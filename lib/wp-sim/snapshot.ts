import { DOC_ROOT, WP_CONTENT } from "@/lib/wp-sim/model";

// A compact copy of an intern's WordPress site for mentors (in the browser).
// It's the same zip WordPress Playground restores sites from, made smaller:
//
// - Stock themes and plugins the intern didn't change (Twenty Twenty-Five,
//   Akismet…) are left out: Playground puts them back from the fresh site
//   the mentor opens it in (an export without formatVersion 2 asks for
//   that). They're most of a site's size.
// - Playground's own runtime files are left out (it always uses its own).
// - Large JPEG uploads are re-encoded at a lower quality, same dimensions,
//   so the page HTML still matches them.
// - Every file is deflate-compressed; the database compresses very well.
//
// A typical exercise site comes to a few hundred KB, instead of 10+ MB.

type Php = {
  run(request: { code: string }): Promise<{ text: string }>;
  readFileAsBuffer(path: string): Promise<Uint8Array>;
  readFileAsText(path: string): Promise<string>;
  absoluteUrl: Promise<string> | string;
};

/** Restored by Playground when missing (see importWordPressFiles). */
const STOCK = [
  "plugins/akismet",
  "plugins/hello.php",
  "plugins/wordpress-importer",
  "themes/twentytwenty",
  "themes/twentytwentyone",
  "themes/twentytwentytwo",
  "themes/twentytwentythree",
  "themes/twentytwentyfour",
  "themes/twentytwentyfive",
  "themes/twentytwentysix",
];
/** Playground's own files, which it never takes from an import. */
const RUNTIME = [
  "mu-plugins/sqlite-database-integration",
  "mu-plugins/playground-includes",
  "mu-plugins/0-playground.php",
  "mu-plugins/0-sqlite.php",
];
/** Files bigger than this (videos, archives) are left out. */
const MAX_FILE_BYTES = 8 * 1024 * 1024;
/** JPEGs bigger than this are re-encoded. */
const RECOMPRESS_JPEG_OVER = 150 * 1024;
/** A stock folder counts as changed if a file in it is this much newer than the rest. */
const CHANGED_AFTER_SECONDS = 120;

const LIST_SCRIPT = `<?php
$root = ${JSON.stringify(WP_CONTENT)};
$out = [];
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
foreach ($it as $file) {
  if (!$file->isFile()) continue;
  $out[] = [substr($file->getPathname(), strlen($root) + 1), $file->getSize(), $file->getMTime()];
}
echo json_encode($out);`;

const within = (path: string, folder: string) => path === folder || path.startsWith(`${folder}/`);

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function smallerJpeg(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: "image/jpeg" }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
    if (!blob || blob.size >= bytes.length) return bytes;
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return bytes;
  }
}

// --------------------------------------------------------------- zip writer

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

/** A zip of the entries, each deflated (or stored, when that's smaller). */
async function zip(entries: Array<{ name: string; bytes: Uint8Array }>): Promise<Blob> {
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const encoder = new TextEncoder();
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const compressed = await deflate(entry.bytes);
    const deflated = compressed !== null && compressed.length < entry.bytes.length;
    const data = deflated ? compressed : entry.bytes;
    const crc = crc32(entry.bytes);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, deflated ? 8 : 0, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, entry.bytes.length, true);
    local.setUint16(26, name.length, true);
    parts.push(local.buffer, name as BlobPart, data as BlobPart);

    const header = new DataView(new ArrayBuffer(46));
    header.setUint32(0, 0x02014b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 20, true);
    header.setUint16(8, 0x0800, true);
    header.setUint16(10, deflated ? 8 : 0, true);
    header.setUint32(16, crc, true);
    header.setUint32(20, data.length, true);
    header.setUint32(24, entry.bytes.length, true);
    header.setUint16(28, name.length, true);
    header.setUint32(42, offset, true);
    central.push(new Uint8Array(header.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...(central as BlobPart[]), end.buffer], { type: "application/zip" });
}

// ------------------------------------------------------------------ snapshot

/**
 * The site as a compact zip. `edited`: files the intern saved in the lab's
 * editor (paths in wp-content), so a stock theme they changed is kept.
 */
export async function buildWpSnapshot(wp: Php, edited: Iterable<string>): Promise<Blob> {
  const listed = JSON.parse((await wp.run({ code: LIST_SCRIPT })).text) as Array<[string, number, number]>;
  const editedPaths = [...edited];

  // Stock folders the intern changed (edited in the lab, or a file in it
  // saved well after the rest, e.g. from WordPress's own theme editor).
  const keepStock = new Set(
    STOCK.filter((folder) => {
      const files = listed.filter(([path]) => within(path, folder));
      if (!files.length) return false;
      if (editedPaths.some((path) => within(path, folder))) return true;
      const usual = median(files.map(([, , mtime]) => mtime));
      return files.some(([, , mtime]) => mtime - usual > CHANGED_AFTER_SECONDS);
    }),
  );

  const entries: Array<{ name: string; bytes: Uint8Array }> = [];
  for (const [path, size] of listed) {
    if (RUNTIME.some((folder) => within(path, folder))) continue;
    const stock = STOCK.find((folder) => within(path, folder));
    if (stock && !keepStock.has(stock)) continue;
    if (size > MAX_FILE_BYTES) continue;
    let bytes = await wp.readFileAsBuffer(`${WP_CONTENT}/${path}`);
    // Playground's database drop-in (it brings its own).
    if (path === "db.php" && new TextDecoder().decode(bytes).includes("SQLite")) continue;
    if (/^uploads\/.+\.jpe?g$/i.test(path) && bytes.length > RECOMPRESS_JPEG_OVER) bytes = await smallerJpeg(bytes);
    entries.push({ name: `wp-content/${path}`, bytes });
  }

  const encoder = new TextEncoder();
  try {
    entries.push({ name: "wp-config.php", bytes: await wp.readFileAsBuffer(`${DOC_ROOT}/wp-config.php`) });
  } catch {
    // Playground writes its own.
  }
  // No formatVersion: Playground then restores the stock folders left out.
  entries.push({
    name: "playground-export.json",
    bytes: encoder.encode(JSON.stringify({ siteUrl: await wp.absoluteUrl })),
  });
  return zip(entries);
}

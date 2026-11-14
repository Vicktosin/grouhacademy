// One-off: copies uploaded files (avatars, images, banners, lab-media) from the
// OLD Supabase project (unqeyyxzmlpnjiwtmtov, retired after it ran out of
// egress) into the project the app now uses.
//
//   npx tsx scripts/copy-storage-files.ts
//
// The old project's settings are read from the backup saved during the move
// (snapshots/supabase-move/old.env.local); the new project's from .env.local.
// The old project is only read from. Files already in the new project are
// skipped, so it is safe to run again. The old project's Storage API returns
// HTTP 402 while its quota restriction is active; the script stops early and
// says so in that case.

import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const OLD_FILE = "snapshots/supabase-move/old.env.local";

function load(path: string) {
  if (!existsSync(path)) throw new Error(`${path} not found.`);
  return parse(readFileSync(path));
}

async function main() {
  const old = { ...load("snapshots/supabase-move/old.env"), ...load(OLD_FILE) };
  const next = { ...load(".env"), ...load(".env.local") };
  if (old.NEXT_PUBLIC_SUPABASE_URL === next.NEXT_PUBLIC_SUPABASE_URL)
    throw new Error(".env.local still points at the old project.");

  const opts = { auth: { autoRefreshToken: false, persistSession: false } };
  const source = createClient(old.NEXT_PUBLIC_SUPABASE_URL, old.SUPABASE_SERVICE_ROLE_KEY, opts).storage;
  const target = createClient(next.NEXT_PUBLIC_SUPABASE_URL, next.SUPABASE_SERVICE_ROLE_KEY, opts).storage;

  // The old database is still reachable even while its APIs are restricted.
  const db = new pg.Client({ connectionString: old.DIRECT_URL });
  await db.connect();
  await db.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
  const { rows } = await db.query<{ bucket: string; name: string; mimetype: string | null }>(
    `SELECT bucket_id AS bucket, name, metadata->>'mimetype' AS mimetype
     FROM storage.objects ORDER BY bucket_id, name`,
  );
  await db.end();
  console.log(`${rows.length} files in the old project.`);

  let copied = 0, skipped = 0;
  const failed: string[] = [];
  for (const { bucket, name, mimetype } of rows) {
    const slash = name.lastIndexOf("/");
    const folder = slash === -1 ? "" : name.slice(0, slash);
    const file = name.slice(slash + 1);
    const { data: existing } = await target.from(bucket).list(folder, { search: file });
    if (existing?.some((entry) => entry.name === file)) {
      skipped++;
      continue;
    }

    const { data, error } = await source.from(bucket).download(name);
    if (error || !data) {
      const status = (error as { status?: number } | null)?.status;
      if (status === 402 || /restricted/i.test(error?.message ?? "")) {
        console.error(
          "\n✗ The old project is still restricted (HTTP 402), so its files can't be downloaded yet.\n" +
            "  Run this again after its quota resets or the plan is upgraded.",
        );
        process.exitCode = 1;
        return;
      }
      failed.push(`${bucket}/${name}: ${error?.message ?? "no data"}`);
      continue;
    }

    const { error: uploadError } = await target
      .from(bucket)
      .upload(name, data, { contentType: mimetype ?? data.type, upsert: true });
    if (uploadError) failed.push(`${bucket}/${name}: ${uploadError.message}`);
    else {
      copied++;
      console.log(`✓ ${bucket}/${name}`);
    }
  }

  console.log(`\nCopied ${copied}, already there ${skipped}, failed ${failed.length}.`);
  if (failed.length) {
    console.log(failed.join("\n"));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ADMIN_API_DIR = path.join(process.cwd(), "app", "api", "admin");
const HANDLER = /export async function (GET|POST|PUT|PATCH|DELETE)\b/g;

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.name === "route.ts" ? [full] : [];
  });
}

test("every admin API handler starts with requireAdminApi()", () => {
  const files = routeFiles(ADMIN_API_DIR);
  assert.ok(files.length > 0);

  const unguarded: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const handlers = [...source.matchAll(HANDLER)];
    handlers.forEach((match, index) => {
      const end = handlers[index + 1]?.index ?? source.length;
      const body = source.slice(match.index, end);
      if (!/requireAdminApi\(\)/.test(body))
        unguarded.push(`${path.relative(process.cwd(), file)} ${match[1]}`);
    });
  }

  assert.deepEqual(unguarded, [], "Admin handlers missing requireAdminApi()");
});

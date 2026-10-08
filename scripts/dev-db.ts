// Points local development at a separate (free) Supabase project, so testing
// on your machine no longer uses the live project's egress, logs or data.
//
// One-time setup:
//   1. Create a new Supabase project and fill in .env.dev-db (see that file).
//   2. npm run dev-db -- setup
//        - checks .env.dev-db points somewhere other than the live project
//        - (re)builds the development database from the current schema;
//          anything already in the DEVELOPMENT database is replaced
//        - copies setup and content from live: roles, tracks, levels, fees,
//          cohorts, assessments, courses, resources, tasks, interview setups,
//          lab exercises. No applicants, interns, payments, messages or other
//          personal data; staff authors are replaced by a "Grouh Team" user.
//        - switches `npm run dev` to the new project
//   3. Restart npm run dev, then sign in through /dev/auth test logins.
//
// Afterwards:
//   npm run dev-db -- off      # local dev uses the live project again
//   npm run dev-db -- on       # back to the development project
//   npm run dev-db -- migrate  # apply new migrations to the dev project
//   npm run dev-db -- copy     # copy content from live again (adds new rows)
//   npm run dev-db -- status
//
// Live is only ever read from; every write goes to the development project.
// Production (Vercel) has its own environment variables and is unaffected.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { parse } from "dotenv";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const DEV_FILE = ".env.dev-db";
// Next.js `next dev` gives this file priority over .env.local and .env.
const SWITCH_FILE = ".env.development.local";
const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
] as const;
type Env = Record<(typeof KEYS)[number], string>;

/** Setup and content tables, copied in dependency order. */
const COPY_TABLES = [
  "Role",
  "Permission",
  "RolePermission",
  "InternshipLevel",
  "InternshipProgram",
  "InternshipTrack",
  "InternshipLevelFee",
  "InternshipOnboardingQuestion",
  "InternshipCohort",
  "InternshipAssessment",
  "AssessmentQuestion",
  "AssessmentOption",
  "InternshipModule",
  "InternshipProject",
  "InternshipResource",
  "DashboardBanner",
  "PlatformSettings",
  "CourseCategory",
  "Course",
  "CourseInstructor",
  "CourseModule",
  "ModuleResource",
  "Lesson",
  "LessonResource",
  "Quiz",
  "QuizQuestion",
  "QuizOption",
  "Assignment",
  "InternResource",
  "InternResourceTrack",
  "InternResourceModule",
  "InternResourceModuleMaterial",
  "InternResourceLesson",
  "InternResourceLessonMaterial",
  "InternResourceRecommendation",
  "InterviewSetup",
  "LabScenario",
  "InternshipTask",
  "InternshipFollowUpTemplate",
];
// Stands in for whichever staff member created copied content.
const TEAM_USER_ID = "00000000-0000-4000-8000-00000000c0de";

function readEnvFile(path: string) {
  return existsSync(path) ? parse(readFileSync(path)) : null;
}

function liveEnv(): Env {
  const env = { ...readEnvFile(".env"), ...readEnvFile(".env.local") };
  for (const key of KEYS)
    if (!env[key]) throw new Error(`${key} is missing from .env.local / .env.`);
  return env as Env;
}

/** The role inside a legacy Supabase JWT key (anon or service_role). */
function jwtRole(key: string): string | null {
  try {
    return JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role ?? null;
  } catch {
    return null;
  }
}

function devEnv(): Env {
  const env = readEnvFile(DEV_FILE);
  if (!env) throw new Error(`${DEV_FILE} not found. Fill it in first.`);
  for (const key of KEYS)
    if (!env[key] || env[key].includes("<"))
      throw new Error(`Fill in ${key} in ${DEV_FILE}.`);
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key.startsWith("sb_secret_") && jwtRole(key) !== "service_role")
    throw new Error(
      `${DEV_FILE} SUPABASE_SERVICE_ROLE_KEY is not a service role key (it's the "${jwtRole(key) ?? "unknown"}" key). Copy the service_role (or sb_secret_…) key.`,
    );
  return env as Env;
}

/** The Supabase project ref in a project URL or Postgres connection string. */
function projectRef(value: string) {
  return (
    /https:\/\/([a-z0-9]+)\.supabase\.co/.exec(value)?.[1] ??
    /postgres\.([a-z0-9]+)[:@]/.exec(value)?.[1] ??
    /db\.([a-z0-9]+)\.supabase\.co/.exec(value)?.[1] ??
    value
  );
}

/** Refuses to continue unless every dev value points away from live. */
function assertSeparate(live: Env, dev: Env) {
  const liveRef = projectRef(live.NEXT_PUBLIC_SUPABASE_URL);
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "DATABASE_URL", "DIRECT_URL"] as const) {
    if (projectRef(dev[key]) === liveRef || dev[key] === live[key])
      throw new Error(
        `${DEV_FILE} ${key} points at the LIVE project. Use the new project's value.`,
      );
  }
  if (dev.SUPABASE_SERVICE_ROLE_KEY === live.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error(`${DEV_FILE} SUPABASE_SERVICE_ROLE_KEY is the live key.`);
}

/** Runs a Prisma CLI command against the development database. */
function prisma(dev: Env, args: string, quiet = false) {
  const result = spawnSync(`npx prisma ${args}`, {
    stdio: quiet ? "pipe" : "inherit",
    shell: true,
    encoding: "utf8",
    // Real environment variables win over prisma.config.ts's dotenv load.
    env: { ...process.env, DATABASE_URL: dev.DATABASE_URL, DIRECT_URL: dev.DIRECT_URL },
  });
  if (result.status !== 0)
    throw new Error(`prisma ${args} failed.\n${result.stderr ?? ""}`);
  return result.stdout ?? "";
}

function migrate(dev: Env) {
  console.log("Applying new migrations to the development project…");
  prisma(dev, "migrate deploy");
}

/**
 * Builds the development database from scratch: the old migration history
 * can't be replayed on an empty database (live predates some of it), so the
 * tables are created from the current schema and every migration is then
 * recorded as applied. Future migrations apply normally with `migrate`.
 */
async function rebuildSchema(dev: Env) {
  console.log("Building the development database from the current schema…");
  const sql = prisma(dev, "migrate diff --from-empty --to-schema prisma/schema.prisma --script", true);
  const client = new pg.Client({ connectionString: dev.DIRECT_URL });
  await client.connect();
  try {
    await client.query(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
      GRANT ALL ON SCHEMA public TO postgres, service_role;`);
    await client.query(sql);
  } finally {
    await client.end();
  }
  const migrations = readdirSync("prisma/migrations", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const name of migrations) prisma(dev, `migrate resolve --applied ${name}`, true);
  console.log(`✓ Tables created; ${migrations.length} migrations recorded as applied.`);
}

async function ensureBuckets(dev: Env) {
  const storage = createClient(dev.NEXT_PUBLIC_SUPABASE_URL, dev.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  }).storage;
  for (const bucket of ["avatars", "images", "banners"]) {
    const { data } = await storage.getBucket(bucket);
    if (data) continue;
    const { error } = await storage.createBucket(bucket, { public: true });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
}

type ForeignKey = { table: string; column: string; ref: string };

async function copy(live: Env, dev: Env) {
  const source = new pg.Client({ connectionString: live.DIRECT_URL });
  const target = new pg.Client({ connectionString: dev.DIRECT_URL });
  await Promise.all([source.connect(), target.connect()]);
  try {
    // Make the session read-only on live, so nothing here can write to it.
    await source.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");

    const { rows: fks } = await source.query<ForeignKey>(`
      SELECT tc.table_name AS table, kcu.column_name AS column, ccu.table_name AS ref
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`);
    const { rows: nullable } = await source.query<{ table: string; column: string }>(`
      SELECT table_name AS table, column_name AS column FROM information_schema.columns
      WHERE table_schema = 'public' AND is_nullable = 'YES'`);
    const isNullable = new Set(nullable.map((c) => `${c.table}.${c.column}`));

    await target.query(
      `INSERT INTO "User" (id, email, name, "updatedAt")
       VALUES ($1, 'team@grouh.dev.local', 'Grouh Team', now())
       ON CONFLICT DO NOTHING`,
      [TEAM_USER_ID],
    );

    const copied = new Set(COPY_TABLES);
    for (const table of COPY_TABLES) {
      const { rows } = await source.query<{ r: Record<string, unknown> }>(
        `SELECT row_to_json(t) AS r FROM "${table}" t`,
      );
      const links = fks.filter((fk) => fk.table === table);
      const records = rows
        .map(({ r }) => {
          for (const { column, ref } of links) {
            if (r[column] == null || ref === table) continue;
            if (ref === "User") r[column] = TEAM_USER_ID;
            else if (!copied.has(ref)) {
              // Points at personal data that isn't copied.
              if (!isNullable.has(`${table}.${column}`)) return null;
              r[column] = null;
            }
          }
          return r;
        })
        .filter(Boolean);
      // A staff member listed twice on one course collapses to one row.
      let inserted = 0;
      for (let i = 0; i < records.length; i += 200) {
        const result = await target.query(
          `INSERT INTO "${table}"
           SELECT * FROM json_populate_recordset(NULL::"${table}", $1::json)
           ON CONFLICT DO NOTHING`,
          [JSON.stringify(records.slice(i, i + 200))],
        );
        inserted += result.rowCount ?? 0;
      }
      console.log(`${table.padEnd(32)} ${String(inserted).padStart(5)} new of ${rows.length}`);
    }
  } finally {
    await Promise.all([source.end(), target.end()]);
  }
}

function switchOn(dev: Env) {
  const lines = [
    "# Written by scripts/dev-db.ts: `npm run dev` uses the development",
    "# Supabase project. Delete this file (npm run dev-db -- off) to use live.",
    ...KEYS.map((key) => `${key}="${dev[key]}"`),
    'DEV_AUTH_BYPASS="true"',
  ];
  writeFileSync(SWITCH_FILE, `${lines.join("\n")}\n`);
  console.log(`\n✓ npm run dev now uses the development project. Restart it to apply.`);
}

async function main() {
  const command = process.argv[2] ?? "status";
  if (command === "off") {
    rmSync(SWITCH_FILE, { force: true });
    console.log("✓ npm run dev uses the LIVE project again. Restart it to apply.");
    return;
  }
  if (command === "status") {
    const active = readEnvFile(SWITCH_FILE);
    console.log(
      active
        ? `npm run dev uses the DEVELOPMENT project (${projectRef(active.NEXT_PUBLIC_SUPABASE_URL ?? "")}).`
        : "npm run dev uses the LIVE project.",
    );
    return;
  }

  const live = liveEnv();
  const dev = devEnv();
  assertSeparate(live, dev);

  if (command === "setup") {
    await rebuildSchema(dev);
    await ensureBuckets(dev);
    console.log("\nCopying setup and content from live (read-only)…");
    await copy(live, dev);
    switchOn(dev);
  } else if (command === "migrate") migrate(dev);
  else if (command === "copy") await copy(live, dev);
  else if (command === "on") switchOn(dev);
  else throw new Error(`Unknown command "${command}". Use setup, migrate, copy, on, off or status.`);
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});

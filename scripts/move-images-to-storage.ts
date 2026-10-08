// One-time clean-up: moves base64 "data:" images out of database columns
// (User.avatarUrl, Course.thumbnail, InternResource.thumbnail) into the
// public Supabase Storage bucket, saving only the image URL in the column.
// Those inline images are hundreds of KB each and were sent with every query
// that selected them, using up database egress.
//
//   npx tsx scripts/move-images-to-storage.ts           # preview
//   npx tsx scripts/move-images-to-storage.ts --apply   # move them
//
// Before changing anything, --apply writes the original values to a local
// backup file (image-backup-<time>.json, git-ignored) so they can be restored.

import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });

import { writeFileSync } from "node:fs";
import { getPrisma } from "../lib/prisma";
import { isDataImage, uploadDataImage } from "../lib/stored-images";

const apply = process.argv.includes("--apply");
const kb = (value: string) => `${Math.round(value.length / 1024)} KB`;

async function main() {
  const prisma = getPrisma();
  const dataFilter = { startsWith: "data:image/" };
  const [users, courses, resources] = await Promise.all([
    prisma.user.findMany({
      where: { avatarUrl: dataFilter },
      select: { id: true, email: true, avatarUrl: true },
    }),
    prisma.course.findMany({
      where: { thumbnail: dataFilter },
      select: { id: true, title: true, thumbnail: true },
    }),
    prisma.internResource.findMany({
      where: { thumbnail: dataFilter },
      select: { id: true, title: true, thumbnail: true },
    }),
  ]);

  const jobs = [
    ...users.map((u) => ({
      kind: "User.avatarUrl",
      id: u.id,
      label: u.email,
      value: u.avatarUrl!,
      folder: `avatars/${u.id}`,
      save: (url: string) =>
        prisma.user.update({ where: { id: u.id }, data: { avatarUrl: url } }),
    })),
    ...courses.map((c) => ({
      kind: "Course.thumbnail",
      id: c.id,
      label: c.title,
      value: c.thumbnail!,
      folder: "course-thumbnails",
      save: (url: string) =>
        prisma.course.update({ where: { id: c.id }, data: { thumbnail: url } }),
    })),
    ...resources.map((r) => ({
      kind: "InternResource.thumbnail",
      id: r.id,
      label: r.title,
      value: r.thumbnail!,
      folder: "resource-thumbnails",
      save: (url: string) =>
        prisma.internResource.update({
          where: { id: r.id },
          data: { thumbnail: url },
        }),
    })),
  ].filter((job) => isDataImage(job.value));

  if (!jobs.length) {
    console.log("No inline images found. Nothing to do.");
    return;
  }
  for (const job of jobs)
    console.log(`${job.kind.padEnd(26)} ${kb(job.value).padStart(8)}  ${job.label}`);
  if (!apply) {
    console.log(`\n${jobs.length} image(s) would move. Run with --apply to move them.`);
    return;
  }

  const backup = `image-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(
    backup,
    JSON.stringify(jobs.map(({ kind, id, value }) => ({ kind, id, value }))),
  );
  console.log(`\nOriginals backed up to ${backup}`);

  let moved = 0;
  for (const job of jobs) {
    try {
      const url = await uploadDataImage(job.value, job.folder);
      await job.save(url);
      moved++;
      console.log(`✓ ${job.kind} ${job.label} → ${url}`);
    } catch (error) {
      console.error(`✗ ${job.kind} ${job.label}:`, error instanceof Error ? error.message : error);
    }
  }
  console.log(`\nMoved ${moved} of ${jobs.length}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());

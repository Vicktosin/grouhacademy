// One-off: sorts existing learner accounts into the two separate sides
// (internship / courses) by what each person has actually used.
//
//   npx tsx scripts/separate-learner-roles.ts           # preview only
//   npx tsx scripts/separate-learner-roles.ts --apply   # make the changes
//
// Rules (staff and /dev/auth test accounts are left untouched):
// - internship application, or neither application nor courses → INTERN
// - course enrolment or course certificate → STUDENT
// - STUDENT is removed from accounts that never used courses (sign-up used
//   to give it to everyone)
// Run it at the same time as deploying the separated sign-up/login code.

import "dotenv/config";
import fs from "node:fs";
import { RoleName } from "../generated/prisma/client";
import { getPrisma } from "../lib/prisma";

const STAFF: string[] = [RoleName.ADMIN, RoleName.INSTRUCTOR, RoleName.MENTOR];
const apply = process.argv.includes("--apply");

async function main() {
  const prisma = getPrisma();
  const [studentRole, internRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { name: RoleName.STUDENT } }),
    prisma.role.findUniqueOrThrow({ where: { name: RoleName.INTERN } }),
  ]);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      roles: { select: { roleId: true, role: { select: { name: true } } } },
      _count: {
        select: {
          internshipApplications: true,
          enrollments: true,
          certificates: true,
        },
      },
    },
  });

  const addIntern: string[] = [];
  const addStudent: string[] = [];
  const removeStudent: string[] = [];
  const summary = { interns: 0, students: 0, both: 0, skipped: 0 };

  for (const user of users) {
    const roles = user.roles.map((r) => r.role.name as string);
    if (
      user.email.endsWith("@developer.local") ||
      roles.some((role) => STAFF.includes(role))
    ) {
      summary.skipped += 1;
      continue;
    }
    const usedInternship = user._count.internshipApplications > 0;
    const usedCourses =
      user._count.enrollments > 0 || user._count.certificates > 0;
    const intern = usedInternship || !usedCourses;
    const student = usedCourses;

    if (intern && student) summary.both += 1;
    else if (intern) summary.interns += 1;
    else summary.students += 1;

    if (intern && !roles.includes(RoleName.INTERN)) addIntern.push(user.id);
    if (student && !roles.includes(RoleName.STUDENT)) addStudent.push(user.id);
    if (!student && roles.includes(RoleName.STUDENT))
      removeStudent.push(user.id);
  }

  console.log("Accounts after sorting:", summary);
  console.log({
    "add intern role": addIntern.length,
    "add student role": addStudent.length,
    "remove student role": removeStudent.length,
  });

  if (!apply) {
    console.log("\nPreview only. Re-run with --apply to make these changes.");
    return;
  }

  const backup = `learner-roles-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  fs.writeFileSync(
    backup,
    JSON.stringify(
      users.map((u) => ({
        userId: u.id,
        roles: u.roles.map((r) => r.role.name),
      })),
      null,
      2,
    ),
  );
  console.log(`Saved everyone's current roles to ${backup}`);

  await prisma.$transaction([
    prisma.userRole.createMany({
      data: addIntern.map((userId) => ({ userId, roleId: internRole.id })),
      skipDuplicates: true,
    }),
    prisma.userRole.createMany({
      data: addStudent.map((userId) => ({ userId, roleId: studentRole.id })),
      skipDuplicates: true,
    }),
    prisma.userRole.deleteMany({
      where: { roleId: studentRole.id, userId: { in: removeStudent } },
    }),
  ]);
  console.log("Done.");
}

main()
  .catch((error) => {
    console.error("Sorting failed; nothing was changed:", error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());

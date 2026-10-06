// Gives an existing account the Admin role, so it opens the admin
// workspace after login. Accounts without it are turned away from /admin
// and end up on the learner (internship) side instead.
//
//   npx tsx scripts/grant-admin.ts someone@example.com           # preview
//   npx tsx scripts/grant-admin.ts someone@example.com --apply   # grant
//   npx tsx scripts/grant-admin.ts someone@example.com --revoke --apply
//
// The person must have signed up (or logged in once) first, so their
// account exists. They should log out and back in afterwards.

import "dotenv/config";
import { RoleName } from "../generated/prisma/client";
import { getPrisma } from "../lib/prisma";

const args = process.argv.slice(2);
const email = args.find((arg) => !arg.startsWith("--"))?.trim().toLowerCase();
const apply = args.includes("--apply");
const revoke = args.includes("--revoke");

async function main() {
  if (!email) {
    console.error("Usage: npx tsx scripts/grant-admin.ts <email> [--apply] [--revoke]");
    process.exitCode = 1;
    return;
  }
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      email: true,
      status: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });
  if (!user) {
    console.error(
      `✖ No account for ${email}. Ask them to sign up or log in once, then run this again.`,
    );
    process.exitCode = 1;
    return;
  }

  const roles = user.roles.map((item) => item.role.name);
  const isAdmin = roles.includes(RoleName.ADMIN);
  console.log(`${user.email} (${user.status}) has roles: ${roles.join(", ") || "none"}`);

  if (revoke ? !isAdmin : isAdmin) {
    console.log(revoke ? "Not an admin; nothing to do." : "Already an admin; nothing to do.");
    return;
  }
  if (!apply) {
    console.log(
      `Preview only: would ${revoke ? "remove" : "add"} the Admin role. Re-run with --apply to do it.`,
    );
    return;
  }

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: RoleName.ADMIN },
    select: { id: true },
  });
  if (revoke)
    await prisma.userRole.delete({
      where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    });
  else
    await prisma.userRole.create({
      data: { userId: user.id, roleId: adminRole.id },
    });
  console.log(
    `✔ ${revoke ? "Removed" : "Added"} the Admin role for ${user.email}. They should log out and log back in.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => getPrisma().$disconnect());

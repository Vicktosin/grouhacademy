import { RoleName } from "@/generated/prisma/client";
import { requireRouteAccess } from "@/lib/route-guards";
import { userHasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Support Admin | SabiRole",
};

// The Support Admin workspace. Its pages reuse the admin's internship pages
// (AdminShell switches to the support sidebar and links under /support);
// the shared APIs refuse what only admins may do.
export default async function SupportAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await requireRouteAccess({
    requiredRoles: [RoleName.ADMIN, RoleName.SUPPORT_ADMIN],
  });
  if (await userHasRole(userId, RoleName.ADMIN)) redirect("/admin/internship");

  return children;
}

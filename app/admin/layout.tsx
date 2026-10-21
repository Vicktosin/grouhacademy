import { RoleName } from "@/generated/prisma/client";
import { requireRouteAccess } from "@/lib/route-guards";
import { userHasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await requireRouteAccess({
    requiredRoles: [RoleName.ADMIN, RoleName.SUPPORT_ADMIN],
  });
  // Support Admins have their own workspace (app/support).
  if (!(await userHasRole(userId, RoleName.ADMIN))) redirect("/support");

  return children;
}

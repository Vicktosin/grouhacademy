import React from "react";
import { RoleName } from "@/generated/prisma/client";
import StudentShell from "../../components/StudentShell";
import { requireRouteAccess } from "@/lib/route-guards";

export const metadata = {
  title: "Student Dashboard",
};

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The courses side is separate from the internship: any student can use
  // it. Others (e.g. interns) are sent to the courses login, where the same
  // account can join the courses.
  await requireRouteAccess({
    requiredRoles: [RoleName.STUDENT],
    redirectTo: "/courses/login",
  });

  return <StudentShell>{children}</StudentShell>;
}

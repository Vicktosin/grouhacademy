import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/route-guards";
import { hasInternshipWorkspaceAccess } from "@/lib/internship-access";
import { getPrisma } from "@/lib/prisma";

export default async function InternshipDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  if (!(await hasInternshipWorkspaceAccess(userId))) {
    const application = await getPrisma().internshipApplication.findFirst({
      where: { studentId: userId },
      include: {
        // Only attempts at the application's current level: an applicant
        // who moved to a lower level hasn't sat that level's exam yet.
        attempts: {
          where: { status: { in: ["PASSED", "FAILED"] } },
          select: { assessment: { select: { levelId: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    redirect(
      application?.attempts.some(
        (attempt) => attempt.assessment?.levelId === application.levelId,
      )
        ? "/internship/results"
        : application
          ? "/internship/assessment/readiness"
          : "/internship/onboarding",
    );
  }
  return children;
}

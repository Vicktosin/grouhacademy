import { UserRound } from "lucide-react";
import { RoleName } from "@/generated/prisma/client";
import MentorInternsTable from "@/components/MentorInternsTable";
import { MentorPage } from "@/components/MentorPage";
import { getMentorInterns, NEEDS_ATTENTION_BELOW } from "@/lib/mentor-data";
import { requireRouteAccess } from "@/lib/route-guards";

export default async function MentorInternsPage() {
  const mentorId = await requireRouteAccess({
    requiredRoles: [RoleName.MENTOR],
  });
  const interns = await getMentorInterns(mentorId);

  return (
    <MentorPage
      title="My Interns"
      description="The interns assigned to your supervision, with their track, cohort and task progress. Contact an administrator to change assignments."
    >
      <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2 text-sm font-bold text-[#1C1D52]">
          <UserRound className="h-4 w-4 text-[#5FBB46]" />
          {interns.length} intern{interns.length === 1 ? "" : "s"} assigned to
          you
        </div>
        <MentorInternsTable
          interns={interns.map((intern) => ({
            key: `${intern.internId}-${intern.programId}`,
            internId: intern.internId,
            name: intern.name,
            email: intern.email,
            programName: intern.programName,
            cohortName: intern.cohortName,
            progressPercent: intern.progressPercent,
            completedTasks: intern.completedTasks,
            totalTasks: intern.totalTasks,
            needsAttention: intern.progressPercent < NEEDS_ATTENTION_BELOW,
          }))}
        />
      </section>
    </MentorPage>
  );
}

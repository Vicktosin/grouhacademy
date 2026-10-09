import { FileText } from "lucide-react";
import Link from "next/link";
import { RoleName } from "@/generated/prisma/client";
import MentorSubmissionsList from "@/components/MentorSubmissionsList";
import { MentorPage } from "@/components/MentorPage";
import {
  getMentorInterns,
  SUBMISSION_LABELS,
  submissionsForInterns,
} from "@/lib/mentor-data";
import { getPrisma } from "@/lib/prisma";
import { requireRouteAccess } from "@/lib/route-guards";

function formatSubmitted(date: Date) {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function MentorSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string }>;
}) {
  const mentorId = await requireRouteAccess({
    requiredRoles: [RoleName.MENTOR],
  });
  const { task: taskId } = await searchParams;
  const interns = await getMentorInterns(mentorId);
  const internNames = new Map(interns.map((i) => [i.internId, i.name]));

  const submissions = await getPrisma().taskSubmission.findMany({
    where: {
      ...submissionsForInterns(interns),
      ...(taskId ? { taskId } : {}),
    },
    orderBy: { submittedAt: "desc" },
    take: 200,
    select: {
      id: true,
      userId: true,
      content: true,
      fileUrl: true,
      status: true,
      score: true,
      feedback: true,
      submittedAt: true,
      reviewedById: true,
      reviewedBy: { select: { name: true, email: true } },
      user: { select: { name: true, email: true } },
      group: { select: { number: true } },
      participants: {
        select: { user: { select: { name: true, email: true } } },
      },
      task: {
        select: {
          title: true,
          maxScore: true,
          module: { select: { title: true } },
        },
      },
    },
  });
  const filteredTaskTitle = taskId ? submissions[0]?.task.title : null;

  return (
    <MentorPage
      title="Submissions"
      description="Review task submissions from your interns. Accept the work, or send it back with feedback so they can resubmit."
    >
      <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-[#5FBB46]" />
          <h2 className="text-sm font-bold text-[#1C1D52]">
            {taskId
              ? `Submissions for ${filteredTaskTitle ?? "this task"}`
              : "Task submissions"}
          </h2>
          {taskId && (
            <Link
              href="/mentor/submissions"
              className="text-[10px] font-bold text-blue-600"
            >
              Show all tasks
            </Link>
          )}
        </div>
        <MentorSubmissionsList
          submissions={submissions.map((submission) => ({
            id: submission.id,
            // Group work shows the group, who submitted it, and who took part.
            internName: submission.group
              ? `Group ${submission.group.number} · submitted by ${submission.user.name?.trim() || submission.user.email} · participants: ${submission.participants.map((p) => p.user.name?.trim() || p.user.email).join(", ")}`
              : (internNames.get(submission.userId) ?? "Intern"),
            taskTitle: submission.task.title,
            moduleTitle: submission.task.module.title,
            content: submission.content,
            // Only link to web URLs; never render javascript: or data: links.
            fileUrl:
              submission.fileUrl && /^https?:\/\//i.test(submission.fileUrl)
                ? submission.fileUrl
                : null,
            submittedLabel: formatSubmitted(submission.submittedAt),
            status: submission.status,
            statusLabel: SUBMISSION_LABELS[submission.status].label,
            statusTone: SUBMISSION_LABELS[submission.status].tone,
            score: submission.score,
            maxScore: submission.task.maxScore,
            feedback: submission.feedback,
            gradedBy:
              submission.reviewedById === mentorId
                ? "you"
                : submission.reviewedBy
                  ? submission.reviewedBy.name?.trim() || submission.reviewedBy.email
                  : null,
            // Mentors may change grades they gave (see lib/submission-grading).
            canChangeGrade: submission.reviewedById === mentorId,
          }))}
        />
      </section>
    </MentorPage>
  );
}

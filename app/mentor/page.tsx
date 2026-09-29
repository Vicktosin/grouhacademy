import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  MessageCircle,
  Users,
} from "lucide-react";
import Link from "next/link";
import { RoleName } from "@/generated/prisma/client";
import { MentorPage, MentorStat, MentorBadge } from "@/components/MentorPage";
import {
  getMentorInterns,
  NEEDS_ATTENTION_BELOW,
  submissionsForInterns,
} from "@/lib/mentor-data";
import { getPrisma } from "@/lib/prisma";
import { requireRouteAccess } from "@/lib/route-guards";

export default async function MentorDashboardPage() {
  const mentorId = await requireRouteAccess({
    requiredRoles: [RoleName.MENTOR],
  });
  const prisma = getPrisma();
  const interns = await getMentorInterns(mentorId);
  const programIds = [...new Set(interns.map((intern) => intern.programId))];
  const submissionScope = submissionsForInterns(interns);

  const [pendingReviews, acceptedTasks, openTasks, unreadMessages] =
    await Promise.all([
      prisma.taskSubmission.count({
        where: {
          ...submissionScope,
          status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
        },
      }),
      prisma.taskSubmission.count({
        where: { ...submissionScope, status: "ACCEPTED" },
      }),
      prisma.internshipTask.count({
        where: { module: { programId: { in: programIds } } },
      }),
      prisma.message.count({
        where: {
          conversation: { mentorId },
          senderId: { not: mentorId },
          readAt: null,
        },
      }),
    ]);

  const averageProgress = interns.length
    ? Math.round(
        interns.reduce((sum, intern) => sum + intern.progressPercent, 0) /
          interns.length,
      )
    : 0;
  const needingAttention = [...interns]
    .filter((intern) => intern.progressPercent < NEEDS_ATTENTION_BELOW)
    .sort((a, b) => a.progressPercent - b.progressPercent)
    .slice(0, 3);

  return (
    <MentorPage
      title="Mentor Dashboard"
      description="Supervise your interns, review their work, and keep every learner moving forward."
    >
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MentorStat
          label="Assigned interns"
          value={String(interns.length)}
          detail={`Across ${programIds.length} track${programIds.length === 1 ? "" : "s"}`}
        />
        <MentorStat
          label="Awaiting review"
          value={String(pendingReviews)}
          detail="Task submissions"
        />
        <MentorStat
          label="Tasks in your tracks"
          value={String(openTasks)}
          detail={`${acceptedTasks} accepted submission${acceptedTasks === 1 ? "" : "s"}`}
        />
        <MentorStat
          label="Average progress"
          value={`${averageProgress}%`}
          detail="Across your interns"
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#1C1D52]">
                Interns needing attention
              </h2>
              <p className="mt-1 text-[10px] text-slate-500">
                Interns below {NEEDS_ATTENTION_BELOW}% progress, lowest first.
              </p>
            </div>
            <Link
              href="/mentor/interns"
              className="text-xs font-bold text-[#5FBB46]"
            >
              View all
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {interns.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                No interns are assigned to you yet.
              </p>
            ) : needingAttention.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                All your interns are at {NEEDS_ATTENTION_BELOW}% progress or
                above.
              </p>
            ) : (
              needingAttention.map((intern) => (
                <div
                  key={`${intern.internId}-${intern.programId}`}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-[#1C1D52]">
                      {intern.name}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {intern.programName} · {intern.progressPercent}% complete
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <MentorBadge tone="amber">Needs attention</MentorBadge>
                    <Link
                      href={`/mentor/messages?intern=${intern.internId}`}
                      className="text-[10px] font-bold text-blue-600"
                    >
                      Message
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        <section className="rounded-2xl bg-[#1C1D52] p-5 text-white shadow-sm sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9be28a]">
            Mentor pulse
          </p>
          <h2 className="mt-3 text-xl font-bold">Your supervision overview</h2>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {(
              [
                [Users, String(interns.length), "Interns"],
                [ClipboardCheck, String(pendingReviews), "To review"],
                [CheckCircle2, String(acceptedTasks), "Tasks accepted"],
                [MessageCircle, String(unreadMessages), "Unread messages"],
              ] as const
            ).map(([Icon, value, label]) => (
              <div key={label} className="rounded-xl bg-white/10 p-3">
                <Icon className="h-4 w-4 text-[#9be28a]" />
                <strong className="mt-3 block text-lg">{value}</strong>
                <span className="text-[10px] text-white/60">{label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/mentor/submissions"
          className="rounded-2xl bg-white p-5 shadow-sm"
        >
          <FileText className="h-5 w-5 text-[#5FBB46]" />
          <h3 className="mt-3 text-sm font-bold text-[#1C1D52]">
            Review submissions
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {pendingReviews === 0
              ? "Nothing waiting for review."
              : `${pendingReviews} submission${pendingReviews === 1 ? "" : "s"} waiting for review.`}
          </p>
        </Link>
        <Link
          href="/mentor/messages"
          className="rounded-2xl bg-white p-5 shadow-sm"
        >
          <MessageCircle className="h-5 w-5 text-amber-500" />
          <h3 className="mt-3 text-sm font-bold text-[#1C1D52]">Messages</h3>
          <p className="mt-1 text-xs text-slate-500">
            {unreadMessages === 0
              ? "You're all caught up."
              : `${unreadMessages} unread message${unreadMessages === 1 ? "" : "s"} from your interns.`}
          </p>
        </Link>
        <Link
          href="/mentor/analytics"
          className="rounded-2xl bg-white p-5 shadow-sm"
        >
          <BarChart3 className="h-5 w-5 text-blue-500" />
          <h3 className="mt-3 text-sm font-bold text-[#1C1D52]">Analytics</h3>
          <p className="mt-1 text-xs text-slate-500">
            Assessment results and progress for your interns.
          </p>
        </Link>
      </div>
    </MentorPage>
  );
}

import { randomUUID } from "node:crypto";
import {
  AuditActionType,
  InternshipApplicationStatus,
  InternshipPaymentStatus,
  Prisma,
  type PrismaClient,
  RoleName,
  UserStatus,
} from "@/generated/prisma/client";
import { reassignLeaderIfNeeded } from "@/lib/internship-groups";
import { artifactKeys, deleteArtifacts } from "@/lib/lab-artifacts";
import { LAB_MEDIA_BUCKET } from "@/lib/lab-media";
import { getPrisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Permanently deleting a learner's account: their sign-in and everything the
// app holds about them, together, so neither is left behind without the other
// (a record without a sign-in locks its owner out if they come back).
//
// Money already received stays on the books: paid applications move to a
// nameless placeholder, so revenue and affiliate earnings don't change.

const LEARNER_ROLES: RoleName[] = [RoleName.INTERN, RoleName.STUDENT];

/** The placeholder that keeps a deleted learner's payments. */
export const DELETED_EMAIL_DOMAIN = "@deleted.invalid";

export class AccountDeletionError extends Error {
  constructor(
    message: string,
    readonly status = 409,
  ) {
    super(message);
  }
}

type Db = PrismaClient | Prisma.TransactionClient;

export type DeletionSummary = {
  userId: string;
  name: string;
  email: string;
  tracks: string[];
  submissions: number;
  messages: number;
  testimonials: number;
  paidAmount: number;
  /** Why this account can't be deleted; null when it can. */
  blockedReason: string | null;
};

const paid = { OR: [{ status: InternshipPaymentStatus.PAID }, { paidAt: { not: null } }] };

/** What deleting the account would remove, and whether it's allowed. */
export async function deletionSummary(userId: string, db: Db = getPrisma()): Promise<DeletionSummary> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      isPreview: true,
      roles: { select: { role: { select: { name: true } } } },
      internshipApplications: {
        select: { program: { select: { name: true } }, level: { select: { name: true } }, payment: { select: { amount: true, status: true, paidAt: true } } },
      },
      payments: { where: paid, select: { amount: true } },
      instructorProfile: { select: { id: true } },
      mentorProfile: { select: { id: true } },
      affiliateProfile: { select: { _count: { select: { commissions: true, payouts: true } } } },
      _count: {
        select: {
          taskSubmissions: true,
          sentMessages: true,
          sentGroupMessages: true,
          testimonials: true,
          certificates: true,
          internshipCertificates: true,
          createdCourses: true,
          courseInstructors: true,
          financeEntries: true,
          sentAnnouncements: true,
          mentorAssignments: true,
          mentorConversations: true,
        },
      },
    },
  });
  if (!user || user.email.endsWith(DELETED_EMAIL_DOMAIN))
    throw new AccountDeletionError("Account not found. It may already be deleted.", 404);

  const n = user._count;
  const earnings = user.affiliateProfile?._count;
  let blockedReason: string | null = null;
  if (
    user.isPreview ||
    user.instructorProfile ||
    user.mentorProfile ||
    user.roles.some(({ role }) => !LEARNER_ROLES.includes(role.name)) ||
    n.createdCourses + n.courseInstructors + n.financeEntries + n.sentAnnouncements + n.mentorAssignments + n.mentorConversations > 0
  )
    blockedReason = "This is a staff account, or has done staff work. Only learner accounts can be deleted here.";
  else if (n.certificates + n.internshipCertificates > 0)
    blockedReason = "This person has a SabiRole certificate. Employers can check it online, so the account must stay. You can remove them from the internship instead.";
  else if (earnings && earnings.commissions + earnings.payouts > 0)
    blockedReason = "This person has affiliate earnings, so the account must stay. You can remove them from the internship instead.";

  return {
    userId,
    name: user.name ?? "Unnamed",
    email: user.email,
    tracks: user.internshipApplications.map((item) => `${item.program.name} (${item.level.name})`),
    submissions: n.taskSubmissions,
    messages: n.sentMessages + n.sentGroupMessages,
    testimonials: n.testimonials,
    paidAmount:
      user.payments.reduce((sum, item) => sum + item.amount, 0) +
      user.internshipApplications.reduce(
        (sum, { payment }) => sum + (payment && (payment.status === "PAID" || payment.paidAt) ? payment.amount : 0),
        0,
      ),
    blockedReason,
  };
}

/** Deletes the Supabase sign-in; one that's already gone is fine. */
async function deleteSupabaseLogin(userId: string) {
  const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(userId);
  if (error && error.status !== 404) throw new AccountDeletionError(`The sign-in couldn't be deleted, so nothing was: ${error.message}`, 502);
}

/** Best effort, once the records are gone: files nobody can reach any more. */
async function deleteFiles(userId: string, artifacts: string[], urls: (string | null)[]) {
  try {
    await deleteArtifacts(artifacts);
    const storage = createSupabaseAdminClient().storage;
    for (const folder of [`lab-ads/${userId}`, `share-photos/${userId}`]) {
      const { data } = await storage.from(LAB_MEDIA_BUCKET).list(folder, { limit: 1000 });
      if (data?.length) await storage.from(LAB_MEDIA_BUCKET).remove(data.map((file) => `${folder}/${file.name}`));
    }
    for (const url of urls) {
      const match = /\/storage\/v1\/object\/public\/([^/]+)\/([^?#]+)/.exec(url ?? "");
      if (match) await storage.from(match[1]).remove([decodeURIComponent(match[2])]);
    }
  } catch (error) {
    console.error("[account-deletion] Some files couldn't be deleted.", error);
  }
}

type Options = {
  /** The email the admin was shown: a mix-up deletes nobody. */
  confirmEmail: string;
  adminId: string;
};

export async function deleteLearnerAccount(
  userId: string,
  { confirmEmail, adminId }: Options,
  db: PrismaClient = getPrisma(),
  deleteLogin: (userId: string) => Promise<void> = deleteSupabaseLogin,
  removeFiles: typeof deleteFiles = deleteFiles,
) {
  const files = await db.$transaction(
    async (tx) => {
      // Nothing about this person changes (a payment, say) until we're done.
      await tx.$queryRaw`select id from "User" where id = ${userId}::uuid for update`;
      await tx.$queryRaw`select p.id from "InternshipPayment" p join "InternshipApplication" a on a.id = p."applicationId" where a."studentId" = ${userId}::uuid for update of p`;

      const summary = await deletionSummary(userId, tx);
      if (summary.email.toLowerCase() !== confirmEmail.trim().toLowerCase())
        throw new AccountDeletionError("That email doesn't match this account. Nothing was deleted.", 400);
      if (summary.blockedReason) throw new AccountDeletionError(summary.blockedReason);

      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          avatarUrl: true,
          internshipApplications: { select: { id: true, payment: { select: { status: true, paidAt: true } } } },
          testimonials: { select: { voiceNoteUrl: true, flyerUrl: true } },
        },
      });
      const applicationIds = user.internshipApplications.map(({ id }) => id);

      // Their groups carry on without them.
      const memberships = await tx.internshipGroupMember.findMany({ where: { userId }, select: { groupId: true } });
      await tx.internshipGroupMember.deleteMany({ where: { userId } });
      for (const { groupId } of memberships) await reassignLeaderIfNeeded(tx, groupId);

      // Meetings they set up stay on their group's calendar.
      for (const meeting of await tx.groupMeeting.findMany({
        where: { createdById: userId },
        select: { id: true, group: { select: { leaderId: true, members: { orderBy: { joinedAt: "asc" }, take: 1, select: { userId: true } } } } },
      })) {
        const heir = [meeting.group.leaderId, meeting.group.members[0]?.userId].find((id) => id && id !== userId);
        if (heir) await tx.groupMeeting.update({ where: { id: meeting.id }, data: { createdById: heir } });
      }

      // Group work they handed in belongs to the teammates on it too.
      const artifacts: string[] = [];
      for (const submission of await tx.taskSubmission.findMany({
        where: { userId },
        select: { id: true, taskId: true, labArtifacts: true, participants: { where: { userId: { not: userId } }, select: { userId: true } } },
      })) {
        const taken = new Set(
          (await tx.taskSubmission.findMany({
            where: { taskId: submission.taskId, userId: { in: submission.participants.map((item) => item.userId) } },
            select: { userId: true },
          })).map((item) => item.userId),
        );
        const heir = submission.participants.find((item) => !taken.has(item.userId));
        if (heir) await tx.taskSubmission.update({ where: { id: submission.id }, data: { userId: heir.userId } });
        else artifacts.push(...artifactKeys(submission.labArtifacts));
      }

      const uploads = await tx.assessmentUpload.findMany({ where: { attempt: { applicationId: { in: applicationIds } } }, select: { fileUrl: true } });
      const attempts = { attempt: { applicationId: { in: applicationIds } } };
      await tx.assessmentAnswer.deleteMany({ where: attempts });
      await tx.assessmentUpload.deleteMany({ where: attempts });
      await tx.assessmentAttempt.deleteMany({ where: { applicationId: { in: applicationIds } } });
      const own = { applicationId: { in: applicationIds } };
      await tx.internshipTask.deleteMany({ where: own });
      await tx.internshipFollowUpLog.deleteMany({ where: own });
      await tx.internshipFollowUp.deleteMany({ where: own });
      await tx.internTestimonial.deleteMany({ where: { OR: [own, { userId }] } });

      const paidIds = user.internshipApplications.filter(({ payment }) => payment && (payment.status === "PAID" || payment.paidAt)).map(({ id }) => id);
      const paidCourses = await tx.payment.count({ where: { userId, ...paid } });
      if (paidIds.length || paidCourses) {
        const id = randomUUID();
        await tx.user.create({
          data: { id, email: `deleted-${id}${DELETED_EMAIL_DOMAIN}`, name: "Deleted intern", status: UserStatus.SUSPENDED },
        });
        await tx.internshipApplication.updateMany({
          where: { id: { in: paidIds } },
          data: { studentId: id, status: InternshipApplicationStatus.REMOVED, cohortId: null, onboardingAnswers: Prisma.DbNull },
        });
        await tx.payment.updateMany({ where: { userId, ...paid }, data: { userId: id } });
        await tx.affiliateReferral.updateMany({ where: { referredUserId: userId }, data: { referredUserId: id } });
        await tx.referralAttribution.updateMany({ where: { referredUserId: userId }, data: { referredUserId: id } });
      }
      await tx.internshipPayment.deleteMany({ where: { applicationId: { in: applicationIds.filter((id) => !paidIds.includes(id)) } } });
      await tx.referralAttribution.deleteMany({ where: { referrerId: userId } });

      await tx.user.delete({ where: { id: userId } });
      // No name or email: the log says that it happened, not who it was.
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: AuditActionType.USER_DELETED,
          resourceType: "User",
          resourceId: userId,
          details: { paymentsKept: paidIds.length + paidCourses },
        },
      });

      // Last, so a failure here undoes everything above.
      await deleteLogin(userId);
      return {
        artifacts,
        urls: [user.avatarUrl, ...user.testimonials.flatMap((item) => [item.voiceNoteUrl, item.flyerUrl]), ...uploads.map((item) => item.fileUrl)],
      };
    },
    { maxWait: 10_000, timeout: 45_000 },
  );
  await removeFiles(userId, files.artifacts, files.urls);
}

export type AccountFilter = "all" | "missing" | "dormant";
export const DORMANT_DAYS = 60;

/** Learner accounts for the admin's Accounts page, longest unseen first. */
export async function listLearnerAccounts(filter: AccountFilter, search: string, db: Db = getPrisma()) {
  const like = `%${search.trim().replace(/[\\%_]/g, "\\$&")}%`;
  const only =
    filter === "missing"
      ? Prisma.sql`and a.id is null`
      : filter === "dormant"
        ? Prisma.sql`and not exists(select 1 from "InternshipApplication" ap join "InternshipPayment" p on p."applicationId" = ap.id where ap."studentId" = u.id and p.status = 'PAID') and coalesce(seen.at, u."createdAt") < now() - make_interval(days => ${DORMANT_DAYS}::int)`
        : Prisma.empty;
  return db.$queryRaw<
    { id: string; name: string | null; email: string; registered: Date; lastSeen: Date | null; loginMissing: boolean; paid: boolean; tracks: string | null }[]
  >`
    select u.id, u.name, u.email, u."createdAt" as registered, seen.at as "lastSeen", a.id is null as "loginMissing",
      exists(select 1 from "InternshipApplication" ap join "InternshipPayment" p on p."applicationId" = ap.id where ap."studentId" = u.id and p.status = 'PAID') as paid,
      (select string_agg(distinct pr.name, ', ') from "InternshipApplication" ap join "InternshipProgram" pr on pr.id = ap."programId" where ap."studentId" = u.id) as tracks
    from "User" u
    left join auth.users a on a.id = u.id
    left join lateral (
      select greatest(a.last_sign_in_at, (select max(s.updated_at) from auth.sessions s where s.user_id = u.id)) as at
    ) seen on true
    where u."isPreview" = false
      and u.email not like ${"%" + DELETED_EMAIL_DOMAIN}
      and not exists(select 1 from "UserRole" ur join "Role" r on r.id = ur."roleId" where ur."userId" = u.id and r.name not in ('INTERN', 'STUDENT'))
      and (u.email ilike ${like} or coalesce(u.name, '') ilike ${like})
      ${only}
    order by coalesce(seen.at, u."createdAt") asc
    limit 100`;
}

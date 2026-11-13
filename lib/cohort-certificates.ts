import type { PrismaClient } from "@/generated/prisma/client";
import { REAL_USER } from "@/lib/real-user";
import {
  internshipCertificateNumber,
  internshipCertificatePrefix,
} from "@/lib/certificate-branding";

// A cohort's interns (roster), and issuing certificates to a whole cohort at
// once (MCP issue_cohort_certificates). Issuing skips anyone who already has
// a certificate for the cohort, so running it again creates no duplicates.
// Each certificate is tied to the intern's application in the cohort, which
// is what the intern's certificate page looks up (lib/internship-progression
// findCertificate), so it can be downloaded straight away.

export type CohortCertificateMode = "submitted_at_least_one" | "all";
export const COHORT_CERTIFICATE_MODES: CohortCertificateMode[] = ["submitted_at_least_one", "all"];

export type CohortMember = {
  applicationId: string;
  userId: string;
  name: string;
  email: string;
  status: "ACTIVE" | "ON_HOLD" | "REMOVED";
  paid: boolean;
  /** Group name, e.g. "Group 3" (null: not in a group). */
  group: string | null;
  /** Work handed in on this cohort's tasks (not drafts), own or as a group. */
  submissionCount: number;
  /** Their certificate for this cohort, if any (revoked ones included). */
  existingCertificate: { id: string; certificateNumber: string; revoked: boolean } | null;
};

export type CohortCertificateRow = {
  name: string;
  email: string;
  userId: string;
  applicationId: string;
  certificateNumber: string | null;
  result: "issued" | "skipped";
  reason?: string;
};

/** Whether a member gets a certificate in this run, and if not, why. */
export function planCohortCertificate(
  member: CohortMember,
  mode: CohortCertificateMode,
): { issue: true } | { issue: false; reason: string } {
  if (member.existingCertificate && !member.existingCertificate.revoked)
    return { issue: false, reason: "Already has a certificate for this cohort." };
  if (member.existingCertificate?.revoked)
    return {
      issue: false,
      reason: "Their certificate for this cohort was revoked. Reinstate it from the admin Certificates page instead.",
    };
  if (member.status === "REMOVED") return { issue: false, reason: "Removed from the internship." };
  if (member.status === "ON_HOLD") return { issue: false, reason: "Application is on hold." };
  if (!member.paid) return { issue: false, reason: "Acceptance fee not paid." };
  if (mode === "submitted_at_least_one" && member.submissionCount < 1)
    return { issue: false, reason: "No submissions in this cohort." };
  return { issue: true };
}

/** What issuing needs from the database (a fake one in tests). */
export type CohortCertificateStore = {
  getCohort(cohortId: string): Promise<{ id: string; name: string; programId: string } | null>;
  listMembers(cohortId: string): Promise<CohortMember[]>;
  certificatePrefix(): Promise<string>;
  /** Creates it unless the application already has a valid one. */
  createCertificate(input: {
    userId: string;
    programId: string;
    applicationId: string;
    title: string;
    certificateNumber: string;
  }): Promise<{ id: string; certificateNumber: string; created: boolean }>;
  /** The intern's usual "certificate is ready" notification (never throws). */
  notify(certificateId: string): Promise<void>;
};

export async function issueCohortCertificates(
  store: CohortCertificateStore,
  { cohortId, title, mode }: { cohortId: string; title: string; mode: CohortCertificateMode },
): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      cohort: { id: string; name: string };
      summary: { issued: number; skipped: number };
      rows: CohortCertificateRow[];
    }
> {
  const cleanTitle = title.trim();
  if (!cleanTitle || cleanTitle.length > 200)
    return { ok: false, error: "Give the certificate a title (up to 200 characters)." };
  if (!COHORT_CERTIFICATE_MODES.includes(mode))
    return { ok: false, error: 'mode must be "submitted_at_least_one" or "all".' };

  const cohort = await store.getCohort(cohortId);
  if (!cohort) return { ok: false, error: "Cohort not found." };

  const [members, prefix] = await Promise.all([store.listMembers(cohortId), store.certificatePrefix()]);
  const rows: CohortCertificateRow[] = [];
  const issuedIds: string[] = [];

  for (const member of members) {
    const base = {
      name: member.name,
      email: member.email,
      userId: member.userId,
      applicationId: member.applicationId,
    };
    const plan = planCohortCertificate(member, mode);
    if (!plan.issue) {
      rows.push({
        ...base,
        certificateNumber: member.existingCertificate?.certificateNumber ?? null,
        result: "skipped",
        reason: plan.reason,
      });
      continue;
    }
    const certificate = await store.createCertificate({
      userId: member.userId,
      programId: cohort.programId,
      applicationId: member.applicationId,
      title: cleanTitle,
      certificateNumber: internshipCertificateNumber(prefix),
    });
    if (certificate.created) {
      issuedIds.push(certificate.id);
      rows.push({ ...base, certificateNumber: certificate.certificateNumber, result: "issued" });
    } else {
      // Issued meanwhile (e.g. the intern opened their certificate page).
      rows.push({
        ...base,
        certificateNumber: certificate.certificateNumber,
        result: "skipped",
        reason: "Already has a certificate for this cohort.",
      });
    }
  }

  // Notify a few at a time: each can send an email.
  for (let i = 0; i < issuedIds.length; i += 5)
    await Promise.all(issuedIds.slice(i, i + 5).map((id) => store.notify(id)));

  return {
    ok: true,
    cohort: { id: cohort.id, name: cohort.name },
    summary: {
      issued: rows.filter((r) => r.result === "issued").length,
      skipped: rows.filter((r) => r.result === "skipped").length,
    },
    rows,
  };
}

function displayName(user: {
  name: string | null;
  email: string;
  profile: { firstName: string | null; lastName: string | null } | null;
}) {
  return (
    [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" ").trim() ||
    user.name?.trim() ||
    user.email
  );
}

/**
 * Everyone placed in the cohort (real users, not admins' preview interns),
 * with their group, submissions and any certificate for the cohort.
 */
export async function loadCohortRoster(db: PrismaClient, cohortId: string): Promise<CohortMember[]> {
  const cohort = await db.internshipCohort.findUnique({
    where: { id: cohortId },
    select: { programId: true, poolId: true },
  });
  if (!cohort) return [];

  const applications = await db.internshipApplication.findMany({
    where: { cohortId, student: REAL_USER },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      studentId: true,
      status: true,
      payment: { select: { status: true } },
      level: { select: { rank: true } },
      student: {
        select: {
          name: true,
          email: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
      certificates: {
        orderBy: { issuedAt: "desc" },
        select: { id: true, certificateNumber: true, revokedAt: true },
      },
    },
  });
  const userIds = applications.map((a) => a.studentId);
  if (userIds.length === 0) return [];

  const [legacyCertificates, groupMemberships, submissions] = await Promise.all([
    // Certificates from before levels existed have no application; they
    // count for first-level cohorts on the same track (as findCertificate).
    db.internshipCertificate.findMany({
      where: { userId: { in: userIds }, applicationId: null, programId: cohort.programId },
      orderBy: { issuedAt: "desc" },
      select: { id: true, userId: true, certificateNumber: true, revokedAt: true },
    }),
    db.internshipGroupMember.findMany({
      where: { userId: { in: userIds }, programId: cohort.programId },
      select: { userId: true, group: { select: { number: true, poolId: true } } },
    }),
    db.taskSubmission.findMany({
      where: {
        status: { not: "DRAFT" },
        task: {
          OR: [{ cohortId }, ...(cohort.poolId ? [{ poolId: cohort.poolId }] : [])],
        },
        OR: [
          { groupId: null, userId: { in: userIds } },
          { groupId: { not: null }, participants: { some: { userId: { in: userIds } } } },
        ],
      },
      select: { userId: true, groupId: true, participants: { select: { userId: true } } },
    }),
  ]);

  const submissionCount = new Map<string, number>();
  for (const submission of submissions) {
    const credited = submission.groupId
      ? submission.participants.map((p) => p.userId)
      : [submission.userId];
    for (const userId of new Set(credited))
      submissionCount.set(userId, (submissionCount.get(userId) ?? 0) + 1);
  }
  const groupOf = new Map(
    groupMemberships.map((m) => [
      m.userId,
      `${m.group.poolId ? "Pool group" : "Group"} ${m.group.number}`,
    ]),
  );

  return applications.map((application) => {
    const own = application.certificates[0];
    const legacy =
      application.level.rank === 1
        ? legacyCertificates.find((c) => c.userId === application.studentId)
        : undefined;
    // A valid certificate wins over a revoked one.
    const candidates = [own, legacy].filter((c): c is NonNullable<typeof c> => Boolean(c));
    const certificate = candidates.find((c) => !c.revokedAt) ?? candidates[0] ?? null;
    return {
      applicationId: application.id,
      userId: application.studentId,
      name: displayName(application.student),
      email: application.student.email,
      status: application.status,
      paid: application.payment?.status === "PAID",
      group: groupOf.get(application.studentId) ?? null,
      submissionCount: submissionCount.get(application.studentId) ?? 0,
      existingCertificate: certificate
        ? { id: certificate.id, certificateNumber: certificate.certificateNumber, revoked: Boolean(certificate.revokedAt) }
        : null,
    };
  });
}

/** The real database behind issueCohortCertificates. */
export function prismaCohortCertificateStore(
  db: PrismaClient,
  notify: (certificateId: string) => Promise<void>,
): CohortCertificateStore {
  return {
    getCohort: (cohortId) =>
      db.internshipCohort.findUnique({
        where: { id: cohortId },
        select: { id: true, name: true, programId: true },
      }),
    listMembers: (cohortId) => loadCohortRoster(db, cohortId),
    certificatePrefix: () => internshipCertificatePrefix(db),
    createCertificate: (input) =>
      db.$transaction(async (tx) => {
        const existing = await tx.internshipCertificate.findFirst({
          where: { applicationId: input.applicationId, revokedAt: null },
          select: { id: true, certificateNumber: true },
        });
        if (existing) return { ...existing, created: false };
        const created = await tx.internshipCertificate.create({
          data: input,
          select: { id: true, certificateNumber: true },
        });
        return { ...created, created: true };
      }),
    notify,
  };
}

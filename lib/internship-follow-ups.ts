import { FollowUpStage, RoleName } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { loadAcceptanceFees } from "@/lib/internship-levels";
import { getSiteUrl } from "@/lib/site-url";
import {
  DEFAULT_TEMPLATES,
  toWhatsAppNumber,
  type FollowUpStageKey,
  type FollowUpValues,
} from "@/lib/follow-up-templates";
import { REAL_USER } from "@/lib/real-user";

// Applicants to follow up: everyone who sat the entrance exam for their
// current level but hasn't paid, split into those who passed (and need to
// pay) and those who failed (and could retake or go a level lower), plus
// those who started paying without an exam result (NO_EXAM).
// Applicants already admitted to the same track, and queued level-ups, are
// left out.

/** Where applicants log in. Messages go to real people, so never localhost. */
const PUBLIC_SITE_URL = "https://grouhacademy.com";

function publicSiteUrl() {
  const configured = getSiteUrl();
  return /localhost|127\.0\.0\.1|vercel\.app/.test(configured)
    ? PUBLIC_SITE_URL
    : configured;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });
}

/** "That's just a few hours to go!", "…just 2 days to go!" and so on. */
function countdownTo(date: Date) {
  const hours = (date.getTime() - Date.now()) / 3_600_000;
  if (hours < 24) return "That's just a few hours to go!";
  const days = Math.round(hours / 24);
  if (days === 1) return "That's just 1 day to go!";
  return days <= 7 ? `That's just ${days} days to go!` : `That's ${days} days to go.`;
}

function formatNaira(amount: number | null) {
  return amount === null ? "" : `₦${amount.toLocaleString("en-NG")}`;
}

/**
 * Onboarding question ids holding the WhatsApp number and the alternative
 * phone number, found by their wording so renamed questions still work.
 */
export async function phoneQuestionIds() {
  const questions = await getPrisma().internshipOnboardingQuestion.findMany({
    select: { id: true, prompt: true },
  });
  const whatsapp = questions
    .filter((q) => /whats\s*app/i.test(q.prompt))
    .map((q) => q.id);
  const phone = questions
    .filter((q) => !/whats\s*app/i.test(q.prompt) && /phone/i.test(q.prompt))
    .map((q) => q.id);
  return { whatsapp, phone };
}

export function firstAnswer(answers: Record<string, unknown>, ids: string[]) {
  for (const id of ids) {
    const value = answers[id];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Who reached out: the admin team or a Support Admin. */
export type ContactRole = "ADMIN" | "SUPPORT_ADMIN";

export type FollowUpContact = {
  name: string;
  role: ContactRole;
  count: number;
  lastAt: string;
};

/**
 * Everyone who has contacted these applicants, newest first, so admins and
 * Support Admins can see who is already handling whom.
 */
export async function followUpContacts(
  applicationIds: string[],
): Promise<Map<string, FollowUpContact[]>> {
  if (!applicationIds.length) return new Map();
  const prisma = getPrisma();
  const logs = await prisma.internshipFollowUpLog.findMany({
    where: { applicationId: { in: applicationIds }, adminId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: {
      applicationId: true,
      adminId: true,
      createdAt: true,
      admin: { select: { name: true, email: true } },
    },
  });
  // Someone with both roles counts as the admin team.
  const roleOf = new Map<string, ContactRole>();
  for (const { userId, role } of await prisma.userRole.findMany({
    where: {
      userId: { in: [...new Set(logs.map((log) => log.adminId!))] },
      role: { name: { in: [RoleName.ADMIN, RoleName.SUPPORT_ADMIN] } },
    },
    select: { userId: true, role: { select: { name: true } } },
  }))
    if (roleOf.get(userId) !== "ADMIN")
      roleOf.set(userId, role.name === RoleName.ADMIN ? "ADMIN" : "SUPPORT_ADMIN");

  // Logs are newest first, so each person's first log is their latest.
  const byApplication = new Map<string, Map<string, FollowUpContact>>();
  for (const log of logs) {
    const adminId = log.adminId!;
    const people = byApplication.get(log.applicationId) ?? new Map();
    const contact = people.get(adminId);
    if (contact) contact.count += 1;
    else
      people.set(adminId, {
        name: log.admin?.name?.trim() || log.admin?.email || "Former team member",
        role: roleOf.get(adminId) ?? "ADMIN",
        count: 1,
        lastAt: log.createdAt.toISOString(),
      });
    byApplication.set(log.applicationId, people);
  }
  return new Map(
    [...byApplication].map(([id, people]) => [id, [...people.values()]]),
  );
}

export type FollowUpRow = {
  applicationId: string;
  stage: FollowUpStageKey;
  name: string;
  firstName: string;
  email: string;
  whatsapp: string | null;
  whatsappNumber: string | null;
  phone: string | null;
  phoneNumber: string | null;
  programId: string;
  track: string;
  levelId: string;
  level: string;
  fee: number | null;
  score: number | null;
  passMark: number | null;
  attempts: number;
  /** When they passed (PASSED_UNPAID), last failed (FAILED) or started paying (NO_EXAM). */
  examDate: string | null;
  /** Payment was started but not completed. */
  triedToPay: boolean;
  /** Where that payment stands, or null if they never started paying. */
  paymentStatus: "PENDING" | "FAILED" | "CANCELLED" | null;
  nextCohort: { name: string; startDate: string } | null;
  followUp: {
    status: string;
    note: string | null;
    nextFollowUpAt: string | null;
    lastContactedAt: string | null;
    lastContactedBy: string | null;
    contactCount: number;
    /** Each person who reached out, most recent first. */
    contactedBy: FollowUpContact[];
  };
  values: FollowUpValues;
};

/** Everyone to follow up, or just one application when `applicationId` is given. */
export async function listFollowUps(
  applicationId?: string,
): Promise<FollowUpRow[]> {
  const prisma = getPrisma();
  const [questionIds, feeFor, cohorts] = await Promise.all([
    phoneQuestionIds(),
    loadAcceptanceFees(),
    prisma.internshipCohort.findMany({
      where: { startDate: { gt: new Date() } },
      orderBy: { startDate: "asc" },
      select: { programId: true, levelId: true, name: true, startDate: true },
    }),
  ]);
  const nextCohortFor = new Map<string, (typeof cohorts)[number]>();
  for (const cohort of cohorts) {
    const key = `${cohort.programId}:${cohort.levelId}`;
    if (!nextCohortFor.has(key)) nextCohortFor.set(key, cohort);
  }

  const applications = await prisma.internshipApplication.findMany({
    where: {
      ...(applicationId ? { id: applicationId } : {}),
      student: REAL_USER,
      promotedFromId: null,
      OR: [
        { payment: { is: null } },
        { payment: { is: { status: { not: "PAID" } } } },
      ],
      // Sat the exam, or started paying without it.
      AND: [
        {
          OR: [
            { attempts: { some: { status: { in: ["PASSED", "FAILED"] } } } },
            { payment: { isNot: null } },
          ],
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          profile: {
            select: { firstName: true, lastName: true, phone: true },
          },
        },
      },
      program: true,
      level: { select: { name: true } },
      payment: { select: { status: true, createdAt: true } },
      attempts: {
        where: { status: { in: ["PASSED", "FAILED"] } },
        orderBy: { createdAt: "desc" },
        select: {
          status: true,
          scorePercent: true,
          submittedAt: true,
          createdAt: true,
          assessment: { select: { levelId: true, passingScore: true } },
        },
      },
      followUp: {
        include: { lastContactedBy: { select: { name: true, email: true } } },
      },
    },
  });

  // Skip anyone already admitted to the same track.
  const admitted = new Set(
    (
      await prisma.internshipApplication.findMany({
        where: {
          studentId: { in: applications.map((a) => a.studentId) },
          payment: { is: { status: "PAID" } },
        },
        select: { studentId: true, programId: true },
      })
    ).map((a) => `${a.studentId}:${a.programId}`),
  );

  // Someone who has since moved to another track (or applied again) is
  // followed up on their newest application only.
  const newest = new Map(
    (
      await prisma.internshipApplication.groupBy({
        by: ["studentId"],
        where: { studentId: { in: applications.map((a) => a.studentId) } },
        _max: { createdAt: true },
      })
    ).map((group) => [group.studentId, group._max.createdAt?.getTime()]),
  );

  const contacts = await followUpContacts(applications.map((a) => a.id));
  const loginLink = `${publicSiteUrl()}/login`;
  const rows: FollowUpRow[] = [];
  for (const application of applications) {
    if (admitted.has(`${application.studentId}:${application.programId}`))
      continue;
    if (newest.get(application.studentId) !== application.createdAt.getTime())
      continue;
    // Only attempts at the application's current level count.
    const attempts = application.attempts.filter(
      (attempt) => attempt.assessment?.levelId === application.levelId,
    );
    const passed = attempts.find((attempt) => attempt.status === "PASSED");
    const latest = passed ?? attempts[0];
    // No result at this level: only those who started paying are followed up.
    if (!latest && !application.payment) continue;
    const stage: FollowUpStageKey = passed ? "PASSED_UNPAID" : latest ? "FAILED" : "NO_EXAM";

    const { student } = application;
    const answers = (application.onboardingAnswers ?? {}) as Record<
      string,
      unknown
    >;
    const whatsapp = firstAnswer(answers, questionIds.whatsapp);
    const phone =
      firstAnswer(answers, questionIds.phone) ?? student.profile?.phone ?? null;
    const name =
      [student.profile?.firstName, student.profile?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      student.name?.trim() ||
      student.email;
    const firstName =
      student.profile?.firstName?.trim() || name.split(/\s+/)[0] || "there";
    const fee = feeFor(application.program, application.levelId);
    const passMark = latest?.assessment?.passingScore ?? null;
    const examDate =
      latest?.submittedAt ?? latest?.createdAt ?? application.payment?.createdAt ?? application.createdAt;
    const score = latest?.scorePercent ?? null;
    const nextCohort =
      nextCohortFor.get(`${application.programId}:${application.levelId}`) ??
      null;
    const followUp = application.followUp;

    rows.push({
      applicationId: application.id,
      stage,
      name,
      firstName,
      email: student.email,
      whatsapp,
      whatsappNumber: toWhatsAppNumber(whatsapp) ?? toWhatsAppNumber(phone),
      phone,
      phoneNumber: toWhatsAppNumber(phone),
      programId: application.programId,
      track: application.program.name,
      levelId: application.levelId,
      level: application.level.name,
      fee,
      score,
      passMark,
      attempts: attempts.length,
      examDate: examDate.toISOString(),
      triedToPay: Boolean(application.payment),
      paymentStatus:
        application.payment && application.payment.status !== "PAID"
          ? application.payment.status
          : null,
      nextCohort: nextCohort
        ? {
            name: nextCohort.name,
            startDate: nextCohort.startDate.toISOString(),
          }
        : null,
      followUp: {
        status: followUp?.status ?? "NOT_CONTACTED",
        note: followUp?.note ?? null,
        nextFollowUpAt: followUp?.nextFollowUpAt?.toISOString() ?? null,
        lastContactedAt: followUp?.lastContactedAt?.toISOString() ?? null,
        lastContactedBy:
          followUp?.lastContactedBy?.name ??
          followUp?.lastContactedBy?.email ??
          null,
        contactCount: followUp?.contactCount ?? 0,
        contactedBy: contacts.get(application.id) ?? [],
      },
      values: {
        firstName,
        name,
        track: application.program.name,
        level: application.level.name,
        fee: formatNaira(fee),
        score: score === null ? "" : String(score),
        passMark: passMark === null ? "" : String(passMark),
        nextCohort: nextCohort?.name ?? "the next cohort",
        nextCohortDate: nextCohort ? formatDate(nextCohort.startDate) : "soon",
        countdown: nextCohort
          ? countdownTo(nextCohort.startDate)
          : "Spaces are filling up fast!",
        loginLink,
      },
    });
  }
  return rows;
}

/** The saved message for each stage, or the built-in default. */
export async function getFollowUpTemplates() {
  const saved = await getPrisma().internshipFollowUpTemplate.findMany();
  const byStage = new Map(saved.map((row) => [row.stage, row.body]));
  return {
    PASSED_UNPAID:
      byStage.get("PASSED_UNPAID") ?? DEFAULT_TEMPLATES.PASSED_UNPAID,
    FAILED: byStage.get("FAILED") ?? DEFAULT_TEMPLATES.FAILED,
    NO_EXAM: byStage.get("NO_EXAM") ?? DEFAULT_TEMPLATES.NO_EXAM,
  } satisfies Record<FollowUpStageKey, string>;
}

/** Whether a value from a request is a follow-up list (stage). */
export function isFollowUpStage(value: unknown): value is FollowUpStage {
  return Object.values(FollowUpStage).includes(value as FollowUpStage);
}

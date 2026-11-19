import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { assignApplicationCohort, type CohortDb } from "@/lib/internship-cohort";
import { activateSelfPacedMode, materialiseSelfPacedTasks } from "@/lib/self-paced-tasks";
import {
  automaticModeOnPayment,
  canSwitchToCohort,
  choiceOptions,
  effectiveLearningMode,
  learningStatusLabel,
  type LearningModePolicyValue,
  type LearningModeValue,
} from "@/lib/learning-mode-rules";

// Each intern chooses, per level, to start now at their own pace or join
// the next cohort (rules: lib/learning-mode-rules). Paying decides on its
// own only when one way is allowed (policy or an always-cohort track);
// otherwise the intern sees the choice screen (/internship/choose).

export async function learningModePolicy(db: PrismaClient = getPrisma()): Promise<LearningModePolicyValue> {
  const settings = await db.platformSettings.findFirst({ select: { learningModePolicy: true } });
  return settings?.learningModePolicy ?? "CHOOSE";
}

/** The next cohort of this track and level that hasn't started. */
export function nextUpcomingCohort(programId: string, levelId: string, db: PrismaClient = getPrisma()) {
  return db.internshipCohort.findFirst({
    where: { programId, levelId, startDate: { gt: new Date() } },
    orderBy: { startDate: "asc" },
    select: { id: true, name: true, startDate: true },
  });
}

const applicationSelect = {
  id: true,
  programId: true,
  levelId: true,
  cohortId: true,
  status: true,
  learningMode: true,
  learningModeChosenAt: true,
  cohortWaitlistedAt: true,
  switchedToCohortAt: true,
  selfPacedStartDate: true,
  payment: { select: { status: true } },
  program: { select: { name: true, excludeFromSelfPacedAndPools: true } },
  level: { select: { name: true } },
  cohort: { select: { name: true, startDate: true, endDate: true } },
} as const;

/** The intern's current (newest, not removed) application. */
function currentApplication(userId: string, db: PrismaClient) {
  return db.internshipApplication.findFirst({
    where: { studentId: userId, status: { not: "REMOVED" } },
    orderBy: { createdAt: "desc" },
    select: applicationSelect,
  });
}

/** Everything the choice screen and the dashboard need. */
export async function getLearningModeState(userId: string, db: PrismaClient = getPrisma()) {
  const application = await currentApplication(userId, db);
  if (!application) return null;
  const [policy, nextCohort] = await Promise.all([
    learningModePolicy(db),
    nextUpcomingCohort(application.programId, application.levelId, db),
  ]);
  const input = { policy, programExcluded: application.program.excludeFromSelfPacedAndPools, nextCohort };
  const paid = application.payment?.status === "PAID";
  const mode = effectiveLearningMode(application);
  return {
    applicationId: application.id,
    trackName: application.program.name,
    levelName: application.level.name,
    paid,
    mode,
    status: learningStatusLabel(application),
    /** Paid and not chosen yet: show the choice screen. */
    needsChoice: paid && mode === null,
    options: choiceOptions(input),
    canSwitchToCohort: paid && canSwitchToCohort(application, input),
    switchedToCohortAt: application.switchedToCohortAt?.toISOString() ?? null,
    cohort: application.cohort
      ? { name: application.cohort.name, startDate: application.cohort.startDate.toISOString() }
      : null,
    nextCohort: nextCohort ? { name: nextCohort.name, startDate: nextCohort.startDate.toISOString() } : null,
  };
}

export type LearningModeState = NonNullable<Awaited<ReturnType<typeof getLearningModeState>>>;

type Application = NonNullable<Awaited<ReturnType<typeof currentApplication>>>;

async function startSelfPaced(application: Application, db: PrismaClient) {
  await db.internshipApplication.update({
    where: { id: application.id },
    data: { learningMode: "SELF_PACED", learningModeChosenAt: new Date(), cohortWaitlistedAt: null },
  });
  if (!application.selfPacedStartDate) await activateSelfPacedMode(application.id);
  const fresh = await db.internshipApplication.findUnique({ where: { id: application.id }, select: { selfPacedStartDate: true } });
  if (fresh?.selfPacedStartDate)
    await materialiseSelfPacedTasks(application.id, application.programId, application.levelId, fresh.selfPacedStartDate);
}

async function joinCohort(application: Application, db: PrismaClient, { joining }: { joining: boolean }) {
  await db.internshipApplication.update({
    where: { id: application.id },
    data: { learningMode: "COHORT", learningModeChosenAt: new Date() },
  });
  const cohortId = await assignApplicationCohort(
    db as unknown as CohortDb,
    { ...application, learningMode: "COHORT" },
    { joining },
  );
  // No cohort to join yet: wait for the next one (placed when it's created).
  await db.internshipApplication.update({
    where: { id: application.id },
    data: { cohortWaitlistedAt: cohortId ? null : new Date() },
  });
  return cohortId;
}

export type ChooseResult = { ok: true; mode: LearningModeValue; cohortId: string | null } | { ok: false; error: string };

/** The intern's choice on the choice screen. */
export async function chooseLearningMode(userId: string, mode: LearningModeValue, db: PrismaClient = getPrisma()): Promise<ChooseResult> {
  const application = await currentApplication(userId, db);
  if (!application) return { ok: false, error: "No internship application found." };
  if (application.payment?.status !== "PAID") return { ok: false, error: "Pay your acceptance fee first." };
  if (effectiveLearningMode(application) !== null) return { ok: false, error: "You've already chosen how to learn this level." };
  const [policy, nextCohort] = await Promise.all([
    learningModePolicy(db),
    nextUpcomingCohort(application.programId, application.levelId, db),
  ]);
  const options = choiceOptions({ policy, programExcluded: application.program.excludeFromSelfPacedAndPools, nextCohort });
  if (mode === "SELF_PACED" && !options.selfPaced.available) return { ok: false, error: options.note ?? "Self-paced isn't available." };
  if (mode === "COHORT" && !options.cohort.available) return { ok: false, error: options.note ?? "Cohorts aren't available." };

  if (mode === "SELF_PACED") {
    await startSelfPaced(application, db);
    return { ok: true, mode, cohortId: null };
  }
  return { ok: true, mode, cohortId: await joinCohort(application, db, { joining: true }) };
}

/**
 * A self-paced intern joins the next cohort (once per level). Their
 * self-paced tasks and submissions are kept (shown as earlier work).
 */
export async function switchToCohort(userId: string, db: PrismaClient = getPrisma()): Promise<ChooseResult> {
  const application = await currentApplication(userId, db);
  if (!application) return { ok: false, error: "No internship application found." };
  const [policy, nextCohort] = await Promise.all([
    learningModePolicy(db),
    nextUpcomingCohort(application.programId, application.levelId, db),
  ]);
  const input = { policy, programExcluded: application.program.excludeFromSelfPacedAndPools, nextCohort };
  if (!canSwitchToCohort(application, input))
    return {
      ok: false,
      error: application.switchedToCohortAt
        ? "You've already switched to a cohort for this level."
        : "There's no upcoming cohort to join right now.",
    };
  // Claim the one switch first, so a double tap can't switch twice.
  const claimed = await db.internshipApplication.updateMany({
    where: { id: application.id, switchedToCohortAt: null },
    data: { switchedToCohortAt: new Date() },
  });
  if (!claimed.count) return { ok: false, error: "You've already switched to a cohort for this level." };
  const cohortId = await joinCohort(application, db, { joining: true });
  return { ok: true, mode: "COHORT", cohortId };
}

/**
 * After an acceptance payment is confirmed (verify page, Paystack webhook,
 * admin "mark paid"; whichever comes first, and safe to repeat): settles the
 * learning mode when only one is allowed, else leaves it for the intern.
 * An intern who has already chosen keeps their choice.
 */
export async function settleLearningModeOnPayment(applicationId: string, db: PrismaClient = getPrisma()) {
  const application = await db.internshipApplication.findUnique({ where: { id: applicationId }, select: applicationSelect });
  if (!application || application.payment?.status !== "PAID") return null;
  const current = effectiveLearningMode(application);
  if (current === "COHORT") {
    // Already a cohort intern (or waiting): place them if a cohort exists.
    await assignApplicationCohort(db as unknown as CohortDb, { ...application, learningMode: "COHORT" });
    return "COHORT";
  }
  if (current === "SELF_PACED") return "SELF_PACED";
  const mode = automaticModeOnPayment(await learningModePolicy(db), application.program.excludeFromSelfPacedAndPools);
  if (mode === "SELF_PACED") await startSelfPaced(application, db);
  else if (mode === "COHORT") await joinCohort(application, db, { joining: true });
  return mode;
}

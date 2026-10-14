import type { AchievementTrigger, Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  meetsConditions,
  renderAchievementText,
  type AchievementConditions,
  type AchievementFacts,
} from "@/lib/achievements-shared";

export {
  ACHIEVEMENT_RARITIES,
  ACHIEVEMENT_TRIGGERS,
  AchievementDefinitionInputSchema,
} from "@/lib/achievements-shared";

// Awards achievements for outcomes the server has already verified (an
// accepted task, a graded Office Life step, a submitted lab exercise, a
// promotion). Each award is a snapshot: later edits to a rule never change
// what an intern earned. The intern sees it as a celebration pop-up
// (components/AchievementCelebration) and can share it as a referral card.

type Tx = Prisma.TransactionClient;

type AchievementEvent = AchievementFacts & {
  userId: string;
  programId: string;
  levelId: string;
  trigger: AchievementTrigger;
  /** Identifies this accomplishment, so a repeatable award is given once per accomplishment. */
  activityKey: string;
  track: string;
  level?: string;
  accomplishment: Record<string, string | number | null>;
};

function conditionsFor(definition: { conditions: Prisma.JsonValue }): AchievementConditions {
  return (definition.conditions && typeof definition.conditions === "object" && !Array.isArray(definition.conditions)
    ? definition.conditions
    : {}) as AchievementConditions;
}

function activeDefinitions(tx: Tx, trigger: AchievementTrigger, programId: string, levelId: string) {
  return tx.achievementDefinition.findMany({
    where: {
      isActive: true,
      trigger,
      AND: [
        { OR: [{ programId: null }, { programId }] },
        { OR: [{ levelId: null }, { levelId }] },
      ],
    },
  });
}

/**
 * Awards the rules this event meets; returns how many new awards were made.
 * `best`: score tiers (75%, 90%…): only the highest tier met that's still
 * unearned, so one great grade is one celebration, not several.
 */
async function awardForEvent(tx: Tx, event: AchievementEvent, { best = false } = {}) {
  const definitions = await activeDefinitions(tx, event.trigger, event.programId, event.levelId);
  const eligible = definitions.filter((definition) => meetsConditions(conditionsFor(definition), event));
  if (!eligible.length) return 0;

  const names = { track: event.track, level: event.level };
  const award = (definition: (typeof eligible)[number]) => {
    const minimum = conditionsFor(definition).minCount;
    // A repeatable count fires once per multiple (5, 10, 15 tasks…).
    const count = event.taskCount ?? 0;
    const repeatKey = minimum ? `${event.activityKey}:${minimum}:${Math.floor(count / minimum)}` : event.activityKey;
    return {
      definitionId: definition.id,
      userId: event.userId,
      activityKey: definition.isRepeatable ? repeatKey : "once",
      titleSnapshot: renderAchievementText(definition.title, names),
      descriptionSnapshot: renderAchievementText(definition.description, names),
      messageSnapshot: renderAchievementText(definition.congratulatoryMessage, names),
      categorySnapshot: renderAchievementText(definition.category, names),
      raritySnapshot: definition.rarity,
      iconSnapshot: definition.icon,
      accomplishment: { ...event.accomplishment, track: event.track, level: event.level ?? null },
    };
  };

  if (best) {
    const threshold = (definition: (typeof eligible)[number]) => {
      const conditions = conditionsFor(definition);
      return conditions.minPercent ?? conditions.minScore ?? 0;
    };
    for (const definition of [...eligible].sort((a, b) => threshold(b) - threshold(a))) {
      const { count } = await tx.achievementUnlock.createMany({ data: [award(definition)], skipDuplicates: true });
      if (count) return count;
    }
    return 0;
  }

  const { count } = await tx.achievementUnlock.createMany({ data: eligible.map(award), skipDuplicates: true });
  return count;
}

/**
 * Evaluates only persisted, accepted task outcomes. For group work, callers
 * pass the recorded participants, never an unverified client-supplied list.
 */
export async function awardTaskAchievements(tx: Tx, userId: string, submissionId: string) {
  const submission = await tx.taskSubmission.findUnique({
    where: { id: submissionId },
    select: {
      status: true,
      score: true,
      group: { select: { leaderId: true } },
      task: {
        select: {
          id: true,
          title: true,
          maxScore: true,
          opensWeek: true,
          cohortId: true,
          cohort: { select: { levelId: true, level: { select: { name: true } } } },
          module: { select: { programId: true, program: { select: { name: true } } } },
        },
      },
    },
  });
  if (!submission || submission.status !== "ACCEPTED") return;
  const { task } = submission;
  const percent = submission.score === null || task.maxScore <= 0
    ? null
    : Math.round((submission.score / task.maxScore) * 100);
  const base = {
    userId,
    programId: task.module.programId,
    levelId: task.cohort.levelId,
    track: task.module.program.name,
    level: task.cohort.level.name,
    taskTitle: task.title,
    scorePercent: percent,
    accomplishment: {
      taskTitle: task.title,
      score: submission.score,
      maxScore: task.maxScore,
      scorePercent: percent,
      week: task.opensWeek,
    },
  };

  await awardForEvent(tx, { ...base, trigger: "TASK_ACCEPTED", activityKey: `task:${task.id}` });
  // How well they did: a perfect score, else the highest score tier reached.
  const perfect = percent === 100
    ? await awardForEvent(tx, { ...base, trigger: "PERFECT_SCORE", activityKey: `perfect:${task.id}` })
    : 0;
  if (!perfect)
    await awardForEvent(tx, { ...base, trigger: "SCORE_THRESHOLD", activityKey: `score:${task.id}` }, { best: true });
  if (submission.group?.leaderId === userId) {
    await awardForEvent(tx, { ...base, trigger: "GROUP_LEADERSHIP", activityKey: `group-task:${task.id}` });
  }

  const acceptedBy = {
    status: "ACCEPTED" as const,
    OR: [{ userId }, { participants: { some: { userId } } }],
  };

  const weekDefinitions = await activeDefinitions(tx, "WEEK_COMPLETE", base.programId, base.levelId);
  if (weekDefinitions.some((definition) => meetsConditions(conditionsFor(definition), { weekNumber: task.opensWeek }))) {
    const weekTasks = await tx.internshipTask.findMany({
      where: { cohortId: task.cohortId, opensWeek: task.opensWeek },
      select: { id: true },
    });
    const accepted = await tx.taskSubmission.findMany({
      where: { taskId: { in: weekTasks.map((item) => item.id) }, ...acceptedBy },
      select: { taskId: true },
      distinct: ["taskId"],
    });
    if (weekTasks.length > 0 && accepted.length === weekTasks.length) {
      await awardForEvent(tx, {
        ...base,
        trigger: "WEEK_COMPLETE",
        activityKey: `week:${task.cohortId}:${task.opensWeek}`,
        weekNumber: task.opensWeek,
        accomplishment: { ...base.accomplishment, taskTitle: `Every Week ${task.opensWeek} task done` },
      });
    }
  }

  const countDefinitions = await activeDefinitions(tx, "TASK_COUNT", base.programId, base.levelId);
  if (countDefinitions.length) {
    const done = await tx.taskSubmission.findMany({
      where: { task: { cohortId: task.cohortId }, ...acceptedBy },
      select: { taskId: true },
      distinct: ["taskId"],
    });
    await awardForEvent(tx, {
      ...base,
      trigger: "TASK_COUNT",
      taskCount: done.length,
      activityKey: `task-count:${task.cohortId}`,
      accomplishment: { ...base.accomplishment, taskTitle: `${done.length} tasks accepted` },
    });
  }
}

/** A task the intern (or their group) just handed in, before any grading. */
export async function awardTaskSubmittedAchievements(tx: Tx, submissionId: string) {
  const submission = await tx.taskSubmission.findUnique({
    where: { id: submissionId },
    select: {
      userId: true,
      groupId: true,
      participants: { select: { userId: true } },
      task: {
        select: {
          id: true,
          title: true,
          cohortId: true,
          opensWeek: true,
          cohort: { select: { levelId: true, level: { select: { name: true } } } },
          module: { select: { programId: true, program: { select: { name: true } } } },
        },
      },
    },
  });
  if (!submission) return;
  const { task } = submission;
  const interns = submission.groupId ? submission.participants.map((p) => p.userId) : [submission.userId];
  for (const userId of interns) {
    // Tasks they've handed in this cohort (alone or with their group).
    const handedIn = await tx.taskSubmission.findMany({
      where: {
        task: { cohortId: task.cohortId },
        status: { not: "DRAFT" },
        OR: [{ userId }, { participants: { some: { userId } } }],
      },
      select: { taskId: true },
      distinct: ["taskId"],
    });
    await awardForEvent(tx, {
      userId,
      programId: task.module.programId,
      levelId: task.cohort.levelId,
      track: task.module.program.name,
      level: task.cohort.level.name,
      trigger: "TASK_SUBMITTED",
      activityKey: `submitted:${task.cohortId}`,
      taskTitle: task.title,
      taskCount: handedIn.length,
      accomplishment: { taskTitle: `Submitted: ${task.title}`, week: task.opensWeek },
    });
  }
}

type OfficeLifeEvent = {
  userId: string;
  programId: string;
  levelId: string;
  day: number;
  track: string;
  level: string;
};

export async function awardOfficeLifeClockIn(tx: Tx, event: OfficeLifeEvent) {
  await awardForEvent(tx, {
    ...event,
    trigger: "OFFICE_LIFE_CLOCK_IN",
    activityKey: `office-in:${event.programId}:${event.levelId}:${event.day}`,
    accomplishment: { taskTitle: `Clocked in · Office Life Workday ${event.day}` },
  });
}

const STEP_DONE: Record<string, string> = {
  meeting: "Led a meeting",
  email: "Sent a professional email",
  report: "Delivered a report",
  work: "Shipped a deliverable",
};

/** A graded Office Life step: a meeting, an email, a report or the day's work. */
export async function awardOfficeLifeStep(
  tx: Tx,
  event: OfficeLifeEvent & { stepId: string; stepKind: string; stepTitle: string; score: number | null },
) {
  await awardForEvent(tx, {
    ...event,
    trigger: "OFFICE_LIFE_STEP",
    activityKey: `office-step:${event.programId}:${event.levelId}:${event.day}:${event.stepId}`,
    stepKind: event.stepKind,
    scorePercent: event.score,
    accomplishment: {
      taskTitle: `${STEP_DONE[event.stepKind] ?? "Finished"}: ${event.stepTitle}`,
      score: event.score,
    },
  });
}

export async function awardOfficeLifeAchievement(tx: Tx, event: OfficeLifeEvent & { score: number | null }) {
  await awardForEvent(tx, {
    ...event,
    trigger: "OFFICE_LIFE_COMPLETE",
    activityKey: `office-life:${event.programId}:${event.levelId}:${event.day}`,
    scorePercent: event.score,
    accomplishment: { taskTitle: `Office Life · Workday ${event.day}`, score: event.score },
  });
}

export async function awardLevelUpAchievement(
  tx: Tx,
  event: {
    userId: string;
    programId: string;
    levelId: string;
    levelName: string;
    trackName: string;
    applicationId: string;
  },
) {
  await awardForEvent(tx, {
    userId: event.userId,
    programId: event.programId,
    levelId: event.levelId,
    track: event.trackName,
    level: event.levelName,
    trigger: "LEVEL_UP",
    activityKey: `level:${event.applicationId}`,
    accomplishment: { taskTitle: `Advanced to ${event.levelName}` },
  });
}

/**
 * A submitted Practice Lab exercise, scored from what the server stored: the
 * run score for simulators and backend APIs, else the share of checks passed.
 */
export async function awardLabAchievement(userId: string, scenarioId: string) {
  const prisma = getPrisma();
  const attempt = await prisma.labAttempt.findUnique({
    where: { userId_scenarioId: { userId, scenarioId } },
    select: {
      status: true,
      checksPassed: true,
      checksTotal: true,
      review: true,
      scenario: { select: { title: true, levelId: true } },
    },
  });
  if (!attempt || attempt.status !== "SUBMITTED") return;
  const review = attempt.review && typeof attempt.review === "object" ? (attempt.review as { score?: unknown }) : {};
  const percent = typeof review.score === "number"
    ? Math.round(review.score)
    : attempt.checksTotal
      ? Math.round(((attempt.checksPassed ?? 0) / attempt.checksTotal) * 100)
      : null;

  const application = await prisma.internshipApplication.findFirst({
    where: { studentId: userId, payment: { status: "PAID" } },
    orderBy: [{ level: { rank: "desc" } }, { createdAt: "desc" }],
    select: { programId: true, levelId: true, level: { select: { name: true } }, program: { select: { name: true } } },
  });
  if (!application) return;

  await prisma.$transaction((tx) =>
    awardForEvent(tx, {
      userId,
      programId: application.programId,
      levelId: attempt.scenario.levelId,
      track: application.program.name,
      level: application.level.name,
      trigger: "PRACTICE_LAB_COMPLETE",
      activityKey: `lab:${scenarioId}`,
      scorePercent: percent,
      accomplishment: { taskTitle: `Practice Lab: ${attempt.scenario.title}`, scorePercent: percent },
    }),
  );
}

import { getPrisma } from "@/lib/prisma";

// Internship levels (Beginner → Novice → Intermediate → Advanced → Professional → …), ordered by rank.
// Every intern starts at the lowest-ranked level.

export type InternshipLevelOption = {
  id: string;
  name: string;
  rank: number;
  description: string | null;
};

export function listLevels(): Promise<InternshipLevelOption[]> {
  return getPrisma().internshipLevel.findMany({
    orderBy: { rank: "asc" },
    select: { id: true, name: true, rank: true, description: true },
  });
}

/** The level everyone starts at (lowest rank; currently Beginner). */
export async function getEntryLevel() {
  const level = await getPrisma().internshipLevel.findFirst({
    orderBy: { rank: "asc" },
    select: { id: true, name: true, rank: true },
  });
  if (!level) throw new Error("No internship levels exist.");
  return level;
}

/**
 * The level id from a request body, or the entry level when none was sent.
 * Returns null for an id that isn't a real level.
 */
export async function resolveLevelId(value: unknown) {
  if (value === undefined || value === null || value === "")
    return (await getEntryLevel()).id;
  if (typeof value !== "string") return null;
  const level = await getPrisma().internshipLevel.findUnique({
    where: { id: value },
    select: { id: true },
  });
  return level?.id ?? null;
}

/** The lowest-ranked level's id (Beginner). */
async function entryLevelId() {
  return (await getEntryLevel()).id;
}

/**
 * A track's acceptance fee at a level: Beginner uses the track's own fee, other
 * levels their InternshipLevelFee row. Null means no fee is set, so the
 * level isn't open for that track.
 */
export async function getAcceptanceFee(programId: string, levelId: string) {
  const prisma = getPrisma();
  if (levelId === (await entryLevelId())) {
    const program = await prisma.internshipProgram.findUnique({
      where: { id: programId },
      select: { acceptanceFee: true },
    });
    return program?.acceptanceFee ?? null;
  }
  const fee = await prisma.internshipLevelFee.findUnique({
    where: { programId_levelId: { programId, levelId } },
    select: { acceptanceFee: true },
  });
  return fee?.acceptanceFee ?? null;
}

export type OpenLevel = InternshipLevelOption & {
  acceptanceFee: number;
  assessmentAvailable: boolean;
};

/**
 * The levels applicants can choose for each track: those with a fee set.
 * An entrance assessment is offered when configured, but is optional.
 */
export async function getOpenLevels(
  programIds: string[],
): Promise<Map<string, OpenLevel[]>> {
  const prisma = getPrisma();
  const [levels, programs, fees, assessments] = await Promise.all([
    listLevels(),
    prisma.internshipProgram.findMany({
      where: { id: { in: programIds } },
      select: { id: true, acceptanceFee: true },
    }),
    prisma.internshipLevelFee.findMany({
      where: { programId: { in: programIds } },
    }),
    prisma.internshipAssessment.findMany({
      where: { programId: { in: programIds }, questions: { some: {} } },
      select: { programId: true, levelId: true },
    }),
  ]);
  const entryId = levels[0]?.id;
  const feeFor = new Map(
    fees.map((fee) => [`${fee.programId}:${fee.levelId}`, fee.acceptanceFee]),
  );
  const hasAssessment = new Set(
    assessments.map((item) => `${item.programId}:${item.levelId}`),
  );

  return new Map(
    programs.map((program) => [
      program.id,
      levels.flatMap((level) => {
        const key = `${program.id}:${level.id}`;
        const fee =
          level.id === entryId ? program.acceptanceFee : feeFor.get(key);
        return fee !== undefined
          ? [{ ...level, acceptanceFee: fee, assessmentAvailable: hasAssessment.has(key) }]
          : [];
      }),
    ]),
  );
}

/**
 * Puts an applicant on a track at a level. Until they've paid (been
 * admitted), an applicant has a single application per track that simply
 * moves between levels, e.g. to a lower level after failing an assessment.
 * Paid applications are never changed: they belong to a level the intern
 * has joined.
 */
export async function chooseApplicationLevel(
  userId: string,
  programId: string,
  levelId: string,
  onboardingAnswers?: Record<string, unknown>,
): Promise<{ applicationId: string } | { error: string; status: number }> {
  const open = (await getOpenLevels([programId])).get(programId) ?? [];
  if (!open.some((level) => level.id === levelId))
    return {
      error: "That level isn't open for this track yet.",
      status: 400,
    };

  const prisma = getPrisma();
  const joined = await prisma.internshipApplication.findUnique({
    where: {
      studentId_programId_levelId: { studentId: userId, programId, levelId },
    },
    select: { id: true, payment: { select: { status: true } } },
  });
  if (joined?.payment?.status === "PAID")
    return {
      error: "You've already joined this level of the track.",
      status: 409,
    };

  // The rest of the app treats an applicant's newest application as their
  // current one, so a reused application is made the newest again.
  const answers = {
    createdAt: new Date(),
    ...(onboardingAnswers === undefined
      ? {}
      : { onboardingAnswers: onboardingAnswers as object }),
  };
  if (joined) {
    await prisma.internshipApplication.update({
      where: { id: joined.id },
      data: answers,
    });
    return { applicationId: joined.id };
  }

  // Only an application without a passed assessment may move: a pass counts
  // for the level it was taken at, so moving it would carry the pass to a
  // level the applicant never sat. Otherwise a new application is created.
  const pending = await prisma.internshipApplication.findFirst({
    where: {
      studentId: userId,
      programId,
      attempts: { none: { status: "PASSED" } },
      OR: [
        { payment: { is: null } },
        { payment: { is: { status: { not: "PAID" } } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (pending) {
    await prisma.internshipApplication.update({
      where: { id: pending.id },
      data: { levelId, ...answers },
    });
    return { applicationId: pending.id };
  }

  const created = await prisma.internshipApplication.create({
    data: {
      studentId: userId,
      programId,
      levelId,
      ...(onboardingAnswers === undefined
        ? {}
        : { onboardingAnswers: onboardingAnswers as object }),
    },
    select: { id: true },
  });
  return { applicationId: created.id };
}

/**
 * Loads every level fee once, for pages listing many applications. The
 * returned function gives a track's fee at a level, given the track's own
 * (Entry) fee.
 */
export async function loadAcceptanceFees() {
  const [entryId, fees] = await Promise.all([
    entryLevelId(),
    getPrisma().internshipLevelFee.findMany(),
  ]);
  const byKey = new Map(
    fees.map((fee) => [`${fee.programId}:${fee.levelId}`, fee.acceptanceFee]),
  );
  return (program: { id: string; acceptanceFee: number }, levelId: string) =>
    levelId === entryId
      ? program.acceptanceFee
      : (byKey.get(`${program.id}:${levelId}`) ?? null);
}

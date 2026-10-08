import { getPrisma } from "@/lib/prisma";
import { chooseApplicationLevel, getOpenLevels } from "@/lib/internship-levels";

// Moving an applicant who hasn't paid yet to another track (admin action on
// the Follow-ups page). They don't keep their old pass: they take the new
// track's assessment and then pay that track's fee, which is worked out when
// they pay. Their old application stays as a record.

/** Published tracks with the levels an applicant can be put on, and fees. */
export async function trackChangeOptions() {
  const programs = await getPrisma().internshipProgram.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const open = await getOpenLevels(programs.map((program) => program.id));
  return programs
    .map((program) => ({
      id: program.id,
      name: program.name,
      levels: (open.get(program.id) ?? []).map((level) => ({
        id: level.id,
        name: level.name,
        acceptanceFee: level.acceptanceFee,
      })),
    }))
    .filter((program) => program.levels.length);
}

export async function changeApplicantTrack(
  applicationId: string,
  programId: string,
  levelId: string,
): Promise<{ message: string } | { error: string; status: number }> {
  const prisma = getPrisma();
  const application = await prisma.internshipApplication.findUnique({
    where: { id: applicationId },
    include: { payment: { select: { status: true } } },
  });
  if (!application) return { error: "Applicant not found.", status: 404 };
  if (application.payment?.status === "PAID")
    return {
      error:
        "This person has already paid. Move them from the Interns page instead.",
      status: 409,
    };
  if (application.programId === programId && application.levelId === levelId)
    return { error: "They're already on this track and level.", status: 400 };

  const program = await prisma.internshipProgram.findFirst({
    where: { id: programId, status: "PUBLISHED" },
    select: { name: true },
  });
  if (!program) return { error: "Choose an open track.", status: 400 };

  // Same applicant, new track: their onboarding answers carry over so they
  // can go straight to the new assessment.
  const result = await chooseApplicationLevel(
    application.studentId,
    programId,
    levelId,
    (application.onboardingAnswers as Record<string, unknown> | null) ??
      undefined,
  );
  if ("error" in result) return result;
  return {
    message: `Moved to ${program.name}. When they log in, they'll take the ${program.name} assessment, then pay its fee.`,
  };
}

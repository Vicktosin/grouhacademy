import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/route-guards";
import { getPrisma } from "@/lib/prisma";
import { chooseApplicationLevel } from "@/lib/internship-levels";

/**
 * Moves the applicant's current application down to a lower level after a
 * failed entrance assessment. Body: { levelId }.
 */
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );

  const body = (await request.json().catch(() => null)) as {
    levelId?: unknown;
  } | null;
  const levelId = typeof body?.levelId === "string" ? body.levelId : "";

  const prisma = getPrisma();
  const application = await prisma.internshipApplication.findFirst({
    where: { studentId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      programId: true,
      level: { select: { rank: true } },
      payment: { select: { status: true } },
    },
  });
  if (!application)
    return NextResponse.json(
      { error: "No application found." },
      { status: 404 },
    );
  if (application.payment?.status === "PAID")
    return NextResponse.json(
      { error: "You've already joined this level." },
      { status: 409 },
    );

  const target = levelId
    ? await prisma.internshipLevel.findUnique({
        where: { id: levelId },
        select: { rank: true },
      })
    : null;
  if (!target || target.rank >= application.level.rank)
    return NextResponse.json(
      { error: "Choose a level below your current one." },
      { status: 400 },
    );

  const result = await chooseApplicationLevel(
    userId,
    application.programId,
    levelId,
  );
  if ("error" in result)
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  return NextResponse.json({ applicationId: result.applicationId });
}

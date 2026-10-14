import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { requireAdminApi } from "@/lib/api-guards";
import { AchievementDefinitionInputSchema } from "@/lib/achievements";
import { getPrisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = AchievementDefinitionInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the achievement details." },
      { status: 400 },
    );
  }
  const prisma = getPrisma();
  const existing = await prisma.achievementDefinition.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Achievement not found." }, { status: 404 });
  const input = parsed.data;
  if (input.programId && !(await prisma.internshipProgram.findUnique({ where: { id: input.programId }, select: { id: true } }))) {
    return NextResponse.json({ error: "Choose an existing internship track." }, { status: 400 });
  }
  if (input.levelId && !(await prisma.internshipLevel.findUnique({ where: { id: input.levelId }, select: { id: true } }))) {
    return NextResponse.json({ error: "Choose an existing internship level." }, { status: 400 });
  }

  const definition = await prisma.$transaction(async (tx) => {
    const updated = await tx.achievementDefinition.update({
      where: { id },
      data: {
        ...input,
        conditions: input.conditions as Prisma.InputJsonValue,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: input.isActive ? "ACHIEVEMENT_UPDATED" : "ACHIEVEMENT_DEACTIVATED",
        resourceType: "AchievementDefinition",
        resourceId: id,
        details: { title: updated.title, trigger: updated.trigger, isActive: updated.isActive },
      },
      select: { id: true },
    });
    return updated;
  });
  return NextResponse.json({ definition });
}

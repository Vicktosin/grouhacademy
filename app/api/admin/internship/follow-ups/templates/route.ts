import { NextResponse } from "next/server";
import { FollowUpStage } from "@/generated/prisma/client";
import { requireAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";
import { getFollowUpTemplates } from "@/lib/internship-follow-ups";

/**
 * Saves a stage's message. Body: { stage, body }; an empty body restores
 * the built-in message.
 */
export async function PUT(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const payload = (await request.json().catch(() => null)) as {
    stage?: unknown;
    body?: unknown;
  } | null;
  const stage = payload?.stage;
  if (stage !== FollowUpStage.PASSED_UNPAID && stage !== FollowUpStage.FAILED)
    return NextResponse.json({ error: "Unknown message." }, { status: 400 });
  const body = typeof payload?.body === "string" ? payload.body.trim() : "";
  if (body.length > 4000)
    return NextResponse.json(
      { error: "Keep the message under 4,000 characters." },
      { status: 400 },
    );

  const prisma = getPrisma();
  if (!body)
    await prisma.internshipFollowUpTemplate.deleteMany({ where: { stage } });
  else
    await prisma.internshipFollowUpTemplate.upsert({
      where: { stage },
      create: { stage, body, updatedById: adminId },
      update: { body, updatedById: adminId },
    });
  return NextResponse.json({ templates: await getFollowUpTemplates() });
}

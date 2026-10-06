import { NextResponse } from "next/server";
import {
  FollowUpChannel,
  FollowUpStage,
  FollowUpStatus,
} from "@/generated/prisma/client";
import { requireAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";

type Params = { params: Promise<{ applicationId: string }> };

/**
 * Records that an admin started a WhatsApp message or call.
 * Body: { channel: "WHATSAPP" | "CALL", stage: "PASSED_UNPAID" | "FAILED" }.
 */
export async function POST(request: Request, { params }: Params) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const { applicationId } = await params;

  const body = (await request.json().catch(() => null)) as {
    channel?: unknown;
    stage?: unknown;
  } | null;
  const channel = body?.channel;
  const stage = body?.stage;
  if (
    (channel !== FollowUpChannel.WHATSAPP &&
      channel !== FollowUpChannel.CALL) ||
    (stage !== FollowUpStage.PASSED_UNPAID && stage !== FollowUpStage.FAILED)
  )
    return NextResponse.json({ error: "Invalid contact." }, { status: 400 });

  const prisma = getPrisma();
  const application = await prisma.internshipApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, followUp: { select: { status: true } } },
  });
  if (!application)
    return NextResponse.json(
      { error: "Applicant not found." },
      { status: 404 },
    );

  const now = new Date();
  const [, followUp] = await prisma.$transaction([
    prisma.internshipFollowUpLog.create({
      data: { applicationId, adminId, channel, stage },
    }),
    prisma.internshipFollowUp.upsert({
      where: { applicationId },
      create: {
        applicationId,
        status: FollowUpStatus.CONTACTED,
        lastContactedAt: now,
        lastContactedById: adminId,
        contactCount: 1,
      },
      update: {
        // Reaching out moves "not contacted" on; other statuses were set
        // by an admin on purpose and are kept.
        ...(application.followUp?.status === FollowUpStatus.NOT_CONTACTED
          ? { status: FollowUpStatus.CONTACTED }
          : {}),
        lastContactedAt: now,
        lastContactedById: adminId,
        contactCount: { increment: 1 },
      },
      include: { lastContactedBy: { select: { name: true, email: true } } },
    }),
  ]);

  return NextResponse.json({
    followUp: {
      status: followUp.status,
      lastContactedAt: followUp.lastContactedAt?.toISOString() ?? null,
      lastContactedBy:
        followUp.lastContactedBy?.name ??
        followUp.lastContactedBy?.email ??
        null,
      contactCount: followUp.contactCount,
    },
  });
}

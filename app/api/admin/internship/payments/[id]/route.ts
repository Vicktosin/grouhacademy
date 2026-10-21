import { NextResponse } from "next/server";

import { InternshipPaymentStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  assignApplicationCohort,
  type CohortDb,
} from "@/lib/internship-cohort";
import { requireAdminApi } from "@/lib/api-guards";
import { activatePromotion } from "@/lib/internship-progression";
import { recordAffiliateCommission } from "@/lib/affiliates";

const VALID_STATUSES = new Set<InternshipPaymentStatus>([
  InternshipPaymentStatus.PENDING,
  InternshipPaymentStatus.PAID,
  InternshipPaymentStatus.FAILED,
  InternshipPaymentStatus.CANCELLED,
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const { id } = await params;
  const prisma = getPrisma();

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rawStatus = body.status;
  if (!rawStatus || typeof rawStatus !== "string") {
    return NextResponse.json(
      { error: "A payment status is required." },
      { status: 400 },
    );
  }

  const normalizedStatus = rawStatus.toUpperCase();
  if (!VALID_STATUSES.has(normalizedStatus as InternshipPaymentStatus)) {
    return NextResponse.json(
      { error: "Unsupported payment status." },
      { status: 400 },
    );
  }

  const payment = await prisma.internshipPayment.findUnique({
    where: { id },
    include: {
      application: {
        select: { id: true, programId: true, levelId: true, cohortId: true },
      },
    },
  });
  if (!payment) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  const updatedPayment = await prisma.internshipPayment.update({
    where: { id },
    data: {
      status: normalizedStatus as InternshipPaymentStatus,
      paidAt:
        normalizedStatus === InternshipPaymentStatus.PAID
          ? (payment.paidAt ?? new Date())
          : null,
    },
  });

  if (normalizedStatus === InternshipPaymentStatus.PAID) {
    await assignApplicationCohort(
      prisma as unknown as CohortDb,
      payment.application,
      // Marking it paid again never moves an intern who already joined.
      { joining: payment.status !== InternshipPaymentStatus.PAID },
    );
    // A paid move up to the next level becomes the intern's current level.
    await activatePromotion(payment.application.id);
    await recordAffiliateCommission(updatedPayment.id);
  }

  return NextResponse.json({
    payment: {
      id: updatedPayment.id,
      status: updatedPayment.status,
      paidAt: updatedPayment.paidAt,
    },
  });
}

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";

function formatDate(date: Date | null | undefined) {
  return date
    ? new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date)
    : "Not available";
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const { id } = await params;
  const payment = await getPrisma().internshipPayment.findUnique({
    where: { id },
    include: {
      application: {
        include: {
          student: {
            select: {
              name: true,
              email: true,
              profile: { select: { firstName: true, lastName: true } },
            },
          },
          program: { select: { name: true, acceptanceFee: true } },
          cohort: { select: { name: true, status: true } },
        },
      },
    },
  });

  if (!payment)
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });

  const student = payment.application.student;
  const studentName =
    student.name ||
    [student.profile?.firstName, student.profile?.lastName]
      .filter(Boolean)
      .join(" ") ||
    "Unnamed intern";
  return NextResponse.json({
    payment: {
      id: payment.id,
      reference: payment.reference,
      invoice: payment.reference,
      student: studentName,
      email: student.email,
      track: payment.application.program.name,
      amount: payment.amount,
      amountLabel: formatMoney(payment.amount, payment.currency),
      currency: payment.currency,
      status: payment.status,
      method: "Paystack",
      date: formatDate(payment.paidAt ?? payment.createdAt),
      createdDate: formatDate(payment.createdAt),
      paidDate: formatDate(payment.paidAt),
      cohort: payment.application.cohort?.name ?? "Unassigned",
      cohortStatus: payment.application.cohort?.status ?? null,
      applicationId: payment.applicationId,
    },
  });
}

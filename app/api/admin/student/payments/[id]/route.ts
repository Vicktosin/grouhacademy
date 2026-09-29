import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const { id } = await params;
  const payment = await getPrisma().payment.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      course: { select: { title: true } },
      internshipProgram: { select: { name: true } },
    },
  });

  if (!payment)
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });

  return NextResponse.json({
    payment: {
      id: payment.id,
      reference: payment.reference,
      invoice: payment.reference,
      student: payment.user.name || payment.user.email,
      email: payment.user.email,
      item:
        payment.course?.title ||
        payment.internshipProgram?.name ||
        "Platform payment",
      amount: payment.amount,
      currency: payment.currency || "NGN",
      provider: payment.provider || "Not specified",
      status: payment.status,
      createdAt: payment.createdAt.toISOString(),
      dateLabel: formatDate(payment.paidAt ?? payment.createdAt),
    },
  });
}

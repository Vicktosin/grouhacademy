import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";

export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const payments = await getPrisma().payment.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reference: true,
      amount: true,
      currency: true,
      provider: true,
      status: true,
      createdAt: true,
      paidAt: true,
      user: { select: { name: true, email: true } },
      course: { select: { title: true } },
      internshipProgram: { select: { name: true } },
    },
  });
  return NextResponse.json({
    payments: payments.map((item) => ({
      id: item.id,
      reference: item.reference,
      amount: item.amount,
      currency: item.currency,
      provider: item.provider,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      paidAt: item.paidAt?.toISOString() ?? null,
      student: item.user.name || item.user.email,
      email: item.user.email,
      item:
        item.course?.title ||
        item.internshipProgram?.name ||
        "Platform payment",
    })),
  });
}

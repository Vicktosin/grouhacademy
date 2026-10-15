import { NextResponse } from "next/server";
import { InternshipPaymentStatus } from "@/generated/prisma/client";
import {
  financeEntryInputSchema,
  financeEntryTypeForDatabase,
} from "@/lib/finance-entry-input";
import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";
import type { FinanceEntryCategory } from "@/lib/finance-types";

export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const prisma = getPrisma();
  const paid = { status: InternshipPaymentStatus.PAID };
  const [studentPayments, programPayments, internshipPayments, entries] =
    await Promise.all([
      prisma.payment.findMany({
        where: { ...paid, courseId: { not: null }, programId: null },
        select: {
          id: true,
          reference: true,
          amount: true,
          currency: true,
          paidAt: true,
          createdAt: true,
          course: { select: { title: true } },
        },
        orderBy: { paidAt: "desc" },
      }),
      prisma.payment.findMany({
        where: { ...paid, programId: { not: null }, courseId: null },
        select: {
          id: true,
          reference: true,
          amount: true,
          currency: true,
          paidAt: true,
          createdAt: true,
          internshipProgram: { select: { name: true } },
        },
        orderBy: { paidAt: "desc" },
      }),
      prisma.internshipPayment.findMany({
        where: { status: InternshipPaymentStatus.PAID },
        select: {
          id: true,
          reference: true,
          amount: true,
          currency: true,
          paidAt: true,
          createdAt: true,
          application: { select: { program: { select: { name: true } } } },
        },
        orderBy: { paidAt: "desc" },
      }),
      prisma.financeEntry.findMany({
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      }),
    ]);

  const internshipReferences = new Set(
    internshipPayments.map((payment) => payment.reference),
  );
  const income = [
    ...studentPayments.map((payment) => ({
      id: `student-${payment.id}`,
      kind: "STUDENT_INCOME" as const,
      reference: payment.reference,
      title: payment.course?.title ?? "Student learning",
      amount: payment.amount,
      currency: payment.currency,
      occurredAt: (payment.paidAt ?? payment.createdAt).toISOString(),
    })),
    ...internshipPayments.map((payment) => ({
      id: `internship-${payment.id}`,
      kind: "INTERNSHIP_REVENUE" as const,
      reference: payment.reference,
      title: payment.application.program.name,
      amount: payment.amount,
      currency: payment.currency,
      occurredAt: (payment.paidAt ?? payment.createdAt).toISOString(),
    })),
    ...programPayments
      .filter((payment) => !internshipReferences.has(payment.reference))
      .map((payment) => ({
        id: `internship-program-${payment.id}`,
        kind: "INTERNSHIP_REVENUE" as const,
        reference: payment.reference,
        title: payment.internshipProgram?.name ?? "Internship program",
        amount: payment.amount,
        currency: payment.currency,
        occurredAt: (payment.paidAt ?? payment.createdAt).toISOString(),
      })),
  ].sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  return NextResponse.json({
    income,
    entries: entries.map((entry) => ({
      ...entry,
      type: entry.type as FinanceEntryCategory,
      occurredAt: entry.occurredAt.toISOString(),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = financeEntryInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid finance entry." },
      { status: 400 },
    );
  }

  const entry = await getPrisma().financeEntry.create({
    data: {
      ...parsed.data,
      type: financeEntryTypeForDatabase(parsed.data.type),
      occurredAt: new Date(parsed.data.occurredAt),
      source: parsed.data.source || null,
      adType: parsed.data.type === "AD_SPEND" ? parsed.data.adType : null,
      campaignName:
        parsed.data.type === "AD_SPEND" ? parsed.data.campaignName : null,
      conversions:
        parsed.data.type === "AD_SPEND" ? parsed.data.conversions : null,
      attributedRevenue:
        parsed.data.type === "AD_SPEND" ? parsed.data.attributedRevenue : null,
      createdById: adminId,
    },
  });

  return NextResponse.json(
    {
      entry: {
        ...entry,
        type: entry.type as FinanceEntryCategory,
        occurredAt: entry.occurredAt.toISOString(),
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      },
    },
    { status: 201 },
  );
}

import { NextResponse } from "next/server";
import {
  financeEntryInputSchema,
  financeEntryTypeForDatabase,
} from "@/lib/finance-entry-input";
import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";
import type { FinanceEntryCategory } from "@/lib/finance-types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;
  const prisma = getPrisma();
  const existing = await prisma.financeEntry.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Finance entry not found." }, { status: 404 });
  }

  const entry = await prisma.financeEntry.update({
    where: { id },
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
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({
    entry: {
      ...entry,
      type: entry.type as FinanceEntryCategory,
      occurredAt: entry.occurredAt.toISOString(),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    },
  });
}

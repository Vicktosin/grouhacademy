import { NextResponse } from "next/server";
import { LearnerAudience, NotificationType } from "@/generated/prisma/client";
import { requireAdminApi } from "@/lib/api-guards";
import { naira } from "@/lib/affiliates";
import { getPrisma } from "@/lib/prisma";

/**
 * Body: { id, status: "PAID" | "REJECTED", adminNote? }. Mark a cash-out paid
 * after sending the transfer; declining returns the amount to the balance.
 */
export async function PATCH(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    status?: unknown;
    adminNote?: unknown;
  } | null;
  const status = body?.status;
  if (typeof body?.id !== "string" || (status !== "PAID" && status !== "REJECTED"))
    return NextResponse.json({ error: "Choose a cash-out and a decision." }, { status: 400 });
  const note =
    typeof body.adminNote === "string" && body.adminNote.trim()
      ? body.adminNote.trim().slice(0, 1000)
      : null;

  const prisma = getPrisma();
  const payout = await prisma.affiliatePayout.findUnique({ where: { id: body.id } });
  if (!payout) return NextResponse.json({ error: "Cash-out not found." }, { status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    // Only a pending request changes, even if two admins act at once.
    const changed = await tx.affiliatePayout.updateMany({
      where: { id: payout.id, status: "PENDING" },
      data: { status, processedAt: new Date(), adminNote: note },
    });
    if (changed.count !== 1) return false;
    await tx.notification.create({
      data: {
        userId: payout.affiliateId,
        title: status === "PAID" ? `${naira(payout.amount)} sent to your bank` : "Cash-out declined",
        message:
          status === "PAID"
            ? `Your affiliate cash-out was paid to ${payout.bankName} ${payout.accountNumber}.${note ? ` Note: ${note}` : ""}`
            : `Your cash-out of ${naira(payout.amount)} was declined and is back in your balance.${note ? ` Reason: ${note}` : ""}`,
        type: status === "PAID" ? NotificationType.SUCCESS : NotificationType.WARNING,
        audience: LearnerAudience.INTERNSHIP,
      },
    });
    return true;
  });
  if (!updated)
    return NextResponse.json({ error: "This cash-out was already processed." }, { status: 409 });
  return NextResponse.json({ id: payout.id, status });
}

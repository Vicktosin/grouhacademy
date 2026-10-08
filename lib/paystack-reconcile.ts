import { getPrisma } from "@/lib/prisma";
import {
  settleSuccessfulPaystackPayment,
  type PaystackSettlementPrisma,
} from "@/lib/paystack-webhook";
import { activatePromotion } from "@/lib/internship-progression";

// Finds acceptance-fee payments that succeeded on Paystack but aren't marked
// paid on the site (e.g. the webhook couldn't match them), so an admin can
// settle them. Every settle re-checks the payment with Paystack first.

const PAYSTACK = "https://api.paystack.co";
const MAX_PAGES = 10; // 1,000 transactions per check.

type Fetch = typeof fetch;

type PaystackTransaction = {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  paid_at?: string | null;
  customer?: { email?: string | null } | null;
  metadata?: unknown;
};

export type UnmatchedStatus =
  /** Paid on Paystack, pending on the site, amount matches: can be settled. */
  | "SETTLEABLE"
  /** The amount differs from what the application owes now: check by hand. */
  | "AMOUNT_DIFFERS"
  /** The application is already paid with another reference: a second payment. */
  | "PAID_TWICE"
  /** No application (or payment record) found for this payment. */
  | "NO_APPLICATION";

export type UnmatchedPayment = {
  reference: string;
  status: UnmatchedStatus;
  paystackEmail: string | null;
  amount: number;
  currency: string;
  paidAt: string | null;
  applicationId: string | null;
  paymentId: string | null;
  applicant: { name: string; email: string } | null;
  track: string | null;
  owed: number | null;
};

function metadataOf(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value === "string" && value.trim().startsWith("{")) {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

/** The application an acceptance-fee payment was for, if it is one. */
export function acceptanceApplicationId(transaction: {
  reference: string;
  metadata?: unknown;
}) {
  const metadata = metadataOf(transaction.metadata);
  const isAcceptance =
    metadata.purpose === "internship_acceptance_fee" ||
    transaction.reference.startsWith("acceptance_");
  if (!isAcceptance) return undefined;
  if (typeof metadata.applicationId === "string") return metadata.applicationId;
  return /^acceptance_(.+)_\d+$/.exec(transaction.reference)?.[1] ?? null;
}

async function paystackGet<T>(path: string, secretKey: string, fetchImpl: Fetch) {
  const response = await fetchImpl(`${PAYSTACK}${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as {
    status?: boolean;
    message?: string;
    data?: T;
    meta?: { pageCount?: number };
  } | null;
  if (!response.ok || !body?.status)
    throw new Error(body?.message ?? `Paystack request failed (${response.status}).`);
  return body;
}

/** Successful Paystack acceptance payments from the last `days` days that the site hasn't recorded as paid. */
export async function findUnmatchedPayments({
  days,
  secretKey,
  fetchImpl = fetch,
}: {
  days: number;
  secretKey: string;
  fetchImpl?: Fetch;
}): Promise<{ checked: number; unmatched: UnmatchedPayment[] }> {
  const from = new Date(Date.now() - days * 86_400_000).toISOString();
  const transactions: PaystackTransaction[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const body = await paystackGet<PaystackTransaction[]>(
      `/transaction?status=success&perPage=100&page=${page}&from=${encodeURIComponent(from)}`,
      secretKey,
      fetchImpl,
    );
    transactions.push(...(body.data ?? []));
    if (page >= (body.meta?.pageCount ?? 1)) break;
  }

  const acceptance = transactions
    .filter((t) => t.status === "success")
    .map((t) => ({ ...t, applicationId: acceptanceApplicationId(t) }))
    .filter((t) => t.applicationId !== undefined);
  if (!acceptance.length) return { checked: transactions.length, unmatched: [] };

  const prisma = getPrisma();
  const applicationIds = [
    ...new Set(acceptance.map((t) => t.applicationId).filter((id): id is string => Boolean(id))),
  ];
  const [paidByReference, payments] = await Promise.all([
    prisma.internshipPayment.findMany({
      where: { reference: { in: acceptance.map((t) => t.reference) }, status: "PAID" },
      select: { reference: true },
    }),
    prisma.internshipPayment.findMany({
      where: { applicationId: { in: applicationIds } },
      select: {
        id: true,
        applicationId: true,
        status: true,
        amount: true,
        reference: true,
        application: {
          select: {
            program: { select: { name: true } },
            level: { select: { name: true } },
            student: {
              select: {
                name: true,
                email: true,
                profile: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    }),
  ]);
  const settled = new Set(paidByReference.map((p) => p.reference));
  const paymentFor = new Map(payments.map((p) => [p.applicationId, p]));

  const unmatched: UnmatchedPayment[] = [];
  for (const transaction of acceptance) {
    if (settled.has(transaction.reference)) continue;
    const payment = transaction.applicationId ? paymentFor.get(transaction.applicationId) : undefined;
    const amount = transaction.amount / 100;
    const student = payment?.application.student;
    const status: UnmatchedStatus = !payment
      ? "NO_APPLICATION"
      : payment.status === "PAID"
        ? "PAID_TWICE"
        : payment.amount !== amount || transaction.currency !== "NGN"
          ? "AMOUNT_DIFFERS"
          : "SETTLEABLE";
    unmatched.push({
      reference: transaction.reference,
      status,
      paystackEmail: transaction.customer?.email ?? null,
      amount,
      currency: transaction.currency,
      paidAt: transaction.paid_at ?? null,
      applicationId: transaction.applicationId ?? null,
      paymentId: payment?.id ?? null,
      applicant: student
        ? {
            name:
              [student.profile?.firstName, student.profile?.lastName].filter(Boolean).join(" ") ||
              student.name ||
              student.email,
            email: student.email,
          }
        : null,
      track: payment
        ? `${payment.application.program.name} · ${payment.application.level.name}`
        : null,
      owed: payment?.amount ?? null,
    });
  }
  unmatched.sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""));
  return { checked: transactions.length, unmatched };
}

/**
 * Settles one payment after re-checking it with Paystack, exactly as the
 * webhook would (marks it paid, places them in a cohort, activates a level
 * move-up).
 */
export async function settleVerifiedReference({
  reference,
  secretKey,
  fetchImpl = fetch,
}: {
  reference: string;
  secretKey: string;
  fetchImpl?: Fetch;
}): Promise<{ settled: true } | { error: string; status: number }> {
  let body;
  try {
    body = await paystackGet<PaystackTransaction>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      secretKey,
      fetchImpl,
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Paystack check failed.", status: 502 };
  }
  const transaction = body.data;
  if (!transaction || transaction.status !== "success" || transaction.reference !== reference)
    return { error: "Paystack doesn't show this payment as successful.", status: 409 };
  if (acceptanceApplicationId(transaction) === undefined)
    return { error: "This isn't an internship acceptance-fee payment.", status: 400 };

  const prisma = getPrisma();
  const result = await settleSuccessfulPaystackPayment(
    prisma as unknown as PaystackSettlementPrisma,
    {
      reference: transaction.reference,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      metadata: metadataOf(transaction.metadata),
    },
  );
  if (result.reason === "already_settled") return { settled: true };
  if (!result.updatedInternshipPayment)
    return {
      error:
        result.reason === "payment_mismatch"
          ? "The amount doesn't match what this applicant owes. Check it and use Mark as paid on their payment if it's right."
          : "No matching application was found for this payment.",
      status: 409,
    };

  const paid = await prisma.internshipPayment.findUnique({
    where: { reference },
    select: { applicationId: true },
  });
  if (paid)
    await activatePromotion(paid.applicationId).catch((error) =>
      console.error("[paystack-reconcile] Promotion activation failed.", error),
    );
  return { settled: true };
}

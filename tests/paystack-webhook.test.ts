import test from "node:test";
import assert from "node:assert/strict";

import {
  settleSuccessfulPaystackPayment,
  type PaystackSettlementPrisma,
} from "../lib/paystack-webhook";

/**
 * A fake database with one application's payment. `stored` is the reference
 * currently on the payment (each new attempt replaces it).
 */
function fakePrisma(stored: { reference: string; amount?: number }) {
  const calls: Array<{ model: string; data: Record<string, unknown> }> = [];
  const payment = {
    id: "payment-1",
    applicationId: "app-1",
    reference: stored.reference,
    status: "PENDING",
    amount: stored.amount ?? 250000,
    currency: "NGN",
    application: {
      id: "app-1",
      programId: "program-1",
      levelId: "level-entry",
      cohortId: null,
    },
  };
  const prisma = {
    internshipPayment: {
      findUnique: async ({ where }: { where: { reference?: string; applicationId?: string } }) =>
        where.reference === payment.reference || where.applicationId === payment.applicationId
          ? payment
          : null,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push({ model: "internshipPayment", data });
        return { ...payment, ...data };
      },
    },
    payment: { findUnique: async () => null },
    internshipApplication: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push({ model: "internshipApplication", data });
        return { id: "app-1", ...data };
      },
    },
    // An upcoming cohort, so a newly paid applicant is placed in it.
    internshipCohort: {
      findFirst: async () => ({
        id: "cohort-1",
        startDate: new Date(Date.now() + 86_400_000),
        endDate: new Date(Date.now() + 30 * 86_400_000),
      }),
    },
  };
  return { prisma: prisma as unknown as PaystackSettlementPrisma, calls };
}

const event = (reference: string, applicationId = "app-1", amount = 25000000) => ({
  reference,
  status: "success",
  amount,
  currency: "NGN",
  metadata: { applicationId, purpose: "internship_acceptance_fee" },
});

test("marks internship payment as paid when Paystack charge.success arrives for a bank transfer", async () => {
  const { prisma, calls } = fakePrisma({ reference: "acceptance_app-1_123" });
  const result = await settleSuccessfulPaystackPayment(prisma, event("acceptance_app-1_123"));

  assert.equal(result.updatedInternshipPayment, true);
  assert.equal(calls.some((call) => call.model === "internshipPayment" && call.data.status === "PAID"), true);
  // Placement isn't decided here: the webhook route then settles self-paced
  // vs cohort (lib/learning-mode), so the intern's choice is respected.
  assert.equal(calls.some((call) => call.model === "internshipApplication" && call.data.cohortId === "cohort-1"), false);
});

test("settles an earlier attempt after the applicant tapped Pay again", async () => {
  // They started a transfer (…_100), came back and tapped Pay again (…_200),
  // then the first transfer completed.
  const { prisma, calls } = fakePrisma({ reference: "acceptance_app-1_200" });
  const result = await settleSuccessfulPaystackPayment(prisma, event("acceptance_app-1_100"));

  assert.equal(result.updatedInternshipPayment, true);
  const update = calls.find((call) => call.model === "internshipPayment");
  assert.equal(update?.data.status, "PAID");
  assert.equal(update?.data.reference, "acceptance_app-1_100", "stores the reference that was paid");
});

test("never settles one application with another application's reference", async () => {
  const { prisma, calls } = fakePrisma({ reference: "acceptance_app-1_200" });
  // A payment for app-2 whose metadata claims app-1.
  const result = await settleSuccessfulPaystackPayment(prisma, event("acceptance_app-2_100", "app-1"));

  assert.equal(result.updatedInternshipPayment, false);
  assert.equal(calls.length, 0);
});

test("refuses an earlier attempt for a different amount", async () => {
  const { prisma, calls } = fakePrisma({ reference: "acceptance_app-1_200" });
  // The earlier attempt was for a cheaper fee than the application owes now.
  const result = await settleSuccessfulPaystackPayment(prisma, event("acceptance_app-1_100", "app-1", 9900000));

  assert.equal(result.updatedInternshipPayment, false);
  assert.equal(result.reason, "payment_mismatch");
  assert.equal(calls.length, 0);
});

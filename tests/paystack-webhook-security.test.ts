import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { isValidPaystackSignature } from "../app/api/paystack/webhook/route";
import {
  settleSuccessfulPaystackPayment,
  type PaystackSettlementPrisma,
} from "../lib/paystack-webhook";

test("rejects invalid Paystack signatures and accepts the exact HMAC", () => {
  const body = JSON.stringify({ event: "charge.success" });
  const secret = "test-secret";
  const signature = createHmac("sha512", secret).update(body).digest("hex");

  assert.equal(isValidPaystackSignature(body, signature, secret), true);
  assert.equal(isValidPaystackSignature(body, `${signature}0`, secret), false);
  assert.equal(isValidPaystackSignature(`${body} `, signature, secret), false);
});

test("does not settle a payment when amount or reference ownership does not match", async () => {
  let updateCount = 0;
  const prisma = {
    internshipPayment: {
      findUnique: async ({ where }: { where: { reference: string } }) =>
        where.reference === "acceptance-owned"
          ? {
              id: "payment-1",
              applicationId: "app-1",
              status: "PENDING",
              amount: 250000,
              currency: "NGN",
              application: {
                id: "app-1",
                programId: "program-1",
                levelId: "level-entry",
                cohortId: null,
              },
            }
          : null,
      update: async () => {
        updateCount += 1;
        return {};
      },
    },
    payment: { findUnique: async () => null },
    internshipApplication: { update: async () => ({}) },
    internshipCohort: { findFirst: async () => null },
  };

  const result = await settleSuccessfulPaystackPayment(
    prisma as unknown as PaystackSettlementPrisma,
    {
      event: "charge.success",
      data: {
        status: "success",
        reference: "acceptance-not-owned",
        amount: 25000000,
        currency: "NGN",
        metadata: {
          applicationId: "app-2",
          purpose: "internship_acceptance_fee",
        },
      },
    },
  );

  assert.equal(result.reason, "unmatched");
  assert.equal(updateCount, 0);
});

test("treats repeated success delivery as an idempotent no-op", async () => {
  let status = "PENDING";
  let updateCount = 0;
  const prisma = {
    internshipPayment: {
      findUnique: async () => ({
        id: "payment-1",
        applicationId: "app-1",
        status,
        amount: 250000,
        currency: "NGN",
        application: {
          id: "app-1",
          programId: "program-1",
          levelId: "level-entry",
          cohortId: null,
        },
      }),
      update: async ({ data }: { data: { status: string } }) => {
        updateCount += 1;
        status = data.status;
        return {};
      },
    },
    payment: { findUnique: async () => null },
    internshipApplication: { update: async () => ({}) },
    internshipCohort: { findFirst: async () => null },
  };
  const payload = {
    event: "charge.success",
    data: {
      status: "success",
      reference: "acceptance-owned",
      amount: 25000000,
      currency: "NGN",
      metadata: { purpose: "internship_acceptance_fee" },
    },
  };

  const first = await settleSuccessfulPaystackPayment(
    prisma as unknown as PaystackSettlementPrisma,
    payload,
  );
  const second = await settleSuccessfulPaystackPayment(
    prisma as unknown as PaystackSettlementPrisma,
    payload,
  );

  assert.equal(first.reason, "settled");
  assert.equal(second.reason, "already_settled");
  assert.equal(updateCount, 1);
});

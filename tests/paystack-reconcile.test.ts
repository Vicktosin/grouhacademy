import test from "node:test";
import assert from "node:assert/strict";

import { acceptanceApplicationId } from "../lib/paystack-reconcile";

test("finds the application an acceptance payment was for", () => {
  assert.equal(
    acceptanceApplicationId({
      reference: "acceptance_cmabc123_1759900000000",
      metadata: { applicationId: "cmabc123", purpose: "internship_acceptance_fee" },
    }),
    "cmabc123",
  );
  // Paystack can send metadata as a JSON string.
  assert.equal(
    acceptanceApplicationId({
      reference: "x",
      metadata: JSON.stringify({ applicationId: "cmxyz", purpose: "internship_acceptance_fee" }),
    }),
    "cmxyz",
  );
  // No metadata: read it from our reference format.
  assert.equal(acceptanceApplicationId({ reference: "acceptance_cmdef456_1759900000000", metadata: "" }), "cmdef456");
});

test("ignores payments that aren't acceptance fees", () => {
  assert.equal(acceptanceApplicationId({ reference: "premium_cm1_1759900000000", metadata: { purpose: "internship_premium" } }), undefined);
  assert.equal(acceptanceApplicationId({ reference: "T1234567890", metadata: null }), undefined);
});

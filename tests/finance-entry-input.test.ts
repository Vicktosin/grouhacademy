import assert from "node:assert/strict";
import test from "node:test";
import { financeEntryInputSchema } from "../lib/finance-entry-input";

const baseEntry = {
  type: "AD_SPEND",
  description: "October course campaign",
  amount: 25000,
  currency: "NGN",
  occurredAt: "2026-10-15T12:00:00.000Z",
  source: "",
  adType: "Instagram sponsored post",
  campaignName: "October course launch",
  conversions: 12,
  attributedRevenue: 120000,
};

test("accepts ad spend with campaign performance details", () => {
  assert.equal(financeEntryInputSchema.safeParse(baseEntry).success, true);
});

test("requires the source for capital investments and staff payments", () => {
  assert.equal(
    financeEntryInputSchema.safeParse({
      ...baseEntry,
      type: "CAPITAL_INVESTMENT",
      source: "",
    }).success,
    false,
  );
  assert.equal(
    financeEntryInputSchema.safeParse({
      ...baseEntry,
      type: "STAFF_PAYMENT",
      source: "Ada Okafor",
      adType: "",
      campaignName: "",
      conversions: null,
      attributedRevenue: null,
    }).success,
    true,
  );
});

test("rejects invalid amounts and ad conversion data", () => {
  assert.equal(
    financeEntryInputSchema.safeParse({ ...baseEntry, amount: -1 }).success,
    false,
  );
  assert.equal(
    financeEntryInputSchema.safeParse({
      ...baseEntry,
      conversions: null,
    }).success,
    false,
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import { resubmissionBlockedReason } from "../lib/task-submission";

test("first submissions and unreviewed or rejected work can be (re)submitted", () => {
  assert.equal(resubmissionBlockedReason(null), null);
  assert.equal(resubmissionBlockedReason(undefined), null);
  assert.equal(resubmissionBlockedReason("DRAFT"), null);
  assert.equal(resubmissionBlockedReason("SUBMITTED"), null);
  assert.equal(resubmissionBlockedReason("REJECTED"), null);
});

test("work under review or already accepted is locked", () => {
  assert.match(resubmissionBlockedReason("UNDER_REVIEW") ?? "", /being reviewed/);
  assert.match(resubmissionBlockedReason("ACCEPTED") ?? "", /already been accepted/);
});

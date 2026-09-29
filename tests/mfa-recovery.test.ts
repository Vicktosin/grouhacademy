import assert from "node:assert/strict";
import test from "node:test";

import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  RECOVERY_CODE_COUNT,
} from "../lib/mfa-recovery";

test("generates unique codes in the XXXXX-XXXXX format", () => {
  const codes = generateRecoveryCodes();
  assert.equal(codes.length, RECOVERY_CODE_COUNT);
  assert.equal(new Set(codes).size, codes.length);
  for (const code of codes) {
    assert.match(code, /^[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/);
  }
});

test("codes never contain easily confused characters", () => {
  const joined = generateRecoveryCodes(200).join("");
  assert.doesNotMatch(joined, /[01ILO]/);
});

test("hashing ignores case, spaces and dashes", () => {
  const expected = hashRecoveryCode("7KQ2M-XH4PD");
  assert.equal(hashRecoveryCode("7kq2m-xh4pd"), expected);
  assert.equal(hashRecoveryCode(" 7KQ2M XH4PD "), expected);
  assert.equal(hashRecoveryCode("7KQ2MXH4PD"), expected);
  assert.notEqual(hashRecoveryCode("7KQ2M-XH4PE"), expected);
  assert.equal(normalizeRecoveryCode("ab-c d"), "ABCD");
});

test("stores a hash, never the code itself", () => {
  const hash = hashRecoveryCode("7KQ2M-XH4PD");
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.ok(!hash.includes("7KQ2M"));
});

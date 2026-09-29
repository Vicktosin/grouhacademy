import assert from "node:assert/strict";
import test from "node:test";

import {
  isAllowedPostAuthPath,
  isMfaVerificationPending,
} from "../lib/supabase/mfa";

type Claims = { aal?: string } | null;

function supabaseWithClaims(claims: Claims, error: Error | null = null) {
  let calls = 0;
  const client = {
    auth: {
      getClaims: async () => {
        calls += 1;
        return error || !claims
          ? { data: null, error }
          : { data: { claims }, error: null };
      },
    },
  };
  return {
    client: client as unknown as Parameters<typeof isMfaVerificationPending>[0],
    calls: () => calls,
  };
}

const verifiedFactor = { factors: [{ status: "verified" }] } as Parameters<
  typeof isMfaVerificationPending
>[1];

test("users without MFA are never pending and skip the claims lookup", async () => {
  const supabase = supabaseWithClaims({ aal: "aal1" });
  assert.equal(await isMfaVerificationPending(supabase.client, {}), false);
  assert.equal(
    await isMfaVerificationPending(supabase.client, {
      factors: [{ status: "unverified" }],
    } as Parameters<typeof isMfaVerificationPending>[1]),
    false,
  );
  assert.equal(supabase.calls(), 0);
});

test("an MFA user with a password-only session is pending", async () => {
  const supabase = supabaseWithClaims({ aal: "aal1" });
  assert.equal(
    await isMfaVerificationPending(supabase.client, verifiedFactor),
    true,
  );
});

test("an MFA user who completed the challenge is not pending", async () => {
  const supabase = supabaseWithClaims({ aal: "aal2" });
  assert.equal(
    await isMfaVerificationPending(supabase.client, verifiedFactor),
    false,
  );
});

test("fails closed when the session claims cannot be verified", async () => {
  const supabase = supabaseWithClaims(null, new Error("invalid JWT"));
  assert.equal(
    await isMfaVerificationPending(supabase.client, verifiedFactor),
    true,
  );
});

test("only internal recovery and internship paths are allowed after auth", () => {
  assert.equal(isAllowedPostAuthPath("/reset-password"), true);
  assert.equal(isAllowedPostAuthPath("/internship/onboarding"), true);
  assert.equal(isAllowedPostAuthPath("/admin"), false);
  assert.equal(isAllowedPostAuthPath("https://evil.example"), false);
  assert.equal(isAllowedPostAuthPath(null), false);
});

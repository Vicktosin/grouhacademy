import assert from "node:assert/strict";
import test from "node:test";

import { getSupabaseCookieOptions } from "../lib/supabase/cookie-options";

test("Supabase auth cookies are shared across Grouh Academy production hosts", () => {
  assert.deepEqual(getSupabaseCookieOptions("grouhacademy.com"), {
    domain: ".grouhacademy.com",
  });
  assert.deepEqual(getSupabaseCookieOptions("www.grouhacademy.com"), {
    domain: ".grouhacademy.com",
  });
});

test("Supabase auth cookies remain host-only outside production domain", () => {
  assert.deepEqual(getSupabaseCookieOptions("localhost"), {});
  assert.deepEqual(getSupabaseCookieOptions("grouhacademy.vercel.app"), {});
});

test("sabirole.com and www.sabirole.com share sign-in cookies; the move switches on with its URL", async () => {
  const { getSupabaseCookieOptions } = await import("../lib/supabase/cookie-options");
  const { isDomainMoveActive, OLD_HOSTS } = await import("../lib/domain-move");
  assert.deepEqual(getSupabaseCookieOptions("sabirole.com"), { domain: ".sabirole.com" });
  assert.deepEqual(getSupabaseCookieOptions("www.sabirole.com"), { domain: ".sabirole.com" });
  assert.deepEqual(getSupabaseCookieOptions("grouhacademy.com"), { domain: ".grouhacademy.com" });
  assert.deepEqual(getSupabaseCookieOptions("grouh-academy.vercel.app"), {});
  assert.equal(isDomainMoveActive("https://grouhacademy.com"), false, "nothing moves until the URL is changed");
  assert.equal(isDomainMoveActive("https://sabirole.com/"), true);
  assert.ok(OLD_HOSTS.includes("grouhacademy.com") && OLD_HOSTS.includes("grouhacademy.space"));
});

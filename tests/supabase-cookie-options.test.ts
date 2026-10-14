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

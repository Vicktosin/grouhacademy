import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { isAppRoute, isPwaRoute } from "../lib/app-routes";

// Pages that make up the public marketing site and keep the site header and
// footer. Every other page is treated as part of the app.
const PUBLIC_PAGES = new Set([
  "/",
  "/about",
  "/apply",
  "/contact",
  "/tracks",
  "/internship",
  "/privacy-policy",
  "/terms-of-service",
  // Public certificate check for employers.
  "/verify",
]);

function listPageRoutes(dir: string, route = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isFile() && entry.name === "page.tsx") return [route || "/"];
    if (!entry.isDirectory() || entry.name === "api") return [];
    // Route groups like "(marketing)" don't add a URL segment.
    const segment = /^\(.*\)$/.test(entry.name) ? "" : `/${entry.name}`;
    return listPageRoutes(path.join(dir, entry.name), route + segment);
  });
}

test("every page is classified as either public site or app", () => {
  const routes = listPageRoutes(path.join(process.cwd(), "app"));
  assert.ok(routes.length > 0);

  for (const route of routes) {
    assert.equal(
      isAppRoute(route),
      !PUBLIC_PAGES.has(route),
      `${route} should ${PUBLIC_PAGES.has(route) ? "show" : "hide"} the public header and footer`,
    );
  }
});

test("matches whole path segments only", () => {
  assert.equal(isAppRoute("/students-stories"), false);
  assert.equal(isAppRoute("/internship"), false);
  assert.equal(isAppRoute("/internship/onboarding"), true);
  assert.equal(isAppRoute("/reset-password"), true);
  assert.equal(isAppRoute("/auth/mfa/setup"), true);
});

test("the installable app covers app pages, not the public site", () => {
  for (const route of ["/app", "/login", "/admin", "/internship/dashboard", "/student", "/mentor/messages"])
    assert.equal(isPwaRoute(route), true, `${route} should be part of the app`);
  for (const route of ["/", "/about", "/courses", "/internship", "/landingpage", "/ad-redirect", "/verify"])
    assert.equal(isPwaRoute(route), false, `${route} should stay on the public website`);
});

test("the service worker's app sections match isPwaRoute", () => {
  const source = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");
  const sections = JSON.parse(
    source
      .match(/const APP_SECTIONS = (\[[\s\S]*?\])/)![1]
      .replace(/'/g, '"')
      .replace(/,\s*\]$/, "]"),
  ) as string[];
  const isAppPath = (p: string) =>
    p.startsWith("/internship/") ||
    sections.some((s) => p === s || p.startsWith(`${s}/`));
  for (const route of listPageRoutes(path.join(process.cwd(), "app")))
    assert.equal(isAppPath(route), isPwaRoute(route), `${route}: sw.js and lib/app-routes.ts disagree`);
});

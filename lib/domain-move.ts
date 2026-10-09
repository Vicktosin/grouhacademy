// The move from grouhacademy.space to grouhacademy.com. Used by
// next.config.ts (the redirects), so it has no imports.
//
// The old domain redirects every page to the same page on the new one,
// with ?moved=1 so the app can tell people (see components/MovedNotice).
// It switches on only once NEXT_PUBLIC_APP_URL is the new domain, so this
// code can ship before the new domain is set up. The redirect is temporary
// (307) until DOMAIN_MOVE_PERMANENT=true: browsers remember permanent
// redirects for good, so make it permanent only once everything works.
//
// Kept answering on the old domain:
// - /sw.js: the installed app's old worker must be able to update, to a
//   worker that retires it (public/sw-retire.js);
// - payment and interview webhooks, until their URLs are updated;
// - /.well-known/ files.
// Installed apps (PWAs) can't move to another domain, so the old one keeps
// opening and lands on the new domain; people can install it again there.

export const NEW_ORIGIN = "https://grouhacademy.com";
export const OLD_HOSTS = ["grouhacademy.space", "www.grouhacademy.space"];

/** Whether the move is switched on (NEXT_PUBLIC_APP_URL is the new domain). */
export function isDomainMoveActive(appUrl = process.env.NEXT_PUBLIC_APP_URL) {
  return (appUrl ?? "").trim().replace(/\/$/, "") === NEW_ORIGIN;
}

/** The `has` condition matching requests to the old domain. */
export const OLD_HOST_CONDITION = {
  type: "host" as const,
  value: `(?:${OLD_HOSTS.map((host) => host.replace(/\./g, "\\.")).join("|")})`,
};

/** Paths on the old domain that keep answering instead of redirecting. */
export const KEEP_ON_OLD_DOMAIN = [
  "sw\\.js$",
  "\\.well-known/",
  "api/paystack/webhook",
  "api/webhooks/tavus",
];

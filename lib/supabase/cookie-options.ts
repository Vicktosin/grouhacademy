// Sign-in cookies are shared by a domain and its www. host (so signing in on
// one works on the other). Each domain has its own cookies: after the move
// to sabirole.com, people sign in there once (lib/domain-move.ts).
const SHARED_COOKIE_DOMAINS = ["sabirole.com", "grouhacademy.com"];

export function getSupabaseCookieOptions(hostname: string) {
  const normalizedHostname = hostname.toLowerCase().replace(/\.$/, "");
  for (const domain of SHARED_COOKIE_DOMAINS) {
    if (normalizedHostname === domain || normalizedHostname.endsWith(`.${domain}`)) {
      return { domain: `.${domain}` };
    }
  }
  return {};
}

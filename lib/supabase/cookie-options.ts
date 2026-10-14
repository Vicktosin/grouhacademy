export function getSupabaseCookieOptions(hostname: string) {
  const normalizedHostname = hostname.toLowerCase().replace(/\.$/, "");

  if (
    normalizedHostname === "grouhacademy.com" ||
    normalizedHostname.endsWith(".grouhacademy.com")
  ) {
    return { domain: ".grouhacademy.com" };
  }

  return {};
}

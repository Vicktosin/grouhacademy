export function getSiteUrl(): string {
  // NEXT_PUBLIC_APP_URL is the canonical public domain for SabiRole.
  // Prefer it over the legacy SITE_URL variable so OAuth and email links do
  // not send learners back to a Vercel deployment hostname.
  const configuredUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL
  )?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:3000";
}

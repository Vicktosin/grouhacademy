// Lightweight dev-auth pieces with no database or next/headers imports, so
// proxy.ts can use them too.

export const DEV_AUTH_COOKIE_NAME = "grouh_dev_auth_role";

export function isDevelopmentBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.DEV_AUTH_BYPASS === "true"
  );
}

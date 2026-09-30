/**
 * Route sections that belong to the application (workspaces, auth flows)
 * rather than the public marketing site. The public header and footer are
 * hidden on these routes and everything nested beneath them.
 */
const APP_ROUTE_SECTIONS = [
  // Workspaces
  "/admin",
  "/instructor",
  "/mentor",
  "/student",

  // Authentication and account recovery
  "/auth",
  "/dev",
  "/login",
  "/register",
  "/welcome",
  "/forgot-password",
  "/otp",
  "/reset-password",
  "/reset-password-success",

  // Connection fallback served by the service worker
  "/offline",

  // Standalone landing pages that render their own header and footer
  "/landingpage",
  "/ad-redirect",
];

export function isAppRoute(pathname: string): boolean {
  // "/internship" itself is the public programme landing page; every page
  // beneath it (onboarding, assessment, payment, dashboard, …) is the app.
  if (pathname.startsWith("/internship/")) {
    return true;
  }

  return APP_ROUTE_SECTIONS.some(
    (section) => pathname === section || pathname.startsWith(`${section}/`),
  );
}

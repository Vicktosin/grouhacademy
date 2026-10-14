/**
 * Route sections that belong to the application (workspaces, auth flows)
 * rather than the public marketing site. The public header and footer are
 * hidden on these routes and everything nested beneath them.
 */
/** Marketing pages that hide the site header but aren't part of the app. */
const MARKETING_LANDING_PAGES = ["/landingpage", "/ad-redirect", "/brag"];

const APP_ROUTE_SECTIONS = [
  // Installed-app start page: sends people to their workspace or login.
  "/app",

  // Workspaces
  "/admin",
  "/instructor",
  "/mentor",
  "/student",
  // A mentor or admin looking at an intern's submitted site.
  "/lab-review",

  // Authentication and account recovery
  "/auth",
  "/dev",
  "/login",
  "/register",
  "/courses/login",
  "/courses/register",
  "/welcome",
  "/forgot-password",
  "/otp",
  "/reset-password",
  "/reset-password-success",

  // Connection fallback served by the service worker
  "/offline",

  // Standalone landing pages that render their own header and footer
  ...MARKETING_LANDING_PAGES,
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

/**
 * Pages that belong to the installable app (PWA): every app route except the
 * marketing landing pages. Public website pages are never part of the
 * installed app; inside it they open in the browser instead.
 */
export function isPwaRoute(pathname: string): boolean {
  if (
    MARKETING_LANDING_PAGES.some(
      (page) => pathname === page || pathname.startsWith(`${page}/`),
    )
  )
    return false;
  return isAppRoute(pathname);
}

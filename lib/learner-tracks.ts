import { isSafeInternalPath } from "@/lib/safe-redirect";

// Grouh Academy has two separate learner sides that share one account: the
// internship and the courses (LMS). Which login or sign-up page someone uses
// decides which side they enter; using the other side's pages with the same
// email and password adds them to that side too. Safe to import anywhere.

export type LearnerTrack = "internship" | "courses";

export const LEARNER_TRACKS = {
  internship: {
    // The existing URLs: every current user is an intern.
    loginPath: "/login",
    registerPath: "/register",
    home: "/internship/onboarding",
    name: "Internship",
    loginTitle: "Welcome back",
    loginSubtitle: "Sign in to continue your Grouh Academy internship journey.",
    registerTitle: "Create account",
    registerSubtitle:
      "Join the Grouh Academy internship and start building practical, career-ready experience.",
    continueLabel: "Continue to the internship",
  },
  courses: {
    loginPath: "/courses/login",
    registerPath: "/courses/register",
    home: "/student",
    name: "Courses",
    loginTitle: "Welcome back, learner",
    loginSubtitle: "Sign in to continue your Grouh Academy courses.",
    registerTitle: "Start learning",
    registerSubtitle:
      "Create your free Grouh Academy student account and start learning at your own pace.",
    continueLabel: "Continue to my courses",
  },
} as const;

export function parseTrack(value: unknown): LearnerTrack | null {
  return value === "internship" || value === "courses" ? value : null;
}

/** The side a destination path belongs to, if any. */
/**
 * True for the staff workspaces (admin, instructor, mentor). Staff always go
 * to their workspace after login, even from a learner login page or a link
 * to a learner page.
 */
export function isStaffWorkspace(path: string | null | undefined) {
  return Boolean(
    path &&
    ["/admin", "/instructor", "/mentor"].some(
      (section) => path === section || path.startsWith(`${section}/`),
    ),
  );
}

export function trackForPath(path: string | null | undefined) {
  if (!path) return null;
  if (path === "/student" || path.startsWith("/student/")) return "courses";
  if (path.startsWith("/internship")) return "internship";
  return null;
}

/**
 * A page someone asked to return to (`?next=`) that is allowed for this
 * side, or null to use the side's normal destination. Internship pages are
 * kept as asked: the dashboard sends anyone who isn't an intern yet to
 * their next step (InternshipWorkspaceGate), and the application pages
 * check for themselves. (Sending every request to onboarding left interns
 * signing in from a dashboard link on the onboarding questions.)
 */
export function requestedPathForTrack(
  track: LearnerTrack,
  requested: string | null | undefined,
): string | null {
  if (!isSafeInternalPath(requested)) return null;
  if (track === "internship") return requested;
  return trackForPath(requested) === "courses" ? requested : null;
}

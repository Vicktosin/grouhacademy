const PLACEHOLDER_ORIGIN = "http://placeholder.invalid";

/**
 * True when `path` is a same-origin path such as "/student/courses".
 *
 * Checking only `startsWith("/")` is not enough: browsers resolve
 * "//evil.example" and "/\evil.example" as links to another site, so the path
 * is resolved against a placeholder origin and must stay on that origin.
 */
export function isSafeInternalPath(
  path: string | null | undefined,
): path is string {
  if (!path?.startsWith("/")) {
    return false;
  }

  try {
    return new URL(path, PLACEHOLDER_ORIGIN).origin === PLACEHOLDER_ORIGIN;
  } catch {
    return false;
  }
}

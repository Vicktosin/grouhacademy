// Pages call this after something that can unlock an achievement (an Office
// Life step, a lab submission), so the celebration pop-up checks at once
// instead of on its next regular check.

export const ACHIEVEMENT_CHECK_EVENT = "grouh:achievements";

export function checkForAchievements() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ACHIEVEMENT_CHECK_EVENT));
}

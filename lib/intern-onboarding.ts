// Remembers, in this browser, what an intern has seen of the onboarding
// (welcome, tour, page guides, getting-started steps). Nothing is stored on
// the server; on another device they just see the welcome again.

const PREFIX = "grouh-onboarding:";

export function getFlag(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function setFlag(key: string, value = "1") {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // Private browsing: it just won't be remembered.
  }
  window.dispatchEvent(new Event(ONBOARDING_CHANGED));
}

/** Fired when any flag changes, so the checklist can update. */
export const ONBOARDING_CHANGED = "grouh:onboarding-changed";
/** Ask the shell to start the guided tour. */
export const START_TOUR = "grouh:start-tour";
/** Ask the dashboard to show the welcome again. */
export const SHOW_WELCOME = "grouh:show-welcome";

export function startTour() {
  window.dispatchEvent(new Event(START_TOUR));
}

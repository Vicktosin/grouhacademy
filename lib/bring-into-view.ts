// On phones, side-by-side layouts stack, so something a tap opens or changes
// (a task list, a chat, a lesson) can land off-screen and the tap seems to
// do nothing. bringIntoView scrolls to it, but only when its top isn't
// already on screen, so wide layouts don't jump.

export function bringIntoView(element: HTMLElement | null | undefined) {
  if (!element || typeof window === "undefined") return;
  // Wait for React to render the change before measuring.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const top = element.getBoundingClientRect().top;
      if (top >= 0 && top < window.innerHeight * 0.6) return;
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }),
  );
}

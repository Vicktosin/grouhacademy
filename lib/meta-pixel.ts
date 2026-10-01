export const trackMetaEvent = (
  event: string,
  parameters?: Record<string, unknown>,
  // eventID lets Meta drop duplicates of the same event (e.g. a page refresh).
  options?: { eventID?: string }
) => {
  if (typeof window === "undefined") return;

  window.fbq?.("track", event, parameters, options);
};

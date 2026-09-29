"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Dev chunk URLs keep their names while their contents change, so the
    // worker's cache-first asset strategy would pin stale CSS and JS. Remove
    // any worker and caches left over from earlier dev sessions instead.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((r) => r.unregister()));
      if ("caches" in window) {
        caches
          .keys()
          .then((keys) =>
            keys
              .filter((key) => key.startsWith("grouh-academy-"))
              .forEach((key) => caches.delete(key)),
          );
      }
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Unable to register the service worker:", error);
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}

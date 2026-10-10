"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { isPwaRoute } from "@/lib/app-routes";
import MovedNotice from "@/components/MovedNotice";

// Keeps the installable app (PWA) to the app itself, not the public website:
// - the manifest is linked only on app pages, so only they offer "Install";
// - the service worker is registered from app pages only;
// - inside the installed app, links to public pages open in the browser, and
//   landing on a public page goes back to the app's start.

const MANIFEST_HREF = "/app.webmanifest";

function isInstalledApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS home-screen apps.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function PwaManager() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const appPage = isPwaRoute(pathname);

  // Manifest link: present on app pages only.
  useEffect(() => {
    const existing = document.head.querySelector<HTMLLinkElement>(
      `link[rel="manifest"][href="${MANIFEST_HREF}"]`,
    );
    if (appPage && !existing) {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = MANIFEST_HREF;
      document.head.appendChild(link);
    } else if (!appPage && existing) {
      existing.remove();
    }
  }, [appPage]);

  // In the installed app, a public page goes back to the app's start.
  useEffect(() => {
    if (!appPage && isInstalledApp()) router.replace("/app");
  }, [appPage, router]);

  // In the installed app, links to the public website open in the browser.
  useEffect(() => {
    if (!isInstalledApp()) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor || anchor.hasAttribute("download") || anchor.target === "_blank") return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || isPwaRoute(url.pathname)) return;
      event.preventDefault();
      window.open(url.href, "_blank", "noopener,noreferrer");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Service worker: registered from app pages in production.
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
    if (!appPage) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Unable to register the service worker:", error);
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, [appPage]);

  // After the move to the new domain: a notice on app pages (see MovedNotice).
  return appPage ? <MovedNotice /> : null;
}

"use client";

import { sendGAEvent } from "@next/third-parties/google";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type Banner = {
  id: string;
  title: string;
  imageUrl: string;
  mobileImageUrl: string | null;
  buttonLabel: string | null;
  buttonUrl: string | null;
};

const SLIDE_MS = 6000;
const SWIPE_PX = 40;

/** One banner image, using the phone image on small screens when set. */
export function BannerSlide({ banner }: { banner: Banner }) {
  const image = (
    <picture className="block h-full w-full">
      {banner.mobileImageUrl && (
        <source media="(max-width: 639px)" srcSet={banner.mobileImageUrl} />
      )}
      <img
        src={banner.imageUrl}
        alt={banner.title}
        draggable={false}
        className="h-full w-full object-cover"
      />
    </picture>
  );
  if (!banner.buttonUrl) return image;

  const internal = banner.buttonUrl.startsWith("/");
  const content = (
    <>
      {image}
      <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#1C1D52] shadow-[0_8px_20px_rgba(0,0,0,0.25)] sm:bottom-4 sm:right-4 sm:px-5 sm:py-2.5 sm:text-sm">
        {banner.buttonLabel}
        <ArrowUpRight className="h-4 w-4" />
      </span>
    </>
  );
  const props = {
    className: "relative block h-full w-full",
    onClick: () =>
      sendGAEvent("event", "banner_click", { banner: banner.title }),
  };
  return internal ? (
    <Link href={banner.buttonUrl} {...props}>
      {content}
    </Link>
  ) : (
    <a
      href={banner.buttonUrl}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {content}
    </a>
  );
}

/**
 * Admin-managed banners that slide at the top of internship workspace pages.
 * Renders nothing when no banner is live.
 */
export default function DashboardBanner() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    fetch("/api/internship/banners", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setBanners(data?.banners ?? []))
      .catch((error) => console.error("Failed to load banners:", error));
  }, []);

  const count = banners.length;
  useEffect(() => {
    if (count < 2 || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => clearInterval(id);
  }, [count, paused]);

  if (count === 0) return null;
  const current = index % count;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Academy announcements"
      className="mb-5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0].clientX;
        setPaused(true);
      }}
      onTouchEnd={(event) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        setPaused(false);
        if (start === null) return;
        const dx = event.changedTouches[0].clientX - start;
        if (Math.abs(dx) < SWIPE_PX) return;
        setIndex((current + (dx < 0 ? 1 : count - 1)) % count);
      }}
    >
      <div className="relative aspect-[2/1] overflow-hidden rounded-2xl bg-[#1C1D52] shadow-[0_12px_28px_rgba(28,29,82,0.14)] sm:aspect-[4/1]">
        <div
          className="flex h-full transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {banners.map((banner, i) => (
            <div
              key={banner.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={i !== current}
              inert={i !== current}
              className="h-full w-full shrink-0"
            >
              <BannerSlide banner={banner} />
            </div>
          ))}
        </div>
      </div>
      {count > 1 && (
        <div className="mt-2.5 flex justify-center gap-1.5">
          {banners.map((banner, i) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show banner ${i + 1}`}
              aria-current={i === current}
              className={`h-2 rounded-full transition-all ${i === current ? "w-6 bg-[#5FBB46]" : "w-2 bg-[#1C1D52]/20 hover:bg-[#1C1D52]/40"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

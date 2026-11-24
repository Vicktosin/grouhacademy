"use client";

import Image from "next/image";
import React, { useEffect, useState } from "react";
import type { PublicTestimonial } from "@/lib/testimonials";

type Story = {
  name: string;
  role: string;
  quote: string;
  /** Without a picture, the person's initials are shown. */
  avatar?: string;
  outcome?: string;
};

const STORIES: Story[] = [
  {
    name: "Amara Osei",
    role: "Frontend Engineer · Flutterwave",
    avatar:
      "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=120&h=120&fit=crop&auto=format",
    quote:
      "SabiRole's internship program gave me real projects that actually mattered. Within 3 months of graduating I landed a role at Flutterwave. The mentorship here is unmatched.",
    outcome: "Hired in 3 months",
  },
  {
    name: "David Mensah",
    role: "Data Analyst · MTN Group",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&auto=format",
    quote:
      "I came in with zero coding experience. The structured curriculum and weekly feedback from instructors made everything click. The Data Science track was the best investment I've made.",
    outcome: "Promoted after 6 months",
  },
  {
    name: "Fatima Al-Hassan",
    role: "Product Designer · Paystack",
    avatar:
      "https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=120&h=120&fit=crop&auto=format",
    quote:
      "The UX course didn't just teach me tools — it taught me how to think like a designer. My portfolio projects from SabiRole got me past every interview screen.",
    outcome: "4 job offers",
  },
];

// Longer stories are shortened behind a "Read more" button.
const LONG_QUOTE = 320;

function shorten(quote: string) {
  if (quote.length <= LONG_QUOTE) return quote;
  const cut = quote.slice(0, LONG_QUOTE);
  return `${cut.slice(0, cut.lastIndexOf(" ")).trimEnd()}…`;
}

function initials(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return picked.map((word) => word[0].toUpperCase()).join("");
}

function Avatar({ story, size, className }: { story: Story; size: number; className: string }) {
  if (story.avatar)
    return (
      <Image src={story.avatar} alt={story.name} width={size} height={size} className={`${className} object-cover`} />
    );
  return (
    <span
      aria-hidden="true"
      className={`${className} flex shrink-0 items-center justify-center font-bold text-white`}
      style={{ backgroundColor: "#2b2e83", fontSize: size * 0.36 }}
    >
      {initials(story.name)}
    </span>
  );
}

const Testimonials = ({ interns = [] }: { interns?: PublicTestimonial[] }) => {
  // Our own interns first.
  const stories: Story[] = [
    ...interns.map(({ name, track, quote }) => ({ name, role: `${track} · SabiRole intern`, quote })),
    ...STORIES,
  ];
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused || expanded) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % stories.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [isPaused, expanded, stories.length]);

  function show(index: number) {
    setActive(index);
    setExpanded(false);
  }

  const story = stories[active];
  const isLong = story.quote.length > LONG_QUOTE;
  // The next two stories.
  const upNext = [1, 2].map((step) => (active + step) % stories.length);

  return (
    <section
      id="success-stories"
      className="py-24 lg:py-32"
      style={{ backgroundColor: "#f8f9fe" }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1fr_2fr] gap-16 items-start">
          <div className="lg:sticky lg:top-32">
            <div className="inline-flex items-center gap-2 mb-4">
              <div
                className="w-8 h-px"
                style={{ backgroundColor: "#4db848" }}
              />
              <span
                className="text-sm font-semibold tracking-widest uppercase"
                style={{ color: "#4db848" }}
              >
                Success Stories
              </span>
            </div>
            <h2
              className="text-4xl lg:text-5xl font-black leading-tight mb-6"
              style={{ fontFamily: "Fraunces, serif", color: "#141650" }}
            >
              Results our
              <br />
              students speak about.
            </h2>
            <p className="text-gray-500 mb-8">
              Real outcomes from real students — not marketing copy.
            </p>

            {/* Avatars selector */}
            <div className="flex flex-wrap gap-3">
              {stories.map((t, i) => (
                <button
                  key={i}
                  onClick={() => show(i)}
                  aria-label={`Read ${t.name}'s story`}
                  aria-pressed={i === active}
                  className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-all ${
                    i === active ? "scale-110" : "opacity-60 hover:opacity-80"
                  }`}
                  style={{
                    borderColor: i === active ? "#4db848" : "transparent",
                  }}
                >
                  <Avatar story={t} size={48} className="h-full w-full" />
                </button>
              ))}
            </div>
          </div>

          {/* Featured testimonial */}
          <div>
            <div
              className="rounded-3xl p-8 lg:p-12 relative overflow-hidden"
              style={{ backgroundColor: "#141650" }}
            >
              <div
                className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
                style={{
                  background: "radial-gradient(circle, #4db848, transparent)",
                  transform: "translate(30%, -30%)",
                }}
              />
              <svg
                className="mb-6 opacity-30"
                width="48"
                height="36"
                viewBox="0 0 48 36"
                fill="white"
              >
                <path d="M0 36V22.8C0 11.2 5.2 3.6 15.6 0l3.6 4.8C14.4 7.2 11.6 11.6 11.2 18H20V36H0zm28 0V22.8C28 11.2 33.2 3.6 43.6 0l3.6 4.8C42.4 7.2 39.6 11.6 39.2 18H48V36H28z" />
              </svg>

              <p
                className="text-white/90 text-xl lg:text-2xl leading-relaxed font-medium mb-8 whitespace-pre-line"
                style={{ fontFamily: "Fraunces, serif" }}
              >
                {expanded ? story.quote : shorten(story.quote)}
                {isLong && (
                  <button
                    type="button"
                    onClick={() => setExpanded((open) => !open)}
                    aria-expanded={expanded}
                    className="ml-2 text-base font-semibold underline underline-offset-4"
                    style={{ color: "#4db848" }}
                  >
                    {expanded ? "Show less" : "Read more"}
                  </button>
                )}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar story={story} size={56} className="h-14 w-14 rounded-full border-2 border-[#4db848]" />
                  <div>
                    <div className="text-white font-bold">
                      {story.name}
                    </div>
                    <div className="text-white/60 text-sm">
                      {story.role}
                    </div>
                  </div>
                </div>
                {story.outcome && (
                  <div
                    className="px-4 py-2 rounded-full text-sm font-semibold"
                    style={{
                      backgroundColor: "rgba(77,184,72,0.2)",
                      color: "#4db848",
                    }}
                  >
                    {story.outcome}
                  </div>
                )}
              </div>
            </div>

            {/* Mini cards */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              {upNext.map((index) => ({ t: stories[index], index })).map(({ t, index }) => (
                <button
                  key={index}
                  onClick={() => show(index)}
                  className="text-left p-5 bg-white rounded-2xl border border-gray-100 hover:border-green-200 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar story={t} size={32} className="h-8 w-8 rounded-full" />
                    <span
                      className="text-sm font-semibold"
                      style={{ color: "#141650" }}
                    >
                      {t.name}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">
                    {t.quote}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;

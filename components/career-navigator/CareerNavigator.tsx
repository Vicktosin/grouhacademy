"use client";

import { sendGAEvent } from "@next/third-parties/google";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import CommunityLink from "@/components/CommunityLink";
import {
  QUESTIONS,
  SKILLS,
  TRAITS,
  bearing,
  rankSkills,
  reasonsFor,
  topTraits,
  type NavigatorOffer,
  type SkillId,
} from "@/lib/career-navigator";
import logoWhite from "@/public/logo-white.png";
import Compass from "./Compass";
import LeadForm from "./LeadForm";

// A short quiz that points people to a digital skill. Nothing they answer is
// saved or sent anywhere, apart from anonymous Analytics events, unless they
// choose to leave their number (LeadForm).

type Offers = Partial<Record<SkillId, NavigatorOffer>> | null;

const primary =
  "inline-flex min-h-13 items-center justify-center rounded-full bg-[#7BE05E] px-6 py-4 text-center sm:whitespace-nowrap text-base font-extrabold text-[#0B0D33] transition hover:bg-[#95ec7c] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white";
const secondary =
  "inline-flex min-h-13 items-center justify-center rounded-full border border-white/30 px-6 py-4 text-center sm:whitespace-nowrap text-base font-semibold text-white transition hover:bg-white/10 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white";

export default function CareerNavigator({
  offers,
  siteUrl,
  leadForm,
}: {
  offers: Offers;
  siteUrl: string;
  /** Leads are connected (docs/career-navigator-sheet.md). */
  leadForm: boolean;
}) {
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [needle, setNeedle] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const done = answers.length === QUESTIONS.length;
  const ranking = answers.length ? rankSkills(answers) : [];

  // Each new screen starts at the top, with its heading read out.
  useEffect(() => {
    if (!started) return;
    window.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [started, answers.length]);

  function update(next: number[]) {
    setAnswers(next);
    const target = next.length ? bearing(rankSkills(next)[0].id) : 0;
    // Turn the short way round.
    setNeedle((current) => current + ((((target - current) % 360) + 540) % 360) - 180);
  }

  function start() {
    setStarted(true);
    sendGAEvent("event", "navigator_start", {});
  }

  function choose(option: number) {
    const next = [...answers, option];
    update(next);
    if (next.length === QUESTIONS.length) sendGAEvent("event", "navigator_complete", { skill: rankSkills(next)[0].id });
  }

  return (
    <main
      className="navigator min-h-screen text-white"
      style={{ background: "radial-gradient(circle at 70% 10%, #23266f 0%, #11133f 45%, #0B0D33 100%)" }}
    >
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <span className="text-lg font-extrabold tracking-tight">Career Navigator</span>
          <a href={siteUrl} className="flex items-center gap-2 text-xs text-white/60">
            by <Image src={logoWhite} alt="Sabirole" className="h-7 w-auto" priority />
          </a>
        </header>

        {!started ? (
          <section className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-2">
            <div>
              <h1 className="font-extrabold tracking-tight">
                Not sure which skill to learn?
              </h1>
              <p className="mt-6 max-w-md text-lg leading-7 text-white/75">
                Answer 12 quick questions and we&apos;ll point you to the digital skill that fits you.
              </p>
              <button type="button" onClick={start} className={`${primary} mt-8`}>
                Find my direction
              </button>
              <p className="mt-4 text-sm text-white/60">Free. About 2 minutes. No sign-up.</p>
            </div>
            <Compass ranking={[]} needle={0} className="navigator-drift mx-auto w-full max-w-sm lg:max-w-lg" />
          </section>
        ) : !done ? (
          <section className="grid flex-1 content-center items-center gap-6 py-6 lg:grid-cols-[1fr_1.3fr] lg:gap-14">
            <Compass ranking={ranking} needle={needle} className="mx-auto w-40 sm:w-56 lg:w-full lg:max-w-md" />
            <div>
              <p className="text-sm font-semibold text-[#7BE05E]">
                {answers.length + 1} of {QUESTIONS.length}
              </p>
              <div className="mt-2 h-1 rounded-full bg-white/15">
                <div
                  className="h-1 rounded-full bg-[#7BE05E] transition-all duration-500"
                  style={{ width: `${(answers.length / QUESTIONS.length) * 100}%` }}
                />
              </div>
              <h2 ref={heading} tabIndex={-1} className="mt-6 font-extrabold outline-none">
                {QUESTIONS[answers.length].text}
              </h2>
              <div key={answers.length} className="navigator-enter mt-6 grid gap-3">
                {QUESTIONS[answers.length].options.map((option, index) => (
                  <button
                    key={option.text}
                    type="button"
                    onClick={() => choose(index)}
                    className="rounded-2xl border border-white/20 bg-white/5 px-5 py-4 text-left text-base transition hover:border-[#7BE05E] hover:bg-white/10 focus-visible:outline-3 focus-visible:outline-[#7BE05E] sm:text-lg"
                  >
                    {option.text}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => (answers.length ? update(answers.slice(0, -1)) : setStarted(false))}
                className="mt-5 py-2 text-sm font-semibold text-white/70 underline underline-offset-4"
              >
                Back
              </button>
            </div>
          </section>
        ) : (
          <Result
            answers={answers}
            needle={needle}
            offers={offers}
            siteUrl={siteUrl}
            leadForm={leadForm}
            heading={heading}
            onRestart={() => {
              update([]);
              setStarted(false);
            }}
          />
        )}
      </div>
      <style>{`
        /* The site styles headings with !important in this layer, so it can only be overridden here. */
        @layer base { main.navigator :is(h1, h2, h3, p, button, a) { font-family: inherit !important; } }
        @layer base { main.navigator h1 { font-size: clamp(2.75rem, 7vw, 4.5rem) !important; line-height: 1 !important; font-weight: 800 !important; letter-spacing: -0.03em; } }
        @layer base { main.navigator h2 { font-size: clamp(1.6rem, 3.4vw, 2.25rem) !important; line-height: 1.15 !important; font-weight: 800 !important; } }
        .navigator-needle { transition: transform 1.1s cubic-bezier(.3,1.6,.5,1); }
        .navigator-enter { animation: navigator-enter .35s ease both; }
        .navigator-drift .navigator-needle { animation: navigator-drift 7s ease-in-out infinite; }
        @keyframes navigator-enter { from { opacity: 0; transform: translateY(10px); } }
        @keyframes navigator-drift { 0%,100% { rotate: -28deg; } 50% { rotate: 46deg; } }
        @media (prefers-reduced-motion: reduce) {
          .navigator :is(h1, h2, h3, button, a) { font-family: inherit; }
        .navigator-needle { transition: none; }
          .navigator-enter, .navigator-drift .navigator-needle { animation: none; }
        }
      `}</style>
    </main>
  );
}

function Result({
  answers,
  needle,
  offers,
  siteUrl,
  leadForm,
  heading,
  onRestart,
}: {
  answers: number[];
  needle: number;
  offers: Offers;
  siteUrl: string;
  leadForm: boolean;
  heading: React.RefObject<HTMLHeadingElement | null>;
  onRestart: () => void;
}) {
  const ranking = rankSkills(answers);
  const id = ranking[0].id;
  const skill = SKILLS[id];
  const offer = offers?.[id];
  // Offers that couldn't be loaded aren't "opening soon": just no price.
  const open = offers === null || Boolean(offer);
  const shareText = `My Career Navigator direction is ${skill.name}. Find yours: ${siteUrl}/career-navigator`;

  function lead(skillId: SkillId) {
    sendGAEvent("event", "generate_lead", { location: "career_navigator", skill: skillId });
  }

  return (
    <section className="flex-1 py-8">
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-[#7BE05E]">Your direction</p>
          <h1 ref={heading} tabIndex={-1} className="mt-2 font-extrabold tracking-tight outline-none">
            {skill.name}
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-7 text-white/80">{skill.what}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {open ? (
              <a href={`${siteUrl}/register`} onClick={() => lead(id)} className={primary}>
                {offer && offer.price > 0 ? `Start with Sabirole for ₦${offer.price.toLocaleString("en-NG")}` : "Start with Sabirole"}
              </a>
            ) : (
              <CommunityLink location="career_navigator_soon" className={primary}>
                Opening soon: join to hear first
              </CommunityLink>
            )}
            {open && (
              <CommunityLink location="career_navigator" className={secondary}>
                Join our WhatsApp community
              </CommunityLink>
            )}
          </div>
          {offer && (
            <a href={`${siteUrl}/tracks?track=${offer.slug}`} className="mt-4 inline-block py-1 text-sm font-semibold text-white/75 underline underline-offset-4">
              See what you&apos;ll learn
            </a>
          )}
        </div>
        <Compass ranking={ranking} needle={needle} named className="mx-auto w-full max-w-md" />
      </div>

      <div className="mt-12 grid gap-10 border-t border-white/15 pt-10 lg:grid-cols-2">
        <div>
          <h2 className="font-extrabold">Why this fits you</h2>
          <ul className="mt-4 space-y-4">
            {reasonsFor(id, answers).map(({ question, answer }) => (
              <li key={question}>
                <p className="text-sm text-white/60">{question}</p>
                <p className="text-lg">{answer}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-extrabold">Your strengths</h2>
          <ul className="mt-4 space-y-4">
            {topTraits(answers).map((trait) => (
              <li key={trait}>
                <p className="text-lg font-semibold text-[#7BE05E]">{TRAITS[trait].name}</p>
                <p className="text-white/80">{TRAITS[trait].text}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-extrabold">What the work looks like</h2>
          <p className="mt-3 text-lg leading-7 text-white/80">{skill.day}</p>
        </div>
        <div>
          <h2 className="font-extrabold">Try this today</h2>
          <p className="mt-3 text-lg leading-7 text-white/80">{skill.firstStep}</p>
        </div>
      </div>

      {leadForm && (
        <div className="mt-12 border-t border-white/15 pt-10">
          <h2 className="font-extrabold">Want help getting started?</h2>
          <p className="mb-5 mt-2 text-white/75">Leave your WhatsApp number and we&apos;ll guide you.</p>
          <LeadForm skill={id} buttonClass={primary} />
        </div>
      )}

      <div className="mt-12 border-t border-white/15 pt-10">
        <h2 className="font-extrabold">Also worth a look</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {ranking.slice(1, 3).map((item) => {
            const other = offers?.[item.id];
            return (
              <div key={item.id} className="rounded-2xl border border-white/20 p-5">
                <h3 className="text-xl font-extrabold">{SKILLS[item.id].name}</h3>
                <p className="mt-1 text-white/75">{SKILLS[item.id].what}</p>
                {other ? (
                  <a href={`${siteUrl}/tracks?track=${other.slug}`} className="mt-3 inline-block py-1 text-sm font-semibold text-[#7BE05E] underline underline-offset-4">
                    See what you&apos;ll learn
                  </a>
                ) : (
                  offers && <p className="mt-3 text-sm text-white/60">Opening soon</p>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => sendGAEvent("event", "share", { method: "whatsapp", content_type: "career_navigator" })}
            className={secondary}
          >
            Share on WhatsApp
          </a>
          <button type="button" onClick={onRestart} className={secondary}>
            Start again
          </button>
        </div>
        <p className="mt-8 max-w-xl text-sm leading-6 text-white/60">
          A friendly guide based on your answers, not a scientific test. {leadForm
            ? "We don't save your answers. If you leave your number, we keep it with your result."
            : "We don't save your answers."}
        </p>
      </div>
    </section>
  );
}

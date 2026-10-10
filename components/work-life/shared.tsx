"use client";

import type { workLifeDay } from "@/lib/work-life/server";
import type { Feedback } from "@/lib/work-life/grade";
import type { PersonId } from "@/lib/work-life/story";

// What the Work Life apps share: the day's data, people's avatars, and the
// coach's feedback card (seen only by the intern, outside the "world").

export type DayData = Exclude<Awaited<ReturnType<typeof workLifeDay>>, { error: unknown }>;
export type StepView = DayData["steps"][number];
export type PersonView = DayData["people"][number];
/** Does the next step; resolves to an error message, or null when it worked. */
export type Act = (body: Record<string, unknown>) => Promise<string | null>;

const COLOURS: Record<PersonId, string> = {
  ceo: "bg-[#7B1FA2]",
  manager: "bg-[#1565C0]",
  supporter: "bg-[#2E7D32]",
  challenger: "bg-[#C62828]",
  client: "bg-[#EF6C00]",
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function Avatar({ person, size = "h-9 w-9 text-[13px]" }: { person: PersonView | "you"; size?: string }) {
  if (person === "you")
    return <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-[#5F6368] font-semibold text-white`}>You</span>;
  return (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${COLOURS[person.id]}`}>
      {initials(person.name)}
    </span>
  );
}

export const personById = (people: PersonView[], id: PersonId) => people.find((person) => person.id === id)!;

export const timeLabel = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";

/** The coach's view of a piece of work: only the intern sees this. */
export function CoachCard({ feedback }: { feedback: Feedback }) {
  const tone = feedback.score >= 85 ? "text-[#137333]" : feedback.score >= 60 ? "text-[#B06000]" : "text-[#C5221F]";
  return (
    <div className="mt-4 rounded-xl border border-[#DADCE0] bg-[#F8F9FA] p-4 text-[13px] text-[#3C4043]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#5F6368]">Coach feedback · only you see this</p>
        <p className={`text-[18px] font-bold ${tone}`}>{feedback.score}/100</p>
      </div>
      {feedback.strengths.length > 0 && (
        <div className="mt-2">
          <p className="font-semibold text-[#137333]">What worked</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {feedback.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {feedback.improvements.length > 0 && (
        <div className="mt-2">
          <p className="font-semibold text-[#B06000]">To do better</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {feedback.improvements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {feedback.source === "rules" && <p className="mt-2 text-[11px] text-[#80868B]">Marked by simple rules (detailed feedback was unavailable).</p>}
    </div>
  );
}

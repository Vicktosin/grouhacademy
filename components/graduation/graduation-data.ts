"use client";

import { useEffect, useState } from "react";

// The graduation data (/api/internship/testimonial), loaded once per page
// and shared by the pop-up, the "My graduation flyer" button and the
// testimonial page. Events let any of them open the pop-up.

export type GraduationData = {
  trackName: string;
  levelName: string | null;
  cohortName: string | null;
  driveFolderUrl: string | null;
  graduated: boolean;
  certificateId: string | null;
  isPreview: boolean;
  /** False once enough interns have sent voice notes (VOICE_NOTE_LIMIT). */
  voiceNotesOpen: boolean;
  /** Has shared their experience (any application). Graduates must, before their certificate. */
  experienceShared: boolean;
  studentName: string;
  flyerUrl: string | null;
  testimonial: {
    videoLink: string | null;
    voiceNoteUrl: string | null;
    testimonial: string;
    rating: number | null;
    consent: boolean;
    updatedAt: string;
  } | null;
};

/** Opens the graduation pop-up (dashboard button, preview banner, …). */
export const OPEN_GRADUATION_EVENT = "sabirole:open-graduation";
// The graduation pop-up is the first thing a graduate sees after logging
// in; the dashboard's level-complete congratulations (LevelCompleteModal)
// waits until it is closed or decides not to open.
let settleGraduation: () => void = () => {};
const graduationSettled = new Promise<void>((resolve) => {
  settleGraduation = resolve;
});
export function markGraduationSettled() {
  settleGraduation();
}
export function whenGraduationSettled() {
  return graduationSettled;
}

export function openGraduation(step: "flyer" | "experience" = "flyer") {
  window.dispatchEvent(new CustomEvent(OPEN_GRADUATION_EVENT, { detail: { step } }));
}

let cached: GraduationData | null = null;
let pending: Promise<GraduationData | null> | null = null;
const listeners = new Set<(data: GraduationData | null) => void>();

export function loadGraduation(force = false): Promise<GraduationData | null> {
  if (cached && !force) return Promise.resolve(cached);
  if (pending && !force) return pending;
  pending = fetch("/api/internship/testimonial", { cache: "no-store" })
    .then((response) => (response.ok ? (response.json() as Promise<GraduationData>) : null))
    .catch(() => null)
    .then((data) => {
      cached = data;
      pending = null;
      for (const listener of listeners) listener(data);
      return data;
    });
  return pending;
}

/** Updates the shared copy (after a save) for everyone using it. */
export function updateGraduation(patch: Partial<GraduationData>) {
  if (!cached) return;
  cached = { ...cached, ...patch };
  for (const listener of listeners) listener(cached);
}

export function useGraduation(enabled = true) {
  const [data, setData] = useState<GraduationData | null>(cached);
  const [loaded, setLoaded] = useState(Boolean(cached));
  useEffect(() => {
    if (!enabled) return;
    const listener = (value: GraduationData | null) => {
      setData(value);
      setLoaded(true);
    };
    listeners.add(listener);
    void loadGraduation().then(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [enabled]);
  return { data, loaded };
}

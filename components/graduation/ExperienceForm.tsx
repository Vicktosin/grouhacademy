"use client";

import { CheckCircle2, ExternalLink, LoaderCircle, Mic, PenLine, RotateCcw, Square, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DRIVE_UPLOAD_INSTRUCTIONS, VOICE_NOTE_MAX_SECONDS } from "@/lib/testimonial-input";
import { updateGraduation, type GraduationData } from "./graduation-data";

// Step 2 of graduation (and the testimonial page): the graduate shares
// their experience one of three ways. A video is recommended (it glows): it
// goes to the Google Drive folder and they paste the link. Or a voice note
// recorded here, or a few written words.

type Choice = "video" | "voice" | "write";

const fieldClass =
  "mt-1.5 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#1C1D52] outline-none focus:border-[#0B7D54]";

const RECORDER_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export default function ExperienceForm({ data, onDone }: { data: GraduationData; onDone?: () => void }) {
  const existing = data.testimonial;
  const [choice, setChoice] = useState<Choice | null>(
    existing?.videoLink ? "video" : existing?.voiceNoteUrl ? "voice" : existing?.testimonial ? "write" : null,
  );
  const [videoLink, setVideoLink] = useState(existing?.videoLink ?? "");
  const [uploadedNoLink, setUploadedNoLink] = useState(false);
  const [text, setText] = useState(existing?.testimonial ?? "");
  const [consent, setConsent] = useState(existing?.consent ?? false);
  const [voice, setVoice] = useState<{ blob: Blob; url: string } | null>(null);
  const [savedVoiceUrl, setSavedVoiceUrl] = useState(existing?.voiceNoteUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setError(null);
    let body: Record<string, unknown> = { consent };
    if (choice === "video") {
      const link = videoLink.trim();
      if (!link && !uploadedNoLink) return setError("Paste the link to your video, or tick that you've uploaded it.");
      // Without their file's own link, the folder link tells admins where to look.
      body = { ...body, videoLink: link || data.driveFolderUrl };
    } else if (choice === "voice") {
      if (!voice && !savedVoiceUrl) return setError("Record your voice note first.");
      body = { ...body, voiceNoteUrl: savedVoiceUrl };
    } else if (choice === "write") {
      if (text.trim().length < 20) return setError("Please write a little more about your experience (at least a sentence or two).");
      body = { ...body, testimonial: text };
    } else return;

    setSaving(true);
    try {
      if (choice === "voice" && voice) {
        const form = new FormData();
        const type = voice.blob.type.split(";")[0] || "audio/webm";
        const extension = type.includes("mp4") ? "m4a" : type.split("/")[1];
        form.append("file", new File([voice.blob], `voice-note.${extension}`, { type }));
        const upload = await fetch("/api/internship/testimonial/voice", { method: "POST", body: form });
        const uploaded = await upload.json().catch(() => null);
        if (!upload.ok || typeof uploaded?.url !== "string") throw new Error(uploaded?.error ?? "Unable to upload your voice note.");
        setSavedVoiceUrl(uploaded.url);
        setVoice(null);
        body.voiceNoteUrl = uploaded.url;
      }
      const response = await fetch("/api/internship/testimonial", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Unable to save. Please try again.");
      updateGraduation({
        testimonial: {
          videoLink: (body.videoLink as string) ?? null,
          voiceNoteUrl: (body.voiceNoteUrl as string) ?? null,
          testimonial: (body.testimonial as string) ?? "",
          rating: null,
          consent,
          updatedAt: new Date().toISOString(),
        },
      });
      setDone(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (done)
    return (
      <div className="py-6 text-center" role="status">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[#0B7D54]" aria-hidden="true" />
        <p className="mt-3 text-lg font-bold text-[#1C1D52]">Thank you, graduate! 🎉</p>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-slate-500">
          We&apos;ve received your experience. It means a lot to us and to future interns.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {onDone && (
            <button type="button" onClick={onDone} className="rounded-xl bg-[#0B7D54] px-4 py-3 text-sm font-bold text-white">
              Done
            </button>
          )}
          <button type="button" onClick={() => setDone(false)} className="text-xs font-semibold text-slate-500 underline">
            Edit what I shared
          </button>
        </div>
      </div>
    );

  const cards: { id: Choice; icon: typeof Video; title: string; text: string }[] = [
    { id: "video", icon: Video, title: "Upload a video", text: "30–90 seconds about your experience" },
    { id: "voice", icon: Mic, title: "Drop a voice note", text: "Record up to 3 minutes right here" },
    { id: "write", icon: PenLine, title: "Write about it", text: "A few words about your month" },
  ];

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0B7D54]">One more thing</p>
      <h2 id="graduation-title" className="mt-1 text-xl font-bold leading-snug text-[#1C1D52]">
        Tell us about your experience
      </h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        How was your month on the Sabirole internship{data.trackName ? ` in ${data.trackName}` : ""}? Choose one way to share it.
      </p>

      <div className="mt-4 grid gap-2.5" role="radiogroup" aria-label="How would you like to share your experience?">
        {cards.map(({ id, icon: Icon, title, text: hint }) => {
          const selected = choice === id;
          const recommended = id === "video";
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                setChoice(id);
                setError(null);
              }}
              className={`relative flex items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition ${
                selected ? "border-[#0B7D54] bg-[#f1faf5]" : "border-slate-200 bg-white hover:border-slate-300"
              } ${recommended ? "graduation-glow" : ""}`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  recommended ? "bg-[#0B7D54] text-white" : "bg-[#edf9f3] text-[#0B7D54]"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#1C1D52]">
                  {title}
                  {recommended && (
                    <span className="rounded-full bg-[#F5A20A] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#3A2A00]">
                      Recommended
                    </span>
                  )}
                </span>
                <span className="block text-[11px] text-slate-500">{hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {choice === "video" && (
        <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4">
          <p className="text-xs leading-5 text-slate-600">
            Record a short video on your phone (30–90 seconds). Say your name, your track and what the internship meant to you.{" "}
            {DRIVE_UPLOAD_INSTRUCTIONS}
          </p>
          {data.driveFolderUrl ? (
            <a
              href={data.driveFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#12306B] px-4 py-2.5 text-xs font-bold text-white"
            >
              Open the Google Drive folder <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : (
            <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-500">The video folder isn&apos;t open yet. Please choose a voice note or writing for now.</p>
          )}
          <label className="block text-xs font-semibold text-[#1C1D52]">
            Link to your video (from Google Drive)
            <input
              type="url"
              inputMode="url"
              value={videoLink}
              onChange={(e) => setVideoLink(e.target.value)}
              placeholder="https://drive.google.com/…"
              maxLength={2000}
              className={fieldClass}
            />
          </label>
          {data.driveFolderUrl && (
            <label className="flex items-start gap-2 text-xs text-[#1C1D52]">
              <input type="checkbox" checked={uploadedNoLink} onChange={(e) => setUploadedNoLink(e.target.checked)} className="mt-0.5 accent-[#0B7D54]" />
              I&apos;ve uploaded my video to the folder but can&apos;t find its link
            </label>
          )}
        </div>
      )}

      {choice === "voice" && (
        <VoiceRecorder
          voice={voice}
          savedUrl={savedVoiceUrl}
          onRecorded={(blob) => {
            setError(null);
            setSavedVoiceUrl(null);
            setVoice((old) => {
              if (old) URL.revokeObjectURL(old.url);
              return { blob, url: URL.createObjectURL(blob) };
            });
          }}
          onError={setError}
        />
      )}

      {choice === "write" && (
        <label className="mt-4 block text-xs font-semibold text-[#1C1D52]">
          Your experience
          <textarea
            rows={6}
            maxLength={5000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What did you learn, build or enjoy? How has the internship helped you?"
            className={`${fieldClass} resize-y`}
          />
        </label>
      )}

      {choice && (
        <>
          <label className="mt-4 flex items-start gap-2 text-xs text-[#1C1D52]">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[#0B7D54]" />
            <span>Sabirole may share my flyer, video, voice note or words publicly</span>
          </label>
          {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B7D54] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {existing ? "Update my experience" : "Send my experience"}
          </button>
        </>
      )}

      {/* The glow on the recommended card. */}
      <style>{`
        @keyframes graduation-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(11,125,84,0.45), 0 0 14px 2px rgba(95,187,70,0.35); } 50% { box-shadow: 0 0 0 4px rgba(11,125,84,0.18), 0 0 26px 8px rgba(95,187,70,0.55); } }
        .graduation-glow { animation: graduation-glow 2.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .graduation-glow { animation: none; box-shadow: 0 0 0 3px rgba(11,125,84,0.3); } }
      `}</style>
    </div>
  );
}

function VoiceRecorder({
  voice,
  savedUrl,
  onRecorded,
  onError,
}: {
  voice: { blob: Blob; url: string } | null;
  savedUrl: string | null;
  onRecorded: (blob: Blob) => void;
  onError: (message: string | null) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | null>(null);
  const canRecord = typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function start() {
    onError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      const rec = new MediaRecorder(stream, { ...(mimeType && { mimeType }), audioBitsPerSecond: 64_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (event) => event.data.size && chunks.push(event.data);
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (timer.current) window.clearInterval(timer.current);
        setRecording(false);
        const blob = new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" });
        if (blob.size) onRecorded(blob);
      };
      recorder.current = rec;
      rec.start(1000);
      setSeconds(0);
      setRecording(true);
      const began = Date.now();
      timer.current = window.setInterval(() => {
        const elapsed = (Date.now() - began) / 1000;
        setSeconds(elapsed);
        if (elapsed >= VOICE_NOTE_MAX_SECONDS && rec.state === "recording") rec.stop();
      }, 250);
    } catch {
      onError("We couldn't use your microphone. Allow microphone access in your browser, or choose another way to share.");
    }
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  return (
    <div className="mt-4 rounded-2xl bg-slate-50 p-4">
      <p className="text-xs leading-5 text-slate-600">
        Tell us your name, your track and what the internship meant to you. Up to {VOICE_NOTE_MAX_SECONDS / 60} minutes.
      </p>
      {!canRecord ? (
        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-500">
          Your browser can&apos;t record audio. Please choose a video or writing instead.
        </p>
      ) : recording ? (
        <div className="mt-3 flex items-center gap-3">
          <span className="relative flex h-3 w-3" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
          <span className="font-mono text-sm text-[#1C1D52]" aria-live="off">
            {formatTime(seconds)} / {formatTime(VOICE_NOTE_MAX_SECONDS)}
          </span>
          <button type="button" onClick={stop} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white">
            <Square className="h-3.5 w-3.5" aria-hidden="true" /> Stop
          </button>
        </div>
      ) : voice || savedUrl ? (
        <div className="mt-3 space-y-2">
          <audio controls src={voice?.url ?? savedUrl!} className="w-full" aria-label="Your voice note" />
          <button type="button" onClick={() => void start()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B7D54] underline">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Record again
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => void start()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#0B7D54] px-4 py-2.5 text-sm font-bold text-white">
          <Mic className="h-4 w-4" aria-hidden="true" /> Start recording
        </button>
      )}
    </div>
  );
}

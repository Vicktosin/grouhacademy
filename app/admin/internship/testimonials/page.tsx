"use client";

import { Check, Download, Eye, ExternalLink, ImageIcon, LoaderCircle, Mic, PenLine, Video, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { VOICE_NOTE_LIMIT } from "@/lib/testimonial-input";

// Graduation testimonials: each graduate's flyer (made in the graduation
// pop-up) and how they shared their experience: a video (in Google Drive;
// the link they pasted), a voice note, or writing. Filter by cohort, track,
// kind and status; approve or reject, tag, export CSV, and set the Google
// Drive folders interns upload videos to.

type Testimonial = {
  id: string;
  userId: string;
  name: string;
  email: string;
  isPreview: boolean;
  programId: string;
  track: string;
  level: string | null;
  cohortId: string | null;
  cohort: string | null;
  rating: number | null;
  testimonial: string;
  videoLink: string | null;
  voiceNoteUrl: string | null;
  flyerUrl: string | null;
  consent: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED";
  tags: string[];
  submittedAt: string;
  updatedAt: string;
};
type Cohort = { id: string; name: string; programName: string; driveUrl: string | null };
type DriveLinks = { global: string | null; cohorts: Cohort[] };
type Track = { id: string; name: string };
type Kind = "" | "video" | "voice" | "write" | "flyer-only";

const selectClass =
  "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-[#1C1D52] outline-none focus:border-[#5FBB46]";
const panel = "rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-6";
const statusChip: Record<Testimonial["status"], string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-slate-200 text-slate-600",
};

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const hasExperience = (t: Testimonial) => Boolean(t.videoLink || t.voiceNoteUrl || t.testimonial);

function matchesKind(t: Testimonial, kind: Kind) {
  if (kind === "video") return Boolean(t.videoLink);
  if (kind === "voice") return Boolean(t.voiceNoteUrl);
  if (kind === "write") return Boolean(t.testimonial);
  if (kind === "flyer-only") return Boolean(t.flyerUrl) && !hasExperience(t);
  return true;
}

export default function AdminTestimonialsPage() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [drive, setDrive] = useState<DriveLinks>({ global: null, cohorts: [] });
  const [tracks, setTracks] = useState<Track[]>([]);
  const [graduates, setGraduates] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);

  const [cohortId, setCohortId] = useState("");
  const [programId, setProgramId] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState<Kind>("");
  const [consentOnly, setConsentOnly] = useState(false);

  useEffect(() => {
    fetch("/api/admin/internship/testimonials", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? "Unable to load testimonials.");
        setItems(data.testimonials ?? []);
        setDrive(data.drive ?? { global: null, cohorts: [] });
        setTracks(data.tracks ?? []);
        setGraduates(typeof data.graduates === "number" ? data.graduates : null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load testimonials."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!lightbox) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setLightbox(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [lightbox]);

  const visible = useMemo(
    () =>
      items.filter(
        (t) =>
          (!cohortId || t.cohortId === cohortId) &&
          (!programId || t.programId === programId) &&
          (!status || t.status === status) &&
          (!consentOnly || t.consent) &&
          matchesKind(t, kind),
      ),
    [items, cohortId, programId, status, consentOnly, kind],
  );
  const real = items.filter((t) => !t.isPreview);

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (cohortId) params.set("cohortId", cohortId);
    if (programId) params.set("programId", programId);
    if (status) params.set("status", status);
    if (consentOnly) params.set("consentOnly", "1");
    const query = params.toString();
    return `/api/admin/internship/testimonials/export${query ? `?${query}` : ""}`;
  }, [cohortId, programId, status, consentOnly]);

  async function review(id: string, body: { status?: Testimonial["status"]; tags?: string[] }) {
    setError(null);
    setNotice(null);
    const response = await fetch(`/api/admin/internship/testimonials/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) return setError(data?.error ?? "Unable to update the testimonial.");
    setItems((list) => list.map((t) => (t.id === id ? { ...t, ...body } : t)));
  }

  async function saveDrive(targetCohortId: string | null, url: string) {
    setError(null);
    setNotice(null);
    const response = await fetch("/api/admin/internship/testimonials/drive", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cohortId: targetCohortId, url }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) return setError(data?.error ?? "Unable to save the link.");
    setDrive((d) =>
      targetCohortId
        ? { ...d, cohorts: d.cohorts.map((c) => (c.id === targetCohortId ? { ...c, driveUrl: data.url } : c)) }
        : { ...d, global: data.url },
    );
    setNotice(data.url ? "Drive folder saved." : "Drive folder cleared.");
  }

  // Voice notes close for new interns once this many people have sent one.
  const voicePeople = new Set(real.filter((t) => t.voiceNoteUrl).map((t) => t.userId)).size;
  const voiceLabel = `Voice notes (limit ${VOICE_NOTE_LIMIT}${voicePeople >= VOICE_NOTE_LIMIT ? ", closed" : ""})`;
  const stats: [string, number | null][] = [
    ["Graduates (certificate)", graduates],
    ["Flyers made", real.filter((t) => t.flyerUrl).length],
    ["Experiences shared", real.filter(hasExperience).length],
    ["Videos", real.filter((t) => t.videoLink).length],
    [voiceLabel, voicePeople],
    ["Written", real.filter((t) => t.testimonial).length],
  ];

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">Internship</p>
            <h1 className="mt-2 text-2xl font-semibold text-[#1C1D52] sm:text-3xl">Graduation testimonials</h1>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
              Interns who earn their internship certificate get a graduation pop-up: they make their flyer, then share a
              video (in Google Drive), a voice note or a few words.
            </p>
          </div>
          <Link
            href="/admin/internship/preview"
            className="inline-flex items-center gap-2 rounded-lg bg-[#B45309] px-4 py-2.5 text-[11px] font-semibold text-white"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" /> See it as an intern
          </Link>
        </header>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">{notice}</p>}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white px-5 py-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
              <p className="text-2xl font-bold text-[#1C1D52]">{loading || value === null ? "–" : value}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        <section className={panel}>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[10px] font-semibold text-[#1C1D52]">
              <span className="block">Cohort</span>
              <select value={cohortId} onChange={(e) => setCohortId(e.target.value)} className={`${selectClass} mt-1 max-w-[280px]`}>
                <option value="">All cohorts</option>
                {drive.cohorts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-semibold text-[#1C1D52]">
              <span className="block">Track</span>
              <select value={programId} onChange={(e) => setProgramId(e.target.value)} className={`${selectClass} mt-1`}>
                <option value="">All tracks</option>
                {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-semibold text-[#1C1D52]">
              <span className="block">Shared</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={`${selectClass} mt-1`}>
                <option value="">Anything</option>
                <option value="video">A video</option>
                <option value="voice">A voice note</option>
                <option value="write">Writing</option>
                <option value="flyer-only">Only a flyer so far</option>
              </select>
            </label>
            <label className="text-[10px] font-semibold text-[#1C1D52]">
              <span className="block">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${selectClass} mt-1`}>
                <option value="">Any status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pb-2 text-xs text-[#1C1D52]">
              <input type="checkbox" checked={consentOnly} onChange={(e) => setConsentOnly(e.target.checked)} className="accent-[#5FBB46]" />
              Consented only
            </label>
            <a href={exportHref} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-4 py-2.5 text-[10px] font-semibold text-white">
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> Export CSV
            </a>
          </div>

          <p className="mt-4 text-[10px] text-slate-500">
            {visible.filter((t) => !t.isPreview).length} shown · {visible.filter((t) => !t.isPreview && t.consent).length} with consent to share
          </p>

          {loading && <p className="mt-4 text-xs text-slate-500">Loading…</p>}
          {!loading && visible.length === 0 && (
            <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
              {items.length === 0
                ? "Nothing yet. Interns get the graduation pop-up as soon as their internship certificate is issued."
                : "Nothing matches these filters."}
            </p>
          )}

          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {visible.map((t) => (
              <TestimonialCard key={t.id} item={t} onReview={review} onOpenFlyer={(url) => setLightbox({ url, name: t.name })} />
            ))}
          </ul>
        </section>

        <DriveFolders drive={drive} onSave={saveDrive} />
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Graduation flyer of ${lightbox.name}`}
          onClick={() => setLightbox(null)}
        >
          <button type="button" onClick={() => setLightbox(null)} className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.url} alt={`Graduation flyer of ${lightbox.name}`} className="max-h-[85vh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          <a
            href={lightbox.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#1C1D52]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> Open full size
          </a>
        </div>
      )}
    </AdminShell>
  );
}

function TestimonialCard({
  item,
  onReview,
  onOpenFlyer,
}: {
  item: Testimonial;
  onReview: (id: string, body: { status?: Testimonial["status"]; tags?: string[] }) => Promise<void>;
  onOpenFlyer: (url: string) => void;
}) {
  const [tags, setTags] = useState(item.tags.join(", "));
  return (
    <li className={`flex gap-4 rounded-2xl border p-4 ${item.isPreview ? "border-dashed border-[#B45309] bg-amber-50/40" : "border-slate-200"}`}>
      {item.flyerUrl ? (
        <button
          type="button"
          onClick={() => onOpenFlyer(item.flyerUrl!)}
          className="shrink-0 self-start overflow-hidden rounded-lg border border-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5FBB46]"
          aria-label={`Open the graduation flyer of ${item.name}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.flyerUrl} alt="" loading="lazy" className="h-[150px] w-[120px] object-cover" />
        </button>
      ) : (
        <div className="flex h-[150px] w-[120px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 text-center text-[10px] text-slate-400">
          <ImageIcon className="h-5 w-5" aria-hidden="true" /> No flyer yet
        </div>
      )}

      <div className="min-w-0 flex-1">
        {item.isPreview && (
          <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-[#B45309] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            <Eye className="h-3 w-3" aria-hidden="true" /> Your preview: only you see this
          </p>
        )}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#1C1D52]">{item.name}</p>
            <p className="text-[10px] text-slate-500">
              {item.track}
              {item.level ? ` · ${item.level}` : ""}
              {item.cohort ? ` · ${item.cohort}` : ""}
            </p>
            {!item.isPreview && <p className="text-[10px] text-slate-400">{item.email}</p>}
          </div>
          <div className="flex flex-wrap gap-1.5 text-[9px] font-bold">
            {item.rating !== null && <span className="rounded-full bg-[#eef7ff] px-2 py-1 text-[#1C1D52]">{item.rating}/10</span>}
            <span className={`rounded-full px-2 py-1 ${item.consent ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
              {item.consent ? "May share" : "No consent to share"}
            </span>
            <span className={`rounded-full px-2 py-1 ${statusChip[item.status]}`}>{item.status}</span>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {item.videoLink && (
            <a href={item.videoLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2f7d52] underline">
              <Video className="h-3.5 w-3.5" aria-hidden="true" /> Open video in Google Drive <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
          {item.voiceNoteUrl && (
            <div>
              <p className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                <Mic className="h-3 w-3" aria-hidden="true" /> Voice note
              </p>
              <audio controls preload="none" src={item.voiceNoteUrl} className="h-9 w-full max-w-sm" aria-label={`Voice note from ${item.name}`} />
            </div>
          )}
          {item.testimonial && (
            <p className="whitespace-pre-line text-xs leading-5 text-slate-700">
              <PenLine className="mr-1 inline h-3 w-3 text-slate-400" aria-hidden="true" />
              {item.testimonial}
            </p>
          )}
          {!hasExperience(item) && <p className="text-[11px] text-slate-400">Made their flyer; hasn&apos;t shared their experience yet.</p>}
        </div>

        {!item.isPreview && hasExperience(item) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void onReview(item.id, { status: "APPROVED" })} disabled={item.status === "APPROVED"} className="inline-flex items-center gap-1 rounded-lg bg-[#5FBB46] px-3 py-1.5 text-[10px] font-semibold text-[#14204f] disabled:opacity-50">
              <Check className="h-3 w-3" aria-hidden="true" /> Approve
            </button>
            <button type="button" onClick={() => void onReview(item.id, { status: "REJECTED" })} disabled={item.status === "REJECTED"} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-[10px] font-semibold text-[#1C1D52] disabled:opacity-50">
              <X className="h-3 w-3" aria-hidden="true" /> Reject
            </button>
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                void onReview(item.id, { tags: tags.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean) });
              }}
            >
              <label className="sr-only" htmlFor={`tags-${item.id}`}>Tags for {item.name}</label>
              <input id={`tags-${item.id}`} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags, comma separated" className="w-36 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] outline-none focus:border-[#5FBB46]" />
              <button type="submit" className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-semibold text-[#1C1D52]">Save tags</button>
            </form>
          </div>
        )}
        <p className="mt-2 text-[9px] text-slate-400">Updated {shortDate(item.updatedAt)}</p>
      </div>
    </li>
  );
}

function DriveFolders({
  drive,
  onSave,
}: {
  drive: DriveLinks;
  onSave: (cohortId: string | null, url: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className={panel}>
      <h2 className="text-sm font-bold text-[#1C1D52]">Google Drive folders for videos</h2>
      <p className="mt-1 text-[10px] text-slate-500">
        Graduates who choose &ldquo;Upload a video&rdquo; get a button to their cohort&apos;s folder, or the global folder if their
        cohort has none. Share each folder so interns can upload.
      </p>
      <DriveRow key={drive.global ?? ""} label="Global folder (all cohorts without their own)" value={drive.global} onSave={(url) => onSave(null, url)} />
      {drive.global && (
        <a href={drive.global} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#2f7d52] underline">
          Open the global folder to watch the videos <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      )}
      <button type="button" onClick={() => setOpen((v) => !v)} className="mt-4 block text-[10px] font-semibold text-[#2f7d52] underline">
        {open ? "Hide cohort folders" : `Set a folder per cohort (${drive.cohorts.filter((c) => c.driveUrl).length} set)`}
      </button>
      {open && (
        <div className="mt-2 max-h-96 space-y-1 overflow-y-auto">
          {drive.cohorts.map((c) => (
            <DriveRow key={`${c.id}:${c.driveUrl ?? ""}`} label={c.name} value={c.driveUrl} onSave={(url) => onSave(c.id, url)} />
          ))}
        </div>
      )}
    </section>
  );
}

function DriveRow({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string | null;
  onSave: (url: string) => Promise<void>;
}) {
  // Remounted (key) when the saved value changes, so this starts from it.
  const [url, setUrl] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        await onSave(url);
        setSaving(false);
      }}
    >
      <label className="min-w-0 flex-1 text-[10px] font-semibold text-[#1C1D52]">
        {label}
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-normal outline-none focus:border-[#5FBB46]" />
      </label>
      <button type="submit" disabled={saving || url === (value ?? "")} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#5FBB46] px-3 py-2 text-[10px] font-semibold text-[#14204f] disabled:opacity-50">
        {saving && <LoaderCircle className="h-3 w-3 animate-spin" />} Save
      </button>
    </form>
  );
}

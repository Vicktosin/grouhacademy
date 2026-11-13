"use client";

import { Check, Download, ExternalLink, LoaderCircle, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/AdminShell";

// Intern testimonials: text, rating, consent and Drive video links (videos
// are never uploaded to the app). Filter by cohort and track, approve or
// reject, tag, export CSV, and set the Google Drive folders interns use.

type Testimonial = {
  id: string;
  name: string;
  email: string;
  programId: string;
  track: string;
  cohortId: string | null;
  cohort: string | null;
  rating: number;
  testimonial: string;
  videoLink: string | null;
  consent: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED";
  tags: string[];
  submittedAt: string;
};
type DriveLinks = {
  global: string | null;
  cohorts: { id: string; name: string; programName: string; driveUrl: string | null }[];
};
type Track = { id: string; name: string };

const selectClass =
  "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-[#1C1D52] outline-none focus:border-[#5FBB46]";
const statusChip: Record<Testimonial["status"], string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-slate-200 text-slate-600",
};

export default function AdminTestimonialsPage() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [drive, setDrive] = useState<DriveLinks>({ global: null, cohorts: [] });
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [cohortId, setCohortId] = useState("");
  const [programId, setProgramId] = useState("");
  const [status, setStatus] = useState("");
  const [consentOnly, setConsentOnly] = useState(false);

  useEffect(() => {
    fetch("/api/admin/internship/testimonials", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? "Unable to load testimonials.");
        setItems(data.testimonials ?? []);
        setDrive(data.drive ?? { global: null, cohorts: [] });
        setTracks(data.tracks ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load testimonials."))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(
    () =>
      items.filter(
        (t) =>
          (!cohortId || t.cohortId === cohortId) &&
          (!programId || t.programId === programId) &&
          (!status || t.status === status) &&
          (!consentOnly || t.consent),
      ),
    [items, cohortId, programId, status, consentOnly],
  );

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

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">Internship</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#1C1D52] sm:text-3xl">Testimonials</h1>
          <p className="mt-2 text-xs text-slate-500">
            Interns upload videos to Google Drive and send their words here. Only text and links are stored.
          </p>
        </header>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">{notice}</p>}

        <DriveFolders drive={drive} onSave={saveDrive} />

        <section className="rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-6">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[10px] font-semibold text-[#1C1D52]">
              <span className="block">Cohort</span>
              <select value={cohortId} onChange={(e) => setCohortId(e.target.value)} className={`${selectClass} mt-1`}>
                <option value="">All cohorts</option>
                {drive.cohorts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} · {c.programName}</option>
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
            {visible.length} testimonial{visible.length === 1 ? "" : "s"} · {visible.filter((t) => t.consent).length} with consent to share
          </p>

          {loading && <p className="mt-4 text-xs text-slate-500">Loading…</p>}
          {!loading && visible.length === 0 && (
            <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
              No testimonials match these filters.
            </p>
          )}

          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {visible.map((t) => (
              <TestimonialCard key={t.id} item={t} onReview={review} />
            ))}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}

function TestimonialCard({
  item,
  onReview,
}: {
  item: Testimonial;
  onReview: (id: string, body: { status?: Testimonial["status"]; tags?: string[] }) => Promise<void>;
}) {
  const [tags, setTags] = useState(item.tags.join(", "));
  return (
    <li className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#1C1D52]">{item.name}</p>
          <p className="text-[10px] text-slate-500">{item.track}{item.cohort ? ` · ${item.cohort}` : ""} · {item.email}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[9px] font-bold">
          <span className="rounded-full bg-[#eef7ff] px-2 py-1 text-[#1C1D52]">{item.rating}/10</span>
          <span className={`rounded-full px-2 py-1 ${item.consent ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
            {item.consent ? "Consent: may share" : "No consent to share"}
          </span>
          <span className={`rounded-full px-2 py-1 ${statusChip[item.status]}`}>{item.status}</span>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-line text-xs leading-5 text-slate-700">{item.testimonial}</p>
      {item.videoLink && (
        <a href={item.videoLink} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#2f7d52] underline">
          Open video in Drive <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void onReview(item.id, { status: "APPROVED" })} disabled={item.status === "APPROVED"} className="inline-flex items-center gap-1 rounded-lg bg-[#5FBB46] px-3 py-1.5 text-[10px] font-semibold text-[#14204f] disabled:opacity-50">
          <Check className="h-3 w-3" aria-hidden="true" /> Approve
        </button>
        <button type="button" onClick={() => void onReview(item.id, { status: "REJECTED" })} disabled={item.status === "REJECTED"} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-[10px] font-semibold text-[#1C1D52] disabled:opacity-50">
          <X className="h-3 w-3" aria-hidden="true" /> Reject
        </button>
        <form
          className="ml-auto flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void onReview(item.id, { tags: tags.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean) });
          }}
        >
          <label className="sr-only" htmlFor={`tags-${item.id}`}>Tags for {item.name}</label>
          <input id={`tags-${item.id}`} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags, comma separated" className="w-40 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] outline-none focus:border-[#5FBB46]" />
          <button type="submit" className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-semibold text-[#1C1D52]">Save tags</button>
        </form>
      </div>
      <p className="mt-2 text-[9px] text-slate-400">Submitted {new Date(item.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
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
    <section className="rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-6">
      <h2 className="text-sm font-bold text-[#1C1D52]">Google Drive folders for videos</h2>
      <p className="mt-1 text-[10px] text-slate-500">
        Interns see a button to the folder for their cohort, or the global folder if their cohort has none. Share each folder so interns can upload.
      </p>
      <DriveRow key={drive.global ?? ""} label="Global folder (all cohorts without their own)" value={drive.global} onSave={(url) => onSave(null, url)} />
      <button type="button" onClick={() => setOpen((v) => !v)} className="mt-4 text-[10px] font-semibold text-[#2f7d52] underline">
        {open ? "Hide cohort folders" : `Set a folder per cohort (${drive.cohorts.filter((c) => c.driveUrl).length} set)`}
      </button>
      {open && (
        <div className="mt-2 max-h-96 space-y-1 overflow-y-auto">
          {drive.cohorts.map((c) => (
            <DriveRow key={`${c.id}:${c.driveUrl ?? ""}`} label={`${c.name} · ${c.programName}`} value={c.driveUrl} onSave={(url) => onSave(c.id, url)} />
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

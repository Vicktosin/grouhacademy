"use client";

import {
  Edit3,
  ImagePlus,
  LoaderCircle,
  Plus,
  Power,
  Trash2,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { BannerSlide } from "@/components/DashboardBanner";

type Banner = {
  id: string;
  title: string;
  imageUrl: string;
  mobileImageUrl: string | null;
  buttonLabel: string | null;
  buttonUrl: string | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
};
type Draft = Omit<Banner, "id">;
type Status = "Live" | "Scheduled" | "Ended" | "Off";

const emptyDraft: Draft = {
  title: "",
  imageUrl: "",
  mobileImageUrl: null,
  buttonLabel: null,
  buttonUrl: null,
  isActive: true,
  startsAt: null,
  endsAt: null,
  sortOrder: 0,
};
const statusStyle: Record<Status, string> = {
  Live: "bg-emerald-100 text-emerald-700",
  Scheduled: "bg-sky-100 text-sky-700",
  Ended: "bg-slate-200 text-slate-600",
  Off: "bg-amber-100 text-amber-700",
};

function bannerStatus(banner: Banner): Status {
  const now = Date.now();
  if (!banner.isActive) return "Off";
  if (banner.endsAt && new Date(banner.endsAt).getTime() <= now) return "Ended";
  if (banner.startsAt && new Date(banner.startsAt).getTime() > now)
    return "Scheduled";
  return "Live";
}

/** ISO timestamp → value for a datetime-local input, in the admin's timezone. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function InternshipBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"desktop" | "mobile" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  async function loadBanners() {
    const response = await fetch("/api/admin/internship/banners", {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load banners.");
    setBanners(data.banners);
  }

  useEffect(() => {
    fetch("/api/admin/internship/banners", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Unable to load banners.");
        return data.banners as Banner[];
      })
      .then(setBanners)
      .catch((requestError: unknown) =>
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load banners.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  function startCreate() {
    setDraft({
      ...emptyDraft,
      sortOrder: banners.length
        ? Math.max(...banners.map((banner) => banner.sortOrder)) + 1
        : 0,
    });
    setEditingId(null);
    setFormError("");
    setOpen(true);
  }
  function startEdit(banner: Banner) {
    const { id, ...rest } = banner;
    setDraft(rest);
    setEditingId(id);
    setFormError("");
    setOpen(true);
  }
  function closeForm() {
    if (!saving && !uploading) setOpen(false);
  }

  async function uploadImage(
    event: ChangeEvent<HTMLInputElement>,
    kind: "desktop" | "mobile",
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(kind);
    setFormError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/admin/internship/banners/upload", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      setDraft((current) =>
        kind === "desktop"
          ? { ...current, imageUrl: data.url }
          : { ...current, mobileImageUrl: data.url },
      );
    } catch (uploadError) {
      setFormError(
        uploadError instanceof Error ? uploadError.message : "Upload failed.",
      );
    } finally {
      setUploading(null);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.imageUrl) {
      setFormError("Upload a banner image.");
      return;
    }
    setSaving(true);
    setFormError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/internship/banners", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, id: editingId ?? undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save banner.");
      setOpen(false);
      setMessage(editingId ? "Banner updated." : "Banner created.");
      await loadBanners();
    } catch (requestError) {
      setFormError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save banner.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggle(banner: Banner) {
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/internship/banners", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...banner, isActive: !banner.isActive }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to change banner.");
      setMessage(banner.isActive ? "Banner turned off." : "Banner turned on.");
      await loadBanners();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to change banner.",
      );
    }
  }

  async function remove(banner: Banner) {
    if (!window.confirm(`Delete “${banner.title}”? This cannot be undone.`))
      return;
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/internship/banners", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: banner.id }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to delete banner.");
      setMessage("Banner deleted.");
      await loadBanners();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete banner.",
      );
    }
  }

  const previewBanner = {
    id: "preview",
    title: draft.title || "Banner preview",
    imageUrl: draft.imageUrl,
    mobileImageUrl: draft.mobileImageUrl,
    buttonLabel: draft.buttonLabel,
    buttonUrl: draft.buttonLabel ? draft.buttonUrl : null,
  };

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[1180px] space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">
              Internship administration
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[#1C1D52] sm:text-3xl">
              Dashboard Banners
            </h1>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
              Image banners shown at the top of every page in the internship
              workspace. When several are live, they slide one after another.
            </p>
          </div>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-bold text-[#14204f]"
          >
            <Plus className="h-4 w-4" />
            Add banner
          </button>
        </header>
        {message && (
          <p
            role="status"
            className="rounded-xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700"
          >
            {message}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-700"
          >
            {error}
          </p>
        )}
        <section className="overflow-hidden rounded-2xl bg-white shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
          {loading ? (
            <p className="p-8 text-center text-xs text-slate-500">
              Loading banners…
            </p>
          ) : banners.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-semibold text-[#1C1D52]">
                No banners yet.
              </p>
              <button
                type="button"
                onClick={startCreate}
                className="mt-4 text-xs font-bold text-[#397d3a]"
              >
                Create the first banner
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {banners.map((banner) => {
                const status = bannerStatus(banner);
                return (
                  <article
                    key={banner.id}
                    className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
                    <img
                      src={banner.imageUrl}
                      alt=""
                      className="aspect-[4/1] w-full rounded-xl object-cover lg:w-64"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-bold text-[#1C1D52]">
                          {banner.title}
                        </h2>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${statusStyle[status]}`}
                        >
                          {status}
                        </span>
                        {banner.mobileImageUrl && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-semibold text-slate-500">
                            Phone image
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Order {banner.sortOrder}
                        {banner.buttonLabel &&
                          ` · Button “${banner.buttonLabel}” → ${banner.buttonUrl}`}
                      </p>
                      {(banner.startsAt || banner.endsAt) && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          {banner.startsAt
                            ? `From ${formatDate(banner.startsAt)}`
                            : "Shown now"}
                          {banner.endsAt &&
                            ` until ${formatDate(banner.endsAt)}`}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(banner)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-[#1C1D52]"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggle(banner)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-[#1C1D52]"
                      >
                        <Power className="h-3.5 w-3.5" />
                        {banner.isActive ? "Turn off" : "Turn on"}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(banner)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-[10px] font-semibold text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#11132f]/60 p-4">
            <form
              onSubmit={save}
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#1C1D52]">
                    {editingId ? "Edit banner" : "New banner"}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Interns see live banners at the top of every internship
                    page.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  aria-label="Close"
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="text-[10px] font-semibold text-[#1C1D52] sm:col-span-2">
                  Banner name
                  <input
                    required
                    maxLength={120}
                    value={draft.title}
                    onChange={(event) =>
                      setDraft({ ...draft, title: event.target.value })
                    }
                    placeholder="e.g. October UI/UX masterclass"
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-[#5FBB46]"
                  />
                  <span className="mt-1 block font-normal text-slate-400">
                    Also read aloud to interns using screen readers, so describe
                    what the banner says.
                  </span>
                </label>

                <ImageField
                  label="Banner image"
                  hint="Wide image, 1600 × 400 px (4:1). Used on computers, and on phones if there is no phone image."
                  url={draft.imageUrl}
                  aspect="aspect-[4/1]"
                  uploading={uploading === "desktop"}
                  onChange={(event) => uploadImage(event, "desktop")}
                />
                <ImageField
                  label="Phone image (recommended)"
                  hint="1080 × 540 px (2:1). Most interns use phones, and text in a wide image is hard to read there."
                  url={draft.mobileImageUrl}
                  aspect="aspect-[2/1]"
                  uploading={uploading === "mobile"}
                  onChange={(event) => uploadImage(event, "mobile")}
                  onRemove={() => setDraft({ ...draft, mobileImageUrl: null })}
                />

                <label className="text-[10px] font-semibold text-[#1C1D52]">
                  Button text (optional)
                  <input
                    maxLength={40}
                    value={draft.buttonLabel ?? ""}
                    onChange={(event) =>
                      setDraft({ ...draft, buttonLabel: event.target.value })
                    }
                    placeholder="e.g. Register now"
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-[#5FBB46]"
                  />
                </label>
                <label className="text-[10px] font-semibold text-[#1C1D52]">
                  Button link
                  <input
                    value={draft.buttonUrl ?? ""}
                    onChange={(event) =>
                      setDraft({ ...draft, buttonUrl: event.target.value })
                    }
                    placeholder="/student or https://…"
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-[#5FBB46]"
                  />
                </label>

                <label className="text-[10px] font-semibold text-[#1C1D52]">
                  Start showing (optional)
                  <input
                    type="datetime-local"
                    value={toLocalInput(draft.startsAt)}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        startsAt: fromLocalInput(event.target.value),
                      })
                    }
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-[#5FBB46]"
                  />
                </label>
                <label className="text-[10px] font-semibold text-[#1C1D52]">
                  Stop showing (optional)
                  <input
                    type="datetime-local"
                    value={toLocalInput(draft.endsAt)}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        endsAt: fromLocalInput(event.target.value),
                      })
                    }
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-[#5FBB46]"
                  />
                </label>

                <label className="text-[10px] font-semibold text-[#1C1D52]">
                  Display order
                  <input
                    type="number"
                    step={1}
                    value={String(draft.sortOrder)}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        sortOrder: Number(event.target.value),
                      })
                    }
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-[#5FBB46]"
                  />
                  <span className="mt-1 block font-normal text-slate-400">
                    Lower numbers show first.
                  </span>
                </label>
                <label className="flex items-center gap-2 self-center text-xs font-semibold text-[#1C1D52]">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(event) =>
                      setDraft({ ...draft, isActive: event.target.checked })
                    }
                    className="h-4 w-4 accent-[#5FBB46]"
                  />
                  Banner is on
                </label>
              </div>

              {draft.imageUrl && (
                <div className="mt-6">
                  <p className="text-[10px] font-semibold text-[#1C1D52]">
                    Preview
                  </p>
                  <div className="mt-2 grid gap-4 sm:grid-cols-[1fr_180px]">
                    <div>
                      <div className="pointer-events-none relative aspect-[4/1] overflow-hidden rounded-xl bg-[#1C1D52]">
                        <BannerSlide
                          banner={{ ...previewBanner, mobileImageUrl: null }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">
                        Computer
                      </p>
                    </div>
                    <div>
                      <div className="pointer-events-none relative aspect-[2/1] overflow-hidden rounded-xl bg-[#1C1D52]">
                        <BannerSlide
                          banner={{
                            ...previewBanner,
                            imageUrl: draft.mobileImageUrl ?? draft.imageUrl,
                            mobileImageUrl: null,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">Phone</p>
                    </div>
                  </div>
                </div>
              )}

              {formError && (
                <p
                  role="alert"
                  className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-700"
                >
                  {formError}
                </p>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-[#1C1D52]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading !== null}
                  className="rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-bold text-[#14204f] disabled:opacity-60"
                >
                  {saving
                    ? "Saving…"
                    : editingId
                      ? "Save changes"
                      : "Create banner"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function ImageField({
  label,
  hint,
  url,
  aspect,
  uploading,
  onChange,
  onRemove,
}: {
  label: string;
  hint: string;
  url: string | null;
  aspect: string;
  uploading: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="text-[10px] font-semibold text-[#1C1D52]">
      {label}
      <label
        className={`relative mt-2 flex ${aspect} w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 hover:border-[#5FBB46]`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- upload preview
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 font-normal text-slate-500">
            <ImagePlus className="h-5 w-5" />
            Choose image
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <LoaderCircle className="h-5 w-5 animate-spin text-[#5FBB46]" />
          </span>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={onChange}
          disabled={uploading}
          className="sr-only"
        />
      </label>
      <span className="mt-1 block font-normal text-slate-400">{hint}</span>
      {url && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="mt-1 font-semibold text-red-600"
        >
          Remove phone image
        </button>
      )}
    </div>
  );
}

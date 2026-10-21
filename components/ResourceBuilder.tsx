"use client";

import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  FileText,
  Layers3,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  BuilderHeading,
  CurriculumEditor,
  ImageUploadInput,
  Input,
  ReviewItem,
  Textarea,
  curriculumPayload,
  hydrateCurriculum,
  useCurriculum,
} from "@/components/CurriculumEditor";
import type { AdminInternResource } from "@/lib/intern-resources";
import { useAdminBasePath, useAdminSupportMode } from "@/components/AdminShell";

// The internship Resource Builder: the Course Builder's curriculum editor,
// saved to the internship's own Resource API and assigned to tracks rather
// than published to the student catalogue.

type TrackOption = { id: string; name: string };
type LevelOption = { id: string; name: string };
type Status = AdminInternResource["status"];
type LoadedResource = AdminInternResource & { canEdit?: boolean };

const STATUS_LABEL: Record<Status, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Waiting for review",
  PUBLISHED: "Published",
};
const STATUS_TONE: Record<Status, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PENDING_REVIEW: "bg-amber-100 text-amber-800",
  PUBLISHED: "bg-[#e8f7eb] text-[#397d3a]",
};

const steps = [
  { label: "Details", icon: FileText },
  { label: "Content", icon: Layers3 },
  { label: "Review", icon: CircleCheckBig },
];

export default function ResourceBuilder({
  resourceId,
}: {
  /** Omit to create a new resource. */
  resourceId?: string;
}) {
  const supportMode = useAdminSupportMode();
  const basePath = useAdminBasePath();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [details, setDetails] = useState({
    title: "",
    description: "",
    thumbnail: "",
  });
  const [trackIds, setTrackIds] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("DRAFT");
  const [reviewNote, setReviewNote] = useState<string | null>(null);
  // Support Admins can't change published resources or other people's.
  const [canEdit, setCanEdit] = useState(true);
  const [tracks, setTracks] = useState<TrackOption[]>([]);
  const [levels, setLevels] = useState<LevelOption[]>([]);
  const [levelId, setLevelId] = useState("");
  const curriculum = useCurriculum();
  const { modules, setModules } = curriculum;

  const [loading, setLoading] = useState(Boolean(resourceId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/internship/tracks", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = (await response.json()) as { tracks?: TrackOption[] };
        setTracks((data.tracks ?? []).map(({ id, name }) => ({ id, name })));
      })
      .catch(() =>
        setMessage({ text: "Unable to load internship tracks.", error: true }),
      );
    fetch("/api/admin/internship/levels", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = (await response.json()) as { levels?: LevelOption[] };
        const options = (data.levels ?? []).map(({ id, name }) => ({
          id,
          name,
        }));
        setLevels(options);
        // New resources default to the first level (Entry).
        setLevelId((current) => current || options[0]?.id || "");
      })
      .catch(() =>
        setMessage({ text: "Unable to load internship levels.", error: true }),
      );
  }, []);

  const applySaved = (resource: LoadedResource) => {
    setDetails({
      title: resource.title,
      description: resource.description ?? "",
      thumbnail: resource.thumbnail ?? "",
    });
    setTrackIds(resource.tracks.map((track) => track.id));
    setLevelId(resource.levelId);
    setStatus(resource.status);
    setReviewNote(resource.reviewNote);
    setCanEdit(resource.canEdit !== false);
    setModules(hydrateCurriculum(resource.modules));
  };

  useEffect(() => {
    if (!resourceId) return;
    let cancelled = false;
    fetch(`/api/admin/internship/resources/${resourceId}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as LoadedResource & {
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok)
          setMessage({
            text: data.error ?? "Unable to load the resource.",
            error: true,
          });
        else applySaved(data);
      })
      .catch(() => {
        if (!cancelled)
          setMessage({ text: "Unable to load the resource.", error: true });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // applySaved only calls state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId]);

  const toggleTrack = (id: string) =>
    setTrackIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );

  /**
   * Saves everything, and moves it to `nextStatus` when given: PUBLISHED
   * makes it visible to interns (admins only), PENDING_REVIEW sends a
   * Support Admin's resource to the admins.
   */
  const save = async (nextStatus?: Status) => {
    if (!details.title.trim()) {
      setCurrentStep(0);
      setMessage({ text: "Give the resource a title.", error: true });
      return;
    }
    if (!trackIds.length) {
      setCurrentStep(0);
      setMessage({
        text: "Assign the resource to at least one track.",
        error: true,
      });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        title: details.title,
        description: details.description,
        thumbnail: details.thumbnail,
        trackIds,
        levelId,
        modules: curriculumPayload(modules),
        // Plain saves keep the current status, so editing a published
        // resource doesn't hide it.
        ...(nextStatus ? { status: nextStatus } : {}),
      };
      const response = await fetch(
        resourceId
          ? `/api/admin/internship/resources/${resourceId}`
          : "/api/admin/internship/resources",
        {
          method: resourceId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as LoadedResource & {
        error?: string;
      };
      if (!response.ok) {
        setMessage({
          text: data.error ?? "Unable to save the resource.",
          error: true,
        });
        return;
      }

      applySaved(data);
      setMessage({
        text:
          nextStatus === "PUBLISHED"
            ? "Resource published. Interns on the selected tracks can now open it."
            : nextStatus === "PENDING_REVIEW"
              ? "Sent for review. An administrator will publish it or send it back with a note."
              : "Resource saved.",
        error: false,
      });
      if (!resourceId)
        router.replace(`${basePath}/resources/${data.id}/edit`);
    } catch {
      setMessage({ text: "Unable to save the resource.", error: true });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <p className="text-sm text-slate-500">Loading resource...</p>
      </div>
    );
  }

  const progress = ((currentStep + 1) / steps.length) * 100;
  const selectedTrackNames = tracks
    .filter((track) => trackIds.includes(track.id))
    .map((track) => track.name);

  return (
    <div className="min-h-full bg-[#f7f9fc]">
      <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href={`${basePath}/resources`}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#1C1D52]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Resources
          </Link>
          <span className="text-xs font-semibold text-slate-400">
            Resource Builder
          </span>
        </div>

        <header className="rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5FBB46]">
                Resource Builder
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-[#1C1D52]">
                {resourceId ? "Edit Resource" : "Create New Resource"}
              </h1>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
                Build learning material for interns. Only interns on the tracks
                you assign can see it, and only once it is published.
                {supportMode &&
                  " When it's ready, send it for review: an administrator publishes it."}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${STATUS_TONE[status]}`}
              >
                {STATUS_LABEL[status]}
              </span>
              {canEdit && <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#1C1D52] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving
                  ? "Saving..."
                  : status === "DRAFT"
                    ? "Save Draft"
                    : "Save Changes"}
              </button>}
            </div>
          </div>

          {!canEdit && (
            <p className="mt-4 rounded-lg bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
              {status === "PUBLISHED"
                ? "This resource is published. Only an administrator can change it."
                : "Only the Support Admin who created this resource, or an administrator, can change it."}
            </p>
          )}
          {reviewNote && status === "DRAFT" && (
            <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-900">
              <strong>Sent back by an administrator:</strong> {reviewNote}
            </p>
          )}

          {message && (
            <p
              className={`mt-4 rounded-lg px-4 py-3 text-xs font-semibold ${
                message.error
                  ? "bg-red-50 text-red-700"
                  : "bg-[#e8f7eb] text-[#397d3a]"
              }`}
              role={message.error ? "alert" : "status"}
            >
              {message.text}
            </p>
          )}

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex gap-2 overflow-x-auto">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <button
                      key={step.label}
                      type="button"
                      onClick={() => setCurrentStep(index)}
                      className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-semibold ${
                        currentStep === index
                          ? "bg-[#1C1D52] text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {step.label}
                    </button>
                  );
                })}
              </div>
              <span className="hidden text-[10px] font-semibold text-slate-400 sm:block">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#5FBB46] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </header>

        <section className="mt-5 rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-6">
          {currentStep === 0 && (
            <>
              <BuilderHeading
                icon={FileText}
                title="Resource details"
                text="Name the resource and choose which internship tracks can see it."
              />
              <div className="space-y-5">
                <Input
                  label="Resource title"
                  value={details.title}
                  onChange={(title) =>
                    setDetails((current) => ({ ...current, title }))
                  }
                  placeholder="e.g. Intro to Workflow Automation"
                />
                <Textarea
                  label="Resource summary"
                  value={details.description}
                  onChange={(description) =>
                    setDetails((current) => ({ ...current, description }))
                  }
                  placeholder="What will interns learn from this resource?"
                />
                <ImageUploadInput
                  label="Thumbnail"
                  value={details.thumbnail}
                  onChange={(thumbnail) =>
                    setDetails((current) => ({ ...current, thumbnail }))
                  }
                />
                <label className="block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                    Level
                  </span>
                  <select
                    value={levelId}
                    onChange={(event) => setLevelId(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-[#1C1D52] outline-none focus:border-[#5FBB46] sm:w-64"
                  >
                    {levels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[10px] text-slate-500">
                    Interns see resources at their own level and below.
                  </span>
                </label>
                <fieldset>
                  <legend className="mb-2 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                    Tracks
                  </legend>
                  <p className="mb-3 text-[10px] text-slate-500">
                    Interns only see resources assigned to their own track.
                  </p>
                  {tracks.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No tracks yet. Create one under Tracks first.
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {tracks.map((track) => {
                        const checked = trackIds.includes(track.id);
                        return (
                          <label
                            key={track.id}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold ${
                              checked
                                ? "border-[#5FBB46] bg-[#f1faee] text-[#1C1D52]"
                                : "border-slate-200 text-slate-600"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTrack(track.id)}
                              className="accent-[#5FBB46]"
                            />
                            {track.name}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </fieldset>
              </div>
            </>
          )}

          {currentStep === 1 && (
            <CurriculumEditor
              curriculum={curriculum}
              title="Resource content"
              description="Organize the resource into modules and lessons."
              materialsLabel="Materials"
              uploadFolder="resources"
            />
          )}

          {currentStep === 2 && (
            <>
              <BuilderHeading
                icon={CircleCheckBig}
                title="Review"
                text="Check the resource before saving or publishing it."
              />
              <div className="grid gap-4 md:grid-cols-2">
                <ReviewItem label="Resource title" value={details.title} />
                <ReviewItem
                  label="Level"
                  value={
                    levels.find((level) => level.id === levelId)?.name ?? ""
                  }
                />
                <ReviewItem
                  label="Tracks"
                  value={selectedTrackNames.join(", ")}
                />
                <ReviewItem label="Modules" value={String(modules.length)} />
                <ReviewItem
                  label="Lessons"
                  value={String(
                    modules.reduce(
                      (total, module) =>
                        total + (module.hasLessons ? module.lessons.length : 0),
                      0,
                    ),
                  )}
                />
              </div>
              {canEdit && <div className="mt-6 rounded-xl bg-[#e8f7eb] p-4">
                <p className="text-xs font-semibold text-[#397d3a]">
                  {supportMode
                    ? status === "PENDING_REVIEW"
                      ? "This resource is waiting for an administrator to review it. You can still save changes."
                      : "Sending for review asks an administrator to publish it. You can keep editing until it's published."
                    : status === "PUBLISHED"
                      ? "This resource is published. Saving updates it for interns straight away."
                      : "Publishing makes this resource visible to interns on the selected tracks."}
                </p>
              </div>}
            </>
          )}
        </section>

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            disabled={currentStep === 0}
            onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#1C1D52] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          {currentStep < steps.length - 1 ? (
            <button
              type="button"
              onClick={() =>
                setCurrentStep((step) => Math.min(steps.length - 1, step + 1))
              }
              className="inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-4 py-2.5 text-xs font-semibold text-white"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : canEdit && (
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void save(
                  supportMode
                    ? status === "DRAFT" ? "PENDING_REVIEW" : undefined
                    : status === "PUBLISHED" ? undefined : "PUBLISHED",
                )
              }
              className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-bold text-[#14204f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              {saving
                ? "Saving..."
                : supportMode
                  ? status === "DRAFT" ? "Send for Review" : "Save Changes"
                  : status === "PUBLISHED" ? "Save Changes" : "Publish Resource"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

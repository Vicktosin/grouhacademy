"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Plus,
  Save,
  Star,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";

type Option = { id: string; name: string };
type ResourceItem = {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  levelName: string;
};
type Payload = {
  tracks: Option[];
  levels: Option[];
  recommended: ResourceItem[];
  available: ResourceItem[];
};

export default function RecommendedResourcesPage() {
  const [tracks, setTracks] = useState<Option[]>([]);
  const [levels, setLevels] = useState<Option[]>([]);
  const [programId, setProgramId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [recommended, setRecommended] = useState<ResourceItem[]>([]);
  const [available, setAvailable] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  // Loads the track/level lists, and the selected pair's recommendations.
  useEffect(() => {
    const query =
      programId && levelId ? `?programId=${programId}&levelId=${levelId}` : "";
    fetch(`/api/admin/internship/resources/recommendations${query}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = (await response.json()) as Payload;
        setTracks(data.tracks);
        setLevels(data.levels);
        if (!programId && data.tracks[0]) setProgramId(data.tracks[0].id);
        if (!levelId && data.levels[0]) setLevelId(data.levels[0].id);
        setRecommended(data.recommended);
        setAvailable(data.available);
        setDirty(false);
      })
      .catch(() =>
        setMessage({ text: "Unable to load recommendations.", error: true }),
      )
      .finally(() => setLoading(false));
  }, [programId, levelId]);

  const change = (next: ResourceItem[]) => {
    setRecommended(next);
    setDirty(true);
    setMessage(null);
  };

  const move = (index: number, by: -1 | 1) => {
    const next = [...recommended];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    change(next);
  };

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(
        "/api/admin/internship/resources/recommendations",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            programId,
            levelId,
            resourceIds: recommended.map((item) => item.id),
          }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as Partial<
        Payload & { error: string }
      >;
      if (!response.ok) throw new Error(data.error ?? "Unable to save.");
      setRecommended(data.recommended ?? []);
      setAvailable(data.available ?? []);
      setDirty(false);
      setMessage({ text: "Recommendations saved.", error: false });
    } catch (saveError) {
      setMessage({
        text:
          saveError instanceof Error ? saveError.message : "Unable to save.",
        error: true,
      });
    } finally {
      setSaving(false);
    }
  }

  const recommendedIds = new Set(recommended.map((item) => item.id));
  const addable = available.filter((item) => !recommendedIds.has(item.id));
  const trackName = tracks.find((track) => track.id === programId)?.name;
  const levelName = levels.find((level) => level.id === levelId)?.name;

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[1100px] space-y-5">
        <Link
          href="/admin/internship/resources"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#1C1D52]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Resources
        </Link>

        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1C1D52] sm:text-3xl">
              Recommended resources
            </h1>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
              Choose what interns see under “Recommended for you” on their
              dashboard, for each track and level. With nothing chosen, interns
              see the newest resources at their level.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !dirty || !programId || !levelId}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-semibold text-[#14204f] disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : dirty ? "Save changes" : "Saved"}
          </button>
        </header>

        {message && (
          <p
            className={`rounded-lg px-4 py-3 text-xs font-semibold ${
              message.error
                ? "bg-red-50 text-red-700"
                : "bg-[#e8f7eb] text-[#397d3a]"
            }`}
            role={message.error ? "alert" : "status"}
          >
            {message.text}
          </p>
        )}

        <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:flex-row sm:p-5">
          <label className="flex-1 text-[10px] font-semibold text-slate-500">
            Track
            <select
              value={programId}
              onChange={(event) => setProgramId(event.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-[#1C1D52]"
            >
              {tracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1 text-[10px] font-semibold text-slate-500">
            Level
            <select
              value={levelId}
              onChange={(event) => setLevelId(event.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-[#1C1D52]"
            >
              {levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">Loading...</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-[#1C1D52]">
                <Star className="h-4 w-4 text-[#5FBB46]" />
                Recommended for {trackName} · {levelName}
              </h2>
              <p className="mt-1 text-[10px] text-slate-500">
                Shown to interns in this order (up to 6).
              </p>
              {recommended.length === 0 ? (
                <p className="mt-4 rounded-lg bg-[#f8fbff] px-3 py-6 text-center text-xs text-slate-500">
                  Nothing chosen yet. Add resources from the list.
                </p>
              ) : (
                <ol className="mt-4 space-y-2">
                  {recommended.map((item, index) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5"
                    >
                      <span className="w-5 text-[10px] font-bold text-slate-400">
                        {index + 1}
                      </span>
                      <ResourceLabel item={item} />
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        className="rounded p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                        aria-label={`Move ${item.title} up`}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === recommended.length - 1}
                        onClick={() => move(index, 1)}
                        className="rounded p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                        aria-label={`Move ${item.title} down`}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          change(recommended.filter((r) => r.id !== item.id))
                        }
                        className="rounded p-1.5 text-red-600 hover:bg-red-50"
                        aria-label={`Remove ${item.title}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              {recommended.length > 6 && (
                <p className="mt-2 text-[10px] text-amber-700">
                  Only the first 6 appear on the dashboard.
                </p>
              )}
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-5">
              <h2 className="text-sm font-bold text-[#1C1D52]">
                Resources you can add
              </h2>
              <p className="mt-1 text-[10px] text-slate-500">
                Resources on this track at {levelName} level or below.
              </p>
              {addable.length === 0 ? (
                <p className="mt-4 rounded-lg bg-[#f8fbff] px-3 py-6 text-center text-xs text-slate-500">
                  {available.length
                    ? "Every eligible resource is already recommended."
                    : "No resources on this track at this level yet."}
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {addable.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5"
                    >
                      <ResourceLabel item={item} />
                      <button
                        type="button"
                        onClick={() => change([...recommended, item])}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-50"
                      >
                        <Plus className="h-3 w-3" /> Add
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function ResourceLabel({ item }: { item: ResourceItem }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-xs font-semibold text-[#1C1D52]">
        {item.title}
      </span>
      <span className="text-[10px] text-slate-400">
        {item.levelName} level
        {item.status === "DRAFT" && " · Draft (hidden until published)"}
      </span>
    </span>
  );
}

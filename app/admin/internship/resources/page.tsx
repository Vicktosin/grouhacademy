"use client";

import Link from "next/link";
import { EyeOff, Pencil, Plus, Search, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/AdminShell";

type ResourceRow = {
  id: string;
  slug: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  updatedAt: string;
  tracks: Array<{ id: string; name: string }>;
  moduleCount: number;
  lessonCount: number;
};

export default function AdminResourcesPage() {
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState("All");
  const [status, setStatus] = useState("All");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/internship/resources", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ resources: ResourceRow[] }>;
      })
      .then((data) => setResources(data.resources))
      .catch(() => setMessage("Unable to load resources."))
      .finally(() => setLoading(false));
  }, []);

  const trackOptions = useMemo(
    () =>
      [
        ...new Set(resources.flatMap((item) => item.tracks.map((t) => t.name))),
      ].sort(),
    [resources],
  );

  const visible = useMemo(
    () =>
      resources.filter(
        (resource) =>
          (status === "All" || resource.status === status) &&
          (track === "All" || resource.tracks.some((t) => t.name === track)) &&
          resource.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [resources, query, status, track],
  );

  async function setPublished(resource: ResourceRow, publish: boolean) {
    const nextStatus = publish ? "PUBLISHED" : "DRAFT";
    const response = await fetch(
      `/api/admin/internship/resources/${resource.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setMessage(payload?.error ?? "Unable to update the resource.");
      return;
    }
    setResources((items) =>
      items.map((item) =>
        item.id === resource.id ? { ...item, status: nextStatus } : item,
      ),
    );
    setMessage(
      publish
        ? `“${resource.title}” is now visible to interns on its tracks.`
        : `“${resource.title}” is hidden from interns.`,
    );
  }

  async function remove(resource: ResourceRow) {
    if (
      !window.confirm(
        `Delete “${resource.title}”? This permanently removes its modules, lessons and every intern's progress on it.`,
      )
    )
      return;
    const response = await fetch(
      `/api/admin/internship/resources/${resource.id}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setMessage(payload?.error ?? "Unable to delete the resource.");
      return;
    }
    setResources((items) => items.filter((item) => item.id !== resource.id));
    setMessage("Resource deleted.");
  }

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1C1D52] sm:text-3xl">
              Resources
            </h1>
            <p className="mt-2 text-xs text-slate-500">
              Learning material for interns. Each resource is only visible to
              interns on the tracks it is assigned to.
            </p>
          </div>
          <Link
            href="/admin/internship/resources/new"
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-semibold text-[#14204f]"
          >
            <Plus className="h-4 w-4" />
            Add New Resource
          </Link>
        </header>

        {message && (
          <p
            className="rounded-lg bg-[#e8f7eb] px-4 py-3 text-xs font-semibold text-[#397d3a]"
            role="status"
          >
            {message}
          </p>
        )}

        <section className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-5">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row">
            <label className="flex flex-1 items-center gap-2 rounded-lg bg-[#f3f6fb] px-3 py-2.5 text-xs text-slate-400">
              <Search className="h-3.5 w-3.5" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent outline-none"
                placeholder="Search resources..."
              />
            </label>
            <select
              value={track}
              onChange={(event) => setTrack(event.target.value)}
              aria-label="Filter by track"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[10px] font-medium text-[#1C1D52]"
            >
              <option value="All">All tracks</option>
              {trackOptions.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filter by status"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[10px] font-medium text-[#1C1D52]"
            >
              <option value="All">All statuses</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead className="bg-[#f8fbff] text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Resource</th>
                  <th className="px-3 py-3">Tracks</th>
                  <th className="px-3 py-3">Content</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-[11px] text-[#1C1D52]">
                {visible.map((resource) => (
                  <tr key={resource.id} className="border-t border-slate-100">
                    <td className="px-3 py-3.5 font-semibold">
                      <Link
                        href={`/admin/internship/resources/${resource.id}/edit`}
                      >
                        {resource.title}
                      </Link>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {resource.tracks.map((item) => (
                          <span
                            key={item.id}
                            className="rounded-full bg-[#eef3ff] px-2 py-1 text-[9px] font-semibold text-[#1C1D52]"
                          >
                            {item.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-slate-500">
                      {resource.moduleCount} module
                      {resource.moduleCount === 1 ? "" : "s"} ·{" "}
                      {resource.lessonCount} lesson
                      {resource.lessonCount === 1 ? "" : "s"}
                    </td>
                    <td className="px-3 py-3.5">
                      <span
                        className={`rounded-full px-2 py-1 text-[9px] font-semibold ${
                          resource.status === "PUBLISHED"
                            ? "bg-[#e8f7eb] text-[#397d3a]"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {resource.status === "PUBLISHED" ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/admin/internship/resources/${resource.id}/edit`}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-2 font-semibold text-blue-600 hover:bg-blue-50"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Link>
                        {resource.status === "PUBLISHED" ? (
                          <button
                            type="button"
                            onClick={() => void setPublished(resource, false)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-2 font-semibold text-slate-600 hover:bg-slate-100"
                          >
                            <EyeOff className="h-3 w-3" />
                            Unpublish
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void setPublished(resource, true)}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#5FBB46] px-2 py-2 font-bold text-[#14204f]"
                          >
                            <Send className="h-3 w-3" />
                            Publish
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void remove(resource)}
                          className="rounded-lg px-2 py-2 text-red-600 hover:bg-red-50"
                          aria-label={`Delete ${resource.title}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && visible.length === 0 && (
            <p className="py-12 text-center text-sm text-slate-500">
              {resources.length
                ? "No resources match the current filters."
                : "No resources yet. Add one to share learning material with a track."}
            </p>
          )}
          {loading && (
            <p className="py-12 text-center text-sm text-slate-500">
              Loading resources...
            </p>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

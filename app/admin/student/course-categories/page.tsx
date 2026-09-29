"use client";

import { Edit3, Plus, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";

type Category = {
  id: string;
  name: string;
  slug: string;
  _count: { courses: number };
};

export default function CourseCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/student/course-categories", {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to load categories.");
      setCategories(data.categories);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to load categories.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch("/api/admin/student/course-categories", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Unable to load categories.");
        return data.categories as Category[];
      })
      .then(setCategories)
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load categories.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setError("");
    setFormOpen(true);
  }
  function openEdit(category: Category) {
    setEditing(category);
    setName(category.name);
    setError("");
    setFormOpen(true);
  }
  function closeEdit() {
    setEditing(null);
    setName("");
    setFormOpen(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/student/course-categories", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing?.id, name }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to save category.");
      closeEdit();
      setMessage(editing ? "Category updated." : "Category added.");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save category.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(category: Category) {
    if (!window.confirm(`Remove “${category.name}”?`)) return;
    setError("");
    setMessage("");
    const response = await fetch("/api/admin/student/course-categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: category.id }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Unable to remove category.");
    else {
      setMessage("Category removed.");
      await load();
    }
  }

  return (
    <AdminShell workspace="student">
      <div className="mx-auto max-w-[1180px] space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">
              Course administration
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[#1C1D52] sm:text-3xl">
              Categories
            </h1>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
              Manage the official categories used to organize courses and power
              personalized recommendations.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-bold text-[#14204f]"
          >
            <Plus className="h-4 w-4" />
            Add category
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
        {formOpen && (
          <form
            onSubmit={save}
            className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:flex-row sm:items-end"
          >
            <label className="flex-1 text-xs font-semibold text-[#1C1D52]">
              Category name
              <input
                autoFocus
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Software Development"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-normal outline-none focus:border-[#5FBB46]"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#1C1D52] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : editing ? "Save changes" : "Add category"}
            </button>
            <button
              type="button"
              onClick={closeEdit}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600"
            >
              <X className="mr-1 inline h-3.5 w-3.5" />
              Cancel
            </button>
          </form>
        )}
        <section className="overflow-hidden rounded-2xl bg-white shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
          {loading ? (
            <p className="p-8 text-center text-xs text-slate-500">
              Loading categories…
            </p>
          ) : categories.length === 0 ? (
            <p className="p-10 text-center text-xs text-slate-500">
              No categories yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {categories.map((category) => (
                <article
                  key={category.id}
                  className="flex items-center justify-between gap-4 p-5"
                >
                  <div>
                    <h2 className="text-sm font-bold text-[#1C1D52]">
                      {category.name}
                    </h2>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {category._count.courses} course
                      {category._count.courses === 1 ? "" : "s"} ·{" "}
                      {category.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(category)}
                      className="rounded-lg p-2 text-[#1C1D52] hover:bg-slate-100"
                      aria-label={`Edit ${category.name}`}
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(category)}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                      aria-label={`Remove ${category.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

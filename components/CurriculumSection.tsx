"use client";

import { useEffect, useMemo, useState } from "react";

type CourseCategory = { name?: string | null } | string | null;
type CourseLesson = { id: string; title: string; description?: string | null };
type CourseModule = {
  id: string;
  title: string;
  description?: string | null;
  lessons: CourseLesson[];
};
type CurriculumCourse = {
  id: string;
  title: string;
  category: CourseCategory;
  modules: CourseModule[];
};

function categoryName(category: CourseCategory) {
  if (typeof category === "string") return category;
  if (category && typeof category === "object" && "name" in category)
    return category.name || "General";
  return "General";
}

export default function CurriculumSection() {
  const [courses, setCourses] = useState<CurriculumCourse[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/courses")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load the curriculum.");
        return (await response.json()) as CurriculumCourse[];
      })
      .then(setCourses)
      .catch((loadError: unknown) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load the curriculum.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const names = courses
      .map((course) => categoryName(course.category))
      .filter((name): name is string => Boolean(name));
    return ["All", ...new Set(names)];
  }, [courses]);

  const filteredCourses = useMemo(
    () =>
      activeCategory === "All"
        ? courses
        : courses.filter(
            (course) => categoryName(course.category) === activeCategory,
          ),
    [activeCategory, courses],
  );

  return (
    <section
      id="curriculum"
      className="bg-[#f8f9fe] py-20 sm:py-24 lg:py-28"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#4db848]">
            Curriculum
          </p>
          <h2
            className="mt-3 text-3xl font-black leading-tight text-[#141650] sm:text-4xl lg:text-5xl"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            See what you’ll learn, topic by topic.
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
            Choose a learning area, then open a curriculum to explore its
            modules and lessons.
          </p>
        </div>

        {!loading && categories.length > 1 && (
          <div
            className="mb-6 flex flex-wrap gap-2"
            role="tablist"
            aria-label="Curriculum category"
          >
            {categories.map((category) => {
              const selected = activeCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    selected
                      ? "bg-[#141650] text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-[#4db848] hover:text-[#141650]"
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-sm text-slate-500">
            Loading curriculum…
          </div>
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-white px-5 py-8 text-sm text-red-700">
            {error}
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-sm text-slate-500">
            No curriculum is available in this area yet.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filteredCourses.map((course) => (
              <details
                key={course.id}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(20,22,80,0.05)] open:border-[#4db848]/50"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#4db848]">
                      {categoryName(course.category)}
                    </span>
                    <span className="mt-1 block text-base font-bold text-[#141650] sm:text-lg">
                      {course.title}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {course.modules.length} modules · {course.modules.reduce((total, module) => total + module.lessons.length, 0)} topics
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f2fbf2] text-xl font-medium leading-none text-[#397d3a] transition group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>

                <div className="grid gap-3 border-t border-slate-100 bg-[#fbfcff] p-4 sm:grid-cols-2">
                  {course.modules.length > 0 ? (
                    course.modules.map((module, index) => (
                      <article
                        key={module.id}
                        className="rounded-xl border border-slate-200 bg-white p-4"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4db848]">
                          Module {String(index + 1).padStart(2, "0")}
                        </p>
                        <h3 className="mt-1 text-sm font-bold text-[#141650]">
                          {module.title}
                        </h3>
                        {module.description && (
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {module.description}
                          </p>
                        )}
                        {module.lessons.length > 0 && (
                          <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                            {module.lessons.map((lesson) => (
                              <li
                                key={lesson.id}
                                className="flex gap-2 text-xs leading-5 text-slate-600"
                              >
                                <span className="text-[#4db848]" aria-hidden="true">•</span>
                                <span>{lesson.title}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      This curriculum is being prepared.
                    </p>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

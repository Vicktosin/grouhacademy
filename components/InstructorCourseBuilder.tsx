"use client";

import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  FileText,
  ImagePlus,
  Layers3,
  Plus,
  Save,
  Send,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  newItemId,
  useCurriculum,
  type CurriculumModule,
} from "@/components/CurriculumEditor";
import type { PublicCourse } from "@/lib/course-data";

type Question = {
  id: string;
  question: string;
  options: string[];
  answer: string;
};

// Local alias to the real API response shape - see course-data.ts for
// why this must not be hand-typed again.
type SavedCourse = PublicCourse;
type CourseCategoryOption = { id: string; name: string };

const steps = [
  { label: "Basics", icon: BookOpen },
  { label: "Curriculum", icon: Layers3 },
  { label: "Media", icon: FileText },
  { label: "Publish", icon: ImagePlus },
  { label: "Review", icon: CircleCheckBig },
];

const emptyCourse = {
  title: "AI Product Design Bootcamp",
  category: "Design",
  level: "Intermediate",
  duration: "6 weeks",
  price: "$0",
  launchDate: "2026-10-15",
  description:
    "A hands-on course covering product thinking, UX research, interface systems, and rapid prototyping for digital products.",
  objectives:
    "Design better product experiences, work with real user feedback, and build a portfolio-ready case study.",
  videoUrl: "",
  thumbnail: "",
};

const startingModules: CurriculumModule[] = [
  {
    id: "new-1",
    title: "Foundations of Product Design",
    summary: "",
    hasLessons: true,
    videoUrl: "",
    content: "",
    materials: [],
    lessons: [
      {
        id: "new-2",
        title: "What makes a product useful?",
        videoUrl: "",
        content: "",
        materials: [],
      },
    ],
  },
];

const startingQuestions: Question[] = [
  {
    id: "q-1",
    question: "What is the primary goal of user research?",
    options: [
      "To make designs look aesthetic",
      "To understand user needs and pain points",
      "To code faster",
      "To reduce course duration",
    ],
    answer: "To understand user needs and pain points",
  },
];

// The course API names a module's or lesson's links `resources`; the
// shared curriculum editor calls them `materials`.
function hydrateModules(course: SavedCourse): CurriculumModule[] {
  return hydrateCurriculum(
    course.modules.map(({ resources, lessons, ...module }) => ({
      ...module,
      materials: resources,
      lessons: lessons.map(({ resources: lessonResources, ...lesson }) => ({
        ...lesson,
        materials: lessonResources,
      })),
    })),
  );
}

function courseModulesPayload(modules: CurriculumModule[]) {
  return curriculumPayload(modules).map(
    ({ materials, lessons, ...module }) => ({
      ...module,
      resources: materials,
      lessons: lessons.map(({ materials: lessonMaterials, ...lesson }) => ({
        ...lesson,
        resources: lessonMaterials,
      })),
    }),
  );
}

export default function InstructorCourseBuilder({
  mode = "create",
  courseSlug,
  courseTitle,
}: {
  mode?: "create" | "edit";
  courseSlug?: string;
  courseTitle?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const isAdmin = pathname.startsWith("/admin/student/courses");
  const workspaceLabel = isAdmin ? "Admin Course Builder" : "Course Builder";

  const backHref = isAdmin ? "/admin/student/courses" : "/instructor/courses";

  const [currentStep, setCurrentStep] = useState(0);

  const [course, setCourse] = useState({
    ...emptyCourse,
    title: courseTitle ?? emptyCourse.title,
  });

  const curriculum = useCurriculum(mode === "edit" ? [] : startingModules);
  const { modules, setModules } = curriculum;

  const [quizEnabled, setQuizEnabled] = useState(true);
  const [quizTitle, setQuizTitle] = useState("Module Checkpoint Quiz");
  const [quizPassingScore, setQuizPassingScore] = useState("80");
  const [questions, setQuestions] = useState(startingQuestions);

  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(
    mode === "edit" && Boolean(courseSlug),
  );

  const [persistedSlug, setPersistedSlug] = useState(courseSlug ?? "");
  const [categories, setCategories] = useState<CourseCategoryOption[]>([]);

  const isEditMode = mode === "edit" || Boolean(persistedSlug);
  const progress = ((currentStep + 1) / steps.length) * 100;

  useEffect(() => {
    fetch("/api/course-categories", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load course categories.");
        const data = (await response.json()) as {
          categories?: CourseCategoryOption[];
        };
        setCategories(data.categories ?? []);
      })
      .catch(() => setCategories([]));
  }, []);

  const field = (name: string, value: string) => {
    setCourse((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const addQuestion = () => {
    setQuestions((items) => [
      ...items,
      {
        id: newItemId(),
        question: `Question ${items.length + 1}`,
        options: ["Option A", "Option B", "Option C", "Option D"],
        answer: "Option A",
      },
    ]);
  };

  const applySavedCourse = (data: SavedCourse) => {
    setPersistedSlug(data.slug);

    setCourse((previous) => ({
      ...previous,
      title: data.title,
      category: data.category?.name ?? previous.category,
      price: `$${data.price}`,
      description: data.description ?? "",
      thumbnail: data.thumbnail ?? "",
    }));

    setModules(hydrateModules(data));
  };

  useEffect(() => {
    if (mode !== "edit" || !courseSlug) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`/api/courses/${courseSlug}`);
        const data = (await response.json()) as SavedCourse & {
          error?: string;
        };

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setMessage(data.error ?? "Unable to load course.");
          setLoading(false);
          return;
        }

        applySavedCourse(data);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setMessage("Unable to load course.");
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [mode, courseSlug]);

  const persistCourse = async (
    action: "draft" | "submit" | "publish" = "draft",
  ) => {
    setSaving(true);
    setMessage(null);

    try {
      // NOTE: `status` is only included when an admin is explicitly
      // publishing. Every other save (draft saves, instructor submits,
      // and admin edits that aren't the Publish action) omits `status`
      // entirely, so the backend's `nextInstructorCourseStatus` preserves
      // whatever status the course already has. Previously this always
      // sent `status: 'DRAFT'`, which meant an admin editing an already
      // PUBLISHED course and clicking "Save Draft" would silently
      // unpublish it.
      const payload: Record<string, unknown> = {
        title: course.title,
        description: course.description,
        category: course.category,
        price: Number(course.price.replace(/[^0-9.]/g, "")) || 0,
        thumbnail: course.thumbnail || null,

        modules: courseModulesPayload(modules),
      };

      if (isAdmin && action === "publish") {
        payload.status = "PUBLISHED";
      }

      const targetSlug = persistedSlug || courseSlug;

      const response = targetSlug
        ? await fetch(`/api/courses/${targetSlug}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/courses", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

      const data = (await response.json()) as SavedCourse & {
        error?: string;
      };

      if (!response.ok || !data.slug) {
        setMessage(data.error ?? "Unable to save course.");
        return;
      }

      applySavedCourse(data);

      if (isAdmin && action === "publish") {
        setMessage("Course published successfully.");
      } else if (isAdmin && action === "draft") {
        setMessage("Course draft saved successfully.");
      } else if (!isAdmin && action === "submit") {
        const submission = await fetch(`/api/courses/${data.slug}/submit`, {
          method: "POST",
        });

        const submissionData = (await submission.json()) as {
          error?: string;
        };

        if (!submission.ok) {
          setMessage(
            submissionData.error ?? "Unable to submit course for review.",
          );
          return;
        }

        setMessage("Course submitted for admin review.");
      } else {
        setMessage("Course saved successfully.");
      }

      if (!targetSlug && pathname.startsWith("/instructor/courses")) {
        router.replace(`/instructor/courses/${data.slug}/edit`);
      }

      router.refresh();
    } catch {
      setMessage("Unable to save course.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <p className="text-sm text-slate-500">Loading course...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f7f9fc]">
      <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#1C1D52]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Courses
          </Link>

          <span className="text-xs font-semibold text-slate-400">
            {workspaceLabel}
          </span>
        </div>

        <header className="rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5FBB46]">
                Course Builder
              </p>

              <h1 className="mt-1 text-2xl font-semibold text-[#1C1D52]">
                {isEditMode ? "Edit Course" : "Create New Course"}
              </h1>

              <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
                {isAdmin
                  ? "Create, edit, save, and publish courses directly to the student catalogue."
                  : "Create your course, save your progress, and submit it to an administrator when it is ready for review."}
              </p>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void persistCourse("draft")}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#1C1D52] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Draft"}
            </button>
          </div>

          {message && (
            <p
              className="mt-4 rounded-lg bg-[#e8f7eb] px-4 py-3 text-xs font-semibold text-[#397d3a]"
              role="status"
            >
              {message}
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
            <BuilderBasics
              course={course}
              categories={categories}
              field={field}
            />
          )}

          {currentStep === 1 && (
            <CurriculumEditor
              curriculum={curriculum}
              title="Course curriculum"
              description="Organize the course into modules and lessons."
              materialsLabel="Course materials"
              uploadFolder="courses"
            />
          )}

          {currentStep === 2 && (
            <BuilderMedia
              course={course}
              field={field}
              quizEnabled={quizEnabled}
              setQuizEnabled={setQuizEnabled}
              quizTitle={quizTitle}
              setQuizTitle={setQuizTitle}
              quizPassingScore={quizPassingScore}
              setQuizPassingScore={setQuizPassingScore}
              questions={questions}
              addQuestion={addQuestion}
            />
          )}

          {currentStep === 3 && (
            <BuilderPublish course={course} field={field} isAdmin={isAdmin} />
          )}

          {currentStep === 4 && (
            <BuilderReview
              course={course}
              modules={modules}
              isAdmin={isAdmin}
            />
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
          ) : isAdmin ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void persistCourse("publish")}
              className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-bold text-[#14204f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              {saving ? "Publishing..." : "Publish Course"}
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => void persistCourse("submit")}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {saving ? "Submitting..." : "Submit for Admin Review"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CategorySelect({
  value,
  categories,
  onChange,
}: {
  value: string;
  categories: CourseCategoryOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-[10px] font-semibold text-[#1C1D52]">
      Category
      <select
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-normal outline-none focus:border-[#5FBB46]"
      >
        <option value="">Select a category</option>
        {categories.map((category) => (
          <option key={category.id} value={category.name}>
            {category.name}
          </option>
        ))}
        {value && !categories.some((category) => category.name === value) && (
          <option value={value}>{value} (legacy)</option>
        )}
      </select>
    </label>
  );
}

function PriceInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const pricingEnabled =
    process.env.NEXT_PUBLIC_COURSE_PRICING_ENABLED === "true";
  return (
    <label className="text-[10px] font-semibold text-[#1C1D52]">
      Price
      <input
        type="text"
        value={pricingEnabled ? value : "$0"}
        onChange={(event) => onChange(event.target.value)}
        disabled={!pricingEnabled}
        className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-normal outline-none focus:border-[#5FBB46] disabled:cursor-not-allowed disabled:text-slate-500"
      />
      <span className="mt-1 block text-[9px] font-normal text-slate-500">
        {pricingEnabled
          ? "This price will be shown to learners."
          : "Courses are currently free. Pricing can be enabled later without changing the course."}
      </span>
    </label>
  );
}

function BuilderBasics({
  course,
  categories,
  field,
}: {
  course: typeof emptyCourse;
  categories: CourseCategoryOption[];
  field: (name: string, value: string) => void;
}) {
  return (
    <>
      <BuilderHeading
        icon={BookOpen}
        title="Course basics"
        text="Define the learning objective and primary structure."
      />

      <div className="grid gap-5 md:grid-cols-2">
        <Input
          label="Course title"
          value={course.title}
          onChange={(value) => field("title", value)}
          placeholder="Enter course title"
        />

        <CategorySelect
          value={course.category}
          categories={categories}
          onChange={(value) => field("category", value)}
        />

        <Input
          label="Level"
          value={course.level}
          onChange={(value) => field("level", value)}
          placeholder="e.g. Intermediate"
        />

        <Input
          label="Duration"
          value={course.duration}
          onChange={(value) => field("duration", value)}
          placeholder="e.g. 6 weeks"
        />

        <PriceInput
          value={course.price}
          onChange={(value) => field("price", value)}
        />

        <Input
          label="Launch date"
          value={course.launchDate}
          onChange={(value) => field("launchDate", value)}
          type="date"
        />
      </div>

      <div className="mt-5">
        <Textarea
          label="Course summary"
          value={course.description}
          onChange={(value) => field("description", value)}
          placeholder="Describe what students will learn..."
        />
      </div>

      <div className="mt-5">
        <Textarea
          label="Learning goals"
          value={course.objectives}
          onChange={(value) => field("objectives", value)}
          placeholder="What should students be able to do after completing this course?"
        />
      </div>
    </>
  );
}

function BuilderMedia({
  course,
  field,
  quizEnabled,
  setQuizEnabled,
  quizTitle,
  setQuizTitle,
  quizPassingScore,
  setQuizPassingScore,
  questions,
  addQuestion,
}: {
  course: typeof emptyCourse;
  field: (name: string, value: string) => void;
  quizEnabled: boolean;
  setQuizEnabled: (value: boolean) => void;
  quizTitle: string;
  setQuizTitle: (value: string) => void;
  quizPassingScore: string;
  setQuizPassingScore: (value: string) => void;
  questions: Question[];
  addQuestion: () => void;
}) {
  return (
    <>
      <BuilderHeading
        icon={FileText}
        title="Media & assessment"
        text="Add a course trailer, upload a course thumbnail, and optional quiz."
      />

      <Input
        label="Course trailer video URL"
        value={course.videoUrl}
        onChange={(value) => field("videoUrl", value)}
        placeholder="https://..."
      />

      <div className="mt-5">
        <ImageUploadInput
          label="Course thumbnail"
          value={course.thumbnail}
          onChange={(value) => field("thumbnail", value)}
        />
      </div>

      {/*
        NOTE: quizEnabled / quizTitle / quizPassingScore / questions are
        still local UI state only. persistCourse() does not send them and
        there is no matching field in CourseWriteInput on the backend, so
        anything entered here does not survive a save/reload yet. Wiring
        this up requires a quiz model on the backend (see course-data.ts)
        before it can be included in the payload.
      */}
      <div className="mt-6 rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[#1C1D52]">
              Course quiz
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Add an optional assessment for students.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setQuizEnabled(!quizEnabled)}
            className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${
              quizEnabled
                ? "bg-[#e8f7eb] text-[#397d3a]"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {quizEnabled ? "Enabled" : "Disabled"}
          </button>
        </div>

        {quizEnabled && (
          <div className="mt-5 space-y-4">
            <Input
              label="Quiz title"
              value={quizTitle}
              onChange={setQuizTitle}
            />

            <Input
              label="Passing score"
              value={quizPassingScore}
              onChange={setQuizPassingScore}
              placeholder="80"
            />

            <div className="space-y-3">
              {questions.map((question) => (
                <div key={question.id} className="rounded-lg bg-[#f8fbff] p-4">
                  <p className="text-xs font-semibold text-[#1C1D52]">
                    {question.question}
                  </p>

                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {question.options.map((option) => (
                      <div
                        key={option}
                        className="rounded-md bg-white px-3 py-2 text-[10px] text-slate-500"
                      >
                        {option}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addQuestion}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-[#1C1D52]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Question
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function BuilderPublish({
  course,
  field,
  isAdmin,
}: {
  course: typeof emptyCourse;
  field: (name: string, value: string) => void;
  isAdmin: boolean;
}) {
  return (
    <>
      <BuilderHeading
        icon={ImagePlus}
        title="Publish settings"
        text={
          isAdmin
            ? "Review the publishing information before making this course available to students."
            : "Prepare the course before submitting it to an administrator for review."
        }
      />

      <div className="grid gap-5 md:grid-cols-2">
        <Input
          label="Launch date"
          type="date"
          value={course.launchDate}
          onChange={(value) => field("launchDate", value)}
        />

        <ImageUploadInput
          label="Thumbnail"
          value={course.thumbnail}
          onChange={(value) => field("thumbnail", value)}
        />
      </div>

      <div
        className={`mt-6 rounded-xl p-4 ${
          isAdmin ? "bg-[#e8f7eb]" : "bg-amber-50"
        }`}
      >
        <p
          className={`text-xs font-semibold ${
            isAdmin ? "text-[#397d3a]" : "text-amber-700"
          }`}
        >
          {isAdmin
            ? "As an administrator, you can publish this course directly. It does not need to go through admin review."
            : "Instructors can save drafts and submit courses for review. Only an administrator can publish the course."}
        </p>
      </div>
    </>
  );
}

function BuilderReview({
  course,
  modules,
  isAdmin,
}: {
  course: typeof emptyCourse;
  modules: CurriculumModule[];
  isAdmin: boolean;
}) {
  return (
    <>
      <BuilderHeading
        icon={CircleCheckBig}
        title="Review"
        text={
          isAdmin
            ? "Review the final course setup before publishing it."
            : "Check the final setup before submitting the course for administrator review."
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <ReviewItem label="Course title" value={course.title} />

        <ReviewItem label="Category" value={course.category} />

        <ReviewItem label="Level" value={course.level} />

        <ReviewItem label="Duration" value={course.duration} />

        <ReviewItem label="Price" value={course.price} />

        <ReviewItem label="Modules" value={String(modules.length)} />
      </div>

      <div
        className={`mt-6 rounded-xl p-4 ${
          isAdmin ? "bg-[#e8f7eb]" : "bg-amber-50"
        }`}
      >
        <p
          className={`text-xs font-semibold ${
            isAdmin ? "text-[#397d3a]" : "text-amber-700"
          }`}
        >
          {isAdmin
            ? "Ready to publish. Publishing will make this course available in the student catalogue."
            : "Ready to submit. Your course will be marked as pending review until an administrator approves it."}
        </p>
      </div>
    </>
  );
}

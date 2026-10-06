"use client";

import { BookOpen, Layers3, Plus, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

// The module → lesson editor and form fields shared by the student-side
// Course Builder and the internship Resource Builder. It only edits local
// state; each builder saves through its own API, so the two systems share UI
// but no data.

export type CurriculumMaterial = {
  id: string;
  url: string;
};

export type CurriculumLesson = {
  id: string;
  title: string;
  videoUrl: string;
  content: string;
  materials: CurriculumMaterial[];
};

export type CurriculumModule = {
  id: string;
  title: string;
  summary: string;
  hasLessons: boolean;
  videoUrl: string;
  content: string;
  materials: CurriculumMaterial[];
  lessons: CurriculumLesson[];
};

/** A saved module as either API returns it, with links named `materials`. */
export type SavedCurriculumModule = {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  content: string | null;
  materials: Array<{ id: string; url: string }>;
  lessons: Array<{
    id: string;
    title: string;
    videoUrl: string | null;
    content: string | null;
    materials: Array<{ id: string; url: string }>;
  }>;
};

export function newItemId() {
  return `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Unsaved items carry a "new-" id that the server must not see. */
export function persistedId(id: string) {
  return id.startsWith("new-") ? undefined : id;
}

export function hydrateCurriculum(
  modules: SavedCurriculumModule[],
): CurriculumModule[] {
  return modules.map((module) => {
    const materials = module.materials.map(({ id, url }) => ({ id, url }));
    const hasDirectContent = Boolean(
      module.videoUrl || module.content || materials.length,
    );

    return {
      id: module.id,
      title: module.title,
      summary: module.description ?? "",
      // A module is treated as lesson-based unless it has lessons (true),
      // OR it has no lessons but does have direct content saved (false).
      // A brand-new, entirely empty module defaults to lesson-based, same
      // as addModule() below.
      hasLessons: module.lessons.length > 0 || !hasDirectContent,
      videoUrl: module.videoUrl ?? "",
      content: module.content ?? "",
      materials,
      lessons: module.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        videoUrl: lesson.videoUrl ?? "",
        content: lesson.content ?? "",
        materials: lesson.materials.map(({ id, url }) => ({ id, url })),
      })),
    };
  });
}

function materialsPayload(materials: CurriculumMaterial[]) {
  return materials
    .map((material) => ({
      id: persistedId(material.id),
      title: material.url.trim(),
      type: "link",
      url: material.url.trim(),
    }))
    .filter((material) => material.url);
}

/**
 * The curriculum as both APIs accept it, with links under `materials`.
 *
 * A module is either lesson-based or direct-content - never both. Enforced
 * here at save time (not just in the UI) so a stale toggle state can't send
 * both lessons and module-level content: whichever mode is off gets sent as
 * empty, which makes the server delete any leftover rows on the other side.
 */
export function curriculumPayload(modules: CurriculumModule[]) {
  return modules.map((module) => ({
    id: persistedId(module.id),
    title: module.title,
    description: module.summary,
    videoUrl: module.hasLessons ? null : module.videoUrl.trim() || null,
    content: module.hasLessons ? null : module.content.trim() || null,
    materials: module.hasLessons ? [] : materialsPayload(module.materials),
    lessons: module.hasLessons
      ? module.lessons.map((lesson) => ({
          id: persistedId(lesson.id),
          title: lesson.title,
          content: lesson.content,
          videoUrl: lesson.videoUrl,
          materials: materialsPayload(lesson.materials),
        }))
      : [],
  }));
}

type ModuleUpdater = (module: CurriculumModule) => CurriculumModule;
type LessonUpdater = (lesson: CurriculumLesson) => CurriculumLesson;

/** Curriculum state plus every edit the editor can make to it. */
export function useCurriculum(initial: CurriculumModule[] = []) {
  const [modules, setModules] = useState<CurriculumModule[]>(initial);

  const editModule = (moduleId: string, update: ModuleUpdater) =>
    setModules((items) =>
      items.map((item) => (item.id === moduleId ? update(item) : item)),
    );

  const editLesson = (
    moduleId: string,
    lessonId: string,
    update: LessonUpdater,
  ) =>
    editModule(moduleId, (module) => ({
      ...module,
      lessons: module.lessons.map((lesson) =>
        lesson.id === lessonId ? update(lesson) : lesson,
      ),
    }));

  return {
    modules,
    setModules,
    updateModule: (
      moduleId: string,
      key: keyof CurriculumModule,
      value: string | boolean,
    ) => editModule(moduleId, (module) => ({ ...module, [key]: value })),
    addModule: () =>
      setModules((items) => [
        ...items,
        {
          id: newItemId(),
          title: `Module ${items.length + 1}`,
          summary: "",
          hasLessons: true,
          videoUrl: "",
          content: "",
          materials: [],
          lessons: [],
        },
      ]),
    removeModule: (moduleId: string) =>
      setModules((items) => items.filter((item) => item.id !== moduleId)),
    addLesson: (moduleId: string) =>
      editModule(moduleId, (module) => ({
        ...module,
        lessons: [
          ...module.lessons,
          {
            id: newItemId(),
            title: `Lesson ${module.lessons.length + 1}`,
            videoUrl: "",
            content: "",
            materials: [],
          },
        ],
      })),
    removeLesson: (moduleId: string, lessonId: string) =>
      editModule(moduleId, (module) => ({
        ...module,
        lessons: module.lessons.filter((lesson) => lesson.id !== lessonId),
      })),
    updateLesson: (
      moduleId: string,
      lessonId: string,
      key: "title" | "videoUrl" | "content",
      value: string,
    ) => editLesson(moduleId, lessonId, (lesson) => ({ ...lesson, [key]: value })),
    addModuleMaterial: (moduleId: string) =>
      editModule(moduleId, (module) => ({
        ...module,
        materials: [...module.materials, { id: newItemId(), url: "" }],
      })),
    updateModuleMaterial: (moduleId: string, materialId: string, url: string) =>
      editModule(moduleId, (module) => ({
        ...module,
        materials: module.materials.map((material) =>
          material.id === materialId ? { ...material, url } : material,
        ),
      })),
    removeModuleMaterial: (moduleId: string, materialId: string) =>
      editModule(moduleId, (module) => ({
        ...module,
        materials: module.materials.filter(
          (material) => material.id !== materialId,
        ),
      })),
    addLessonMaterial: (moduleId: string, lessonId: string) =>
      editLesson(moduleId, lessonId, (lesson) => ({
        ...lesson,
        materials: [...lesson.materials, { id: newItemId(), url: "" }],
      })),
    updateLessonMaterial: (
      moduleId: string,
      lessonId: string,
      materialId: string,
      url: string,
    ) =>
      editLesson(moduleId, lessonId, (lesson) => ({
        ...lesson,
        materials: lesson.materials.map((material) =>
          material.id === materialId ? { ...material, url } : material,
        ),
      })),
    removeLessonMaterial: (
      moduleId: string,
      lessonId: string,
      materialId: string,
    ) =>
      editLesson(moduleId, lessonId, (lesson) => ({
        ...lesson,
        materials: lesson.materials.filter(
          (material) => material.id !== materialId,
        ),
      })),
  };
}

export type Curriculum = ReturnType<typeof useCurriculum>;

export function CurriculumEditor({
  curriculum,
  title,
  description,
  materialsLabel,
}: {
  curriculum: Curriculum;
  title: string;
  description: string;
  /** Heading over each module's / lesson's list of links. */
  materialsLabel: string;
}) {
  const {
    modules,
    updateModule,
    addModule,
    removeModule,
    addLesson,
    removeLesson,
    updateLesson,
    addModuleMaterial,
    updateModuleMaterial,
    removeModuleMaterial,
    addLessonMaterial,
    updateLessonMaterial,
    removeLessonMaterial,
  } = curriculum;

  return (
    <>
      <BuilderHeading icon={Layers3} title={title} text={description} />

      <div className="space-y-5">
        {modules.map((module, moduleIndex) => (
          <div
            key={module.id}
            className="rounded-xl border border-slate-200 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                  Module {moduleIndex + 1}
                </p>

                <input
                  value={module.title}
                  onChange={(event) =>
                    updateModule(module.id, "title", event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-[#1C1D52] outline-none focus:border-[#5FBB46]"
                  placeholder="Module title"
                />
              </div>

              <button
                type="button"
                onClick={() => removeModule(module.id)}
                className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                aria-label={`Remove module ${moduleIndex + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4">
              <Textarea
                label="Module summary"
                value={module.summary}
                onChange={(value) => updateModule(module.id, "summary", value)}
                placeholder="Describe this module..."
              />
            </div>

            <div className="mt-4">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                Module format
              </span>
              <div className="inline-flex rounded-lg border border-slate-200 p-1">
                <button
                  type="button"
                  onClick={() => updateModule(module.id, "hasLessons", true)}
                  className={`rounded-md px-3 py-1.5 text-[10px] font-semibold transition ${
                    module.hasLessons
                      ? "bg-[#1C1D52] text-white"
                      : "text-slate-500"
                  }`}
                >
                  Lessons
                </button>
                <button
                  type="button"
                  onClick={() => updateModule(module.id, "hasLessons", false)}
                  className={`rounded-md px-3 py-1.5 text-[10px] font-semibold transition ${
                    !module.hasLessons
                      ? "bg-[#1C1D52] text-white"
                      : "text-slate-500"
                  }`}
                >
                  Direct content
                </button>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">
                {module.hasLessons
                  ? "Break this module into individual lessons learners step through."
                  : "This module is one piece of content - a single video/workshop - with no separate lessons."}
              </p>
            </div>

            {!module.hasLessons && (
              <div className="mt-4 space-y-3 rounded-lg bg-[#f8fbff] p-4">
                <Input
                  label="Video URL"
                  value={module.videoUrl}
                  onChange={(value) =>
                    updateModule(module.id, "videoUrl", value)
                  }
                  placeholder="YouTube or Google Drive link"
                />

                <Textarea
                  label="Module content"
                  value={module.content}
                  onChange={(value) =>
                    updateModule(module.id, "content", value)
                  }
                  placeholder="Workshop brief, instructions, or notes for this module..."
                />

                <MaterialList
                  label={materialsLabel}
                  materials={module.materials}
                  onAdd={() => addModuleMaterial(module.id)}
                  onChange={(materialId, url) =>
                    updateModuleMaterial(module.id, materialId, url)
                  }
                  onRemove={(materialId) =>
                    removeModuleMaterial(module.id, materialId)
                  }
                />
              </div>
            )}

            {module.hasLessons && (
              <div className="mt-4 space-y-3">
                {module.lessons.map((lesson, lessonIndex) => (
                  <div key={lesson.id} className="rounded-lg bg-[#f8fbff] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                        Lesson {lessonIndex + 1}
                      </p>

                      <button
                        type="button"
                        onClick={() => removeLesson(module.id, lesson.id)}
                        className="text-red-500"
                        aria-label={`Remove lesson ${lessonIndex + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <input
                      value={lesson.title}
                      onChange={(event) =>
                        updateLesson(
                          module.id,
                          lesson.id,
                          "title",
                          event.target.value,
                        )
                      }
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-[#1C1D52] outline-none focus:border-[#5FBB46]"
                      placeholder="Lesson title"
                    />

                    <div className="mt-3">
                      <Textarea
                        label="Lesson content"
                        value={lesson.content}
                        onChange={(value) =>
                          updateLesson(module.id, lesson.id, "content", value)
                        }
                        placeholder="Lesson notes or text..."
                      />
                    </div>

                    <div className="mt-3">
                      <Input
                        label="Video URL"
                        value={lesson.videoUrl}
                        onChange={(value) =>
                          updateLesson(module.id, lesson.id, "videoUrl", value)
                        }
                        placeholder="YouTube or Google Drive link"
                      />
                    </div>

                    <div className="mt-3">
                      <MaterialList
                        label={materialsLabel}
                        materials={lesson.materials}
                        onAdd={() => addLessonMaterial(module.id, lesson.id)}
                        onChange={(materialId, url) =>
                          updateLessonMaterial(
                            module.id,
                            lesson.id,
                            materialId,
                            url,
                          )
                        }
                        onRemove={(materialId) =>
                          removeLessonMaterial(module.id, lesson.id, materialId)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {module.hasLessons && (
              <button
                type="button"
                onClick={() => addLesson(module.id)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-[10px] font-semibold text-[#1C1D52]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Lesson
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addModule}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-4 py-2.5 text-xs font-semibold text-white"
      >
        <Plus className="h-4 w-4" />
        Add Module
      </button>
    </>
  );
}

function MaterialList({
  label,
  materials,
  onAdd,
  onChange,
  onRemove,
}: {
  label: string;
  materials: CurriculumMaterial[];
  onAdd: () => void;
  onChange: (materialId: string, url: string) => void;
  onRemove: (materialId: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
          {label}
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1C1D52]"
        >
          <Plus className="h-3 w-3" /> Add Link
        </button>
      </div>
      <div className="space-y-2">
        {materials.map((material) => (
          <div key={material.id} className="flex items-center gap-2">
            <input
              value={material.url}
              onChange={(event) => onChange(material.id, event.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-[#1C1D52] outline-none focus:border-[#5FBB46]"
            />
            <button
              type="button"
              onClick={() => onRemove(material.id)}
              className="rounded p-1 text-red-500 hover:bg-red-50"
              aria-label="Remove link"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {materials.length === 0 && (
          <p className="text-[10px] italic text-slate-400">
            No links added yet.
          </p>
        )}
      </div>
    </div>
  );
}

export function BuilderHeading({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof BookOpen;
  title: string;
  text: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-[#5FBB46]" />
        <h2 className="text-lg font-semibold text-[#1C1D52]">{title}</h2>
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}

export function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#f8fbff] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-[#1C1D52]">
        {value || "Not provided"}
      </p>
    </div>
  );
}

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-[#1C1D52] outline-none focus:border-[#5FBB46]"
      />
    </label>
  );
}

export function ImageUploadInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      if (uploadEvent.target?.result) {
        onChange(uploadEvent.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="block">
      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </span>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://... or upload image"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-[#1C1D52] outline-none focus:border-[#5FBB46]"
        />

        <label className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#1C1D52] hover:bg-slate-50">
          <Upload className="h-4 w-4" />
          <span>Upload File</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>

      {value && (
        <div className="mt-3">
          <Image
            src={value}
            alt="Thumbnail preview"
            width={128}
            height={80}
            className="h-20 w-32 rounded-lg border border-slate-200 object-cover"
          />
        </div>
      )}
    </div>
  );
}

export function Textarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </span>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs leading-5 text-[#1C1D52] outline-none focus:border-[#5FBB46]"
      />
    </label>
  );
}

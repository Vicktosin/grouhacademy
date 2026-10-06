"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Maximize2,
  Menu,
  Play,
  RotateCcw,
  RotateCw,
  Video,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { resolveLessonMedia } from "@/lib/video-embed";

export type LearnLessonResource = {
  id: string;
  title: string;
  url: string;
};

export type LearnLesson = {
  id: string;
  title: string;
  videoUrl: string | null;
  content: string | null;
  resources: LearnLessonResource[];
  complete: boolean;
};

export type LearnModule = {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  content: string | null;
  resources: LearnLessonResource[];
  lessons: LearnLesson[];
};

export type LearnCourseData = {
  slug: string;
  title: string;
  modules: LearnModule[];
};

type ProgressResponse = {
  completed: boolean;
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
  error?: string;
};

// Also the internship Resource player: interns pass itemLabel="Resource",
// their own back link and their own progress endpoint.
export default function CourseLearningPlayer({
  course,
  initialCompletedLessons,
  initialTotalLessons,
  initialProgressPercent,
  itemLabel = "Course",
  backHref = "/student/my-courses",
  lessonsApiPath = `/api/courses/${course.slug}/lessons`,
}: {
  course: LearnCourseData;
  initialCompletedLessons: number;
  initialTotalLessons: number;
  initialProgressPercent: number;
  /** What learners call the thing they are studying ("Course", "Resource"). */
  itemLabel?: string;
  backHref?: string;
  /** Lesson progress is POSTed to `${lessonsApiPath}/${lessonId}/progress`. */
  lessonsApiPath?: string;
}) {
  const [selectedModule, setSelectedModule] = useState(0);
  const [selectedLesson, setSelectedLesson] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [playingMedia, setPlayingMedia] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [savingCompletion, setSavingCompletion] = useState(false);

  // Lesson completion state lives here (not per-lesson local state) so it
  // survives navigating between lessons/modules and can be updated from
  // the server's response after each save.
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(
    () =>
      new Set(
        course.modules.flatMap((module) =>
          module.lessons
            .filter((lesson) => lesson.complete)
            .map((lesson) => lesson.id),
        ),
      ),
  );
  const [completedLessons, setCompletedLessons] = useState(
    initialCompletedLessons,
  );
  const [totalLessons, setTotalLessons] = useState(initialTotalLessons);
  const [progressPercent, setProgressPercent] = useState(
    initialProgressPercent,
  );

  const playerRef = useRef<HTMLIFrameElement>(null);
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef(0);

  const modules = course.modules;
  const currentModule = modules[selectedModule];
  const hasLessons = currentModule.lessons.length > 0;
  const lesson = hasLessons ? currentModule.lessons[selectedLesson] : undefined;
  const hasModuleContent = Boolean(
    currentModule.videoUrl ||
    currentModule.content ||
    currentModule.resources.length,
  );
  const title = lesson ? lesson.title : currentModule.title;
  const mediaUrl = lesson
    ? lesson.videoUrl
    : hasModuleContent
      ? currentModule.videoUrl
      : null;
  const content = lesson
    ? lesson.content
    : hasModuleContent
      ? currentModule.content
      : null;
  const resources = lesson
    ? lesson.resources
    : hasModuleContent
      ? currentModule.resources
      : [];
  const isLessonComplete = lesson ? completedLessonIds.has(lesson.id) : false;
  const mediaKey = `${selectedModule}-${selectedLesson}`;
  // Pasted links (watch pages, youtu.be, no https…) become playable embeds.
  const media = resolveLessonMedia(
    mediaUrl,
    typeof window === "undefined" ? undefined : window.location.origin,
  );

  const isLastLesson =
    selectedModule === modules.length - 1 &&
    (!hasLessons || selectedLesson === currentModule.lessons.length - 1);

  useEffect(() => {
    if (playingMedia !== mediaKey) return;

    const handlePlayerMessage = (event: MessageEvent) => {
      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (
          data?.event === "infoDelivery" &&
          typeof data.info?.currentTime === "number"
        )
          currentTimeRef.current = data.info.currentTime;
      } catch {
        // Ignore unrelated postMessage events.
      }
    };

    window.addEventListener("message", handlePlayerMessage);
    const syncTime = window.setInterval(() => {
      playerRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "getCurrentTime", args: [] }),
        "*",
      );
    }, 500);

    return () => {
      window.removeEventListener("message", handlePlayerMessage);
      window.clearInterval(syncTime);
    };
  }, [mediaKey, playingMedia]);

  // Drive downloads open in their own tab so the course stays put. Small
  // files download straight away and the browser drops the empty tab;
  // large ones stop on Google's "can't scan for viruses" page, so that tab
  // is closed for the student once they come back to the course. A
  // download already started keeps going after its tab closes.
  const downloadTabRef = useRef<Window | null>(null);

  useEffect(() => {
    let leftForDownload = false;
    const handleVisibility = () => {
      const tab = downloadTabRef.current;
      if (!tab) return;
      if (document.visibilityState === "hidden") {
        leftForDownload = true;
      } else if (leftForDownload) {
        leftForDownload = false;
        downloadTabRef.current = null;
        if (!tab.closed) tab.close();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const downloadInNewTab = (url: string) => {
    const tab = window.open("", "_blank");
    if (!tab) {
      // Pop-ups blocked: Drive sends small files as attachments, so this
      // usually downloads without leaving the page.
      window.location.assign(url);
      return;
    }
    // Keep the handle so the tab can be closed later, but don't give
    // Google's page access back to this one.
    tab.opener = null;
    tab.location.href = url;
    downloadTabRef.current = tab;
  };

  const selectModule = (moduleIndex: number) => {
    setSelectedModule(moduleIndex);
    setSelectedLesson(0);
    setPlayingMedia("");
    setIsPaused(false);
    setSidebarOpen(false);
  };

  const selectLesson = (lessonIndex: number) => {
    setSelectedLesson(lessonIndex);
    setPlayingMedia("");
    setIsPaused(false);
    setSidebarOpen(false);
  };

  const goNext = () => {
    if (hasLessons && selectedLesson < currentModule.lessons.length - 1) {
      selectLesson(selectedLesson + 1);
      return;
    }
    if (selectedModule < modules.length - 1) selectModule(selectedModule + 1);
  };

  const sendPlayerCommand = (func: string, args: unknown[] = []) => {
    playerRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*",
    );
  };

  const seekBy = (seconds: number) => {
    sendPlayerCommand("seekTo", [
      Math.max(0, currentTimeRef.current + seconds),
      true,
    ]);
  };

  const toggleFullscreen = async () => {
    if (!mediaContainerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await mediaContainerRef.current.requestFullscreen();
    }
  };

  const toggleLessonComplete = async () => {
    if (!lesson || savingCompletion) return;

    const nextCompleted = !isLessonComplete;
    setSavingCompletion(true);

    try {
      const response = await fetch(`${lessonsApiPath}/${lesson.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: nextCompleted }),
      });

      const data = (await response.json()) as ProgressResponse;

      if (!response.ok) {
        console.error(data.error ?? "Unable to save lesson progress.");
        return;
      }

      setCompletedLessonIds((current) => {
        const next = new Set(current);
        if (data.completed) {
          next.add(lesson.id);
        } else {
          next.delete(lesson.id);
        }
        return next;
      });
      setCompletedLessons(data.completedLessons);
      setTotalLessons(data.totalLessons);
      setProgressPercent(data.progressPercent);
    } catch {
      console.error("Unable to save lesson progress.");
    } finally {
      setSavingCompletion(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-2rem)] w-full max-w-full overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_rgba(28,29,82,0.08)]">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={backHref}
            className="shrink-0 text-[#1C1D52] hover:text-blue-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#1C1D52]">
              {course.title}
            </p>
            <p className="text-[10px] text-slate-500">
              {itemLabel} player · Module {selectedModule + 1} of {modules.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[10px] font-semibold text-slate-500 sm:inline">
            {progressPercent}% complete
          </span>
          <button
            type="button"
            onClick={() => setSidebarOpen((value) => !value)}
            className="rounded-lg border border-slate-200 p-2 text-[#1C1D52] lg:hidden"
            aria-label={`Toggle ${itemLabel.toLowerCase()} outline`}
          >
            {sidebarOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      <div className="grid min-h-[680px] lg:grid-cols-[280px_1fr]">
        <aside
          className={`${sidebarOpen ? "block" : "hidden"} border-b border-slate-200 bg-[#f8fbff] lg:block lg:border-b-0 lg:border-r`}
        >
          <div className="border-b border-slate-200 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5FBB46]">
              {itemLabel} outline
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[#5FBB46]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              {completedLessons} of {totalLessons} lessons complete
            </p>
          </div>
          <div className="space-y-2 p-3">
            {modules.map((item, moduleIndex) => (
              <div key={item.id} className="rounded-lg">
                <button
                  type="button"
                  onClick={() => selectModule(moduleIndex)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left ${selectedModule === moduleIndex ? "bg-[#1C1D52] text-white" : "text-[#1C1D52] hover:bg-white"}`}
                >
                  <span className="text-[10px] font-bold">
                    0{moduleIndex + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                    {item.title}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {selectedModule === moduleIndex && (
                  <div className="mt-1 space-y-1 pl-3">
                    {item.lessons.length > 0 ? (
                      item.lessons.map((itemLesson, lessonIndex) => (
                        <button
                          type="button"
                          key={itemLesson.id}
                          onClick={() => selectLesson(lessonIndex)}
                          className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] ${selectedLesson === lessonIndex ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-500 hover:bg-white"}`}
                        >
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white">
                            {completedLessonIds.has(itemLesson.id) ? (
                              <Check className="h-3 w-3 text-[#5FBB46]" />
                            ) : (
                              <Play className="h-2.5 w-2.5" />
                            )}
                          </span>
                          <span className="truncate">{itemLesson.title}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-2.5 py-2 text-[10px] italic text-slate-400">
                        {item.videoUrl || item.content || item.resources.length
                          ? "Direct module content"
                          : "No lessons in this module yet"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        <main className="min-w-0 bg-white">
          <div className="mx-auto max-w-[850px] px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-500">
              <span>Module {selectedModule + 1}</span>
              <span>·</span>
              <span>
                {hasLessons
                  ? `Lesson ${selectedLesson + 1} of ${currentModule.lessons.length}`
                  : "Module content"}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold text-[#1C1D52] sm:text-3xl">
              {title}
            </h1>
            {currentModule.description && (
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {currentModule.description}
              </p>
            )}

            {!hasLessons && !hasModuleContent ? (
              <div className="mt-6 flex aspect-video items-center justify-center rounded-xl border border-dashed border-slate-300 bg-[#f8fbff]">
                <div className="text-center">
                  <Video className="mx-auto h-7 w-7 text-blue-500" />
                  <p className="mt-3 text-xs font-semibold text-[#1C1D52]">
                    No lessons in this module yet
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Check back once content is added here.
                  </p>
                </div>
              </div>
            ) : mediaUrl ? (
              <div
                ref={mediaContainerRef}
                className="mt-6 aspect-video overflow-hidden rounded-xl bg-[#101426] shadow-[0_12px_30px_rgba(28,29,82,0.16)]"
              >
                {playingMedia === mediaKey && media?.kind === "file" ? (
                  <video
                    src={media.src}
                    controls
                    autoPlay
                    playsInline
                    className="h-full w-full bg-black"
                  />
                ) : playingMedia === mediaKey &&
                  (media?.kind === "embed" || media?.kind === "drive") ? (
                  <iframe
                    className="h-full w-full"
                    src={media.src}
                    title={`${title} lesson media`}
                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                    allowFullScreen
                  />
                ) : playingMedia === mediaKey && !media ? (
                  <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/80">
                    This video link isn&apos;t valid. Please let the{" "}
                    {itemLabel.toLowerCase()} team know.
                  </div>
                ) : playingMedia === mediaKey && media ? (
                  <div className="relative h-full w-full">
                    <iframe
                      ref={playerRef}
                      className="h-full w-full"
                      src={media.src}
                      title={`${title} lesson media`}
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                    <div className="absolute inset-0 z-10" aria-hidden="true" />
                    <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-4 py-3 text-white">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                        Lesson media
                      </span>
                      <span className="text-[10px] text-white/70">
                        Now playing
                      </span>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => seekBy(-10)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#1C1D52] shadow-lg transition hover:bg-white"
                          aria-label="Rewind 10 seconds"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            sendPlayerCommand(
                              isPaused ? "playVideo" : "pauseVideo",
                            );
                            setIsPaused((value) => !value);
                          }}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#1C1D52] shadow-lg transition hover:bg-white"
                          aria-label={isPaused ? "Resume video" : "Pause video"}
                        >
                          {isPaused ? (
                            <Play className="ml-0.5 h-4 w-4 fill-current" />
                          ) : (
                            <span className="flex gap-1">
                              <span className="h-4 w-1 rounded-full bg-current" />
                              <span className="h-4 w-1 rounded-full bg-current" />
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => seekBy(10)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#1C1D52] shadow-lg transition hover:bg-white"
                          aria-label="Forward 10 seconds"
                        >
                          <RotateCw className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={toggleFullscreen}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#1C1D52] shadow-lg transition hover:bg-white"
                        aria-label="Toggle fullscreen"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPlayingMedia(mediaKey);
                      setIsPaused(false);
                    }}
                    className="group relative flex h-full w-full items-center justify-center overflow-hidden text-left"
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(95,187,70,0.38),transparent_32%),linear-gradient(135deg,#121936,#253b66)]" />
                    <div className="relative z-10 flex flex-col items-center text-center text-white">
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#5FBB46] text-[#14204f] shadow-[0_8px_24px_rgba(95,187,70,0.32)] transition group-hover:scale-105">
                        <Play className="ml-1 h-7 w-7 fill-current" />
                      </span>
                      <span className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/65">
                        Lesson media
                      </span>
                      <span className="mt-1 text-sm font-semibold">
                        Start {lesson ? "lesson" : "module"} video
                      </span>
                    </div>
                    <span className="absolute bottom-4 left-4 z-10 rounded-md bg-black/25 px-2.5 py-1.5 text-[10px] text-white/75">
                      {itemLabel} content
                    </span>
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-6 flex aspect-video items-center justify-center rounded-xl border border-dashed border-slate-300 bg-[#f8fbff]">
                <div className="text-center">
                  <Video className="mx-auto h-7 w-7 text-blue-500" />
                  <p className="mt-3 text-xs font-semibold text-[#1C1D52]">
                    No video added for this content
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Continue with the lesson material below.
                  </p>
                </div>
              </div>
            )}

            {media?.kind === "drive" && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => downloadInNewTab(media.downloadUrl)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-[#1C1D52] hover:border-[#5FBB46] hover:text-[#5FBB46]"
                >
                  <Download className="h-4 w-4" />
                  Download video
                </button>
              </div>
            )}

            {content && (
              <article className="mt-7 max-w-3xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5FBB46]">
                  {lesson ? "Lesson content" : "Module content"}
                </p>
                <div className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
                  {content}
                </div>
              </article>
            )}

            {resources.length > 0 && (
              <section className="mt-7 rounded-xl border border-slate-200 bg-[#f8fbff] p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <h2 className="text-xs font-bold text-[#1C1D52]">
                    Materials for this {lesson ? "lesson" : "module"}
                  </h2>
                </div>
                <div className="mt-3 space-y-2">
                  {resources.map((resource) => (
                    <a
                      key={resource.id}
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex w-full items-center gap-3 rounded-lg bg-white px-3 py-2.5 text-left text-xs text-slate-600 hover:text-blue-600"
                    >
                      <Download className="h-3.5 w-3.5 text-[#5FBB46]" />
                      {resource.title}
                    </a>
                  ))}
                </div>
              </section>
            )}

            {hasLessons && (
              <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={toggleLessonComplete}
                  disabled={savingCompletion}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${isLessonComplete ? "bg-[#e8faf7] text-teal-700" : "bg-[#5FBB46] text-[#14204f]"}`}
                >
                  {isLessonComplete ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {savingCompletion
                    ? "Saving..."
                    : isLessonComplete
                      ? "Lesson completed"
                      : "Mark as complete"}
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={isLastLesson}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-[#1C1D52] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next content
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

import PageGuide from "@/components/onboarding/PageGuide";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, CheckCircle2 } from "lucide-react";
import InternshipShell from "@/components/InternshipShell";
import { requireRouteAccess } from "@/lib/route-guards";
import { internshipWorkspaceRedirect } from "@/lib/internship-access";
import { listResourcesForIntern } from "@/lib/intern-resources";

export default async function InternResourcesPage() {
  // Signed out: the login page; second sign-in step owed: the MFA page.
  const userId = await requireRouteAccess();
  // Rendered here, so it checks for itself (the dashboard's gate is in the
  // browser): anyone without the workspace goes where they belong.
  const elsewhere = await internshipWorkspaceRedirect(userId);
  if (elsewhere) redirect(elsewhere);
  // Only resources published for the intern's own track come back.
  const resources = await listResourcesForIntern(userId);

  return (
    <InternshipShell>
      <div className="space-y-5">
        <PageGuide section="resources" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1C1D52]">
            Resources
          </h1>
          <p className="mt-2 text-xs text-slate-500">
            Learning material for your internship track. Work through each
            resource at your own pace.
          </p>
        </div>

        {resources.length === 0 ? (
          <section className="flex flex-col items-center rounded-2xl bg-white px-6 py-14 text-center shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
            <BookOpen className="h-8 w-8 text-blue-500" />
            <p className="mt-3 text-sm font-semibold text-[#1C1D52]">
              No resources for your track yet
            </p>
            <p className="mt-1 text-xs text-slate-500">
              New material will appear here as soon as it is published.
            </p>
          </section>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {resources.map((resource) => (
              <article
                key={resource.slug}
                className="flex flex-col overflow-hidden rounded-xl bg-white p-2 shadow-[0_8px_24px_rgba(28,29,82,0.09)]"
              >
                <div className="relative aspect-[2.1/1] overflow-hidden rounded-lg bg-[linear-gradient(135deg,#1c1d52,#5fbb46)]">
                  {resource.thumbnail && (
                    <Image
                      src={resource.thumbnail}
                      alt=""
                      fill
                      // Admins may paste a link from any host (or upload
                      // a data URL), which the image optimizer would reject.
                      unoptimized
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col px-2 pb-2 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5FBB46]">
                    {[
                      ...resource.trackNames,
                      `${resource.levelName} level`,
                    ].join(" · ")}
                  </p>
                  <h2 className="mt-1 text-sm font-bold text-[#1C1D52]">
                    {resource.title}
                  </h2>
                  {resource.description && (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                      {resource.description}
                    </p>
                  )}
                  <div className="mt-auto pt-4">
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>
                        {resource.moduleCount} module
                        {resource.moduleCount === 1 ? "" : "s"} ·{" "}
                        {resource.totalLessons} lesson
                        {resource.totalLessons === 1 ? "" : "s"}
                      </span>
                      <span className="font-semibold">
                        {resource.progressPercent}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#5FBB46]"
                        style={{ width: `${resource.progressPercent}%` }}
                      />
                    </div>
                    <Link
                      href={`/internship/dashboard/resources/${resource.slug}`}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1C1D52] px-4 py-2.5 text-xs font-semibold text-white"
                    >
                      {resource.progressPercent === 100 ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" /> Review
                        </>
                      ) : resource.completedLessons > 0 ? (
                        "Continue"
                      ) : (
                        "Start"
                      )}
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </InternshipShell>
  );
}

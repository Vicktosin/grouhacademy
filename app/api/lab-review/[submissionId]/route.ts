import { NextResponse } from "next/server";
import { RoleName } from "@/generated/prisma/client";
import { artifactKeys, artifactUrls, type LabArtifacts } from "@/lib/lab-artifacts";
import { normalizeChecks } from "@/lib/lab-shared";
import { isAssignedIntern } from "@/lib/mentor-data";
import { getPrisma } from "@/lib/prisma";
import { userHasRole } from "@/lib/rbac";
import { getCurrentUserId } from "@/lib/route-guards";
import { parseWpConfig } from "@/lib/wp-sim/model";

/**
 * A Practice Lab task submission as the intern built it: screenshots and
 * the submitted code (web, React) or the site snapshot (WordPress). For
 * admins, the intern's assigned mentor, and the intern.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const viewerId = await getCurrentUserId();
  if (!viewerId) return NextResponse.json({ error: "Sign in to see this." }, { status: 401 });
  const submission = await getPrisma().taskSubmission.findUnique({
    where: { id: (await params).submissionId },
    select: {
      userId: true,
      status: true,
      score: true,
      submittedAt: true,
      labArtifacts: true,
      user: { select: { name: true, email: true } },
      task: {
        select: {
          title: true,
          maxScore: true,
          labScenario: { select: { kind: true, title: true, checks: true, config: true } },
        },
      },
    },
  });
  if (!submission?.task.labScenario) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const allowed =
    viewerId === submission.userId ||
    (await userHasRole(viewerId, RoleName.ADMIN)) ||
    ((await userHasRole(viewerId, RoleName.MENTOR)) && (await isAssignedIntern(viewerId, submission.userId)));
  if (!allowed) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const scenario = submission.task.labScenario;
  const artifacts = (submission.labArtifacts ?? {}) as LabArtifacts;
  const urls = await artifactUrls(artifactKeys(artifacts));
  return NextResponse.json({
    intern: submission.user.name || submission.user.email,
    task: submission.task.title,
    exercise: scenario.title,
    kind: scenario.kind,
    status: submission.status,
    score: submission.score,
    maxScore: submission.task.maxScore,
    submittedAt: submission.submittedAt?.toISOString() ?? null,
    screenshots: (artifacts.screenshots ?? [])
      .map((shot) => ({ label: shot.label, width: shot.width, height: shot.height, url: urls.get(shot.key) ?? null }))
      .filter((shot) => shot.url),
    files: scenario.kind === "WEB" || scenario.kind === "REACT" ? (artifacts.files ?? null) : null,
    checks: scenario.kind === "WEB" || scenario.kind === "REACT" ? normalizeChecks(scenario.checks) : [],
    snapshot:
      scenario.kind === "WORDPRESS" && artifacts.snapshot && urls.get(artifacts.snapshot.key)
        ? { url: urls.get(artifacts.snapshot.key)!, bytes: artifacts.snapshot.bytes, config: parseWpConfig(scenario.config) }
        : null,
  });
}

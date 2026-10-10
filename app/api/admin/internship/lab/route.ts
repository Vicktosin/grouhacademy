import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";
import { listLevels } from "@/lib/internship-levels";
import { parseScenarioInput } from "@/lib/lab-admin";
import { isLabReviewEnabled } from "@/lib/practice-lab";
import { isLabMediaEnabled } from "@/lib/lab-media";
import { isCodeKind, LAB_KIND_LABEL, normalizeChecks } from "@/lib/lab-shared";
import { parseAdsConfig } from "@/lib/ads-sim/model";
import { parseSocialConfig } from "@/lib/social-sim/model";
import { parseAutomationConfig } from "@/lib/automation-sim/model";
import { parseBackendConfig } from "@/lib/backend-sim/model";
import { parseWpConfig } from "@/lib/wp-sim/model";
import { parseContentConfig } from "@/lib/content-sim/model";
import { REAL_USER } from "@/lib/real-user";

/** Every exercise, plus tracks and levels for the builder. */
export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const prisma = getPrisma();
  const [tracks, levels, scenarios] = await Promise.all([
    prisma.internshipProgram.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    listLevels(),
    prisma.labScenario.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        program: { select: { name: true } },
        level: { select: { name: true } },
        _count: { select: { attempts: { where: { user: REAL_USER } }, tasks: true } },
        attempts: { where: { status: "SUBMITTED", user: REAL_USER }, select: { id: true } },
      },
    }),
  ]);
  return NextResponse.json({
    reviewEnabled: isLabReviewEnabled(),
    mediaEnabled: isLabMediaEnabled(),
    tracks,
    levels: levels.map(({ id, name }) => ({ id, name })),
    scenarios: scenarios.map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      kind: scenario.kind,
      kindLabel: LAB_KIND_LABEL[scenario.kind],
      track: scenario.program.name,
      level: scenario.level.name,
      published: scenario.published,
      // Code: checks. Ads and social: goals. Automation: test records.
      // Backend: API tests.
      checkCount: isCodeKind(scenario.kind)
        ? normalizeChecks(scenario.checks).length
        : scenario.kind === "BACKEND"
          ? parseBackendConfig(scenario.config).tests.length
          : scenario.kind === "WORDPRESS"
          ? parseWpConfig(scenario.config).checks.length
          : scenario.kind === "CONTENT"
          ? (({ mode, errors, pieces, rubric }) =>
              mode === "FACTCHECK"
                ? errors.length
                : pieces.reduce((sum, piece) => sum + piece.rules.length + rubric.length, 0))(
              parseContentConfig(scenario.config),
            )
          : scenario.kind === "AUTOMATION"
          ? parseAutomationConfig(scenario.config).records.length
          : scenario.kind === "SOCIAL"
          ? parseSocialConfig(scenario.config).goals.length
          : parseAdsConfig(scenario.config).goals.length,
      attempts: scenario._count.attempts,
      submitted: scenario.attempts.length,
      linkedTasks: scenario._count.tasks,
    })),
  });
}

export async function POST(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const parsed = await parseScenarioInput(
    await request.json().catch(() => null),
  );
  if ("error" in parsed)
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  const scenario = await getPrisma().labScenario.create({ data: parsed.data });
  return NextResponse.json({ id: scenario.id }, { status: 201 });
}

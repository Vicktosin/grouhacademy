import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";
import { parseScenarioInput } from "@/lib/lab-admin";
import { isCodeKind, normalizeChecks, normalizeFiles } from "@/lib/lab-shared";
import { DEFAULT_ADS_CONFIG, parseAdsConfig } from "@/lib/ads-sim/model";
import { DEFAULT_SOCIAL_CONFIG, parseSocialConfig } from "@/lib/social-sim/model";
import {
  DEFAULT_AUTOMATION_CONFIG,
  parseAutomationConfig,
} from "@/lib/automation-sim/model";
import { parseBackendConfig, parseBackendFiles } from "@/lib/backend-sim/model";
import { parseWpConfig } from "@/lib/wp-sim/model";

type Params = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json({ error: "Exercise not found." }, { status: 404 });

/** The exercise with its model answer, for the builder. */
export async function GET(_request: Request, { params }: Params) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const scenario = await getPrisma().labScenario.findUnique({
    where: { id: (await params).id },
  });
  if (!scenario) return notFound();
  if (scenario.kind === "BACKEND") {
    const starterFiles = parseBackendFiles(scenario.starterFiles);
    return NextResponse.json({
      id: scenario.id,
      programId: scenario.programId,
      levelId: scenario.levelId,
      kind: scenario.kind,
      title: scenario.title,
      brief: scenario.brief,
      config: parseBackendConfig(scenario.config),
      starterFiles,
      solutionFiles: scenario.solutionFiles
        ? parseBackendFiles(scenario.solutionFiles, starterFiles)
        : null,
      checks: [],
      published: scenario.published,
    });
  }
  if (scenario.kind === "WORDPRESS")
    return NextResponse.json({
      id: scenario.id,
      programId: scenario.programId,
      levelId: scenario.levelId,
      kind: scenario.kind,
      title: scenario.title,
      brief: scenario.brief,
      config: parseWpConfig(scenario.config),
      starterFiles: {},
      solutionFiles: null,
      checks: [],
      published: scenario.published,
    });
  if (!isCodeKind(scenario.kind))
    return NextResponse.json({
      id: scenario.id,
      programId: scenario.programId,
      levelId: scenario.levelId,
      kind: scenario.kind,
      title: scenario.title,
      brief: scenario.brief,
      config:
        scenario.kind === "AUTOMATION"
          ? scenario.config
            ? parseAutomationConfig(scenario.config)
            : DEFAULT_AUTOMATION_CONFIG
          : scenario.kind === "SOCIAL"
          ? scenario.config
            ? parseSocialConfig(scenario.config)
            : DEFAULT_SOCIAL_CONFIG
          : scenario.config
            ? parseAdsConfig(scenario.config)
            : DEFAULT_ADS_CONFIG,
      published: scenario.published,
    });
  const starterFiles = normalizeFiles(scenario.kind, scenario.starterFiles);
  return NextResponse.json({
    id: scenario.id,
    programId: scenario.programId,
    levelId: scenario.levelId,
    kind: scenario.kind,
    title: scenario.title,
    brief: scenario.brief,
    starterFiles,
    solutionFiles: scenario.solutionFiles
      ? normalizeFiles(scenario.kind, scenario.solutionFiles, starterFiles)
      : null,
    checks: normalizeChecks(scenario.checks),
    published: scenario.published,
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const id = (await params).id;
  const prisma = getPrisma();
  const existing = await prisma.labScenario.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return notFound();
  const parsed = await parseScenarioInput(
    await request.json().catch(() => null),
  );
  if ("error" in parsed)
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  await prisma.labScenario.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const id = (await params).id;
  const prisma = getPrisma();
  const existing = await prisma.labScenario.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return notFound();
  await prisma.labScenario.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}

import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";
import { isValidSchedulePoint, type SchedulePoint } from "@/lib/task-schedule";
import {
  DEFAULT_LAB_PASS_MARK,
  parseLabPassMark,
} from "@/lib/lab-task-grading";

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 10_000;

function point(body: Record<string, unknown>, prefix: "opens" | "due"): SchedulePoint {
  return {
    week: Number(body[`${prefix}Week`]),
    day: Number(body[`${prefix}Day`]),
    time: String(body[`${prefix}Time`] ?? ""),
  };
}

export type TemplateInput = {
  programId: string | null;
  levelId: string;
  title: string;
  description: string | null;
  kind: "INDIVIDUAL" | "GROUP";
  opensWeek: number;
  opensDay: number;
  opensTime: string;
  dueWeek: number;
  dueDay: number;
  dueTime: string;
  maxScore: number;
  labScenarioId: string | null;
  labPassMark: number;
  officeLifeDay: number | null;
  isShared: boolean;
};

/** Validate a template payload. Returns an error string or the parsed data. */
export async function parseTemplate(
  body: Record<string, unknown>,
): Promise<string | TemplateInput> {
  const title = String(body.title ?? "").trim();
  const levelId = String(body.levelId ?? "").trim();
  const programIdRaw = typeof body.programId === "string" ? body.programId.trim() : null;
  const description = String(body.description ?? "").trim();
  const kind = body.kind === "GROUP" ? ("GROUP" as const) : ("INDIVIDUAL" as const);
  const isShared = body.isShared === true || body.isShared === "true";
  const opens = point(body, "opens");
  const due = point(body, "due");
  const maxScore = Number(body.maxScore ?? 100);

  if (!title || title.length > MAX_TITLE_LENGTH)
    return `Give the template a name (up to ${MAX_TITLE_LENGTH} characters).`;
  if (description.length > MAX_DESCRIPTION_LENGTH)
    return "The description is too long.";
  if (!levelId) return "Choose the level this template belongs to.";
  if (!isValidSchedulePoint(opens) || !isValidSchedulePoint(due))
    return "Set a valid week, day (1–7) and time for when the task opens and when it is due.";
  if (!Number.isInteger(maxScore) || maxScore < 1 || maxScore > 1000)
    return "Max score must be a whole number from 1 to 1000.";

  const prisma = getPrisma();

  const level = await prisma.internshipLevel.findUnique({ where: { id: levelId }, select: { id: true } });
  if (!level) return "Level not found.";

  const programId: string | null = isShared ? null : (programIdRaw || null);
  if (!isShared && !programId) return "Choose the track this template belongs to, or mark it as shared.";
  if (isShared && kind !== "GROUP") return "Only GROUP tasks can be marked as shared.";

  if (programId) {
    const prog = await prisma.internshipProgram.findUnique({ where: { id: programId }, select: { id: true } });
    if (!prog) return "Track not found.";
  }

  const labScenarioId =
    typeof body.labScenarioId === "string" && body.labScenarioId ? body.labScenarioId : null;
  const officeLifeDay =
    body.officeLifeDay === undefined || body.officeLifeDay === null || body.officeLifeDay === ""
      ? null
      : Number(body.officeLifeDay);

  if (labScenarioId && officeLifeDay !== null)
    return "A template can target either Practice Lab or Work-Life, not both.";
  if (officeLifeDay !== null && kind === "GROUP")
    return "Work-Life sessions can only be linked to individual tasks.";
  if (labScenarioId && kind === "GROUP")
    return "Practice Lab exercises can only be linked to individual tasks.";

  if (officeLifeDay !== null && (!Number.isInteger(officeLifeDay) || officeLifeDay < 1 || officeLifeDay > 4))
    return "Choose a valid Work-Life day (1–4).";

  if (labScenarioId && programId) {
    const scenario = await prisma.labScenario.findUnique({
      where: { id: labScenarioId },
      select: { programId: true },
    });
    if (!scenario || scenario.programId !== programId)
      return "Choose a Practice Lab exercise from this track.";
  }

  const labPassMark = labScenarioId
    ? parseLabPassMark(body.labPassMark ?? DEFAULT_LAB_PASS_MARK)
    : DEFAULT_LAB_PASS_MARK;
  if (labPassMark === null) return "Set the pass mark as a whole number from 1 to 100.";

  return {
    programId,
    levelId,
    title,
    description: description || null,
    kind,
    opensWeek: opens.week,
    opensDay: opens.day,
    opensTime: opens.time,
    dueWeek: due.week,
    dueDay: due.day,
    dueTime: due.time,
    maxScore,
    labScenarioId,
    labPassMark,
    officeLifeDay,
    isShared,
  };
}

// ── GET /api/admin/internship/task-library ────────────────────────────────────

export async function GET(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const { searchParams } = new URL(request.url);
  const levelId = searchParams.get("levelId") ?? undefined;
  const programId = searchParams.get("programId") ?? undefined;
  const kind = searchParams.get("kind") === "GROUP" ? "GROUP" : searchParams.get("kind") === "INDIVIDUAL" ? "INDIVIDUAL" : undefined;
  const includeArchived = searchParams.get("archived") === "true";

  const prisma = getPrisma();
  const templates = await prisma.internshipTaskTemplate.findMany({
    where: {
      ...(levelId && { levelId }),
      ...(programId && { programId }),
      ...(kind && { kind }),
      archived: includeArchived ? undefined : false,
    },
    orderBy: [{ opensWeek: "asc" }, { opensDay: "asc" }, { title: "asc" }],
    include: {
      program: { select: { id: true, name: true } },
      level: { select: { id: true, name: true } },
      labScenario: { select: { id: true, title: true, kind: true } },
      _count: { select: { tasks: true } },
    },
  });

  return NextResponse.json({ templates });
}

// ── POST /api/admin/internship/task-library ───────────────────────────────────

export async function POST(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const parsed = await parseTemplate(body as Record<string, unknown>);
  if (typeof parsed === "string")
    return NextResponse.json({ error: parsed }, { status: 400 });

  const prisma = getPrisma();
  const template = await prisma.internshipTaskTemplate.create({
    data: parsed,
    include: {
      program: { select: { id: true, name: true } },
      level: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ template }, { status: 201 });
}

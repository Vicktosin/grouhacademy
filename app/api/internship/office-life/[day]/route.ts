import { NextResponse } from "next/server";
import { requireInternshipWorkspace } from "@/lib/internship-access";
import { isPreviewSession } from "@/lib/route-guards";
import { officeLifeAct, officeLifeDay, type OfficeLifeAction } from "@/lib/office-life/server";

// One Office Life workday: read it, or do its next step (clock in, open an
// email, send an email, finish a meeting, send a report or the build).
// An admin's preview intern can open any workday, to check them early.

// Marking a step can take an AI call.
export const maxDuration = 60;

type Params = { params: Promise<{ day: string }> };

function dayNumber(raw: string) {
  const day = Number(raw);
  return Number.isInteger(day) && day >= 1 && day <= 30 ? day : null;
}

export async function GET(_request: Request, { params }: Params) {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  const day = dayNumber((await params).day);
  if (!day) return NextResponse.json({ error: "That workday doesn't exist." }, { status: 404 });
  const result = await officeLifeDay(access.userId, day, await isPreviewSession());
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}

export async function POST(request: Request, { params }: Params) {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  const day = dayNumber((await params).day);
  if (!day) return NextResponse.json({ error: "That workday doesn't exist." }, { status: 404 });
  const body = (await request.json().catch(() => null)) as OfficeLifeAction | null;
  if (!body || typeof body.action !== "string")
    return NextResponse.json({ error: "Say what you're doing." }, { status: 400 });
  const result = await officeLifeAct(access.userId, day, await isPreviewSession(), body);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}

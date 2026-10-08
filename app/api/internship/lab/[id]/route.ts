import { NextResponse } from "next/server";
import { requireInternApi } from "@/lib/lab-api";
import { getLabForIntern, saveLabDraft } from "@/lib/practice-lab";

type Params = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json({ error: "Exercise not found." }, { status: 404 });

/** The exercise and the intern's saved work. ?taskId= for a linked task. */
export async function GET(request: Request, { params }: Params) {
  const userId = await requireInternApi();
  if (userId instanceof NextResponse) return userId;
  const taskId = new URL(request.url).searchParams.get("taskId");
  const lab = await getLabForIntern(userId, (await params).id, taskId);
  return lab ? NextResponse.json(lab) : notFound();
}

/** Autosave. Body: { files }. */
export async function PUT(request: Request, { params }: Params) {
  const userId = await requireInternApi();
  if (userId instanceof NextResponse) return userId;
  const body = (await request.json().catch(() => null)) as {
    files?: unknown;
  } | null;
  if (!body?.files)
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  const saved = await saveLabDraft(userId, (await params).id, body.files);
  return saved ? NextResponse.json({ ok: true }) : notFound();
}

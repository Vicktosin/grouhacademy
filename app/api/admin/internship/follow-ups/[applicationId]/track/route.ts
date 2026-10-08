import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { changeApplicantTrack } from "@/lib/applicant-track-change";

/**
 * Moves an applicant who hasn't paid to another track and level. They take
 * that track's assessment, then pay its fee. Body: { programId, levelId }.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body = (await request.json().catch(() => null)) as {
    programId?: unknown;
    levelId?: unknown;
  } | null;
  if (typeof body?.programId !== "string" || typeof body.levelId !== "string")
    return NextResponse.json(
      { error: "Choose a track and level." },
      { status: 400 },
    );
  const result = await changeApplicantTrack(
    (await params).applicationId,
    body.programId,
    body.levelId,
  );
  if ("error" in result)
    return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { endInterview } from "@/lib/interviews";
import { requireInternshipWorkspace } from "@/lib/internship-access";

/** Ends the intern's interview now. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  const { userId } = access;
  const session = await endInterview(userId, (await params).id);
  if (!session)
    return NextResponse.json(
      { error: "Interview not found." },
      { status: 404 },
    );
  return NextResponse.json({ session });
}

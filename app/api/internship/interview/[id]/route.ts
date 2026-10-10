import { NextResponse } from "next/server";
import { getSession } from "@/lib/interviews";
import { requireInternshipWorkspace } from "@/lib/internship-access";

/** One of the intern's interviews (polled while waiting for feedback). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  const { userId } = access;
  const session = await getSession(userId, (await params).id);
  if (!session)
    return NextResponse.json(
      { error: "Interview not found." },
      { status: 404 },
    );
  return NextResponse.json({ session });
}

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { listFollowUps } from "@/lib/internship-follow-ups";
import { followUpCardImage } from "@/lib/follow-up-card";

// The applicant's summary card as a PNG. Admin-only: it shows their score
// and fee.

type Params = { params: Promise<{ applicationId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const [row] = await listFollowUps((await params).applicationId);
  if (!row)
    return NextResponse.json(
      { error: "Applicant not found." },
      { status: 404 },
    );
  return followUpCardImage(row);
}

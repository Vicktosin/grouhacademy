import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { trackChangeOptions } from "@/lib/applicant-track-change";

/** Tracks and levels an applicant can be moved to, with their fees. */
export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  return NextResponse.json({ tracks: await trackChangeOptions() });
}

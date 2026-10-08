import { NextResponse } from "next/server";
import { requireInternApi } from "@/lib/lab-api";
import { listLabForIntern } from "@/lib/practice-lab";

/** Exercises for the intern's track at their level and below. */
export async function GET() {
  const userId = await requireInternApi();
  if (userId instanceof NextResponse) return userId;
  return NextResponse.json({ exercises: await listLabForIntern(userId) });
}

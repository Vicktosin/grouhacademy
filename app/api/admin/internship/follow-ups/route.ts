import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import {
  getFollowUpTemplates,
  listFollowUps,
} from "@/lib/internship-follow-ups";

/** Everyone to follow up (both lists) and the message templates. */
export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const [rows, templates] = await Promise.all([
    listFollowUps(),
    getFollowUpTemplates(),
  ]);
  return NextResponse.json({ rows, templates });
}

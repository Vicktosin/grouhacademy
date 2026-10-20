import { NextResponse } from "next/server";
import { requireSupportOrAdminApi } from "@/lib/api-guards";
import {
  getFollowUpTemplates,
  listFollowUps,
} from "@/lib/internship-follow-ups";

/** Everyone to follow up (both lists) and the message templates. */
export async function GET() {
  const access = await requireSupportOrAdminApi();
  if (access instanceof NextResponse) return access;
  const [rows, templates] = await Promise.all([
    listFollowUps(),
    getFollowUpTemplates(),
  ]);
  return NextResponse.json({ rows, templates });
}

import { NextResponse } from "next/server";
import { guideVideoEmbed } from "@/lib/guide-video";
import { requireInternshipWorkspace } from "@/lib/internship-access";
import { getPlatformSettings } from "@/lib/platform-settings";

/** The "How it works" demo videos, as players (null: no video set). */
export async function GET() {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  const settings = await getPlatformSettings();
  return NextResponse.json({
    "office-life": guideVideoEmbed(settings.officeLifeGuideVideoUrl),
    "practice-lab": guideVideoEmbed(settings.practiceLabGuideVideoUrl),
  });
}

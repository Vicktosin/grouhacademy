import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { parseGuideVideoLink } from "@/lib/guide-video";
import { getPlatformSettings } from "@/lib/platform-settings";
import { getPrisma } from "@/lib/prisma";

// The demo video links for the Office Life and Practice Lab "How it works"
// guides, set on the admin Office Life and Practice Lab pages.

const FIELDS = { "office-life": "officeLifeGuideVideoUrl", "practice-lab": "practiceLabGuideVideoUrl" } as const;

export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const settings = await getPlatformSettings();
  return NextResponse.json({ "office-life": settings.officeLifeGuideVideoUrl, "practice-lab": settings.practiceLabGuideVideoUrl });
}

export async function PUT(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body = await request.json().catch(() => null);
  const guide = body?.guide as keyof typeof FIELDS;
  if (!(guide in FIELDS)) return NextResponse.json({ error: "Choose Office Life or Practice Lab." }, { status: 400 });
  const link = parseGuideVideoLink(body?.url);
  if ("error" in link) return NextResponse.json({ error: link.error }, { status: 400 });
  await getPlatformSettings(); // makes sure the settings row exists
  await getPrisma().platformSettings.update({
    where: { id: "singleton" },
    data: { [FIELDS[guide]]: link.url, updatedById: adminId },
  });
  return NextResponse.json({ url: link.url });
}

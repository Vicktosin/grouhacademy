import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";
import { parsePlatformSettingsPatch } from "@/lib/platform-settings-validation";
import { applyPlatformSettingsPatch } from "@/lib/platform-settings-update";

const SETTINGS_ID = "singleton";

function serialize(settings: Awaited<ReturnType<typeof getSettings>>) {
  return {
    ...settings,
    updatedAt: settings.updatedAt.toISOString(),
  };
}

async function getSettings() {
  return getPrisma().platformSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
}

export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  try {
    return NextResponse.json(serialize(await getSettings()));
  } catch (error) {
    console.error("Failed to load platform settings:", error);
    return NextResponse.json(
      { error: "Unable to load platform settings." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const userId = await requireAdminApi();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "A settings payload is required." },
      { status: 400 },
    );
  }

  const { data, errors } = parsePlatformSettingsPatch(
    body as Record<string, unknown>,
  );
  if (errors.length) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  try {
    const settings = await applyPlatformSettingsPatch(data, userId);
    return NextResponse.json(serialize(settings));
  } catch (error) {
    console.error("Failed to save platform settings:", error);
    return NextResponse.json(
      { error: "Unable to save platform settings." },
      { status: 500 },
    );
  }
}

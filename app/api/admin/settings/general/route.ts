import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getPlatformSettings } from "@/lib/platform-settings";
import { requireAdminApi } from "@/lib/api-guards";
import { parsePlatformSettingsPatch } from "@/lib/platform-settings-validation";

const SHARED_RULE_FIELDS = [
  "platformName",
  "supportEmail",
  "defaultLanguage",
  "timezone",
  "maxUploadSizeMb",
  "allowStudentRegistration",
  "enableCourseReviews",
  "maintenanceMode",
  "certificateNumberPrefix",
];

export async function GET() {
  const userId = await requireAdminApi();
  if (userId instanceof NextResponse) return userId;

  try {
    const settings = await getPlatformSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to load platform settings:", error);
    return NextResponse.json(
      { error: "Unable to load settings." },
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
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const prisma = getPrisma();

  const allowedFields = [
    "platformName",
    "supportEmail",
    "defaultLanguage",
    "timezone",
    "maxUploadSizeMb",
    "allowStudentRegistration",
    "enableCourseReviews",
    "autoApproveSubmittedCourses",
    "maintenanceMode",
    "premiumTier1Amount",
    "premiumTier2Amount",
    "defaultAssessmentPassScore",
    "maxGroupSize",
    "certificateNumberPrefix",
  ] as const;

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) data[field] = body[field];
  }

  // Fields with shared rules (lib/platform-settings-validation) are checked
  // the same way as on the other settings pages and in the MCP server.
  const checked = parsePlatformSettingsPatch(
    Object.fromEntries(
      SHARED_RULE_FIELDS.filter((field) => field in data).map((field) => [field, data[field]]),
    ),
  );
  if (checked.errors.length) {
    return NextResponse.json({ error: checked.errors.join(" ") }, { status: 400 });
  }
  Object.assign(data, checked.data);

  try {
    await getPlatformSettings(); // ensures the singleton row exists first
    const updated = await prisma.platformSettings.update({
      where: { id: "singleton" },
      data: { ...data, updatedById: userId },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update platform settings:", error);
    return NextResponse.json(
      { error: "Unable to save settings." },
      { status: 500 },
    );
  }
}

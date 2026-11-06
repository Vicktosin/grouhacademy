import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";

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

  const value = body as Record<string, unknown>;
  const text = (key: string, maxLength: number) => {
    const field = value[key];
    return typeof field === "string" &&
      field.trim() &&
      field.trim().length <= maxLength
      ? field.trim()
      : undefined;
  };
  const boolean = (key: string) =>
    typeof value[key] === "boolean" ? value[key] : undefined;

  const academyName = text("academyName", 120);
  const supportEmail = text("supportEmail", 254);
  const platformUrl =
    typeof value.platformUrl === "string"
      ? value.platformUrl.trim()
      : undefined;
  const defaultLanguage = text("defaultLanguage", 60);
  const timezone = text("timezone", 100);
  const maxUploadSizeMb =
    typeof value.maxUploadSizeMb === "number" &&
    Number.isInteger(value.maxUploadSizeMb) &&
    value.maxUploadSizeMb >= 1 &&
    value.maxUploadSizeMb <= 25
      ? value.maxUploadSizeMb
      : undefined;
  const certificateIssuerName = text("certificateIssuerName", 120);
  const certificatePrefix = text("certificatePrefix", 24)?.toUpperCase();
  const certificateMinimumCompletion =
    typeof value.certificateMinimumCompletion === "number" &&
    Number.isInteger(value.certificateMinimumCompletion) &&
    value.certificateMinimumCompletion >= 1 &&
    value.certificateMinimumCompletion <= 100
      ? value.certificateMinimumCompletion
      : undefined;
  const selfPacedCertificatePassMark =
    typeof value.selfPacedCertificatePassMark === "number" &&
    Number.isInteger(value.selfPacedCertificatePassMark) &&
    value.selfPacedCertificatePassMark >= 1 &&
    value.selfPacedCertificatePassMark <= 100
      ? value.selfPacedCertificatePassMark
      : undefined;
  const poolGroupSize =
    typeof value.poolGroupSize === "number" &&
    Number.isInteger(value.poolGroupSize) &&
    value.poolGroupSize >= 2 &&
    value.poolGroupSize <= 50
      ? value.poolGroupSize
      : undefined;

  if (supportEmail && !/^\S+@\S+\.\S+$/.test(supportEmail)) {
    return NextResponse.json(
      { error: "Enter a valid support email address." },
      { status: 400 },
    );
  }
  if (platformUrl) {
    try {
      const url = new URL(platformUrl);
      if (!["http:", "https:"].includes(url.protocol))
        throw new Error("Unsupported protocol");
    } catch {
      return NextResponse.json(
        { error: "Enter a valid http(s) platform URL." },
        { status: 400 },
      );
    }
  }

  try {
    const settings = await getPrisma().platformSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID },
      update: {
        updatedById: userId,
        ...(academyName !== undefined && { academyName }),
        ...(supportEmail !== undefined && { supportEmail }),
        ...(platformUrl !== undefined && { platformUrl: platformUrl || null }),
        ...(defaultLanguage !== undefined && { defaultLanguage }),
        ...(timezone !== undefined && { timezone }),
        ...(maxUploadSizeMb !== undefined && { maxUploadSizeMb }),
        ...(boolean("courseEnrollmentEnabled") !== undefined && {
          courseEnrollmentEnabled: boolean("courseEnrollmentEnabled"),
        }),
        ...(boolean("allowStudentRegistration") !== undefined && {
          allowStudentRegistration: boolean("allowStudentRegistration"),
        }),
        ...(boolean("enableCourseReviews") !== undefined && {
          enableCourseReviews: boolean("enableCourseReviews"),
        }),
        ...(boolean("autoApproveCourses") !== undefined && {
          autoApproveCourses: boolean("autoApproveCourses"),
        }),
        ...(boolean("internshipApplicationsEnabled") !== undefined && {
          internshipApplicationsEnabled: boolean(
            "internshipApplicationsEnabled",
          ),
        }),
        ...(boolean("maintenanceMode") !== undefined && {
          maintenanceMode: boolean("maintenanceMode"),
        }),
        ...(certificateIssuerName !== undefined && { certificateIssuerName }),
        ...(certificatePrefix !== undefined && { certificatePrefix }),
        ...(certificateMinimumCompletion !== undefined && {
          certificateMinimumCompletion,
        }),
        ...(boolean("automaticCertificateIssue") !== undefined && {
          automaticCertificateIssue: boolean("automaticCertificateIssue"),
        }),
        ...(boolean("notifyAdminOnRegistration") !== undefined && {
          notifyAdminOnRegistration: boolean("notifyAdminOnRegistration"),
        }),
        ...(boolean("notifyAdminOnPayment") !== undefined && {
          notifyAdminOnPayment: boolean("notifyAdminOnPayment"),
        }),
        ...(boolean("notifyStudentOnEnrollment") !== undefined && {
          notifyStudentOnEnrollment: boolean("notifyStudentOnEnrollment"),
        }),
        ...(boolean("notifyStudentOnCertificate") !== undefined && {
          notifyStudentOnCertificate: boolean("notifyStudentOnCertificate"),
        }),
        ...(boolean("cohortSystemEnabled") !== undefined && {
          cohortSystemEnabled: boolean("cohortSystemEnabled"),
        }),
        ...(selfPacedCertificatePassMark !== undefined && {
          selfPacedCertificatePassMark,
        }),
        ...(poolGroupSize !== undefined && { poolGroupSize }),
      },
    });

    // When the cohort system is switched OFF, bulk-activate any paid intern
    // who is waiting for a cohort. Fetch the previous value BEFORE the update
    // so we can detect a true → false transition.
    if (boolean("cohortSystemEnabled") === false) {
      // previousWasEnabled was captured above before the upsert ran.
      const stranded = await getPrisma().internshipApplication.findMany({
        where: {
          cohortId: null,
          selfPacedStartDate: null,
          status: { not: "REMOVED" },
          payment: { is: { status: "PAID" } },
          program: { excludeFromSelfPacedAndPools: false },
        },
        select: { id: true },
      });
      if (stranded.length > 0) {
        await getPrisma().internshipApplication.updateMany({
          where: { id: { in: stranded.map((a) => a.id) } },
          data: { selfPacedStartDate: new Date() },
        });
        console.info(
          `[cohort-switch] Activated self-paced for ${stranded.length} stranded intern(s).`,
        );
      }
    }

    return NextResponse.json(serialize(settings));
  } catch (error) {
    console.error("Failed to save platform settings:", error);
    return NextResponse.json(
      { error: "Unable to save platform settings." },
      { status: 500 },
    );
  }
}

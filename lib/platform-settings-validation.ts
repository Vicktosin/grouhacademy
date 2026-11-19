// Validation for platform settings, shared by the admin settings pages
// (app/api/admin/student/settings, app/api/admin/settings/general) and the
// MCP update_platform_settings tool, so every route applies the same rules.

export type PlatformSettingsPatch = Partial<{
  academyName: string;
  platformName: string;
  supportEmail: string;
  platformUrl: string | null;
  defaultLanguage: string;
  timezone: string;
  maxUploadSizeMb: number;
  courseEnrollmentEnabled: boolean;
  allowStudentRegistration: boolean;
  enableCourseReviews: boolean;
  autoApproveCourses: boolean;
  internshipApplicationsEnabled: boolean;
  maintenanceMode: boolean;
  certificateIssuerName: string;
  certificatePrefix: string;
  certificateNumberPrefix: string;
  certificateLogoUrl: string | null;
  certificateMinimumCompletion: number;
  automaticCertificateIssue: boolean;
  cohortSystemEnabled: boolean;
  learningModePolicy: "CHOOSE" | "COHORT_ONLY" | "SELF_PACED_ONLY";
  selfPacedCertificatePassMark: number;
  poolGroupSize: number;
  testimonialDriveUrl: string | null;
  notifyAdminOnRegistration: boolean;
  notifyAdminOnPayment: boolean;
  notifyStudentOnEnrollment: boolean;
  notifyStudentOnCertificate: boolean;
}>;

/** Letters, digits and hyphens, e.g. "SABIROLE" or "SR-INT". */
const PREFIX = /^[A-Z0-9][A-Z0-9-]{0,23}$/;

const TEXT_FIELDS = {
  academyName: 120,
  platformName: 120,
  supportEmail: 254,
  defaultLanguage: 60,
  timezone: 100,
  certificateIssuerName: 120,
} as const;

const BOOLEAN_FIELDS = [
  "courseEnrollmentEnabled",
  "allowStudentRegistration",
  "enableCourseReviews",
  "autoApproveCourses",
  "internshipApplicationsEnabled",
  "maintenanceMode",
  "automaticCertificateIssue",
  "cohortSystemEnabled",
  "notifyAdminOnRegistration",
  "notifyAdminOnPayment",
  "notifyStudentOnEnrollment",
  "notifyStudentOnCertificate",
] as const;

const INTEGER_FIELDS = {
  maxUploadSizeMb: [1, 25],
  certificateMinimumCompletion: [1, 100],
  selfPacedCertificatePassMark: [1, 100],
  poolGroupSize: [2, 50],
} as const;

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** A Google Drive folder or file link (drive.google.com). */
export function isGoogleDriveUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "drive.google.com";
  } catch {
    return false;
  }
}

/**
 * Reads the settings present in `body`. Fields with a value that breaks the
 * rules are listed in `errors` and left out of `data`; absent fields are
 * left unchanged.
 */
export function parsePlatformSettingsPatch(body: Record<string, unknown>): {
  data: PlatformSettingsPatch;
  errors: string[];
} {
  const data: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const [key, max] of Object.entries(TEXT_FIELDS)) {
    if (body[key] === undefined) continue;
    const value = typeof body[key] === "string" ? (body[key] as string).trim() : "";
    if (!value || value.length > max) errors.push(`${key} must be 1–${max} characters.`);
    else data[key] = value;
  }
  if (typeof data.supportEmail === "string" && !/^\S+@\S+\.\S+$/.test(data.supportEmail)) {
    delete data.supportEmail;
    errors.push("supportEmail must be a valid email address.");
  }

  for (const key of ["certificatePrefix", "certificateNumberPrefix"] as const) {
    if (body[key] === undefined) continue;
    const value = typeof body[key] === "string" ? (body[key] as string).trim().toUpperCase() : "";
    if (!PREFIX.test(value)) errors.push(`${key} must be 1–24 letters, digits or hyphens (e.g. "SABIROLE").`);
    else data[key] = value;
  }

  for (const key of BOOLEAN_FIELDS) {
    if (body[key] === undefined) continue;
    if (typeof body[key] === "boolean") data[key] = body[key];
    else errors.push(`${key} must be true or false.`);
  }

  for (const [key, [min, max]] of Object.entries(INTEGER_FIELDS)) {
    if (body[key] === undefined) continue;
    const value = body[key];
    if (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max) data[key] = value;
    else errors.push(`${key} must be a whole number from ${min} to ${max}.`);
  }

  if (body.learningModePolicy !== undefined) {
    const value = body.learningModePolicy;
    if (value === "CHOOSE" || value === "COHORT_ONLY" || value === "SELF_PACED_ONLY") data.learningModePolicy = value;
    else errors.push("learningModePolicy must be CHOOSE, COHORT_ONLY or SELF_PACED_ONLY.");
  }

  // Optional links: empty string or null clears them.
  if (body.platformUrl !== undefined) {
    const value = typeof body.platformUrl === "string" ? body.platformUrl.trim() : body.platformUrl;
    if (value === null || value === "") data.platformUrl = null;
    else if (typeof value === "string" && isHttpUrl(value)) data.platformUrl = value;
    else errors.push("platformUrl must be a valid http(s) URL.");
  }
  if (body.certificateLogoUrl !== undefined) {
    const value = typeof body.certificateLogoUrl === "string" ? body.certificateLogoUrl.trim() : body.certificateLogoUrl;
    if (value === null || value === "") data.certificateLogoUrl = null;
    else if (
      typeof value === "string" &&
      value.length <= 2000 &&
      (isHttpUrl(value) || /^\/[\w./-]+\.(png|jpe?g|svg|webp)$/i.test(value))
    )
      data.certificateLogoUrl = value;
    else errors.push("certificateLogoUrl must be an http(s) image URL or a /public path like /sabirole-logo.png.");
  }
  if (body.testimonialDriveUrl !== undefined) {
    const value = typeof body.testimonialDriveUrl === "string" ? body.testimonialDriveUrl.trim() : body.testimonialDriveUrl;
    if (value === null || value === "") data.testimonialDriveUrl = null;
    else if (typeof value === "string" && value.length <= 2000 && isGoogleDriveUrl(value)) data.testimonialDriveUrl = value;
    else errors.push("testimonialDriveUrl must be a https://drive.google.com/… link.");
  }

  return { data: data as PlatformSettingsPatch, errors };
}

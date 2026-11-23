/**
 * SabiRole — Admin MCP Server
 * Director-level control over the SabiRole LMS: students, interns, courses,
 * cohorts, payments, follow-ups, announcements, and platform settings.
 * This is the ACADEMY product, NOT the internal management app.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { parseScenarioInput } from "../lib/lab-admin";
import { scheduleToDate, isValidSchedulePoint, type SchedulePoint } from "../lib/task-schedule";
import { DEFAULT_LAB_PASS_MARK, parseLabPassMark } from "../lib/lab-task-grading";
import { recomputeCohortProgress } from "../lib/internship-progress";
import {
  parseResourceInput,
  moduleCreateData,
  reviewFieldsFor,
  uniqueResourceSlug,
  unknownTrackIds,
} from "../lib/intern-resources";
import { resolveLevelId } from "../lib/internship-levels";
import { storeImage } from "../lib/stored-images";
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  listAnnouncementsForAdmin,
} from "../lib/announcements";
import { parsePlatformSettingsPatch } from "../lib/platform-settings-validation";
import { applyPlatformSettingsPatch } from "../lib/platform-settings-update";
import { copyCohortTasksToLibrary } from "../lib/task-library-copy";
import { learningStatusLabel } from "../lib/learning-mode-rules";
import { internshipCertificateNumber, internshipCertificatePrefix } from "../lib/certificate-branding";
import { notifyCertificateIssued } from "../lib/internship-certificate-notify";
import {
  issueCohortCertificates,
  loadCohortRoster,
  prismaCohortCertificateStore,
} from "../lib/cohort-certificates";
import {
  listTestimonials,
  listTestimonialDriveLinks,
  reviewTestimonial,
  setTestimonialDriveUrl,
} from "../lib/testimonials";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

// One small pool per MCP process (Claude Desktop starts more than one), shared
// with the lib/* helpers via the same global getPrisma() uses, so each process
// holds at most 3 pooler connections instead of two default pools of 10.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  max: 3,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 30_000,
});
const db = new PrismaClient({ adapter });
globalThis.__grouhPrismaClient = db;

const server = new McpServer({ name: "bacatib", version: "1.0.0" });

// ── DASHBOARD SUMMARY ──────────────────────────────────────────────────────────
server.tool("get_academy_summary", "Overall snapshot of the SabiRole platform", {}, async () => {
  const [
    totalUsers, activeInterns, pendingApplications, paidPayments, pendingPayments,
    publishedCourses, activeCohorts, pendingCourses,
  ] = await Promise.all([
    db.user.count({ where: { isPreview: false } }),
    db.internshipApplication.count({ where: { status: "ACTIVE" } }),
    db.internshipApplication.count({ where: { status: "ACTIVE", payment: { status: "PENDING" } } }),
    db.internshipPayment.count({ where: { status: "PAID" } }),
    db.internshipPayment.count({ where: { status: "PENDING" } }),
    db.course.count({ where: { status: "PUBLISHED" } }),
    db.internshipCohort.count({ where: { status: "ACTIVE" } }),
    db.course.count({ where: { status: "PENDING_REVIEW" } }),
  ]);
  const recentPayments = await db.internshipPayment.findMany({
    where: { status: "PAID" },
    orderBy: { paidAt: "desc" },
    take: 5,
    include: { application: { include: { student: true, program: true, level: true } } },
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        totalUsers, activeInterns, pendingApplications,
        payments: { paid: paidPayments, pending: pendingPayments },
        publishedCourses, activeCohorts, pendingCourseReviews: pendingCourses,
        recentPaidPayments: recentPayments.map(p => ({
          amount: p.amount,
          paidAt: p.paidAt,
          student: p.application.student.name,
          program: p.application.program.name,
          level: p.application.level.name,
        })),
      }, null, 2),
    }],
  };
});

// ── USERS ──────────────────────────────────────────────────────────────────────
server.tool("list_users", "List users filtered by role or status", {
  role: z.enum(["STUDENT","INTERN","INSTRUCTOR","MENTOR","ADMIN","SUPPORT_ADMIN"]).optional(),
  status: z.enum(["ACTIVE","SUSPENDED","PENDING","DEACTIVATED"]).optional(),
  search: z.string().optional(),
  limit: z.number().default(20),
}, async ({ role, status, search, limit }) => {
  const users = await db.user.findMany({
    where: {
      isPreview: false,
      ...(status && { status: status as any }),
      ...(role && { roles: { some: { role: { name: role as any } } } }),
      ...(search && { OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ]}),
    },
    include: {
      roles: { include: { role: true } },
      profile: { select: { firstName: true, lastName: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(users.map(u => ({
        id: u.id, email: u.email, name: u.name,
        status: u.status,
        roles: u.roles.map(r => r.role.name),
        phone: u.profile?.phone,
        createdAt: u.createdAt,
      })), null, 2),
    }],
  };
});

server.tool("get_user", "Full profile for a single user by email or id", {
  identifier: z.string().describe("User email address or UUID"),
}, async ({ identifier }) => {
  const user = await db.user.findFirst({
    where: { OR: [{ email: identifier }, { id: identifier }], isPreview: false },
    include: {
      roles: { include: { role: true } },
      profile: true,
      internshipApplications: {
        include: { program: true, level: true, cohort: true, payment: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      enrollments: { include: { course: true }, take: 5 },
    },
  });
  if (!user) return { content: [{ type: "text", text: "User not found." }] };
  return { content: [{ type: "text", text: JSON.stringify(user, null, 2) }] };
});

server.tool("suspend_user", "Suspend a user account", {
  userId: z.string(),
  reason: z.string().optional(),
}, async ({ userId }) => {
  await db.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });
  return { content: [{ type: "text", text: `User ${userId} suspended.` }] };
});

server.tool("activate_user", "Reactivate a suspended user account", {
  userId: z.string(),
}, async ({ userId }) => {
  await db.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
  return { content: [{ type: "text", text: `User ${userId} activated.` }] };
});

// ── INTERNSHIP APPLICATIONS ────────────────────────────────────────────────────
server.tool("list_applications", "List internship applications. Each shows how the intern learns this level (learning: Self-paced, Cohort, Waiting for a cohort, or Choosing = paid but not chosen yet); filter with learning.", {
  status: z.enum(["ACTIVE","ON_HOLD","REMOVED"]).optional(),
  paymentStatus: z.enum(["PENDING","PAID","FAILED","CANCELLED"]).optional(),
  levelName: z.string().optional(),
  learning: z.enum(["SELF_PACED","COHORT","WAITING","CHOOSING"]).optional(),
  limit: z.number().default(25),
}, async ({ status, paymentStatus, levelName, learning, limit }) => {
  const learningWhere =
    learning === "COHORT" ? { cohortId: { not: null } }
    : learning === "WAITING" ? { cohortId: null, learningMode: "COHORT" as const }
    : learning === "SELF_PACED" ? { cohortId: null, OR: [{ learningMode: "SELF_PACED" as const }, { learningMode: null, selfPacedStartDate: { not: null } }] }
    : learning === "CHOOSING" ? { cohortId: null, learningMode: null, selfPacedStartDate: null }
    : {};
  const apps = await db.internshipApplication.findMany({
    where: {
      ...learningWhere,
      ...(status && { status: status as any }),
      ...(paymentStatus && { payment: { status: paymentStatus as any } }),
      ...(levelName && { level: { name: { contains: levelName, mode: "insensitive" } } }),
    },
    include: {
      student: { select: { name: true, email: true } },
      program: { select: { name: true } },
      level: { select: { name: true } },
      cohort: { select: { name: true } },
      payment: { select: { status: true, amount: true, paidAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(apps.map(a => ({
        id: a.id,
        student: a.student.name ?? a.student.email,
        email: a.student.email,
        program: a.program.name,
        level: a.level.name,
        cohort: a.cohort?.name ?? "unassigned",
        learning: learningStatusLabel(a),
        status: a.status,
        payment: a.payment ? { status: a.payment.status, amount: a.payment.amount, paidAt: a.payment.paidAt } : null,
        createdAt: a.createdAt,
      })), null, 2),
    }],
  };
});

server.tool("update_application_status", "Change an application status (ON_HOLD / REMOVED / ACTIVE)", {
  applicationId: z.string(),
  status: z.enum(["ACTIVE","ON_HOLD","REMOVED"]),
}, async ({ applicationId, status }) => {
  await db.internshipApplication.update({ where: { id: applicationId }, data: { status: status as any } });
  return { content: [{ type: "text", text: `Application ${applicationId} set to ${status}.` }] };
});

server.tool("update_payment_status", "Mark an internship payment as PAID, FAILED, or CANCELLED", {
  applicationId: z.string().describe("The internship application ID whose payment to update"),
  status: z.enum(["PAID","PENDING","FAILED","CANCELLED"]),
  paidAt: z.string().optional().describe("ISO date string for when it was paid"),
}, async ({ applicationId, status, paidAt }) => {
  const payment = await db.internshipPayment.findUnique({ where: { applicationId } });
  if (!payment) return { content: [{ type: "text", text: "No payment record found for this application." }] };
  await db.internshipPayment.update({
    where: { applicationId },
    data: {
      status: status as any,
      ...(status === "PAID" && { paidAt: paidAt ? new Date(paidAt) : new Date() }),
    },
  });
  return { content: [{ type: "text", text: `Payment for application ${applicationId} updated to ${status}.` }] };
});

// ── FOLLOW-UPS ─────────────────────────────────────────────────────────────────
server.tool("list_follow_ups", "List applicants needing follow-up (unpaid or failed exam)", {
  status: z.enum(["NOT_CONTACTED","CONTACTED","NO_ANSWER","INTERESTED","NOT_INTERESTED"]).optional(),
  limit: z.number().default(20),
}, async ({ status, limit }) => {
  const followUps = await db.internshipFollowUp.findMany({
    where: { ...(status && { status: status as any }) },
    include: {
      application: {
        include: {
          student: { select: { name: true, email: true } },
          program: { select: { name: true } },
          level: { select: { name: true } },
          payment: { select: { status: true, amount: true } },
          attempts: { select: { status: true, scorePercent: true }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { nextFollowUpAt: "asc" },
    take: limit,
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(followUps.map(f => ({
        applicationId: f.applicationId,
        student: f.application.student.name ?? f.application.student.email,
        email: f.application.student.email,
        program: f.application.program.name,
        level: f.application.level.name,
        paymentStatus: f.application.payment?.status,
        lastExamScore: f.application.attempts[0]?.scorePercent,
        followUpStatus: f.status,
        contactCount: f.contactCount,
        nextFollowUpAt: f.nextFollowUpAt,
        note: f.note,
      })), null, 2),
    }],
  };
});

server.tool("update_follow_up", "Update follow-up status after contacting an applicant", {
  applicationId: z.string(),
  status: z.enum(["NOT_CONTACTED","CONTACTED","NO_ANSWER","INTERESTED","NOT_INTERESTED"]),
  note: z.string().optional(),
  nextFollowUpAt: z.string().optional().describe("ISO date string for next contact"),
}, async ({ applicationId, status, note, nextFollowUpAt }) => {
  await db.internshipFollowUp.update({
    where: { applicationId },
    data: {
      status: status as any,
      ...(note && { note }),
      ...(nextFollowUpAt && { nextFollowUpAt: new Date(nextFollowUpAt) }),
      contactCount: { increment: 1 },
      lastContactedAt: new Date(),
    },
  });
  return { content: [{ type: "text", text: `Follow-up for ${applicationId} updated to ${status}.` }] };
});

// ── COHORTS ────────────────────────────────────────────────────────────────────
server.tool("list_cohorts", "List internship cohorts", {
  status: z.enum(["UPCOMING","ACTIVE","COMPLETED"]).optional(),
}, async ({ status }) => {
  const cohorts = await db.internshipCohort.findMany({
    where: { ...(status && { status: status as any }) },
    include: {
      program: { select: { name: true } },
      level: { select: { name: true } },
      _count: { select: { applications: true, tasks: true } },
    },
    orderBy: { startDate: "desc" },
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(cohorts.map(c => ({
        id: c.id, name: c.name, slug: c.slug,
        program: c.program.name, level: c.level.name,
        status: c.status, startDate: c.startDate, endDate: c.endDate,
        internCount: c._count.applications, taskCount: c._count.tasks,
      })), null, 2),
    }],
  };
});

// ── COURSES ────────────────────────────────────────────────────────────────────
server.tool("list_cohort_members", "List every intern placed in a cohort: userId, name, email, applicationId, group, number of submissions, status, whether they paid, and their certificate for this cohort (if any). Admins' preview interns are left out.", {
  cohortId: z.string(),
}, async ({ cohortId }) => {
  const cohort = await db.internshipCohort.findUnique({
    where: { id: cohortId },
    select: { id: true, name: true, program: { select: { name: true } } },
  });
  if (!cohort) return { content: [{ type: "text", text: "Cohort not found." }] };
  const members = await loadCohortRoster(db, cohortId);
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        cohort: { id: cohort.id, name: cohort.name, track: cohort.program.name },
        memberCount: members.length,
        members: members.map((m) => ({
          userId: m.userId, name: m.name, email: m.email, applicationId: m.applicationId,
          group: m.group, submissions: m.submissionCount,
          status: m.status, paid: m.paid,
          certificate: m.existingCertificate
            ? { number: m.existingCertificate.certificateNumber, revoked: m.existingCertificate.revoked }
            : null,
        })),
      }, null, 2),
    }],
  };
});

server.tool("list_courses", "List courses with enrollment counts", {
  status: z.enum(["DRAFT","PENDING_REVIEW","PUBLISHED","REJECTED","ARCHIVED"]).optional(),
  limit: z.number().default(20),
}, async ({ status, limit }) => {
  const courses = await db.course.findMany({
    where: { ...(status && { status: status as any }) },
    include: {
      creator: { select: { name: true, email: true } },
      _count: { select: { enrollments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(courses.map(c => ({
        id: c.id, title: c.title, slug: c.slug,
        status: c.status, price: c.price,
        creator: c.creator.name ?? c.creator.email,
        enrollments: c._count.enrollments,
        createdAt: c.createdAt,
      })), null, 2),
    }],
  };
});

server.tool("update_course_status", "Approve, reject, publish, or archive a course", {
  courseId: z.string(),
  status: z.enum(["PUBLISHED","REJECTED","ARCHIVED","DRAFT"]),
}, async ({ courseId, status }) => {
  await db.course.update({ where: { id: courseId }, data: { status: status as any } });
  return { content: [{ type: "text", text: `Course ${courseId} set to ${status}.` }] };
});

// ── PAYMENTS & FINANCE ─────────────────────────────────────────────────────────
server.tool("list_payments", "List internship payments", {
  status: z.enum(["PENDING","PAID","FAILED","CANCELLED"]).optional(),
  limit: z.number().default(25),
}, async ({ status, limit }) => {
  const payments = await db.internshipPayment.findMany({
    where: { ...(status && { status: status as any }) },
    include: {
      application: {
        include: {
          student: { select: { name: true, email: true } },
          program: { select: { name: true } },
          level: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(payments.map(p => ({
        id: p.id, reference: p.reference,
        student: p.application.student.name ?? p.application.student.email,
        email: p.application.student.email,
        program: p.application.program.name,
        level: p.application.level.name,
        amount: p.amount, currency: p.currency,
        status: p.status, paidAt: p.paidAt,
      })), null, 2),
    }],
  };
});

server.tool("list_finance_entries", "List finance entries (income, expenses, ad spend)", {
  type: z.enum(["AD_SPEND","STAFF_PAYMENT","BUSINESS_SAVINGS","CAPITAL_INVESTMENT","UNPLANNED_EXPENSE","SUBSCRIPTION","OTHER"]).optional(),
  limit: z.number().default(25),
}, async ({ type, limit }) => {
  const entries = await db.financeEntry.findMany({
    where: { ...(type && { type: type as any }) },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(entries, null, 2),
    }],
  };
});

server.tool("add_finance_entry", "Log a new finance entry (expense, ad spend, etc.)", {
  type: z.enum(["AD_SPEND","STAFF_PAYMENT","BUSINESS_SAVINGS","CAPITAL_INVESTMENT","UNPLANNED_EXPENSE","SUBSCRIPTION","OTHER"]),
  description: z.string(),
  amount: z.number().describe("Amount in NGN (kobo? or naira — match the existing entries)"),
  source: z.string().optional(),
  campaignName: z.string().optional(),
  occurredAt: z.string().optional().describe("ISO date string, defaults to now"),
}, async ({ type, description, amount, source, campaignName, occurredAt }) => {
  const admin = await db.user.findFirst({
    where: { roles: { some: { role: { name: "ADMIN" } } }, status: "ACTIVE" },
  });
  if (!admin) return { content: [{ type: "text", text: "No active admin found to attribute entry to." }] };
  const entry = await db.financeEntry.create({
    data: {
      type: type as any,
      description, amount,
      ...(source && { source }),
      ...(campaignName && { campaignName }),
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      createdById: admin.id,
    },
  });
  return { content: [{ type: "text", text: `Finance entry created: ${entry.id}` }] };
});

// ── NOTIFICATIONS & ANNOUNCEMENTS ──────────────────────────────────────────────
server.tool("send_notification", "Send a notification to a specific user", {
  userId: z.string().describe("User UUID"),
  title: z.string(),
  message: z.string(),
  type: z.enum(["INFO","SUCCESS","WARNING","ERROR"]).default("INFO"),
  audience: z.enum(["COURSES","INTERNSHIP"]).optional(),
}, async ({ userId, title, message, type, audience }) => {
  await db.notification.create({
    data: { userId, title, message, type: type as any, ...(audience && { audience: audience as any }) },
  });
  return { content: [{ type: "text", text: `Notification sent to user ${userId}.` }] };
});

// Announcements use the same rules as the admin Notifications page
// (lib/announcements, lib/announcement-targeting).
async function mcpAnnouncementAuthorId() {
  const admin = await db.user.findFirst({
    where: { roles: { some: { role: { name: "ADMIN" } } }, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return admin?.id ?? null;
}

const announcementTargetFields = {
  audience: z.enum(["INTERNSHIP","COURSES"]).nullable().optional().describe("INTERNSHIP, COURSES, or null/omit for both. Cohort-targeted and pop-up announcements are always INTERNSHIP."),
  programId: z.string().nullable().optional().describe("Only interns on this track (program id from list_programs). Null/omit: any track."),
  cohortIds: z.array(z.string()).optional().describe("Only interns in one of these cohorts (ids from list_cohorts). Empty/omit: no cohort limit."),
  showAsPopup: z.boolean().optional().describe("Show it once to each targeted intern as a pop-up with a 'Got it' button, the next time they open the app."),
};

server.tool("create_announcement", "Post an announcement to all interns, all students, one track, or one or more cohorts (same validation as the admin Notifications page). Optionally show it as a one-time pop-up.", {
  title: z.string().describe("Up to 160 characters"),
  message: z.string().describe("Up to 2000 characters"),
  ...announcementTargetFields,
}, async ({ title, message, audience, programId, cohortIds, showAsPopup }) => {
  const authorId = await mcpAnnouncementAuthorId();
  if (!authorId) return { content: [{ type: "text", text: "No active admin found to post as." }] };
  const result = await createAnnouncement(authorId, {
    title, message,
    audience: audience ?? null,
    programId: programId ?? null,
    cohortIds: cohortIds ?? [],
    showAsPopup: showAsPopup ?? false,
  }, db);
  if (!result.ok) return { content: [{ type: "text", text: `Error: ${result.error}` }] };
  return { content: [{ type: "text", text: `Announcement created: ${result.value.id}` }] };
});

server.tool("list_announcements", "List recent announcements with their ids, targets (track / cohorts), pop-up flag and how many interns pressed 'Got it'", {
  limit: z.number().int().min(1).max(200).default(20),
}, async ({ limit }) => {
  const announcements = await listAnnouncementsForAdmin(limit, db);
  return { content: [{ type: "text", text: JSON.stringify(announcements, null, 2) }] };
});

server.tool("update_announcement", "Edit an announcement. Only the fields you pass change; the result is re-validated as a whole (same rules as create_announcement).", {
  announcementId: z.string(),
  title: z.string().optional(),
  message: z.string().optional(),
  ...announcementTargetFields,
}, async ({ announcementId, ...fields }) => {
  const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  if (Object.keys(patch).length === 0) return { content: [{ type: "text", text: "Nothing to update." }] };
  const result = await updateAnnouncement(announcementId, patch, db);
  if (!result.ok) return { content: [{ type: "text", text: `Error: ${result.error}` }] };
  return { content: [{ type: "text", text: `Announcement ${announcementId} updated.` }] };
});

server.tool("delete_announcement", "Permanently delete an announcement (interns stop seeing it, including as a pop-up)", {
  announcementId: z.string(),
}, async ({ announcementId }) => {
  const result = await deleteAnnouncement(announcementId, db);
  if (!result.ok) return { content: [{ type: "text", text: `Error: ${result.error}` }] };
  return { content: [{ type: "text", text: `Announcement ${announcementId} deleted.` }] };
});

// ── DASHBOARD BANNERS ──────────────────────────────────────────────────────────
server.tool("list_banners", "List all dashboard banners", {}, async () => {
  const banners = await db.dashboardBanner.findMany({ orderBy: { sortOrder: "asc" } });
  return { content: [{ type: "text", text: JSON.stringify(banners, null, 2) }] };
});

server.tool("add_banner", "Add a new dashboard banner", {
  title: z.string(),
  imageUrl: z.string(),
  buttonLabel: z.string().optional(),
  buttonUrl: z.string().optional(),
  sortOrder: z.number().default(0),
}, async ({ title, imageUrl, buttonLabel, buttonUrl, sortOrder }) => {
  const banner = await db.dashboardBanner.create({
    data: { title, imageUrl, ...(buttonLabel && { buttonLabel }), ...(buttonUrl && { buttonUrl }), sortOrder },
  });
  return { content: [{ type: "text", text: `Banner created: ${banner.id}` }] };
});

server.tool("update_banner", "Update or toggle a dashboard banner", {
  bannerId: z.string(),
  isActive: z.boolean().optional(),
  title: z.string().optional(),
  imageUrl: z.string().optional(),
  buttonLabel: z.string().optional(),
  buttonUrl: z.string().optional(),
  sortOrder: z.number().optional(),
}, async ({ bannerId, ...data }) => {
  await db.dashboardBanner.update({ where: { id: bannerId }, data });
  return { content: [{ type: "text", text: `Banner ${bannerId} updated.` }] };
});

server.tool("delete_banner", "Delete a dashboard banner", {
  bannerId: z.string(),
}, async ({ bannerId }) => {
  await db.dashboardBanner.delete({ where: { id: bannerId } });
  return { content: [{ type: "text", text: `Banner ${bannerId} deleted.` }] };
});

// ── MENTOR ASSIGNMENTS ─────────────────────────────────────────────────────────
server.tool("list_mentor_assignments", "List mentor–intern pairings", {
  mentorEmail: z.string().optional(),
  status: z.enum(["ACTIVE","COMPLETED","ARCHIVED"]).optional(),
  limit: z.number().default(20),
}, async ({ mentorEmail, status, limit }) => {
  const assignments = await db.mentorAssignment.findMany({
    where: {
      ...(status && { status: status as any }),
      ...(mentorEmail && { mentor: { email: mentorEmail } }),
    },
    include: {
      mentor: { select: { name: true, email: true } },
      intern: { select: { name: true, email: true } },
      program: { select: { name: true } },
    },
    take: limit,
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(assignments.map(a => ({
        id: a.id,
        mentor: a.mentor.name ?? a.mentor.email,
        intern: a.intern.name ?? a.intern.email,
        internEmail: a.intern.email,
        program: a.program.name,
        status: a.status,
      })), null, 2),
    }],
  };
});

server.tool("assign_mentor", "Assign a mentor to an intern for a program", {
  mentorId: z.string().describe("Mentor UUID"),
  internId: z.string().describe("Intern UUID"),
  programId: z.string(),
}, async ({ mentorId, internId, programId }) => {
  const assignment = await db.mentorAssignment.upsert({
    where: { mentorId_internId_programId: { mentorId, internId, programId } },
    create: { mentorId, internId, programId, status: "ACTIVE" },
    update: { status: "ACTIVE" },
  });
  return { content: [{ type: "text", text: `Mentor assignment created/updated: ${assignment.id}` }] };
});

// ── AFFILIATE PAYOUTS ──────────────────────────────────────────────────────────
server.tool("list_affiliate_payouts", "List affiliate payout requests", {
  status: z.enum(["PENDING","PAID","REJECTED"]).optional(),
}, async ({ status }) => {
  const payouts = await db.affiliatePayout.findMany({
    where: { ...(status && { status: status as any }) },
    include: { affiliate: { include: { user: { select: { name: true, email: true } } } } },
    orderBy: { requestedAt: "desc" },
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(payouts.map(p => ({
        id: p.id,
        affiliate: p.affiliate.user.name ?? p.affiliate.user.email,
        amount: p.amount, status: p.status,
        bankName: p.bankName, accountNumber: p.accountNumber, accountName: p.accountName,
        requestedAt: p.requestedAt, processedAt: p.processedAt,
      })), null, 2),
    }],
  };
});

server.tool("update_payout_status", "Approve or reject an affiliate payout", {
  payoutId: z.string(),
  status: z.enum(["PAID","REJECTED"]),
  adminNote: z.string().optional(),
}, async ({ payoutId, status, adminNote }) => {
  await db.affiliatePayout.update({
    where: { id: payoutId },
    data: { status: status as any, processedAt: new Date(), ...(adminNote && { adminNote }) },
  });
  return { content: [{ type: "text", text: `Payout ${payoutId} marked as ${status}.` }] };
});

// ── INTERNSHIP PROGRAMS ────────────────────────────────────────────────────────
server.tool("list_programs", "List internship programs (tracks)", {}, async () => {
  const programs = await db.internshipProgram.findMany({
    include: {
      _count: { select: { applications: true, cohorts: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(programs.map(p => ({
        id: p.id, name: p.name, slug: p.slug,
        status: p.status, price: p.price, duration: p.duration,
        applications: p._count.applications, cohorts: p._count.cohorts,
      })), null, 2),
    }],
  };
});

// ── ACHIEVEMENTS ───────────────────────────────────────────────────────────────
server.tool("list_achievements", "List achievement definitions", {
  isActive: z.boolean().optional(),
  limit: z.number().default(20),
}, async ({ isActive, limit }) => {
  const achievements = await db.achievementDefinition.findMany({
    where: { ...(isActive !== undefined && { isActive }) },
    include: { _count: { select: { unlocks: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(achievements.map(a => ({
        id: a.id, title: a.title, trigger: a.trigger,
        rarity: a.rarity, category: a.category,
        isActive: a.isActive, timesUnlocked: a._count.unlocks,
      })), null, 2),
    }],
  };
});

// ── COHORT MANAGEMENT ─────────────────────────────────────────────────────────
server.tool("update_cohort", "Change a cohort's status, dates, or pass mark. Moving the start date automatically recomputes all task open/due times.", {
  cohortId: z.string(),
  status: z.enum(["UPCOMING","ACTIVE","COMPLETED"]).optional(),
  startDate: z.string().optional().describe("ISO date string"),
  endDate: z.string().optional().describe("ISO date string"),
  name: z.string().optional(),
  certificatePassMark: z.number().optional(),
}, async ({ cohortId, status, startDate, endDate, name, certificatePassMark }) => {
  const existing = await db.internshipCohort.findUnique({ where: { id: cohortId } });
  if (!existing) return { content: [{ type: "text", text: `Cohort ${cohortId} not found.` }] };

  const newStart = startDate ? new Date(startDate) : existing.startDate;

  await db.internshipCohort.update({
    where: { id: cohortId },
    data: {
      ...(status && { status: status as any }),
      ...(startDate && { startDate: newStart }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(name && { name }),
      ...(certificatePassMark !== undefined && { certificatePassMark }),
    },
  });

  // Task windows are relative to the start date — move the start date, move the tasks.
  if (startDate && newStart.getTime() !== existing.startDate.getTime()) {
    const tasks = await db.internshipTask.findMany({ where: { cohortId } });
    await db.$transaction(
      tasks.map((task) =>
        db.internshipTask.update({
          where: { id: task.id },
          data: {
            opensAt: scheduleToDate(newStart, { week: task.opensWeek, day: task.opensDay, time: task.opensTime }),
            dueDate: scheduleToDate(newStart, { week: task.dueWeek, day: task.dueDay, time: task.dueTime }),
          },
        }),
      ),
    );
    return { content: [{ type: "text", text: `Cohort ${cohortId} updated. Recomputed dates for ${tasks.length} task(s).` }] };
  }

  return { content: [{ type: "text", text: `Cohort ${cohortId} updated.` }] };
});

server.tool("create_cohort", "Create a new internship cohort", {
  programId: z.string(),
  levelId: z.string(),
  name: z.string(),
  slug: z.string(),
  startDate: z.string().describe("ISO date string"),
  endDate: z.string().describe("ISO date string"),
  status: z.enum(["UPCOMING","ACTIVE","COMPLETED"]).default("UPCOMING"),
}, async ({ programId, levelId, name, slug, startDate, endDate, status }) => {
  const cohort = await db.internshipCohort.create({
    data: { programId, levelId, name, slug, startDate: new Date(startDate), endDate: new Date(endDate), status: status as any },
  });
  return { content: [{ type: "text", text: `Cohort created: ${cohort.id}` }] };
});

server.tool("delete_cohort", "Delete a cohort (only if it has no active interns)", {
  cohortId: z.string(),
}, async ({ cohortId }) => {
  await db.internshipCohort.delete({ where: { id: cohortId } });
  return { content: [{ type: "text", text: `Cohort ${cohortId} deleted.` }] };
});

// ── COHORT TASKS ───────────────────────────────────────────────────────────────
server.tool("list_cohort_tasks", "List tasks for a cohort", {
  cohortId: z.string(),
}, async ({ cohortId }) => {
  const tasks = await db.internshipTask.findMany({
    where: { cohortId },
    include: { module: { select: { title: true } }, _count: { select: { submissions: true } } },
    orderBy: [{ opensWeek: "asc" }, { opensDay: "asc" }],
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(tasks.map(t => ({
        id: t.id, title: t.title, kind: t.kind,
        module: t.module.title,
        opensAt: t.opensAt, dueDate: t.dueDate,
        week: t.opensWeek, day: t.opensDay,
        submissions: t._count.submissions,
      })), null, 2),
    }],
  };
});

server.tool("update_cohort_task", "Update a cohort task's title, description, max score, lab pass mark, or schedule. To move a task to another week, pass opensWeek (and dueWeek if the due point should move too): open/due times are recalculated from the cohort start date (WAT) and the task is filed under that week, as on the admin task page.", {
  taskId: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  maxScore: z.number().int().min(1).max(1000).optional(),
  labPassMark: z.number().int().min(1).max(100).optional().describe("Pass percentage for the linked lab (1–100). Only allowed on tasks linked to a Practice Lab exercise."),
  opensWeek: z.number().int().min(1).max(52).optional().describe("Week the task opens (1 = cohort's first week). Moves the task to that week."),
  opensDay: z.number().int().min(1).max(7).optional().describe("Day it opens (1 = Monday)"),
  opensTime: z.string().optional().describe("HH:MM, 24-hour WAT"),
  dueWeek: z.number().int().min(1).max(52).optional(),
  dueDay: z.number().int().min(1).max(7).optional(),
  dueTime: z.string().optional().describe("HH:MM, 24-hour WAT"),
  dueDate: z.string().optional().describe("Exact ISO due date. Prefer dueWeek/dueDay/dueTime; can't be combined with them."),
  opensAt: z.string().optional().describe("Exact ISO open date. Prefer opensWeek/opensDay/opensTime; can't be combined with them."),
}, async ({ taskId, title, description, dueDate, opensAt, maxScore, labPassMark, opensWeek, opensDay, opensTime, dueWeek, dueDay, dueTime }) => {
  const task = await db.internshipTask.findUnique({
    where: { id: taskId },
    select: {
      labScenarioId: true, cohortId: true,
      opensWeek: true, opensDay: true, opensTime: true,
      dueWeek: true, dueDay: true, dueTime: true,
      cohort: { select: { startDate: true, programId: true } },
    },
  });
  if (!task) return { content: [{ type: "text", text: "Task not found." }] };

  if (title !== undefined && (!title.trim() || title.trim().length > 200))
    return { content: [{ type: "text", text: "Give the task a name (up to 200 characters)." }] };
  if (description !== undefined && description.length > 10_000)
    return { content: [{ type: "text", text: "The task brief is too long." }] };
  if (labPassMark !== undefined) {
    if (!task.labScenarioId)
      return { content: [{ type: "text", text: "labPassMark can only be set on tasks linked to a Practice Lab exercise." }] };
    if (parseLabPassMark(labPassMark) === null)
      return { content: [{ type: "text", text: "Pass mark must be a whole number from 1 to 100." }] };
  }

  const scheduleGiven = [opensWeek, opensDay, opensTime, dueWeek, dueDay, dueTime].some((v) => v !== undefined);
  if (scheduleGiven && (dueDate || opensAt))
    return { content: [{ type: "text", text: "Use either the week/day/time fields or exact ISO dates, not both." }] };

  const data: Record<string, unknown> = {
    ...(title !== undefined && { title: title.trim() }),
    ...(description !== undefined && { description: description || null }),
    ...(maxScore !== undefined && { maxScore }),
    ...(labPassMark !== undefined && { labPassMark }),
    ...(dueDate && { dueDate: new Date(dueDate) }),
    ...(opensAt && { opensAt: new Date(opensAt) }),
  };

  let moved = "";
  if (scheduleGiven) {
    if (!task.cohortId || !task.cohort)
      return { content: [{ type: "text", text: "Only cohort tasks can be rescheduled here (this is a self-paced or pool task)." }] };
    const opens: SchedulePoint = { week: opensWeek ?? task.opensWeek, day: opensDay ?? task.opensDay, time: opensTime ?? task.opensTime };
    const due: SchedulePoint = { week: dueWeek ?? task.dueWeek, day: dueDay ?? task.dueDay, time: dueTime ?? task.dueTime };
    if (!isValidSchedulePoint(opens) || !isValidSchedulePoint(due))
      return { content: [{ type: "text", text: "Set a valid week, day (1–7) and time (HH:MM) for opens and due." }] };
    const newOpensAt = scheduleToDate(task.cohort.startDate, opens);
    const newDueDate = scheduleToDate(task.cohort.startDate, due);
    if (newDueDate <= newOpensAt)
      return { content: [{ type: "text", text: `The due time (week ${due.week}, day ${due.day} ${due.time}) must be after the opening time (week ${opens.week}, day ${opens.day} ${opens.time}). Pass dueWeek too when moving a task to a later week.` }] };
    Object.assign(data, {
      opensWeek: opens.week, opensDay: opens.day, opensTime: opens.time,
      dueWeek: due.week, dueDay: due.day, dueTime: due.time,
      opensAt: newOpensAt, dueDate: newDueDate,
    });
    // File it under the "Week N" module of its new week (as the admin page).
    if (opens.week !== task.opensWeek) {
      const moduleTitle = `Week ${opens.week}`;
      const existingModule = await db.internshipModule.findFirst({
        where: { programId: task.cohort.programId, title: moduleTitle },
        select: { id: true },
      });
      data.moduleId = existingModule
        ? existingModule.id
        : (await db.internshipModule.create({
            data: { programId: task.cohort.programId, title: moduleTitle, order: opens.week },
            select: { id: true },
          })).id;
    }
    moved = ` Now opens ${newOpensAt.toISOString()} (week ${opens.week}) and is due ${newDueDate.toISOString()} (week ${due.week}).`;
  }

  if (Object.keys(data).length === 0) return { content: [{ type: "text", text: "Nothing to update." }] };
  await db.internshipTask.update({ where: { id: taskId }, data });
  if (task.cohortId && (scheduleGiven || dueDate || opensAt)) await recomputeCohortProgress(task.cohortId);
  return { content: [{ type: "text", text: `Task ${taskId} updated.${moved}` }] };
});

server.tool("create_cohort_task", "Create a task for a cohort — same validation as the admin task page. Times are in West Africa Time (WAT). Optionally link a Practice Lab exercise.", {
  cohortId: z.string(),
  title: z.string().describe("Task title (max 200 characters)"),
  description: z.string().default("").describe("Task brief/instructions (max 10000 characters)"),
  kind: z.enum(["INDIVIDUAL","GROUP"]).default("INDIVIDUAL"),
  opensWeek: z.number().int().min(1).max(52).describe("Week number relative to cohort start (1 = first week)"),
  opensDay: z.number().int().min(1).max(7).describe("Day of the week (1 = Monday)"),
  opensTime: z.string().describe("HH:MM in 24-hour WAT, e.g. '09:00'"),
  dueWeek: z.number().int().min(1).max(52),
  dueDay: z.number().int().min(1).max(7),
  dueTime: z.string().describe("HH:MM in 24-hour WAT, e.g. '23:59'"),
  maxScore: z.number().int().min(1).default(100),
  labScenarioId: z.string().optional().describe("Link a Practice Lab exercise (must belong to the cohort's track)"),
  labPassMark: z.number().int().min(1).max(100).optional().describe("Pass percentage for the linked lab (default 70)"),
}, async ({ cohortId, title, description, kind, opensWeek, opensDay, opensTime, dueWeek, dueDay, dueTime, maxScore, labScenarioId, labPassMark }) => {
  const trimmedTitle = title.trim();
  if (!trimmedTitle || trimmedTitle.length > 200)
    return { content: [{ type: "text", text: "Give the task a name (up to 200 characters)." }] };
  if (description.length > 10_000)
    return { content: [{ type: "text", text: "The task brief is too long." }] };

  const opens: SchedulePoint = { week: opensWeek, day: opensDay, time: opensTime };
  const due: SchedulePoint = { week: dueWeek, day: dueDay, time: dueTime };
  if (!isValidSchedulePoint(opens) || !isValidSchedulePoint(due))
    return { content: [{ type: "text", text: "Set a valid week, day (1–7) and time (HH:MM) for opens and due." }] };

  const cohort = await db.internshipCohort.findUnique({
    where: { id: cohortId },
    select: { id: true, programId: true, levelId: true, startDate: true },
  });
  if (!cohort) return { content: [{ type: "text", text: "Cohort not found." }] };

  if (labScenarioId && kind === "GROUP")
    return { content: [{ type: "text", text: "Practice Lab exercises can only be linked to individual tasks." }] };

  if (labScenarioId) {
    const scenario = await db.labScenario.findUnique({
      where: { id: labScenarioId },
      select: { programId: true },
    });
    if (!scenario || scenario.programId !== cohort.programId)
      return { content: [{ type: "text", text: "Choose a Practice Lab exercise from this cohort's track." }] };
  }

  const resolvedPassMark = labScenarioId
    ? parseLabPassMark(labPassMark ?? DEFAULT_LAB_PASS_MARK)
    : DEFAULT_LAB_PASS_MARK;
  if (resolvedPassMark === null)
    return { content: [{ type: "text", text: "Set the pass mark as a whole number from 1 to 100." }] };

  const opensAt = scheduleToDate(cohort.startDate, opens);
  const dueDate = scheduleToDate(cohort.startDate, due);
  if (dueDate <= opensAt)
    return { content: [{ type: "text", text: "The due time must be after the opening time." }] };

  // Find or create the "Week N" module for this cohort's track.
  const moduleTitle = `Week ${opensWeek}`;
  const existingModule = await db.internshipModule.findFirst({
    where: { programId: cohort.programId, title: moduleTitle },
    select: { id: true },
  });
  const moduleId = existingModule
    ? existingModule.id
    : (await db.internshipModule.create({
        data: { programId: cohort.programId, title: moduleTitle, order: opensWeek },
        select: { id: true },
      })).id;

  const task = await db.internshipTask.create({
    data: {
      title: trimmedTitle,
      description: description || null,
      kind: kind as any,
      cohortId,
      moduleId,
      opensWeek, opensDay, opensTime,
      dueWeek, dueDay, dueTime,
      opensAt, dueDate,
      maxScore,
      labScenarioId: labScenarioId ?? null,
      labPassMark: resolvedPassMark,
      officeLifeDay: null,
    },
  });

  await recomputeCohortProgress(cohortId);
  return { content: [{ type: "text", text: `Task created: ${task.id} — "${task.title}" (opens ${opensAt.toISOString()}, due ${dueDate.toISOString()})` }] };
});

// ── TASK SUBMISSIONS & GRADING ─────────────────────────────────────────────────
server.tool("list_submissions", "List task submissions pending review or recently graded", {
  status: z.enum(["SUBMITTED","UNDER_REVIEW","ACCEPTED","REJECTED","DRAFT"]).optional(),
  cohortId: z.string().optional(),
  limit: z.number().default(25),
}, async ({ status, cohortId, limit }) => {
  const submissions = await db.taskSubmission.findMany({
    where: {
      ...(status && { status: status as any }),
      ...(cohortId && { task: { cohortId } }),
    },
    include: {
      task: { select: { title: true, maxScore: true } },
      user: { select: { name: true, email: true } },
    },
    orderBy: { submittedAt: "desc" },
    take: limit,
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(submissions.map(s => ({
        id: s.id,
        task: s.task.title, maxScore: s.task.maxScore,
        intern: s.user.name ?? s.user.email,
        status: s.status, score: s.score,
        submittedAt: s.submittedAt,
        content: s.content?.slice(0, 200),
        fileUrl: s.fileUrl,
      })), null, 2),
    }],
  };
});

server.tool("grade_submission", "Grade or update the grade on a task submission", {
  submissionId: z.string(),
  status: z.enum(["ACCEPTED","REJECTED","UNDER_REVIEW"]),
  score: z.number().optional(),
  feedback: z.string().optional(),
}, async ({ submissionId, status, score, feedback }) => {
  await db.taskSubmission.update({
    where: { id: submissionId },
    data: {
      status: status as any,
      ...(score !== undefined && { score }),
      ...(feedback && { feedback }),
      reviewedAt: new Date(),
    },
  });
  return { content: [{ type: "text", text: `Submission ${submissionId} graded as ${status}.` }] };
});

// ── ASSESSMENT ATTEMPTS ────────────────────────────────────────────────────────
server.tool("list_assessment_attempts", "List entrance exam attempts", {
  status: z.enum(["NOT_STARTED","IN_PROGRESS","OBJECTIVE_SUBMITTED","UNDER_REVIEW","PASSED","FAILED"]).optional(),
  programId: z.string().optional(),
  limit: z.number().default(25),
}, async ({ status, programId, limit }) => {
  const attempts = await db.assessmentAttempt.findMany({
    where: {
      ...(status && { status: status as any }),
      ...(programId && { application: { programId } }),
    },
    include: {
      application: {
        include: {
          student: { select: { name: true, email: true } },
          program: { select: { name: true } },
          level: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(attempts.map(a => ({
        id: a.id,
        student: a.application.student.name ?? a.application.student.email,
        program: a.application.program.name,
        level: a.application.level.name,
        status: a.status, score: a.score,
        scorePercent: a.scorePercent,
        submittedAt: a.submittedAt,
      })), null, 2),
    }],
  };
});

server.tool("update_assessment_attempt", "Manually pass, fail, or mark an assessment attempt under review", {
  attemptId: z.string(),
  status: z.enum(["PASSED","FAILED","UNDER_REVIEW"]),
  score: z.number().optional(),
  scorePercent: z.number().optional(),
}, async ({ attemptId, status, score, scorePercent }) => {
  await db.assessmentAttempt.update({
    where: { id: attemptId },
    data: {
      status: status as any,
      ...(score !== undefined && { score }),
      ...(scorePercent !== undefined && { scorePercent }),
      submittedAt: new Date(),
    },
  });
  return { content: [{ type: "text", text: `Assessment attempt ${attemptId} set to ${status}.` }] };
});

// ── USER ROLES ─────────────────────────────────────────────────────────────────
server.tool("list_levels", "List internship levels (Beginner, Novice, etc.)", {}, async () => {
  const levels = await db.internshipLevel.findMany({ orderBy: { rank: "asc" } });
  return { content: [{ type: "text", text: JSON.stringify(levels, null, 2) }] };
});

server.tool("add_user_role", "Add a role to a user (STUDENT, INTERN, INSTRUCTOR, MENTOR, ADMIN, SUPPORT_ADMIN)", {
  userId: z.string(),
  roleName: z.enum(["STUDENT","INTERN","INSTRUCTOR","MENTOR","ADMIN","SUPPORT_ADMIN"]),
}, async ({ userId, roleName }) => {
  const role = await db.role.findUnique({ where: { name: roleName as any } });
  if (!role) return { content: [{ type: "text", text: `Role ${roleName} not found.` }] };
  await db.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    create: { userId, roleId: role.id },
    update: {},
  });
  return { content: [{ type: "text", text: `Role ${roleName} added to user ${userId}.` }] };
});

server.tool("remove_user_role", "Remove a role from a user", {
  userId: z.string(),
  roleName: z.enum(["STUDENT","INTERN","INSTRUCTOR","MENTOR","ADMIN","SUPPORT_ADMIN"]),
}, async ({ userId, roleName }) => {
  const role = await db.role.findUnique({ where: { name: roleName as any } });
  if (!role) return { content: [{ type: "text", text: `Role ${roleName} not found.` }] };
  await db.userRole.deleteMany({ where: { userId, roleId: role.id } });
  return { content: [{ type: "text", text: `Role ${roleName} removed from user ${userId}.` }] };
});

// ── CERTIFICATES ───────────────────────────────────────────────────────────────
server.tool("issue_internship_certificate", "Manually issue an internship certificate to one intern. The intern can download it straight away and gets the usual notification. Uses the certificate number prefix from platform settings.", {
  userId: z.string().describe("User UUID"),
  programId: z.string(),
  applicationId: z.string().optional().describe("The intern's application (ties the certificate to its cohort and level; recommended)"),
  title: z.string().describe("Certificate title e.g. 'Digital Marketing Internship – Beginner Level'"),
}, async ({ userId, programId, applicationId, title }) => {
  if (applicationId) {
    const existing = await db.internshipCertificate.findFirst({
      where: { applicationId, revokedAt: null },
      select: { certificateNumber: true },
    });
    if (existing)
      return { content: [{ type: "text", text: `This application already has certificate ${existing.certificateNumber}. Not issuing a duplicate.` }] };
  }
  const certNum = internshipCertificateNumber(await internshipCertificatePrefix(db));
  const cert = await db.internshipCertificate.create({
    data: { userId, programId, ...(applicationId && { applicationId }), title, certificateNumber: certNum },
  });
  await notifyCertificateIssued(cert.id);
  return { content: [{ type: "text", text: `Certificate issued: ${cert.certificateNumber} (id: ${cert.id}). The intern was notified.` }] };
});

server.tool("issue_cohort_certificates", "Issue internship certificates to a whole cohort. mode 'submitted_at_least_one': every paid, active intern in the cohort with at least one submission; 'all': every paid, active intern. Interns who already have a certificate for this cohort are skipped, so running it twice creates no duplicates. Each intern can download theirs straight away and gets the usual notification. Returns one row per intern: name, email, certificate number, issued or skipped (with reason).", {
  cohortId: z.string(),
  title: z.string().describe("Certificate title, e.g. 'Digital Marketing Internship Completion Certificate'"),
  mode: z.enum(["submitted_at_least_one", "all"]),
}, async ({ cohortId, title, mode }) => {
  const result = await issueCohortCertificates(
    prismaCohortCertificateStore(db, notifyCertificateIssued),
    { cohortId, title, mode },
  );
  if (!result.ok) return { content: [{ type: "text", text: `Error: ${result.error}` }] };
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

server.tool("revoke_certificate", "Revoke an internship certificate", {
  certificateId: z.string(),
  reason: z.string(),
}, async ({ certificateId, reason }) => {
  await db.internshipCertificate.update({
    where: { id: certificateId },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  return { content: [{ type: "text", text: `Certificate ${certificateId} revoked.` }] };
});

server.tool("list_certificates", "List internship certificates", {
  userId: z.string().optional(),
  programId: z.string().optional(),
  limit: z.number().default(20),
}, async ({ userId, programId, limit }) => {
  const certs = await db.internshipCertificate.findMany({
    where: {
      ...(userId && { userId }),
      ...(programId && { programId }),
    },
    include: {
      user: { select: { name: true, email: true } },
      program: { select: { name: true } },
    },
    orderBy: { issuedAt: "desc" },
    take: limit,
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(certs.map(c => ({
        id: c.id, certificateNumber: c.certificateNumber,
        title: c.title,
        user: c.user.name ?? c.user.email,
        program: c.program.name,
        issuedAt: c.issuedAt,
        revokedAt: c.revokedAt,
      })), null, 2),
    }],
  };
});

// ── INTERN GROUPS ──────────────────────────────────────────────────────────────
server.tool("list_groups", "List intern groups for a program or cohort", {
  programId: z.string().optional(),
  cohortId: z.string().optional(),
}, async ({ programId, cohortId }) => {
  const groups = await db.internshipGroup.findMany({
    where: {
      ...(programId && { programId }),
      ...(cohortId && { cohortId }),
    },
    include: {
      leader: { select: { name: true, email: true } },
      _count: { select: { members: true } },
    },
    orderBy: { number: "asc" },
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(groups.map(g => ({
        id: g.id, number: g.number,
        leader: g.leader?.name ?? g.leader?.email ?? "no leader",
        members: g._count.members, capacity: g.capacity,
        discussionOpen: g.discussionOpen,
      })), null, 2),
    }],
  };
});

server.tool("update_group", "Update a group's capacity, leader, or discussion status", {
  groupId: z.string(),
  leaderId: z.string().optional().describe("User UUID of new leader"),
  capacity: z.number().optional(),
  discussionOpen: z.boolean().optional(),
}, async ({ groupId, leaderId, capacity, discussionOpen }) => {
  await db.internshipGroup.update({
    where: { id: groupId },
    data: {
      ...(leaderId !== undefined && { leaderId }),
      ...(capacity !== undefined && { capacity }),
      ...(discussionOpen !== undefined && { discussionOpen }),
    },
  });
  return { content: [{ type: "text", text: `Group ${groupId} updated.` }] };
});

server.tool("add_intern_to_group", "Add an intern to a group", {
  groupId: z.string(),
  userId: z.string().describe("Intern UUID"),
  programId: z.string(),
}, async ({ groupId, userId, programId }) => {
  const group = await db.internshipGroup.findUnique({ where: { id: groupId } });
  if (!group) return { content: [{ type: "text", text: "Group not found." }] };
  await db.internshipGroupMember.upsert({
    where: { programId_userId: { programId, userId } },
    create: { groupId, programId, userId },
    update: { groupId },
  });
  return { content: [{ type: "text", text: `Intern ${userId} added to group ${groupId}.` }] };
});

// ── ENROLLMENTS ────────────────────────────────────────────────────────────────
server.tool("list_enrollments", "List course enrollments", {
  courseId: z.string().optional(),
  status: z.enum(["PENDING","ACTIVE","COMPLETED","CANCELLED"]).optional(),
  limit: z.number().default(25),
}, async ({ courseId, status, limit }) => {
  const enrollments = await db.enrollment.findMany({
    where: {
      ...(courseId && { courseId }),
      ...(status && { status: status as any }),
    },
    include: {
      user: { select: { name: true, email: true } },
      course: { select: { title: true } },
    },
    orderBy: { enrolledAt: "desc" },
    take: limit,
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(enrollments.map(e => ({
        id: e.id,
        student: e.user.name ?? e.user.email,
        course: e.course.title,
        status: e.status,
        enrolledAt: e.enrolledAt,
        completedAt: e.completedAt,
      })), null, 2),
    }],
  };
});

server.tool("enroll_student", "Manually enroll a student in a course", {
  userId: z.string().describe("User UUID"),
  courseId: z.string(),
}, async ({ userId, courseId }) => {
  const enrollment = await db.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId, status: "ACTIVE" },
    update: { status: "ACTIVE" },
  });
  return { content: [{ type: "text", text: `Student enrolled: ${enrollment.id}` }] };
});

server.tool("update_enrollment", "Change an enrollment status (ACTIVE, COMPLETED, CANCELLED)", {
  enrollmentId: z.string(),
  status: z.enum(["ACTIVE","COMPLETED","CANCELLED","PENDING"]),
}, async ({ enrollmentId, status }) => {
  await db.enrollment.update({
    where: { id: enrollmentId },
    data: {
      status: status as any,
      ...(status === "COMPLETED" && { completedAt: new Date() }),
    },
  });
  return { content: [{ type: "text", text: `Enrollment ${enrollmentId} set to ${status}.` }] };
});

// ── PROGRAMS ───────────────────────────────────────────────────────────────────
server.tool("update_program", "Update an internship program's status or details", {
  programId: z.string(),
  status: z.enum(["DRAFT","PUBLISHED","DISABLED"]).optional(),
  name: z.string().optional(),
  price: z.number().optional(),
  acceptanceFee: z.number().optional(),
  description: z.string().optional(),
}, async ({ programId, ...data }) => {
  await db.internshipProgram.update({
    where: { id: programId },
    data: data as any,
  });
  return { content: [{ type: "text", text: `Program ${programId} updated.` }] };
});

// ── ACHIEVEMENTS ───────────────────────────────────────────────────────────────
server.tool("toggle_achievement", "Enable or disable an achievement definition", {
  achievementId: z.string(),
  isActive: z.boolean(),
}, async ({ achievementId, isActive }) => {
  await db.achievementDefinition.update({ where: { id: achievementId }, data: { isActive } });
  return { content: [{ type: "text", text: `Achievement ${achievementId} ${isActive ? "enabled" : "disabled"}.` }] };
});

// ── AUDIT LOG ──────────────────────────────────────────────────────────────────
server.tool("list_audit_logs", "View recent admin audit log entries", {
  limit: z.number().default(20),
  actorEmail: z.string().optional(),
}, async ({ limit, actorEmail }) => {
  const logs = await db.auditLog.findMany({
    where: {
      ...(actorEmail && { actor: { email: actorEmail } }),
    },
    include: {
      actor: { select: { name: true, email: true } },
      targetUser: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(logs.map(l => ({
        action: l.action, resourceType: l.resourceType,
        actor: l.actor?.name ?? l.actor?.email ?? "system",
        target: l.targetUser?.name ?? l.targetUser?.email,
        details: l.details,
        createdAt: l.createdAt,
      })), null, 2),
    }],
  };
});

// ── INTERN RESOURCES ───────────────────────────────────────────────────────────
server.tool("list_intern_resources", "List intern learning resources", {
  status: z.enum(["DRAFT","PENDING_REVIEW","PUBLISHED"]).optional(),
  limit: z.number().default(20),
}, async ({ status, limit }) => {
  const resources = await db.internResource.findMany({
    where: { ...(status && { status: status as any }) },
    include: {
      level: { select: { name: true } },
      tracks: { include: { program: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(resources.map(r => ({
        id: r.id, title: r.title, slug: r.slug,
        status: r.status, level: r.level.name,
        tracks: r.tracks.map(t => t.program.name),
      })), null, 2),
    }],
  };
});

server.tool("update_resource_status", "Publish, unpublish, or send an intern resource for review", {
  resourceId: z.string(),
  status: z.enum(["DRAFT","PENDING_REVIEW","PUBLISHED"]),
  reviewNote: z.string().optional(),
}, async ({ resourceId, status, reviewNote }) => {
  await db.internResource.update({
    where: { id: resourceId },
    data: {
      status: status as any,
      ...(reviewNote && { reviewNote }),
      ...(status === "PENDING_REVIEW" && { submittedForReviewAt: new Date() }),
    },
  });
  return { content: [{ type: "text", text: `Resource ${resourceId} set to ${status}.` }] };
});

// ── PRACTICE LAB MANAGEMENT ────────────────────────────────────────────────────
server.tool("list_lab_scenarios", "List practice lab exercises — shows id, title, kind, track, level, published status, and number of linked tasks", {
  programId: z.string().optional(),
  levelId: z.string().optional(),
  kind: z.enum(["WEB","REACT","ADS","SOCIAL","AUTOMATION","BACKEND","WORDPRESS","CONTENT"]).optional(),
  published: z.boolean().optional(),
  limit: z.number().default(50),
}, async ({ programId, levelId, kind, published, limit }) => {
  const labs = await db.labScenario.findMany({
    where: {
      ...(programId && { programId }),
      ...(levelId && { levelId }),
      ...(kind && { kind: kind as any }),
      ...(published !== undefined && { published }),
    },
    include: {
      program: { select: { name: true } },
      level: { select: { name: true } },
      _count: { select: { tasks: true, attempts: true } },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(labs.map(l => ({
        id: l.id,
        title: l.title,
        kind: l.kind,
        track: l.program.name,
        level: l.level.name,
        published: l.published,
        linkedTasks: l._count.tasks,
        internAttempts: l._count.attempts,
      })), null, 2),
    }],
  };
});

server.tool("get_lab_scenario", "Get the full details of a lab exercise including brief, starter files, checks, and config", {
  labId: z.string(),
}, async ({ labId }) => {
  const lab = await db.labScenario.findUnique({
    where: { id: labId },
    include: {
      program: { select: { name: true } },
      level: { select: { name: true } },
      _count: { select: { attempts: true } },
    },
  });
  if (!lab) return { content: [{ type: "text", text: "Lab not found." }] };
  return { content: [{ type: "text", text: JSON.stringify(lab, null, 2) }] };
});

server.tool("create_lab_scenario", "Create a new practice lab exercise using the same validation as the admin website", {
  programId: z.string(),
  levelId: z.string(),
  kind: z.enum(["WEB","REACT","ADS","SOCIAL","AUTOMATION","BACKEND","WORDPRESS","CONTENT"]),
  title: z.string(),
  brief: z.string().describe("What the intern needs to build (plain text, can include line breaks)"),
  starterFiles: z.record(z.string(), z.string()).default({}).describe("{ filename: contents } — pass {} for simulator kinds"),
  solutionFiles: z.record(z.string(), z.string()).optional().describe("Admin-only model answer files"),
  checks: z.array(z.object({
    label: z.string(),
    code: z.string().describe("JS evaluated in the preview iframe; must return true to pass"),
  })).default([]).describe("Auto-grading checks (WEB/REACT only; ignored for simulator kinds)"),
  config: z.record(z.string(), z.unknown()).optional().describe("Simulator config (required for ADS, SOCIAL, AUTOMATION, BACKEND, WORDPRESS, CONTENT)"),
  published: z.boolean().default(false),
}, async (args) => {
  const result = await parseScenarioInput(args);
  if ("error" in result) {
    return { content: [{ type: "text", text: `Validation error: ${result.error}` }] };
  }
  const lab = await db.labScenario.create({ data: result.data as any });
  return { content: [{ type: "text", text: `Lab created: ${lab.id} — "${lab.title}"` }] };
});

server.tool("update_lab_scenario", "Edit an existing lab exercise — update the brief, files, checks, config, or publish/unpublish it", {
  labId: z.string(),
  title: z.string().optional(),
  brief: z.string().optional(),
  starterFiles: z.record(z.string(), z.string()).optional(),
  solutionFiles: z.record(z.string(), z.string()).optional(),
  checks: z.array(z.object({
    label: z.string(),
    code: z.string(),
  })).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  published: z.boolean().optional(),
}, async ({ labId, title, brief, starterFiles, solutionFiles, checks, config, published }) => {
  await db.labScenario.update({
    where: { id: labId },
    data: {
      ...(title !== undefined && { title }),
      ...(brief !== undefined && { brief }),
      ...(starterFiles !== undefined && { starterFiles: starterFiles as any }),
      ...(solutionFiles !== undefined && { solutionFiles: solutionFiles as any }),
      ...(checks !== undefined && { checks: checks as any }),
      ...(config !== undefined && { config: config as any }),
      ...(published !== undefined && { published }),
    },
  });
  return { content: [{ type: "text", text: `Lab ${labId} updated.` }] };
});

server.tool("publish_lab_scenario", "Publish or unpublish a lab so interns can or cannot see it", {
  labId: z.string(),
  published: z.boolean(),
}, async ({ labId, published }) => {
  await db.labScenario.update({ where: { id: labId }, data: { published } });
  return { content: [{ type: "text", text: `Lab ${labId} is now ${published ? "published" : "unpublished"}.` }] };
});

server.tool("delete_lab_scenario", "Permanently delete a lab exercise (only safe if no intern attempts exist)", {
  labId: z.string(),
}, async ({ labId }) => {
  const count = await db.labAttempt.count({ where: { scenarioId: labId } });
  if (count > 0) {
    return { content: [{ type: "text", text: `Cannot delete: ${count} intern attempt(s) exist for this lab. Unpublish it instead.` }] };
  }
  await db.labScenario.delete({ where: { id: labId } });
  return { content: [{ type: "text", text: `Lab ${labId} deleted.` }] };
});

server.tool("list_lab_attempts", "See intern attempts on a specific lab exercise", {
  labId: z.string(),
  status: z.enum(["DRAFT","SUBMITTED"]).optional(),
  limit: z.number().default(25),
}, async ({ labId, status, limit }) => {
  const attempts = await db.labAttempt.findMany({
    where: {
      scenarioId: labId,
      ...(status && { status: status as any }),
    },
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
  return {
    content: [{
      type: "text",
      text: JSON.stringify(attempts.map(a => ({
        id: a.id,
        intern: a.user.name ?? a.user.email,
        status: a.status,
        checksPassed: a.checksPassed,
        checksTotal: a.checksTotal,
        submittedAt: a.submittedAt,
        updatedAt: a.updatedAt,
      })), null, 2),
    }],
  };
});

server.tool("update_lab_checks", "Replace the auto-grading check suite for a lab with a new set of checks", {
  labId: z.string(),
  checks: z.array(z.object({
    label: z.string().describe("Human-readable check name, e.g. 'Page has a heading'"),
    code: z.string().describe("JS snippet evaluated in the preview iframe; must return true to pass"),
  })),
}, async ({ labId, checks }) => {
  await db.labScenario.update({ where: { id: labId }, data: { checks } });
  return { content: [{ type: "text", text: `Checks updated on lab ${labId} (${checks.length} check(s)).` }] };
});

server.tool("update_lab_starter_files", "Replace the starter files interns begin with on a lab", {
  labId: z.string(),
  starterFiles: z.record(z.string(), z.string()).describe("{ 'filename.ext': 'file contents', ... }"),
}, async ({ labId, starterFiles }) => {
  await db.labScenario.update({ where: { id: labId }, data: { starterFiles: starterFiles as any } });
  return { content: [{ type: "text", text: `Starter files updated on lab ${labId}.` }] };
});

server.tool("update_lab_config", "Update the simulator configuration for ADS, SOCIAL, AUTOMATION, or BACKEND labs", {
  labId: z.string(),
  config: z.record(z.string(), z.unknown()).describe("Simulator-specific settings object"),
}, async ({ labId, config }) => {
  await db.labScenario.update({ where: { id: labId }, data: { config: config as any } });
  return { content: [{ type: "text", text: `Config updated on lab ${labId}.` }] };
});

// ── INTERN RESOURCE CREATION ───────────────────────────────────────────────────
server.tool(
  "create_intern_resource",
  "Create a new intern resource (course) with modules and video lessons in one operation. The resource appears in interns' Resources section exactly as if created on the admin page.",
  {
    title: z.string().describe("Resource title"),
    description: z.string().optional().describe("Short summary shown in the resource list"),
    levelId: z.string().describe("Internship level id — use list_levels to find it"),
    programIds: z.array(z.string()).min(1).describe("One or more track (program) ids — the resource appears for interns in these tracks"),
    status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT").describe("DRAFT = not visible to interns yet, PUBLISHED = live immediately"),
    modules: z.array(z.object({
      title: z.string(),
      description: z.string().optional(),
      videoUrl: z.string().optional().describe("Optional module-level video URL (YouTube or other)"),
      content: z.string().optional().describe("Optional module-level text content"),
      lessons: z.array(z.object({
        title: z.string(),
        content: z.string().optional().describe("Plain text content for this lesson"),
        videoUrl: z.string().optional().describe("YouTube or other video URL"),
      })).default([]),
    })).default([]).describe("Modules in order. Each module can have lessons."),
  },
  async ({ title, description, levelId, programIds, status, modules }) => {
    // Run through the same parseResourceInput used by the admin page (non-partial create).
    const body = {
      title,
      description: description ?? null,
      status,
      trackIds: programIds,
      levelId,
      modules: modules.map((mod, i) => ({
        title: mod.title,
        description: mod.description ?? null,
        videoUrl: mod.videoUrl ?? null,
        content: mod.content ?? null,
        materials: [],
        lessons: mod.lessons.map((les) => ({
          title: les.title,
          content: les.content ?? null,
          videoUrl: les.videoUrl ?? null,
          materials: [],
        })),
      })),
    };

    const parsed = parseResourceInput(body, false);
    if ("error" in parsed)
      return { content: [{ type: "text", text: `Validation error: ${parsed.error}` }] };
    const { input } = parsed;
    const trackIds = input.trackIds ?? [];

    const badTracks = await unknownTrackIds(db, trackIds);
    if (badTracks.length)
      return { content: [{ type: "text", text: `Unknown track id(s): ${badTracks.join(", ")}` }] };

    const resolvedLevelId = await resolveLevelId(input.levelId);
    if (!resolvedLevelId)
      return { content: [{ type: "text", text: "The selected level was not found." }] };

    const slug = await uniqueResourceSlug(db, input.title ?? "");

    const resource = await db.internResource.create({
      data: {
        levelId: resolvedLevelId,
        slug,
        title: input.title ?? "",
        description: input.description ?? null,
        thumbnail: null,
        status: input.status ?? "DRAFT",
        ...reviewFieldsFor(input.status, null, null),
        createdById: null,
        tracks: { create: trackIds.map((programId) => ({ programId })) },
        modules: {
          create: (input.modules ?? []).map((mod, order) =>
            moduleCreateData(mod, order),
          ),
        },
      },
      include: {
        modules: {
          include: {
            lessons: { select: { id: true, title: true, order: true } },
          },
        },
      },
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          resourceId: resource.id,
          slug: resource.slug,
          status: resource.status,
          modules: resource.modules.map((mod) => ({
            moduleId: mod.id,
            title: mod.title,
            lessons: mod.lessons.map((les) => ({ lessonId: les.id, title: les.title })),
          })),
        }, null, 2),
      }],
    };
  },
);

server.tool(
  "add_resource_lesson",
  "Add a single lesson (with an optional video URL) to an existing resource module",
  {
    moduleId: z.string().describe("The id of the InternResourceModule to add the lesson to"),
    title: z.string().describe("Lesson title"),
    content: z.string().optional().describe("Plain text content"),
    videoUrl: z.string().optional().describe("YouTube or other video URL"),
    order: z.number().int().min(0).describe("Position in the lesson list (0 = first). Existing lessons are not reordered."),
  },
  async ({ moduleId, title, content, videoUrl, order }) => {
    const mod = await db.internResourceModule.findUnique({
      where: { id: moduleId },
      select: { id: true, resourceId: true },
    });
    if (!mod)
      return { content: [{ type: "text", text: "Module not found." }] };

    const lesson = await db.internResourceLesson.create({
      data: {
        moduleId,
        title: title.trim() || "Lesson",
        content: content?.trim() || null,
        videoUrl: videoUrl?.trim() || null,
        order,
      },
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ lessonId: lesson.id, moduleId, title: lesson.title }, null, 2),
      }],
    };
  },
);

// ── UPDATE INTERN RESOURCE ────────────────────────────────────────────────────
// Maps file extension → MIME type for the same types the admin page accepts.
const THUMBNAIL_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

server.tool(
  "update_intern_resource",
  "Update an intern resource's title, description, and/or thumbnail. When thumbnailPath is given, the file is read from disk, uploaded to Supabase Storage (same bucket as the admin page), and saved. Max image size: 5 MB. Accepted types: JPG, PNG, WebP, GIF, SVG.",
  {
    resourceId: z.string().describe("InternResource id"),
    title: z.string().optional(),
    description: z.string().optional(),
    thumbnailPath: z.string().optional().describe("Full local path to the thumbnail image, e.g. C:\\Users\\Emmanuel Thomas\\Downloads\\thumb.png"),
  },
  async ({ resourceId, title, description, thumbnailPath }) => {
    const resource = await db.internResource.findUnique({ where: { id: resourceId }, select: { id: true } });
    if (!resource) return { content: [{ type: "text", text: "Resource not found." }] };

    let thumbnailUrl: string | null | undefined;
    if (thumbnailPath !== undefined) {
      // Validate the file exists and is a supported image type.
      const ext = path.extname(thumbnailPath).toLowerCase();
      const mime = THUMBNAIL_MIME[ext];
      if (!mime)
        return { content: [{ type: "text", text: `Unsupported image type "${ext}". Use JPG, PNG, WebP, GIF or SVG.` }] };
      if (!fs.existsSync(thumbnailPath))
        return { content: [{ type: "text", text: `File not found: ${thumbnailPath}` }] };

      const bytes = fs.readFileSync(thumbnailPath);
      if (bytes.length > 5 * 1024 * 1024)
        return { content: [{ type: "text", text: "Image must be 5 MB or smaller." }] };

      // Build the same data: URL the admin upload form sends, then let storeImage
      // handle the upload and return the public URL (same path as the admin page).
      const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
      try {
        thumbnailUrl = await storeImage(dataUrl, "resource-thumbnails") as string;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Image upload failed.";
        return { content: [{ type: "text", text: msg }] };
      }
    }

    await db.internResource.update({
      where: { id: resourceId },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description.trim() || null }),
        ...(thumbnailUrl !== undefined && { thumbnail: thumbnailUrl }),
      },
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          resourceId,
          updated: {
            ...(title !== undefined && { title: title.trim() }),
            ...(description !== undefined && { description: description.trim() || null }),
            ...(thumbnailUrl !== undefined && { thumbnail: thumbnailUrl }),
          },
        }, null, 2),
      }],
    };
  },
);

// ── PLATFORM SETTINGS ─────────────────────────────────────────────────────────

server.tool(
  "get_platform_settings",
  "Read the current platform settings including branding (academyName, certificateIssuerName, certificate prefixes and logo), cohortSystemEnabled, selfPacedCertificatePassMark, automaticCertificateIssue, certificateMinimumCompletion, and other operational flags.",
  {},
  async () => {
    const settings = await db.platformSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    });
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          academyName: settings.academyName,
          platformName: settings.platformName,
          certificateIssuerName: settings.certificateIssuerName,
          certificatePrefix: settings.certificatePrefix,
          certificateNumberPrefix: settings.certificateNumberPrefix,
          certificateLogoUrl: settings.certificateLogoUrl,
          testimonialDriveUrl: settings.testimonialDriveUrl,
          cohortSystemEnabled: settings.cohortSystemEnabled,
          learningModePolicy: settings.learningModePolicy,
          selfPacedCertificatePassMark: settings.selfPacedCertificatePassMark,
          automaticCertificateIssue: settings.automaticCertificateIssue,
          certificateMinimumCompletion: settings.certificateMinimumCompletion,
          internshipApplicationsEnabled: settings.internshipApplicationsEnabled,
          maxGroupSize: settings.maxGroupSize,
          poolGroupSize: settings.poolGroupSize,
          defaultAssessmentPassScore: settings.defaultAssessmentPassScore,
          maintenanceMode: settings.maintenanceMode,
        }, null, 2),
      }],
    };
  },
);

server.tool(
  "set_cohort_system_enabled",
  "Old on/off switch, kept for compatibility: true = Cohort only, false = Self-paced only. Prefer set_learning_mode_policy (which also has 'Let interns choose', the default). Switching to self-paced only starts self-paced for every paid intern without a cohort (waiting or still choosing); interns in cohorts never change, and Special Class always uses cohorts. Confirm this is intentional before calling.",
  {
    enabled: z.boolean(),
  },
  async ({ enabled }) => {
    const settings = await applyPlatformSettingsPatch({ cohortSystemEnabled: enabled }, null, db);
    return { content: [{ type: "text", text: JSON.stringify({ cohortSystemEnabled: settings.cohortSystemEnabled, learningModePolicy: settings.learningModePolicy }, null, 2) }] };
  },
);

server.tool(
  "set_learning_mode_policy",
  "How newly paid interns learn each level: CHOOSE (each intern picks self-paced now or the next cohort; the default), COHORT_ONLY, or SELF_PACED_ONLY (also starts self-paced for every paid intern without a cohort). Interns already in cohorts never change; Special Class always uses cohorts. Confirm SELF_PACED_ONLY before calling.",
  {
    policy: z.enum(["CHOOSE", "COHORT_ONLY", "SELF_PACED_ONLY"]),
  },
  async ({ policy }) => {
    const settings = await applyPlatformSettingsPatch({ learningModePolicy: policy }, null, db);
    return { content: [{ type: "text", text: JSON.stringify({ learningModePolicy: settings.learningModePolicy, cohortSystemEnabled: settings.cohortSystemEnabled }, null, 2) }] };
  },
);

server.tool(
  "copy_cohort_tasks_to_library",
  "Fill the Task Library (where self-paced interns' tasks come from) by copying one cohort's tasks for its track and level. Real open/due dates become week/day/time offsets from the cohort start, so the order and spacing match the cohort. Safe to repeat: tasks already in the library (same title, track and level) are skipped. Use list_cohorts to find cohort IDs (e.g. the October 22 Level 1 cohorts).",
  {
    cohortId: z.string(),
  },
  async ({ cohortId }) => {
    const result = await copyCohortTasksToLibrary(cohortId, db);
    if (!result.ok) return { content: [{ type: "text", text: result.error }], isError: true };
    return { content: [{ type: "text", text: `Copied ${result.created} task(s) from ${result.cohort} into the Task Library (${result.skipped} already there).` }] };
  },
);

// ── TASK LIBRARY ───────────────────────────────────────────────────────────────

server.tool(
  "list_library_tasks",
  "List task templates in the Task Library. Filter by levelId, programId, kind, or set archived=true to include archived templates.",
  {
    levelId: z.string().optional(),
    programId: z.string().optional(),
    kind: z.enum(["INDIVIDUAL", "GROUP"]).optional(),
    archived: z.boolean().optional(),
  },
  async ({ levelId, programId, kind, archived }) => {
    const templates = await db.internshipTaskTemplate.findMany({
      where: {
        ...(levelId && { levelId }),
        ...(programId && { programId }),
        ...(kind && { kind }),
        archived: archived ? undefined : false,
      },
      orderBy: [{ opensWeek: "asc" }, { opensDay: "asc" }, { title: "asc" }],
      include: {
        program: { select: { id: true, name: true } },
        level: { select: { id: true, name: true } },
        _count: { select: { tasks: true } },
      },
    });
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ count: templates.length, templates }, null, 2),
      }],
    };
  },
);

server.tool(
  "create_library_task",
  "Create a new task template in the Task Library. isShared=true is for GROUP tasks shared across all tracks in a pool (programId must be null). Individual tracks set programId.",
  {
    levelId: z.string(),
    programId: z.string().nullable().optional(),
    title: z.string(),
    description: z.string().optional(),
    kind: z.enum(["INDIVIDUAL", "GROUP"]).default("INDIVIDUAL"),
    opensWeek: z.number().int().min(1),
    opensDay: z.number().int().min(1).max(7),
    opensTime: z.string(),
    dueWeek: z.number().int().min(1),
    dueDay: z.number().int().min(1).max(7),
    dueTime: z.string(),
    maxScore: z.number().int().min(1).max(1000).default(100),
    labScenarioId: z.string().nullable().optional(),
    labPassMark: z.number().int().min(1).max(100).optional(),
    officeLifeDay: z.number().int().min(1).max(4).nullable().optional(),
    isShared: z.boolean().default(false),
  },
  async (args) => {
    const { levelId, title, kind, isShared, labScenarioId, officeLifeDay } = args;
    const programId = isShared ? null : (args.programId ?? null);

    if (!title.trim()) return { content: [{ type: "text", text: "Error: title is required." }] };
    if (isShared && kind !== "GROUP") return { content: [{ type: "text", text: "Error: isShared=true requires kind=GROUP." }] };
    if (!isShared && !programId) return { content: [{ type: "text", text: "Error: provide programId, or set isShared=true." }] };
    if (labScenarioId && officeLifeDay != null) return { content: [{ type: "text", text: "Error: labScenarioId and officeLifeDay are mutually exclusive." }] };
    if (kind === "GROUP" && (labScenarioId || officeLifeDay != null)) return { content: [{ type: "text", text: "Error: GROUP tasks cannot link to lab or work-life." }] };

    const level = await db.internshipLevel.findUnique({ where: { id: levelId }, select: { id: true } });
    if (!level) return { content: [{ type: "text", text: "Error: level not found." }] };
    if (programId) {
      const prog = await db.internshipProgram.findUnique({ where: { id: programId }, select: { id: true } });
      if (!prog) return { content: [{ type: "text", text: "Error: track not found." }] };
    }

    const template = await db.internshipTaskTemplate.create({
      data: {
        levelId,
        programId,
        title: title.trim(),
        description: args.description?.trim() || null,
        kind,
        opensWeek: args.opensWeek,
        opensDay: args.opensDay,
        opensTime: args.opensTime,
        dueWeek: args.dueWeek,
        dueDay: args.dueDay,
        dueTime: args.dueTime,
        maxScore: args.maxScore,
        labScenarioId: labScenarioId ?? null,
        labPassMark: args.labPassMark ?? DEFAULT_LAB_PASS_MARK,
        officeLifeDay: officeLifeDay ?? null,
        isShared,
      },
      include: {
        program: { select: { id: true, name: true } },
        level: { select: { id: true, name: true } },
      },
    });
    return { content: [{ type: "text", text: JSON.stringify({ created: true, template }, null, 2) }] };
  },
);

server.tool(
  "update_library_task",
  "Update a task template. All fields are optional — only provided fields are changed. Cannot edit archived templates.",
  {
    templateId: z.string(),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    opensWeek: z.number().int().min(1).optional(),
    opensDay: z.number().int().min(1).max(7).optional(),
    opensTime: z.string().optional(),
    dueWeek: z.number().int().min(1).optional(),
    dueDay: z.number().int().min(1).max(7).optional(),
    dueTime: z.string().optional(),
    maxScore: z.number().int().min(1).max(1000).optional(),
    labScenarioId: z.string().nullable().optional(),
    labPassMark: z.number().int().min(1).max(100).optional(),
    officeLifeDay: z.number().int().min(1).max(4).nullable().optional(),
  },
  async ({ templateId, ...fields }) => {
    const existing = await db.internshipTaskTemplate.findUnique({
      where: { id: templateId },
      select: { archived: true },
    });
    if (!existing) return { content: [{ type: "text", text: "Error: template not found." }] };
    if (existing.archived) return { content: [{ type: "text", text: "Error: template is archived. Unarchive it first." }] };

    const data: Record<string, unknown> = {};
    if (fields.title !== undefined) data.title = fields.title.trim();
    if (fields.description !== undefined) data.description = fields.description?.trim() || null;
    if (fields.opensWeek !== undefined) data.opensWeek = fields.opensWeek;
    if (fields.opensDay !== undefined) data.opensDay = fields.opensDay;
    if (fields.opensTime !== undefined) data.opensTime = fields.opensTime;
    if (fields.dueWeek !== undefined) data.dueWeek = fields.dueWeek;
    if (fields.dueDay !== undefined) data.dueDay = fields.dueDay;
    if (fields.dueTime !== undefined) data.dueTime = fields.dueTime;
    if (fields.maxScore !== undefined) data.maxScore = fields.maxScore;
    if (fields.labScenarioId !== undefined) data.labScenarioId = fields.labScenarioId;
    if (fields.labPassMark !== undefined) data.labPassMark = fields.labPassMark;
    if (fields.officeLifeDay !== undefined) data.officeLifeDay = fields.officeLifeDay;

    const template = await db.internshipTaskTemplate.update({
      where: { id: templateId },
      data,
      include: { program: { select: { id: true, name: true } }, level: { select: { id: true, name: true } } },
    });
    return { content: [{ type: "text", text: JSON.stringify({ updated: true, template }, null, 2) }] };
  },
);

server.tool(
  "archive_library_task",
  "Archive a task template so it no longer appears in listings. Templates with materialised tasks are soft-archived; templates with no tasks are permanently deleted.",
  {
    templateId: z.string(),
  },
  async ({ templateId }) => {
    const existing = await db.internshipTaskTemplate.findUnique({
      where: { id: templateId },
      select: { archived: true, _count: { select: { tasks: true } } },
    });
    if (!existing) return { content: [{ type: "text", text: "Error: template not found." }] };
    if (existing._count.tasks > 0) {
      await db.internshipTaskTemplate.update({ where: { id: templateId }, data: { archived: true } });
      return { content: [{ type: "text", text: JSON.stringify({ archived: true, tasksPreserved: existing._count.tasks }, null, 2) }] };
    }
    await db.internshipTaskTemplate.delete({ where: { id: templateId } });
    return { content: [{ type: "text", text: JSON.stringify({ deleted: true }, null, 2) }] };
  },
);

// ── MIXED-TRACK GROUP POOLS ───────────────────────────────────────────────────

server.tool(
  "list_group_pools",
  "List all mixed-track group pools, with their cohorts and group counts.",
  {},
  async () => {
    const pools = await db.internshipGroupPool.findMany({
      orderBy: { startDate: "asc" },
      include: {
        level: { select: { name: true } },
        cohorts: {
          select: {
            id: true,
            name: true,
            program: { select: { name: true } },
            _count: { select: { applications: true } },
          },
        },
        groups: { select: { id: true, _count: { select: { members: true } } } },
      },
    });
    const result = pools.map((p) => ({
      id: p.id,
      level: p.level.name,
      startDate: p.startDate.toISOString().slice(0, 10),
      cohorts: p.cohorts.map((c) => ({
        id: c.id,
        name: c.name,
        track: c.program.name,
        applicationCount: c._count.applications,
      })),
      poolGroupCount: p.groups.length,
      poolMemberCount: p.groups.reduce((s, g) => s + g._count.members, 0),
    }));
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "form_pool_for_cohort",
  "Link a cohort to a mixed-track pool, creating the pool if needed. Only works for programs with excludeFromSelfPacedAndPools=false. Returns the pool, or null if fewer than 2 eligible cohorts share the same level and start date.",
  { cohortId: z.string() },
  async ({ cohortId }) => {
    const cohort = await db.internshipCohort.findUnique({
      where: { id: cohortId },
      select: {
        levelId: true,
        startDate: true,
        poolId: true,
        program: { select: { excludeFromSelfPacedAndPools: true } },
      },
    });
    if (!cohort) return { content: [{ type: "text", text: "Error: cohort not found." }] };
    if (cohort.program.excludeFromSelfPacedAndPools)
      return { content: [{ type: "text", text: "Error: this cohort's program is excluded from pools." }] };
    if (cohort.poolId) {
      const pool = await db.internshipGroupPool.findUnique({
        where: { id: cohort.poolId },
        include: { cohorts: { select: { id: true, name: true, program: { select: { name: true } } } } },
      });
      return { content: [{ type: "text", text: JSON.stringify({ alreadyInPool: true, pool }, null, 2) }] };
    }

    const eligible = await db.internshipCohort.findMany({
      where: { levelId: cohort.levelId, startDate: cohort.startDate, program: { excludeFromSelfPacedAndPools: false } },
      select: { id: true, name: true, program: { select: { name: true } } },
    });
    if (eligible.length < 2)
      return { content: [{ type: "text", text: JSON.stringify({ formed: false, reason: "Fewer than 2 eligible cohorts share this level and start date.", eligible }, null, 2) }] };

    const pool = await db.internshipGroupPool.upsert({
      where: { levelId_startDate: { levelId: cohort.levelId, startDate: cohort.startDate } },
      create: { levelId: cohort.levelId, startDate: cohort.startDate },
      update: {},
      select: { id: true },
    });
    await db.internshipCohort.updateMany({
      where: { id: { in: eligible.map((c) => c.id) } },
      data: { poolId: pool.id },
    });
    return { content: [{ type: "text", text: JSON.stringify({ formed: true, poolId: pool.id, cohorts: eligible }, null, 2) }] };
  },
);

server.tool(
  "set_track_pool_exclusion",
  "Set excludeFromSelfPacedAndPools on a track (program). Set to true for Special Class (or any track that must always use cohorts and never join mixed-track pools). Returns the updated track.",
  { programId: z.string(), exclude: z.boolean() },
  async ({ programId, exclude }) => {
    const program = await db.internshipProgram.findUnique({ where: { id: programId }, select: { id: true, name: true } });
    if (!program) return { content: [{ type: "text", text: "Error: program not found." }] };
    const updated = await db.internshipProgram.update({
      where: { id: programId },
      data: { excludeFromSelfPacedAndPools: exclude },
      select: { id: true, name: true, excludeFromSelfPacedAndPools: true },
    });
    return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
  },
);

// ── PLATFORM SETTINGS ─────────────────────────────────────────────────────────
server.tool("update_platform_settings", "Change platform settings with the same validation as the admin settings pages. Only the fields you pass change. certificateIssuerName and certificateLogoUrl appear on every certificate; certificateNumberPrefix is used for new internship certificate numbers, certificatePrefix for course certificates.", {
  academyName: z.string().optional().describe("1–120 characters; shown on certificates (e.g. 'SabiRole')"),
  platformName: z.string().optional().describe("1–120 characters"),
  certificateIssuerName: z.string().optional().describe("1–120 characters; the certificate seal and 'issued by' text"),
  certificatePrefix: z.string().optional().describe("Course certificate number prefix: 1–24 letters, digits or hyphens (saved uppercase)"),
  certificateNumberPrefix: z.string().optional().describe("Internship certificate number prefix: 1–24 letters, digits or hyphens (saved uppercase), e.g. 'SR-INT'"),
  certificateLogoUrl: z.string().nullable().optional().describe("Logo on certificates: an https image URL or a /public path like /sabirole-logo.png. Empty or null: the bundled /logo.png. Host it in /public or a public Supabase bucket so it also appears in downloaded PDFs."),
  automaticCertificateIssue: z.boolean().optional(),
  poolGroupSize: z.number().int().optional().describe("2–50"),
  certificateMinimumCompletion: z.number().int().optional().describe("1–100"),
  selfPacedCertificatePassMark: z.number().int().optional().describe("1–100"),
  supportEmail: z.string().optional(),
  testimonialDriveUrl: z.string().nullable().optional().describe("Global Google Drive folder for testimonial videos (cohorts without their own). Empty or null clears it."),
}, async (fields) => {
  const body = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  if (Object.keys(body).length === 0) return { content: [{ type: "text", text: "Nothing to update." }] };
  const { data, errors } = parsePlatformSettingsPatch(body);
  if (errors.length) return { content: [{ type: "text", text: `Not saved. ${errors.join(" ")}` }] };
  const settings = await applyPlatformSettingsPatch(data, null, db);
  const changed = Object.fromEntries(Object.keys(data).map((key) => [key, (settings as Record<string, unknown>)[key]]));
  return { content: [{ type: "text", text: JSON.stringify({ updated: changed }, null, 2) }] };
});

// ── TESTIMONIALS (text only; videos stay in Google Drive) ─────────────────────
server.tool("list_testimonials", "List intern testimonials with their consent status ('SabiRole may share my video and words'), rating, status, tags, and Drive video link. Filter by cohort, track, status, or consent.", {
  cohortId: z.string().optional(),
  programId: z.string().optional().describe("Track id"),
  status: z.enum(["PENDING","APPROVED","REJECTED"]).optional(),
  consentOnly: z.boolean().optional().describe("Only testimonials the intern consented to share"),
}, async ({ cohortId, programId, status, consentOnly }) => {
  const items = await listTestimonials({ cohortId, programId, status, consentOnly }, db);
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        count: items.length,
        consented: items.filter((i) => i.consent).length,
        testimonials: items,
      }, null, 2),
    }],
  };
});

server.tool("update_testimonial", "Approve, reject, or tag a testimonial", {
  testimonialId: z.string(),
  status: z.enum(["PENDING","APPROVED","REJECTED"]).optional(),
  tags: z.array(z.string()).optional().describe("Replaces the tags (up to 10 short words)"),
}, async ({ testimonialId, status, tags }) => {
  const result = await reviewTestimonial(testimonialId, { status, tags }, db);
  if (!result.ok) return { content: [{ type: "text", text: `Error: ${result.error}` }] };
  return { content: [{ type: "text", text: `Testimonial ${testimonialId} updated.` }] };
});

server.tool("list_testimonial_drive_links", "Show the global testimonial Google Drive folder and each cohort's own folder", {}, async () => {
  return { content: [{ type: "text", text: JSON.stringify(await listTestimonialDriveLinks(db), null, 2) }] };
});

server.tool("set_testimonial_drive_link", "Set the Google Drive folder where interns upload testimonial videos, for one cohort or (without cohortId) the global fallback. Empty url clears it.", {
  cohortId: z.string().optional().describe("Omit to set the global link"),
  url: z.string().describe("https://drive.google.com/… folder link, or empty to clear"),
}, async ({ cohortId, url }) => {
  const result = await setTestimonialDriveUrl(cohortId ?? null, url, null, db);
  if (!result.ok) return { content: [{ type: "text", text: `Error: ${result.error}` }] };
  return { content: [{ type: "text", text: `${cohortId ? `Cohort ${cohortId}` : "Global"} testimonial folder ${result.url ? `set to ${result.url}` : "cleared"}.` }] };
});

// ── LAUNCH ─────────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("SabiRole MCP server fatal error:", err);
  process.exit(1);
});

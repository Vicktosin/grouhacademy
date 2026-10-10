import { Resend } from "resend";
import { LearnerAudience, NotificationType } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { CONTACT_SENDER } from "@/lib/contact";
import { internshipAchievement } from "@/lib/internship-certificates";

// Tells an intern their certificate is ready: an in-app notification and,
// when Resend is configured, an email. Never throws; failures are logged so
// issuing the certificate itself is never undone by a notification problem.

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function notifyCertificateIssued(certificateId: string) {
  try {
    const prisma = getPrisma();
    const certificate = await prisma.internshipCertificate.findUnique({
      where: { id: certificateId },
      select: {
        userId: true,
        user: {
          select: {
            email: true,
            name: true,
            isPreview: true,
            profile: { select: { firstName: true } },
          },
        },
        program: { select: { name: true } },
        application: { select: { level: { select: { name: true, rank: true } } } },
      },
    });
    if (!certificate) return;

    const level = certificate.application?.level;
    const achievement = internshipAchievement(certificate.program.name, level);
    const next = level
      ? await prisma.internshipLevel.findFirst({
          where: { rank: { gt: level.rank } },
          orderBy: { rank: "asc" },
          select: { name: true },
        })
      : null;

    const title = "Your internship certificate is ready";
    const message = next
      ? `Congratulations on completing ${achievement}! Download your certificate, or move up to ${next.name} level, from your dashboard.`
      : `Congratulations on completing ${achievement}! Download your certificate from your dashboard.`;

    await prisma.notification.create({
      data: {
        userId: certificate.userId,
        title,
        message,
        type: NotificationType.SUCCESS,
        audience: LearnerAudience.INTERNSHIP,
      },
    });

    // An admin's preview intern has no real address (lib/preview-intern).
    if (certificate.user.isPreview) return;
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.info(
        "Certificate email skipped: RESEND_API_KEY isn't set on this server.",
      );
      return;
    }
    const firstName =
      certificate.user.profile?.firstName?.trim() ||
      certificate.user.name?.trim().split(/\s+/)[0] ||
      "there";
    const dashboardUrl = `${getSiteUrl()}/internship/dashboard`;
    const { error } = await new Resend(apiKey).emails.send({
      from: CONTACT_SENDER,
      to: certificate.user.email,
      subject: `🎉 ${title}`,
      text: [
        `Hi ${firstName},`,
        "",
        message,
        "",
        `Open your dashboard: ${dashboardUrl}`,
        "",
        "Keep it up!",
        "Grouh Academy",
      ].join("\n"),
      html: `<p>Hi ${escapeHtml(firstName)},</p>
<p>${escapeHtml(message)}</p>
<p><a href="${dashboardUrl}" style="display:inline-block;background:#5FBB46;color:#14204f;padding:12px 20px;border-radius:10px;font-weight:bold;text-decoration:none">Open my dashboard</a></p>
<p>Keep it up!<br>Grouh Academy</p>`,
    });
    if (error) console.error("Certificate email was rejected by Resend.", error);
  } catch (error) {
    console.error("Failed to notify intern about their certificate.", error);
  }
}

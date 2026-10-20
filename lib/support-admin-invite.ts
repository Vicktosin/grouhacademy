import { Resend } from "resend";
import { RoleName } from "@/generated/prisma/client";
import { CONTACT_SENDER } from "@/lib/contact";
import { getPrisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Support Admin accounts. Only an admin creates one, with the person's
// (company) email and a password the admin sets. The account can't be used
// until the person opens the invitation link sent to that email
// (app/auth/support-invite), so they need both the mailbox and the password.

/** Where the invitation link lands; it confirms the email address. */
export const SUPPORT_INVITE_PATH = "/auth/support-invite";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The Support Admin role's row, created on first use. */
export async function supportAdminRoleId() {
  const role = await getPrisma().role.upsert({
    where: { name: RoleName.SUPPORT_ADMIN },
    update: {},
    create: { name: RoleName.SUPPORT_ADMIN },
    select: { id: true },
  });
  return role.id;
}

/** Our own link around Supabase's one-time token, verified server-side. */
function inviteLink(hashedToken: string, type: string) {
  const query = new URLSearchParams({ token_hash: hashedToken, type });
  return `${getSiteUrl()}${SUPPORT_INVITE_PATH}?${query}`;
}

/**
 * Emails the invitation. Returns the link only in development without
 * Resend, so the flow can be tested locally; in production the link is
 * never shown to the admin, only sent to the mailbox.
 */
async function sendInvite(email: string, name: string, link: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") return { sent: false, devLink: link };
    throw new Error(
      "The invitation email couldn't be sent: RESEND_API_KEY isn't set on this server.",
    );
  }
  const firstName = name.trim().split(/\s+/)[0] || "there";
  const { error } = await new Resend(apiKey).emails.send({
    from: CONTACT_SENDER,
    to: email,
    subject: "You've been invited as a Grouh Academy Support Admin",
    text: [
      `Hi ${firstName},`,
      "",
      "An administrator has created a Support Admin account for you on Grouh Academy.",
      "Open this link to confirm your email address:",
      link,
      "",
      "Then sign in with this email and the password your administrator gave you.",
      "If you weren't expecting this, you can ignore this email.",
      "",
      "Grouh Academy",
    ].join("\n"),
    html: `<p>Hi ${escapeHtml(firstName)},</p>
<p>An administrator has created a <strong>Support Admin</strong> account for you on Grouh Academy. Confirm your email address to activate it:</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#5FBB46;color:#14204f;padding:12px 20px;border-radius:10px;font-weight:bold;text-decoration:none">Confirm my email</a></p>
<p>Then sign in with this email and the password your administrator gave you.</p>
<p>If you weren't expecting this, you can ignore this email.</p>
<p>Grouh Academy</p>`,
  });
  if (error) throw new Error(`The invitation email was rejected: ${error.message}`);
  return { sent: true, devLink: null };
}

/**
 * Creates the account (email not yet confirmed) with the admin's password,
 * gives it the Support Admin role and emails the invitation.
 */
export async function inviteSupportAdmin(input: {
  email: string;
  name: string;
  password: string;
}) {
  // Never turn an existing account (a learner's, say) into a Support Admin,
  // or change its password.
  const existing = await getPrisma().user.findUnique({
    where: { email: input.email },
    select: { roles: { select: { role: { select: { name: true } } } } },
  });
  if (existing)
    throw new Error(
      existing.roles.some(({ role }) => role.name === RoleName.SUPPORT_ADMIN)
        ? "This Support Admin was already invited. Use Resend invitation below."
        : "This email already has a Grouh Academy account. Use a different company email.",
    );

  const auth = createSupabaseAdminClient();
  const { data, error } = await auth.auth.admin.generateLink({
    type: "signup",
    email: input.email,
    password: input.password,
    options: { data: { name: input.name } },
  });
  // Supabase hands back an existing sign-in that isn't in our database yet
  // instead of refusing; a confirmed one isn't ours to take over.
  if (error || !data.user || data.user.email_confirmed_at)
    throw new Error(
      data?.user?.email_confirmed_at ||
        /already been registered|already exists/i.test(error?.message ?? "")
        ? "This email already has a Grouh Academy account. Use a different company email."
        : (error?.message ?? "Unable to create the account."),
    );

  const userId = data.user.id;
  try {
    const roleId = await supportAdminRoleId();
    await getPrisma().$transaction(async (tx) => {
      await tx.user.upsert({
        where: { id: userId },
        create: { id: userId, email: input.email, name: input.name },
        update: { email: input.email, name: input.name },
      });
      await tx.userRole.upsert({
        where: { userId_roleId: { userId, roleId } },
        create: { userId, roleId },
        update: {},
      });
    });
    const sent = await sendInvite(
      input.email,
      input.name,
      inviteLink(data.properties.hashed_token, data.properties.verification_type),
    );
    return { userId, ...sent };
  } catch (cause) {
    // Nothing half-made is left behind: the admin can simply try again.
    await auth.auth.admin.deleteUser(userId).catch(() => undefined);
    throw cause;
  }
}

/** A new invitation link for someone who hasn't confirmed their email yet. */
export async function resendSupportAdminInvite(userId: string) {
  const auth = createSupabaseAdminClient();
  const { data: found, error: findError } = await auth.auth.admin.getUserById(userId);
  if (findError || !found.user?.email) throw new Error("Account not found.");
  if (found.user.email_confirmed_at)
    throw new Error("This Support Admin has already confirmed their email.");
  const { data, error } = await auth.auth.admin.generateLink({
    type: "magiclink",
    email: found.user.email,
  });
  if (error) throw new Error(error.message);
  return sendInvite(
    found.user.email,
    String(found.user.user_metadata?.name ?? ""),
    inviteLink(data.properties.hashed_token, data.properties.verification_type),
  );
}

/**
 * Ends a Support Admin's access: removes the role and blocks the sign-in.
 * The account itself is kept, so their group messages, resources and
 * follow-up history stay attributed.
 */
export async function revokeSupportAdmin(userId: string) {
  const prisma = getPrisma();
  const roleId = await supportAdminRoleId();
  const { count } = await prisma.userRole.deleteMany({ where: { userId, roleId } });
  if (!count) throw new Error("This person isn't a Support Admin.");
  await prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });
  const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(userId, {
    // Supabase has no permanent ban; this is about 100 years.
    ban_duration: "876000h",
  });
  if (error) console.error("Failed to block a revoked Support Admin's sign-in:", error);
}

/** Every Support Admin, with whether they've confirmed their email yet. */
export async function listSupportAdmins() {
  const users = await getPrisma().user.findMany({
    where: { roles: { some: { role: { name: RoleName.SUPPORT_ADMIN } } } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  const auth = createSupabaseAdminClient();
  return Promise.all(
    users.map(async (user) => {
      const { data } = await auth.auth.admin.getUserById(user.id);
      return {
        ...user,
        createdAt: user.createdAt.toISOString(),
        confirmed: Boolean(data.user?.email_confirmed_at),
        lastSignInAt: data.user?.last_sign_in_at ?? null,
      };
    }),
  );
}

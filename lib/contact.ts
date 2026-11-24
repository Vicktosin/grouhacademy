// Contact form email settings. Change these addresses here.
// The sender must be on a domain verified in Resend (resend.com/domains).

/** The address shown on the site. */
export const CONTACT_EMAIL = "contact@sabirole.com";

/** The phone number shown on the site. */
export const CONTACT_PHONE = "+234 815 808 5673";

/** Inbox that receives messages sent through the contact form. */
export const CONTACT_INBOX = "hello@grouhacademy.space";

/** Address the contact emails are sent from. */
export const CONTACT_SENDER = "SabiRole <noreply@grouhacademy.space>";

/** Topics offered in the contact form, keyed by the value it submits. */
export const CONTACT_TOPICS: Record<string, string> = {
  course: "Choosing a course",
  enrollment: "Enrollment and payment",
  internship: "Internship program",
  partnership: "Partnerships",
  other: "Something else",
};

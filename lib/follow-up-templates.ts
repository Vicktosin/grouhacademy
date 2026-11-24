// Follow-up message templates and phone numbers for the admin follow-up
// page. Safe to import in the browser (no database access).

export type FollowUpStageKey = "PASSED_UNPAID" | "FAILED" | "NO_EXAM";

/** Values a template can use, already formatted for a message. */
export type FollowUpValues = {
  firstName: string;
  name: string;
  track: string;
  level: string;
  fee: string;
  score: string;
  passMark: string;
  nextCohort: string;
  nextCohortDate: string;
  /** How soon the cohort starts, e.g. "That's just a few hours to go!" */
  countdown: string;
  loginLink: string;
};

export const PLACEHOLDERS: Array<{ key: keyof FollowUpValues; label: string }> =
  [
    { key: "firstName", label: "First name" },
    { key: "name", label: "Full name" },
    { key: "track", label: "Track" },
    { key: "level", label: "Level" },
    { key: "fee", label: "Acceptance fee" },
    { key: "score", label: "Exam score" },
    { key: "passMark", label: "Pass mark" },
    { key: "nextCohort", label: "Next cohort" },
    { key: "nextCohortDate", label: "Next cohort start" },
    { key: "countdown", label: "Countdown to start" },
    { key: "loginLink", label: "Login link" },
  ];

export const DEFAULT_TEMPLATES: Record<FollowUpStageKey, string> = {
  PASSED_UNPAID: `Dear {name},

Congratulations on passing the {track} assessment! 🎉

We noticed you have not completed your payment to join the internship. Do you have any questions, or anything you would like us to clarify?

Your cohort starts {nextCohortDate}. {countdown}

— SabiRole`,
  FAILED: `Hi {firstName},

Thank you for taking the {track} ({level} level) entrance assessment. You scored {score}% and the pass mark is {passMark}%, so you're close!

Your score does not affect your application. Log in at {loginLink} to continue to payment, or optionally retake the assessment when you like.

Want tips to prepare? Reply here and we'll help.
— SabiRole`,
  NO_EXAM: `Hi {firstName},

Your application for the {track} internship ({level} level) is ready.

The skills assessment is optional. Log in at {loginLink} to continue to payment and start your internship. You can take the assessment whenever you like.

Any questions? Reply here and we'll help.
— SabiRole`,
};

/** Fills {placeholders}; unknown ones are left as they are. */
export function renderTemplate(template: string, values: FollowUpValues) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? values[key as keyof FollowUpValues] : match,
  );
}

/**
 * A phone number in the international digits-only form WhatsApp links need.
 * Nigerian local numbers (080…, 80…) become 234…; anything already
 * international is kept. Returns null for something that isn't a number.
 */
export function toWhatsAppNumber(raw: string | null | undefined) {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0"))
    digits = `234${digits.slice(1)}`;
  else if (digits.length === 10 && /^[789]/.test(digits))
    digits = `234${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function whatsAppLink(number: string, message: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

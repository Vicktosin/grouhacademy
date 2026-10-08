import { getPrisma } from "@/lib/prisma";
import { firstAnswer, phoneQuestionIds } from "@/lib/internship-follow-ups";
import { toWhatsAppNumber } from "@/lib/follow-up-templates";

// Group members' phone numbers, shown only to their group leader so they can
// organise group work. Taken from the WhatsApp/phone answers given at
// onboarding (on the member's application for this track), falling back to
// the phone on their profile.

export type MemberContact = { phone: string; whatsapp: string | null };

export async function memberContacts(
  userIds: string[],
  programId: string,
): Promise<Map<string, MemberContact>> {
  const contacts = new Map<string, MemberContact>();
  if (!userIds.length) return contacts;
  const prisma = getPrisma();
  const [questionIds, applications, profiles] = await Promise.all([
    phoneQuestionIds(),
    prisma.internshipApplication.findMany({
      where: { studentId: { in: userIds }, programId },
      orderBy: { createdAt: "desc" },
      select: { studentId: true, onboardingAnswers: true },
    }),
    prisma.profile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, phone: true },
    }),
  ]);
  const answersFor = new Map<string, Record<string, unknown>>();
  for (const application of applications)
    if (!answersFor.has(application.studentId))
      answersFor.set(
        application.studentId,
        (application.onboardingAnswers ?? {}) as Record<string, unknown>,
      );
  const profilePhone = new Map(profiles.map((p) => [p.userId, p.phone]));

  for (const userId of userIds) {
    const answers = answersFor.get(userId) ?? {};
    const whatsapp = firstAnswer(answers, questionIds.whatsapp);
    const phone =
      whatsapp ??
      firstAnswer(answers, questionIds.phone) ??
      profilePhone.get(userId)?.trim() ??
      null;
    if (phone)
      contacts.set(userId, {
        phone,
        whatsapp: toWhatsAppNumber(whatsapp) ?? toWhatsAppNumber(phone),
      });
  }
  return contacts;
}

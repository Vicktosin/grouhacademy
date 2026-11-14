import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/route-guards";
import { getPrisma } from "@/lib/prisma";
import {
  internshipCertificateSelect,
  serializeInternshipCertificate,
} from "@/lib/internship-certificates";
import {
  checkCertificate,
  getCurrentApplication,
} from "@/lib/internship-progression";
import { mustShareExperience } from "@/lib/testimonials";

// The certificate for the intern's current level (issued here once they
// qualify), plus every certificate they've earned, so certificates from
// earlier levels stay available after moving up.
//
// A graduate must first share their experience (a video, voice note or
// writing; see components/graduation): until they do, no certificate is
// sent, only experienceRequired, and the page sends them to share it.

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  try {
    const application = await getCurrentApplication(userId);
    if (!application) {
      return NextResponse.json({
        eligible: false,
        reason: "No internship application found.",
        certificates: [],
      });
    }

    // Issues the certificate when due, so a new graduate is held back too.
    const check = await checkCertificate(application);
    if (await mustShareExperience(userId))
      return NextResponse.json({
        eligible: false,
        experienceRequired: true,
        reason: "Tell us about your experience to unlock your certificate.",
        certificates: [],
      });
    const earned = await getPrisma().internshipCertificate.findMany({
      where: { userId },
      orderBy: { issuedAt: "desc" },
      select: internshipCertificateSelect,
    });
    const certificates = earned.map(serializeInternshipCertificate);

    if (!check.eligible) return NextResponse.json({ ...check, certificates });

    const current = certificates.find(
      (certificate) => certificate.id === check.certificateId,
    );
    return NextResponse.json({ eligible: true, ...current, certificates });
  } catch (error) {
    console.error("Failed to load certificate:", error);
    return NextResponse.json(
      { error: "Unable to load certificate." },
      { status: 500 },
    );
  }
}

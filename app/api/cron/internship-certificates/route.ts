import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import {
  certificateApplicationInclude,
  checkCertificate,
} from "@/lib/internship-progression";

// Daily job (vercel.json): issues certificates to interns whose cohort has
// ended and who met its pass mark, so they're told (in-app and by email)
// without first having to visit their dashboard. Visiting still issues a
// certificate too; whichever happens first notifies the intern once.
//
// Only cohorts that ended in the last LOOKBACK_DAYS are checked, so turning
// this on doesn't suddenly email interns from long-finished cohorts.

const LOOKBACK_DAYS = 30;

export const maxDuration = 300;

export async function GET(request: Request) {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const prisma = getPrisma();
  const now = new Date();
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const applications = await prisma.internshipApplication.findMany({
    where: {
      // Cohorts that just ended, and self-paced interns (no cohort): those
      // qualify whenever they've passed enough tasks, so they're checked daily.
      OR: [
        { cohort: { endDate: { gte: since, lt: now } } },
        { cohortId: null, selfPacedStartDate: { not: null } },
      ],
      status: { not: "REMOVED" },
      payment: { is: { status: "PAID" } },
      certificates: { none: {} },
    },
    include: certificateApplicationInclude,
  });

  let issued = 0;
  let failed = 0;
  for (const application of applications) {
    try {
      const check = await checkCertificate(application);
      if (check.eligible && check.issuedNow) issued += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `[cron] Certificate check failed for application ${application.id}.`,
        error,
      );
    }
  }

  const summary = { checked: applications.length, issued, failed };
  console.info("[cron] Internship certificates.", summary);
  return NextResponse.json(summary);
}

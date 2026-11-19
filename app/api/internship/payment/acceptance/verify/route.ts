import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { activatePromotion } from "@/lib/internship-progression";
import { recordAffiliateCommission } from "@/lib/affiliates";
import { settleLearningModeOnPayment } from "@/lib/learning-mode";

export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get("reference");
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!reference)
    return NextResponse.json(
      { message: "Missing payment reference." },
      { status: 400 },
    );
  if (!secretKey)
    return NextResponse.json(
      { message: "Paystack is not configured." },
      { status: 503 },
    );

  const prisma = getPrisma();

  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
      },
    );
    const data = await response.json();
    if (!response.ok || data.data?.status !== "success") {
      return NextResponse.json(
        { message: "Payment was not successful." },
        { status: 402 },
      );
    }

    const applicationId = data.data.metadata?.applicationId as
      string | undefined;
    if (
      !applicationId ||
      data.data.reference !== reference ||
      data.data.metadata?.purpose !== "internship_acceptance_fee"
    ) {
      return NextResponse.json(
        { message: "Payment reference is missing application context." },
        { status: 400 },
      );
    }

    // Paystack returns to this endpoint through the customer's browser. That
    // navigation can arrive without the Supabase session cookie (for example,
    // when the callback host differs from the host where payment began). The
    // Paystack verification plus this exact persisted reference are therefore
    // the authority for settling the payment; browser authentication must not
    // leave a successful payment pending.
    //
    // Metadata alone must never settle a different application's payment, so
    // the reference must be the one stored on this application's payment, or
    // an earlier attempt for this same application: each new attempt replaces
    // the stored reference, but an earlier one can still complete (e.g. a
    // bank transfer made after tapping Pay again). Our references embed the
    // application id; the amount check below still applies.
    const application = await prisma.internshipApplication.findFirst({
      where: reference.startsWith(`acceptance_${applicationId}_`)
        ? { id: applicationId, payment: { isNot: null } }
        : { id: applicationId, payment: { is: { reference } } },
      include: { program: true, payment: true },
    });
    if (!application) {
      return NextResponse.json(
        { message: "This payment does not belong to your account." },
        { status: 403 },
      );
    }

    const passedAttempt = await prisma.assessmentAttempt.findFirst({
      where: { applicationId, status: "PASSED" },
      select: { id: true },
    });
    if (!passedAttempt) {
      return NextResponse.json(
        {
          message:
            "A passed entrance assessment is required to verify this payment.",
        },
        { status: 403 },
      );
    }

    // The amount was fixed (for this track and level) when the payment was
    // started; compare against that rather than today's fee.
    const expectedAmount = application.payment?.amount;
    if (
      expectedAmount === undefined ||
      data.data.amount !== expectedAmount * 100 ||
      data.data.currency !== application.payment?.currency
    ) {
      return NextResponse.json(
        {
          message:
            "Payment amount or currency does not match this application.",
        },
        { status: 400 },
      );
    }

    // Store the reference that was actually paid. If it's already paid (e.g.
    // the webhook got there first), keep the original paid time.
    const joining = application.payment?.status !== "PAID";
    if (joining) {
      const paid = await prisma.internshipPayment.update({
        where: { applicationId },
        data: { status: "PAID", paidAt: new Date(), reference },
        select: { id: true },
      });
      // Whoever invited them through the Affiliate Program earns commission.
      await recordAffiliateCommission(paid.id);
    }

    // Self-paced or cohort: decided here when only one is allowed, else the
    // intern chooses next (/internship/choose). The webhook does the same,
    // so whichever arrives first settles it; repeating is harmless and never
    // moves an intern who has chosen.
    await settleLearningModeOnPayment(applicationId);

    // A paid move up to the next level becomes the intern's current level.
    await activatePromotion(application.id);

    // Amount and currency let the browser report the purchase value to
    // Google Analytics and Meta Pixel.
    return NextResponse.json({
      status: "success",
      amount: expectedAmount,
      currency: data.data.currency,
      programName: application.program.name,
    });
  } catch (error) {
    console.error("Failed to verify acceptance fee payment:", error);
    return NextResponse.json(
      { message: "Payment verification failed." },
      { status: 500 },
    );
  }
}

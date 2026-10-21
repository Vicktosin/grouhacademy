import { assignApplicationCohort } from "@/lib/internship-cohort";
import { recordAffiliateCommission } from "@/lib/affiliates";

export type PaystackWebhookEvent = {
  event?: string;
  status?: string;
  reference?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  metadata?: Record<string, unknown> | null;
  data?: {
    event?: string;
    status?: string;
    reference?: string | null;
    amount?: number | string | null;
    currency?: string | null;
    metadata?: Record<string, unknown> | null;
  };
};

export type PaystackSettlementPrisma = {
  internshipPayment: {
    findUnique(args: Record<string, unknown>): Promise<{
      id: string;
      applicationId: string;
      status: string;
      amount: number;
      currency: string;
      application: {
        id: string;
        programId: string;
        levelId: string;
        cohortId: string | null;
      } | null;
    } | null>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  payment: {
    findUnique(args: Record<string, unknown>): Promise<{
      id: string;
      status: string;
      amount: number;
      currency: string;
    } | null>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  internshipApplication: {
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  internshipCohort: {
    findFirst(
      args: Record<string, unknown>,
    ): Promise<{ id: string; startDate?: Date; endDate?: Date } | null>;
  };
};

function amountInSmallestUnit(value: number | string | null | undefined) {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export async function settleSuccessfulPaystackPayment(
  prisma: PaystackSettlementPrisma,
  payload: PaystackWebhookEvent,
) {
  const eventData = payload.data ?? payload;
  const reference =
    typeof eventData.reference === "string" ? eventData.reference : null;
  const status = eventData.status ?? payload.status;
  const metadata = (eventData.metadata ?? payload.metadata ?? {}) as Record<
    string,
    unknown
  >;
  const applicationId =
    typeof metadata.applicationId === "string"
      ? metadata.applicationId
      : undefined;
  const purpose =
    typeof metadata.purpose === "string" ? metadata.purpose : undefined;
  const paystackAmount = amountInSmallestUnit(
    eventData.amount ?? payload.amount,
  );
  const paystackCurrency =
    typeof eventData.currency === "string"
      ? eventData.currency
      : payload.currency;

  if (status !== "success") {
    return {
      updatedInternshipPayment: false,
      updatedGenericPayment: false,
      ignored: true,
      reason: "unsuccessful_status",
    };
  }

  if (!reference || paystackAmount === null || !paystackCurrency) {
    console.warn(
      "[paystack-webhook] Successful event missing reference, amount, or currency.",
    );
    return {
      updatedInternshipPayment: false,
      updatedGenericPayment: false,
      ignored: true,
      reason: "incomplete_payment_data",
    };
  }

  let updatedInternshipPayment = false;
  let updatedGenericPayment = false;

  if (
    purpose === "internship_acceptance_fee" ||
    reference.startsWith("acceptance_")
  ) {
    const include = { application: { include: { program: true } } };
    // Each new payment attempt replaces the reference stored on the
    // application's payment, but an earlier attempt can still complete (a
    // bank transfer made after the applicant tapped Pay again). Our references
    // embed the application id, so an earlier one is matched to that
    // application's payment; the amount check below still applies.
    const supersededFor =
      applicationId && reference.startsWith(`acceptance_${applicationId}_`)
        ? applicationId
        : null;
    const internshipPayment =
      (await prisma.internshipPayment
        .findUnique({ where: { reference }, include })
        .catch(() => null)) ??
      (supersededFor
        ? await prisma.internshipPayment
            .findUnique({ where: { applicationId: supersededFor }, include })
            .catch(() => null)
        : null);

    if (
      internshipPayment &&
      internshipPayment.amount * 100 === paystackAmount &&
      internshipPayment.currency === paystackCurrency &&
      internshipPayment.application
    ) {
      if (internshipPayment.status === "PAID") {
        return {
          updatedInternshipPayment: false,
          updatedGenericPayment: false,
          ignored: false,
          reason: "already_settled",
        };
      }

      // Store the reference that was actually paid.
      await prisma.internshipPayment.update({
        where: { id: internshipPayment.id },
        data: { status: "PAID", paidAt: new Date(), reference },
      });
      await recordAffiliateCommission(internshipPayment.id);

      updatedInternshipPayment = true;

      if (internshipPayment.application)
        await assignApplicationCohort(
          prisma,
          internshipPayment.application,
          { joining: true },
        ).catch(() => null);
    } else if (internshipPayment) {
      console.warn("[paystack-webhook] Acceptance payment validation failed.", {
        reference,
      });
      return {
        updatedInternshipPayment: false,
        updatedGenericPayment: false,
        ignored: true,
        reason: "payment_mismatch",
      };
    }
  }

  if (purpose === "internship_premium" || reference.startsWith("premium_")) {
    const genericPayment = await prisma.payment
      .findUnique({ where: { reference } })
      .catch(() => null);

    if (
      genericPayment &&
      genericPayment.amount * 100 === paystackAmount &&
      genericPayment.currency === paystackCurrency
    ) {
      if (genericPayment.status === "PAID") {
        return {
          updatedInternshipPayment,
          updatedGenericPayment: false,
          ignored: false,
          reason: "already_settled",
        };
      }

      await prisma.payment.update({
        where: { reference },
        data: { status: "PAID", paidAt: new Date() },
      });
      updatedGenericPayment = true;
    } else if (genericPayment) {
      console.warn("[paystack-webhook] Premium payment validation failed.", {
        reference,
      });
      return {
        updatedInternshipPayment: false,
        updatedGenericPayment: false,
        ignored: true,
        reason: "payment_mismatch",
      };
    }
  }

  if (!updatedInternshipPayment && !updatedGenericPayment) {
    console.warn(
      "[paystack-webhook] Successful event did not match a stored payment.",
      { reference, applicationId, purpose },
    );
  }

  return {
    updatedInternshipPayment,
    updatedGenericPayment,
    ignored: false,
    reason:
      updatedInternshipPayment || updatedGenericPayment
        ? "settled"
        : "unmatched",
  };
}

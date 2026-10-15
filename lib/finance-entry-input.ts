import { z } from "zod";
import { FinanceEntryType as PrismaFinanceEntryType } from "@/generated/prisma/client";
import {
  FINANCE_ENTRY_CATEGORIES,
  type FinanceEntryCategory,
} from "@/lib/finance-types";

const databaseEntryTypes: Record<
  FinanceEntryCategory,
  PrismaFinanceEntryType
> = {
  AD_SPEND: PrismaFinanceEntryType.AD_SPEND,
  STAFF_PAYMENT: PrismaFinanceEntryType.STAFF_PAYMENT,
  BUSINESS_SAVINGS: PrismaFinanceEntryType.BUSINESS_SAVINGS,
  CAPITAL_INVESTMENT: PrismaFinanceEntryType.CAPITAL_INVESTMENT,
  UNPLANNED_EXPENSE: PrismaFinanceEntryType.UNPLANNED_EXPENSE,
  SUBSCRIPTION: PrismaFinanceEntryType.SUBSCRIPTION,
  OTHER: PrismaFinanceEntryType.OTHER,
};

export function financeEntryTypeForDatabase(type: FinanceEntryCategory) {
  return databaseEntryTypes[type];
}

export const financeEntryInputSchema = z
  .object({
    type: z.enum(FINANCE_ENTRY_CATEGORIES),
    description: z.string().trim().min(1).max(160),
    amount: z.number().int().positive().safe(),
    currency: z.enum(["NGN", "USD", "GBP"]),
    occurredAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
    source: z.string().trim().max(160),
    adType: z.string().trim().max(80),
    campaignName: z.string().trim().max(120),
    conversions: z.number().int().nonnegative().nullable(),
    attributedRevenue: z.number().int().nonnegative().nullable(),
  })
  .superRefine((value, context) => {
    if (
      (value.type === "CAPITAL_INVESTMENT" ||
        value.type === "STAFF_PAYMENT") &&
      !value.source
    ) {
      context.addIssue({
        code: "custom",
        path: ["source"],
        message:
          value.type === "CAPITAL_INVESTMENT"
            ? "Enter the source of this capital investment."
            : "Enter the staff member or payee.",
      });
    }

    if (value.type !== "AD_SPEND") return;

    if (!value.adType) {
      context.addIssue({
        code: "custom",
        path: ["adType"],
        message: "Select the type of ad.",
      });
    }
    if (!value.campaignName) {
      context.addIssue({
        code: "custom",
        path: ["campaignName"],
        message: "Enter the ad or campaign name.",
      });
    }
    if (value.conversions === null) {
      context.addIssue({
        code: "custom",
        path: ["conversions"],
        message: "Enter the number of conversions.",
      });
    }
  });

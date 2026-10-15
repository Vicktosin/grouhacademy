export const FINANCE_ENTRY_CATEGORIES = [
  "AD_SPEND",
  "STAFF_PAYMENT",
  "BUSINESS_SAVINGS",
  "CAPITAL_INVESTMENT",
  "UNPLANNED_EXPENSE",
  "SUBSCRIPTION",
  "OTHER",
] as const;

export type FinanceEntryCategory = (typeof FINANCE_ENTRY_CATEGORIES)[number];

export const FINANCE_ENTRY_LABELS: Record<FinanceEntryCategory, string> = {
  AD_SPEND: "Advertising",
  STAFF_PAYMENT: "Staff payment",
  BUSINESS_SAVINGS: "Business savings",
  CAPITAL_INVESTMENT: "Capital investment",
  UNPLANNED_EXPENSE: "Unplanned expense",
  SUBSCRIPTION: "Subscription",
  OTHER: "Other",
};

export type FinanceEntryRecord = {
  id: string;
  type: FinanceEntryCategory;
  description: string;
  amount: number;
  currency: string;
  occurredAt: string;
  source: string | null;
  adType: string | null;
  campaignName: string | null;
  conversions: number | null;
  attributedRevenue: number | null;
  createdAt: string;
  updatedAt: string;
};

export type FinanceIncomeRecord = {
  id: string;
  kind: "STUDENT_INCOME" | "INTERNSHIP_REVENUE";
  reference: string;
  title: string;
  amount: number;
  currency: string;
  occurredAt: string;
};

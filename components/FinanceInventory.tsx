"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Download,
  Megaphone,
  Pencil,
  PiggyBank,
  Plus,
  Receipt,
  Search,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  FINANCE_ENTRY_CATEGORIES,
  FINANCE_ENTRY_LABELS,
  type FinanceEntryCategory,
  type FinanceEntryRecord,
  type FinanceIncomeRecord,
} from "@/lib/finance-types";

type FinanceData = {
  income: FinanceIncomeRecord[];
  entries: FinanceEntryRecord[];
};

type EntryForm = {
  type: FinanceEntryCategory;
  description: string;
  amount: string;
  currency: "NGN" | "USD" | "GBP";
  occurredAt: string;
  source: string;
  adType: string;
  campaignName: string;
  conversions: string;
  attributedRevenue: string;
};

type Filter = "ALL" | "STUDENT_INCOME" | "INTERNSHIP_REVENUE" | "EXPENSES";

type LedgerRow = {
  id: string;
  kind: "STUDENT_INCOME" | "INTERNSHIP_REVENUE" | "EXPENSE";
  title: string;
  reference: string | null;
  amount: number;
  currency: string;
  occurredAt: string;
  details: string;
  entry?: FinanceEntryRecord;
};

const categoryIcons: Record<FinanceEntryCategory, typeof Megaphone> = {
  AD_SPEND: Megaphone,
  STAFF_PAYMENT: Building2,
  BUSINESS_SAVINGS: PiggyBank,
  CAPITAL_INVESTMENT: TrendingUp,
  UNPLANNED_EXPENSE: Receipt,
  SUBSCRIPTION: CalendarDays,
  OTHER: WalletCards,
};

function makeDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyForm(): EntryForm {
  return {
    type: "AD_SPEND",
    description: "",
    amount: "",
    currency: "NGN",
    occurredAt: makeDateValue(new Date()),
    source: "",
    adType: "",
    campaignName: "",
    conversions: "0",
    attributedRevenue: "",
  };
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatBreakdown(values: Array<{ amount: number; currency: string }>) {
  const totals = new Map<string, number>();
  for (const value of values) {
    totals.set(value.currency, (totals.get(value.currency) ?? 0) + value.amount);
  }
  if (!totals.size) return formatMoney(0, "NGN");
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => formatMoney(amount, currency))
    .join(" · ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  return body?.error ?? "The request could not be completed.";
}

export default function FinanceInventory() {
  const [data, setData] = useState<FinanceData>({ income: [], entries: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceEntryRecord | null>(null);
  const [form, setForm] = useState<EntryForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/finance", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(await readError(response));
        const result = (await response.json()) as FinanceData;
        if (!cancelled) setData(result);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load finance records.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const studentIncome = useMemo(
    () => data.income.filter((item) => item.kind === "STUDENT_INCOME"),
    [data.income],
  );
  const internshipIncome = useMemo(
    () => data.income.filter((item) => item.kind === "INTERNSHIP_REVENUE"),
    [data.income],
  );
  const operatingEntries = useMemo(
    () =>
      data.entries.filter(
        (entry) =>
          entry.type !== "BUSINESS_SAVINGS" &&
          entry.type !== "CAPITAL_INVESTMENT",
      ),
    [data.entries],
  );
  const savingsEntries = useMemo(
    () => data.entries.filter((entry) => entry.type === "BUSINESS_SAVINGS"),
    [data.entries],
  );
  const capitalEntries = useMemo(
    () => data.entries.filter((entry) => entry.type === "CAPITAL_INVESTMENT"),
    [data.entries],
  );

  const topCampaign = useMemo(() => {
    const campaigns = new Map<
      string,
      {
        campaignName: string;
        adType: string;
        amount: number;
        currency: string;
        conversions: number;
        attributedRevenue: number | null;
      }
    >();
    for (const entry of data.entries) {
      if (entry.type !== "AD_SPEND" || !entry.campaignName) continue;
      const key = `${entry.campaignName}:${entry.currency}`;
      const campaign = campaigns.get(key);
      if (campaign) {
        campaign.amount += entry.amount;
        campaign.conversions += entry.conversions ?? 0;
        if (entry.attributedRevenue !== null) {
          campaign.attributedRevenue =
            (campaign.attributedRevenue ?? 0) + entry.attributedRevenue;
        }
      } else {
        campaigns.set(key, {
          campaignName: entry.campaignName,
          adType: entry.adType ?? "Ad campaign",
          amount: entry.amount,
          currency: entry.currency,
          conversions: entry.conversions ?? 0,
          attributedRevenue: entry.attributedRevenue,
        });
      }
    }
    return (
      [...campaigns.values()].sort(
        (a, b) =>
          b.conversions - a.conversions ||
          (b.attributedRevenue ?? 0) - (a.attributedRevenue ?? 0),
      )[0] ?? null
    );
  }, [data.entries]);

  const rows = useMemo<LedgerRow[]>(() => {
    const incomeRows: LedgerRow[] = data.income.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      reference: item.reference,
      amount: item.amount,
      currency: item.currency,
      occurredAt: item.occurredAt,
      details:
        item.kind === "STUDENT_INCOME" ? "Student learning" : "Internship",
    }));
    const expenseRows: LedgerRow[] = data.entries.map((entry) => ({
      id: entry.id,
      kind: "EXPENSE",
      title: entry.description,
      reference: null,
      amount: entry.amount,
      currency: entry.currency,
      occurredAt: entry.occurredAt,
      details: [
        FINANCE_ENTRY_LABELS[entry.type],
        entry.source,
        entry.campaignName,
      ]
        .filter(Boolean)
        .join(" · "),
      entry,
    }));

    return [...incomeRows, ...expenseRows]
      .filter((row) => {
        const matchesFilter =
          filter === "ALL" ||
          (filter === "EXPENSES" && row.kind === "EXPENSE") ||
          row.kind === filter;
        const matchesQuery =
          !query ||
          `${row.title} ${row.reference ?? ""} ${row.details}`
            .toLowerCase()
            .includes(query.toLowerCase());
        return matchesFilter && matchesQuery;
      })
      .sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() -
          new Date(a.occurredAt).getTime(),
      );
  }, [data, filter, query]);

  const categoryTotals = useMemo(
    () => {
      const totals = new Map<
        string,
        { type: FinanceEntryCategory; currency: string; amount: number }
      >();
      for (const entry of data.entries) {
        const key = `${entry.type}:${entry.currency}`;
        const total = totals.get(key);
        if (total) total.amount += entry.amount;
        else {
          totals.set(key, {
            type: entry.type,
            currency: entry.currency,
            amount: entry.amount,
          });
        }
      }
      return [...totals.values()].sort(
        (a, b) =>
          FINANCE_ENTRY_CATEGORIES.indexOf(a.type) -
            FINANCE_ENTRY_CATEGORIES.indexOf(b.type) ||
          a.currency.localeCompare(b.currency),
      );
    },
    [data.entries],
  );
  const largestByCurrency = new Map<string, number>();
  for (const category of categoryTotals) {
    largestByCurrency.set(
      category.currency,
      Math.max(
        largestByCurrency.get(category.currency) ?? 0,
        category.amount,
      ),
    );
  }

  function openNewEntry() {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setFormOpen(true);
  }

  function openEditEntry(entry: FinanceEntryRecord) {
    setEditing(entry);
    setForm({
      type: entry.type,
      description: entry.description,
      amount: String(entry.amount),
      currency:
        entry.currency === "USD" || entry.currency === "GBP"
          ? entry.currency
          : "NGN",
      occurredAt: makeDateValue(new Date(entry.occurredAt)),
      source: entry.source ?? "",
      adType: entry.adType ?? "",
      campaignName: entry.campaignName ?? "",
      conversions: String(entry.conversions ?? 0),
      attributedRevenue:
        entry.attributedRevenue === null
          ? ""
          : String(entry.attributedRevenue),
    });
    setFormError(null);
    setFormOpen(true);
  }

  function updateForm<K extends keyof EntryForm>(key: K, value: EntryForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const payload = {
      type: form.type,
      description: form.description,
      amount: Number(form.amount),
      currency: form.currency,
      occurredAt: new Date(`${form.occurredAt}T12:00:00`).toISOString(),
      source: form.source,
      adType: form.type === "AD_SPEND" ? form.adType : "",
      campaignName: form.type === "AD_SPEND" ? form.campaignName : "",
      conversions:
        form.type === "AD_SPEND" ? Number(form.conversions) : null,
      attributedRevenue:
        form.type === "AD_SPEND" && form.attributedRevenue
          ? Number(form.attributedRevenue)
          : null,
    };

    try {
      const response = await fetch(
        editing
          ? `/api/admin/finance/${encodeURIComponent(editing.id)}`
          : "/api/admin/finance",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) throw new Error(await readError(response));
      setFormOpen(false);
      setRefreshKey((current) => current + 1);
    } catch (saveError) {
      setFormError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save this record.",
      );
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const csvRows = [
      ["Date", "Record", "Type", "Reference", "Amount", "Currency", "Details"],
      ...rows.map((row) => [
        row.occurredAt,
        row.title,
        row.kind === "EXPENSE"
          ? row.entry
            ? FINANCE_ENTRY_LABELS[row.entry.type]
            : "Expense"
          : row.details,
        row.reference ?? "",
        row.amount,
        row.currency,
        row.details,
      ]),
    ];
    const csv = csvRows
      .map((line) =>
        line
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "grouh-academy-finance.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const filters: Array<{ value: Filter; label: string; count: number }> = [
    { value: "ALL", label: "All records", count: rows.length },
    {
      value: "STUDENT_INCOME",
      label: "Student income",
      count: studentIncome.length,
    },
    {
      value: "INTERNSHIP_REVENUE",
      label: "Internship revenue",
      count: internshipIncome.length,
    },
    {
      value: "EXPENSES",
      label: "Expenses & allocations",
      count: data.entries.length,
    },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#5FBB46]">
            SabiRole · Financial overview
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1C1D52] sm:text-3xl">
            Finance &amp; inventory
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Follow paid learner revenue, operating costs, savings, and
            investment activity in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={!rows.length}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#1C1D52] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={openNewEntry}
            className="inline-flex items-center gap-2 rounded-xl bg-[#5FBB46] px-4 py-2.5 text-sm font-semibold text-[#102314] shadow-sm transition hover:bg-[#51a63b]"
          >
            <Plus className="h-4 w-4" />
            Add record
          </button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setRefreshKey((current) => current + 1)}
            className="font-semibold underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={ArrowUpRight}
          label="Student learning"
          value={formatBreakdown(
            studentIncome.map(({ amount, currency }) => ({ amount, currency })),
          )}
          detail={`${studentIncome.length} paid course payment${studentIncome.length === 1 ? "" : "s"}`}
          tone="green"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Internship revenue"
          value={formatBreakdown(
            internshipIncome.map(({ amount, currency }) => ({
              amount,
              currency,
            })),
          )}
          detail={`${internshipIncome.length} paid internship payment${internshipIncome.length === 1 ? "" : "s"}`}
          tone="blue"
        />
        <SummaryCard
          icon={ArrowDownRight}
          label="Operating spend"
          value={formatBreakdown(
            operatingEntries.map(({ amount, currency }) => ({
              amount,
              currency,
            })),
          )}
          detail="Ads, staff, subscriptions & other expenses"
          tone="amber"
        />
        <SummaryCard
          icon={PiggyBank}
          label="Business savings"
          value={formatBreakdown(
            savingsEntries.map(({ amount, currency }) => ({
              amount,
              currency,
            })),
          )}
          detail={`${savingsEntries.length} savings allocation${savingsEntries.length === 1 ? "" : "s"}`}
          tone="purple"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[24px] bg-[#1C1D52] p-5 text-white shadow-[0_12px_35px_rgba(28,29,82,0.14)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">
                After recorded allocations
              </p>
              <h2 className="mt-2 text-lg font-semibold">Tracked cash position</h2>
            </div>
            <span className="rounded-xl bg-white/10 p-2.5 text-[#9de386]">
              <WalletCards className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
            {formatBreakdown(
              [...studentIncome, ...internshipIncome].reduce<
                Array<{ amount: number; currency: string }>
              >((totals, income) => {
                const existing = totals.find(
                  (item) => item.currency === income.currency,
                );
                if (existing) existing.amount += income.amount;
                else totals.push({ amount: income.amount, currency: income.currency });
                return totals;
              }, []).map(({ amount, currency }) => {
                const allocated = data.entries
                  .filter((entry) => entry.currency === currency)
                  .reduce((sum, entry) => sum + entry.amount, 0);
                return { amount: amount - allocated, currency };
              }),
            )}
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/65">
            <span>
              Paid income:{" "}
              <strong className="font-semibold text-white">
                {formatBreakdown(
                  [...studentIncome, ...internshipIncome].map(
                    ({ amount, currency }) => ({ amount, currency }),
                  ),
                )}
              </strong>
            </span>
            <span>
              Capital deployed:{" "}
              <strong className="font-semibold text-white">
                {formatBreakdown(
                  capitalEntries.map(({ amount, currency }) => ({
                    amount,
                    currency,
                  })),
                )}
              </strong>
            </span>
          </div>
          <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-white/50">
            Based on confirmed paid transactions less recorded expenses,
            savings, and investments. Open balances and unrecorded funding are
            not included.
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_8px_25px_rgba(28,29,82,0.06)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Campaign performance
              </p>
              <h2 className="mt-2 text-lg font-semibold text-[#1C1D52]">
                Top converting ad
              </h2>
            </div>
            <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
              <Megaphone className="h-5 w-5" />
            </span>
          </div>
          {topCampaign ? (
            <>
              <p className="mt-5 truncate text-base font-semibold text-[#1C1D52]">
                {topCampaign.campaignName}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {topCampaign.adType} ·{" "}
                {formatMoney(topCampaign.amount, topCampaign.currency)} spent
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#f5f8fb] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Conversions
                  </p>
                  <p className="mt-1 text-xl font-semibold text-[#1C1D52]">
                    {topCampaign.conversions?.toLocaleString("en-NG") ?? 0}
                  </p>
                </div>
                <div className="rounded-xl bg-[#f5f8fb] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Attributed revenue
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#1C1D52]">
                    {topCampaign.attributedRevenue === null
                      ? "Not tracked"
                      : formatMoney(
                          topCampaign.attributedRevenue,
                          topCampaign.currency,
                        )}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-5 rounded-xl bg-[#f5f8fb] p-4 text-sm leading-6 text-slate-500">
              Add an ad-spend record with its campaign name and conversion
              count to see your best-performing ad here.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_8px_25px_rgba(28,29,82,0.06)] sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[#1C1D52]">Cash allocations</h2>
              <p className="mt-1 text-xs text-slate-500">
                Recorded outflows by category
              </p>
            </div>
            <Building2 className="h-5 w-5 text-slate-400" />
          </div>
          {categoryTotals.length ? (
            <ul className="space-y-4">
              {categoryTotals.map(({ type, amount, currency }) => {
                const Icon = categoryIcons[type];
                const percent = Math.max(
                  4,
                  Math.round(
                    (amount / (largestByCurrency.get(currency) || 1)) * 100,
                  ),
                );
                const hasMultipleCurrencies = categoryTotals.some(
                  (item) => item.type === type && item.currency !== currency,
                );
                return (
                  <li key={`${type}-${currency}`}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                      <span className="flex min-w-0 items-center gap-2 font-medium text-slate-600">
                        <Icon className="h-4 w-4 shrink-0 text-[#5FBB46]" />
                        <span className="truncate">
                          {FINANCE_ENTRY_LABELS[type]}
                          {hasMultipleCurrencies ? ` · ${currency}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold text-[#1C1D52]">
                        {formatMoney(amount, currency)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#5FBB46]"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-xl bg-[#f5f8fb] p-4 text-sm text-slate-500">
              No costs or allocations have been recorded yet.
            </p>
          )}
        </div>

        <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_8px_25px_rgba(28,29,82,0.06)] sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[#1C1D52]">
                Recent financial activity
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Revenue is read from paid transactions; other records are
                entered by an administrator.
              </p>
            </div>
            <Receipt className="h-5 w-5 shrink-0 text-slate-400" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniMetric
              label="Capital invested"
              value={formatBreakdown(
                capitalEntries.map(({ amount, currency }) => ({
                  amount,
                  currency,
                })),
              )}
              detail={`${capitalEntries.length} recorded investment${capitalEntries.length === 1 ? "" : "s"}`}
            />
            <MiniMetric
              label="Expenses & allocations"
              value={formatBreakdown(
                data.entries.map(({ amount, currency }) => ({
                  amount,
                  currency,
                })),
              )}
              detail={`${data.entries.length} admin-managed record${data.entries.length === 1 ? "" : "s"}`}
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-[0_8px_25px_rgba(28,29,82,0.06)]">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter records">
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                    filter === item.value
                      ? "bg-[#1C1D52] text-white"
                      : "bg-[#f3f6fb] text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {item.label}
                  <span className="ml-1.5 opacity-70">{item.count}</span>
                </button>
              ))}
            </div>
            <label className="flex min-w-[220px] items-center gap-2 rounded-xl bg-[#f3f6fb] px-3 py-2.5 text-xs text-slate-500">
              <Search className="h-4 w-4" />
              <span className="sr-only">Search records</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search records"
                className="w-full bg-transparent text-[#1C1D52] outline-none placeholder:text-slate-400"
              />
            </label>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Loading financial records…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-[#f7f9fc] text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Record</th>
                  <th className="px-5 py-3">Type / source</th>
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                      {formatDate(row.occurredAt)}
                    </td>
                    <td className="max-w-[280px] px-5 py-4">
                      <p className="truncate font-semibold text-[#1C1D52]">
                        {row.title}
                      </p>
                      <span
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          row.kind === "EXPENSE"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {row.kind === "EXPENSE"
                          ? "Outflow"
                          : row.kind === "STUDENT_INCOME"
                            ? "Student income"
                            : "Internship revenue"}
                      </span>
                    </td>
                    <td className="max-w-[240px] truncate px-5 py-4 text-xs text-slate-500">
                      {row.details || "—"}
                    </td>
                    <td className="px-5 py-4 font-mono text-[11px] text-slate-500">
                      {row.reference ?? "—"}
                    </td>
                    <td
                      className={`whitespace-nowrap px-5 py-4 text-right font-semibold ${
                        row.kind === "EXPENSE"
                          ? "text-slate-700"
                          : "text-emerald-700"
                      }`}
                    >
                      {row.kind === "EXPENSE" ? "−" : "+"}
                      {formatMoney(row.amount, row.currency)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {row.entry ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (row.entry) openEditEntry(row.entry);
                          }}
                          aria-label={`Edit ${row.title}`}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-[#f3f6fb] hover:text-[#1C1D52]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">Verified</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      {error
                        ? "Records could not be loaded."
                        : "No records match this filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#11152f]/60 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-form-title"
            className="my-auto w-full max-w-2xl rounded-[24px] bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#5FBB46]">
                  Finance record
                </p>
                <h2
                  id="finance-form-title"
                  className="mt-1 text-xl font-semibold text-[#1C1D52]"
                >
                  {editing ? "Update record" : "Add a record"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label="Close form"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitEntry} className="space-y-4 p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Record type">
                  <select
                    value={form.type}
                    onChange={(event) =>
                      updateForm(
                        "type",
                        event.target.value as FinanceEntryCategory,
                      )
                    }
                    className={inputClass}
                  >
                    {FINANCE_ENTRY_CATEGORIES.map((type) => (
                      <option key={type} value={type}>
                        {FINANCE_ENTRY_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Date">
                  <input
                    type="date"
                    required={
                      form.type === "CAPITAL_INVESTMENT" ||
                      form.type === "STAFF_PAYMENT"
                    }
                    value={form.occurredAt}
                    onChange={(event) =>
                      updateForm("occurredAt", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Description">
                  <input
                    required
                    maxLength={160}
                    value={form.description}
                    onChange={(event) =>
                      updateForm("description", event.target.value)
                    }
                    placeholder="e.g. May social media promotion"
                    className={inputClass}
                  />
                </Field>
                <div className="grid grid-cols-[1fr_110px] gap-2">
                  <Field label="Amount">
                    <input
                      type="number"
                      required
                      min={1}
                      step={1}
                      value={form.amount}
                      onChange={(event) =>
                        updateForm("amount", event.target.value)
                      }
                      placeholder="0"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Currency">
                    <select
                      value={form.currency}
                      onChange={(event) =>
                        updateForm(
                          "currency",
                          event.target.value as EntryForm["currency"],
                        )
                      }
                      className={inputClass}
                    >
                      <option value="NGN">NGN</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </Field>
                </div>
                <Field
                  label={
                    form.type === "CAPITAL_INVESTMENT"
                      ? "Source of capital"
                      : form.type === "STAFF_PAYMENT"
                        ? "Payee / source"
                        : "Source or reference"
                  }
                >
                  <input
                    maxLength={160}
                    value={form.source}
                    onChange={(event) => updateForm("source", event.target.value)}
                    placeholder={
                      form.type === "CAPITAL_INVESTMENT"
                        ? "e.g. founder contribution, angel investor"
                        : "Optional"
                    }
                    className={inputClass}
                  />
                </Field>
              </div>

              {form.type === "AD_SPEND" && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <p className="mb-3 text-sm font-semibold text-[#1C1D52]">
                    Campaign performance
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Type of ad">
                      <input
                        required
                        maxLength={80}
                        value={form.adType}
                        onChange={(event) =>
                          updateForm("adType", event.target.value)
                        }
                        placeholder="e.g. Instagram sponsored post"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Campaign or ad name">
                      <input
                        required
                        maxLength={120}
                        value={form.campaignName}
                        onChange={(event) =>
                          updateForm("campaignName", event.target.value)
                        }
                        placeholder="e.g. October course launch"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Conversions">
                      <input
                        type="number"
                        required
                        min={0}
                        step={1}
                        value={form.conversions}
                        onChange={(event) =>
                          updateForm("conversions", event.target.value)
                        }
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Revenue attributed (optional)">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={form.attributedRevenue}
                        onChange={(event) =>
                          updateForm("attributedRevenue", event.target.value)
                        }
                        placeholder="0"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </div>
              )}

              {formError && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {formError}
                </p>
              )}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#5FBB46] px-5 py-2.5 text-sm font-semibold text-[#102314] disabled:cursor-wait disabled:opacity-60"
                >
                  {saving ? "Saving…" : editing ? "Save changes" : "Save record"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#1C1D52] outline-none transition focus:border-[#5FBB46] focus:ring-2 focus:ring-[#5FBB46]/15";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0 space-y-1.5 text-xs font-semibold text-slate-600">
      {label}
      {children}
    </label>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof ArrowUpRight;
  label: string;
  value: string;
  detail: string;
  tone: "green" | "blue" | "amber" | "purple";
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    purple: "bg-violet-50 text-violet-700",
  };
  return (
    <div className="rounded-[20px] border border-slate-100 bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.05)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <span className={`rounded-xl p-2 ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 break-words text-xl font-semibold tracking-tight text-[#1C1D52] sm:text-2xl">
        {value}
      </p>
      <p className="mt-2 text-[11px] leading-4 text-slate-400">{detail}</p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl bg-[#f5f8fb] p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold text-[#1C1D52]">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-slate-400">{detail}</p>
    </div>
  );
}

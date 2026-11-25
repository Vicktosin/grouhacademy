"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import DeleteAccountButton from "@/components/admin/DeleteAccountButton";

type Account = {
  id: string;
  name: string | null;
  email: string;
  registered: string;
  lastSeen: string | null;
  loginMissing: boolean;
  paid: boolean;
  tracks: string | null;
};

const FILTERS = [
  { value: "dormant", label: "Dormant" },
  { value: "missing", label: "Sign-in missing" },
  { value: "all", label: "All" },
] as const;

const HELP: Record<string, string> = {
  dormant: "Never paid, and not seen for 60 days or more.",
  missing: "Their sign-in was deleted but their records were left behind. Delete the records here too, or leave them: they get this account back if they sign in again.",
  all: "Every intern and student account, longest unseen first.",
};

const date = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;

export default function LearnerAccountsPage() {
  const [filter, setFilter] = useState<string>("dormant");
  const [query, setQuery] = useState("");
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/internship/accounts?${new URLSearchParams({ filter, q: query })}`, {
      cache: "no-store",
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (!response?.ok) {
      setError(body?.error ?? "Couldn't load accounts.");
      return;
    }
    setError(null);
    setAccounts(body.accounts);
  }, [filter, query]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[1100px] space-y-5">
        <header>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">Internship operations</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#1C1D52] sm:text-3xl">Accounts</h1>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Find people who are no longer active and permanently delete their account. Always delete here, not in
            Supabase: this removes the sign-in and the records together.
          </p>
        </header>

        <section className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={filter === item.value}
                  onClick={() => {
                    setFilter(item.value);
                    setAccounts(null);
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${filter === item.value ? "bg-[#1C1D52] text-white" : "bg-[#f3f6fb] text-[#1C1D52]"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="flex w-full items-center gap-2 rounded-lg bg-[#f3f6fb] px-3 py-2.5 text-slate-400 sm:max-w-[300px]">
              <Search className="h-4 w-4 shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or email"
                aria-label="Search by name or email"
                className="w-full bg-transparent text-sm text-[#1C1D52] outline-none placeholder:text-slate-400"
              />
            </label>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">{HELP[filter]}</p>

          {notice && (
            <p className="mt-3 rounded-lg bg-[#e8f7eb] px-3 py-2.5 text-xs font-semibold text-[#397d3a]" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700" role="alert">
              {error}
            </p>
          )}
          {!accounts && !error && <p className="mt-4 text-xs text-slate-500">Loading accounts...</p>}
          {accounts?.length === 0 && <p className="mt-4 text-xs text-slate-500">No accounts here.</p>}

          <ul className="mt-2 divide-y divide-slate-100">
            {accounts?.map((account) => (
              <li key={account.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-xs text-slate-500">
                  <p className="text-sm font-bold text-[#1C1D52]">
                    {account.name ?? "Unnamed"}
                    {account.loginMissing && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        Sign-in missing
                      </span>
                    )}
                    {account.paid && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        Paid
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 break-all">{account.email}</p>
                  <p className="mt-0.5">
                    {account.tracks ?? "No track chosen"}. Registered {date(account.registered)}.{" "}
                    {account.lastSeen ? `Last seen ${date(account.lastSeen)}.` : "Never seen since."}
                  </p>
                </div>
                <div className="shrink-0">
                  <DeleteAccountButton
                    userId={account.id}
                    name={account.name ?? account.email}
                    onDeleted={() => {
                      setNotice(`${account.name ?? account.email} was permanently deleted.`);
                      void load();
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
          {accounts?.length === 100 && (
            <p className="mt-2 text-xs text-slate-500">Showing the first 100. Search to find someone else.</p>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

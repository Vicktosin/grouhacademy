"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AffiliateDashboard } from "@/lib/affiliates";

// The affiliate app's data (app/api/affiliate/dashboard), shared by its pages.
// Signed-out visitors are sent to the affiliate sign-in.

export type AffiliateState =
  | { state: "not_eligible"; me: Me }
  | { state: "not_joined"; me: Me; terms: { commissionPercent: number; payoutMinimum: number } }
  | { state: "joined"; me: Me; dashboard: AffiliateDashboard };
type Me = { firstName: string; email: string };

export const formatNaira = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function useAffiliate() {
  const router = useRouter();
  const [data, setData] = useState<AffiliateState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const response = await fetch("/api/affiliate/dashboard", { cache: "no-store" }).catch(() => null);
    if (response?.status === 401) {
      router.replace("/affiliate/login");
      return;
    }
    const body = await response?.json().catch(() => null);
    if (!response?.ok || !body) {
      setError(body?.error ?? "Unable to load the Affiliate Program. Please try again.");
      return;
    }
    setError(null);
    setData(body as AffiliateState);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads once; state is set after the request
    void reload();
  }, [reload]);

  return { data, error, reload };
}

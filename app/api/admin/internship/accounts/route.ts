import { NextResponse } from "next/server";
import { listLearnerAccounts, type AccountFilter } from "@/lib/account-deletion";
import { requireAdminApi } from "@/lib/api-guards";

const FILTERS: AccountFilter[] = ["all", "missing", "dormant"];

export async function GET(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const params = new URL(request.url).searchParams;
  const filter = FILTERS.find((item) => item === params.get("filter")) ?? "all";
  const accounts = await listLearnerAccounts(filter, params.get("q")?.slice(0, 100) ?? "");
  return NextResponse.json({ accounts });
}

import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/route-guards";
import { getAuthorizedHomeRouteForUserId } from "@/lib/supabase/auth";

// Where the installed app (PWA) opens: a signed-in person goes straight to
// their own workspace, everyone else to login. ?moved=1 (from the old
// domain, see lib/domain-move.ts) is passed on so the move notice shows.
export const dynamic = "force-dynamic";

export default async function AppStartPage({
  searchParams,
}: {
  searchParams: Promise<{ moved?: string }>;
}) {
  const moved = (await searchParams).moved === "1" ? "?moved=1" : "";
  const userId = await getCurrentUserId();
  if (!userId) redirect(`/login${moved}`);
  redirect(`${await getAuthorizedHomeRouteForUserId(userId)}${moved}`);
}

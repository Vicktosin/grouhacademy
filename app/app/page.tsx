import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/route-guards";
import { getAuthorizedHomeRouteForUserId } from "@/lib/supabase/auth";

// Where the installed app (PWA) opens: a signed-in person goes straight to
// their own workspace, everyone else to login.
export const dynamic = "force-dynamic";

export default async function AppStartPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  redirect(await getAuthorizedHomeRouteForUserId(userId));
}

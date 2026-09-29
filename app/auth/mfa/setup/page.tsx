import FlowExitBar from "@/components/FlowExitBar";
import MfaSettings from "@/components/MfaSettings";
import { getCurrentUserId } from "@/lib/route-guards";
import { getAuthorizedHomeRouteForUserId } from "@/lib/supabase/auth";
import Image from "next/image";

export default async function MfaSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ recovered?: string }>;
}) {
  const { recovered } = await searchParams;
  const userId = await getCurrentUserId();
  const backHref = userId
    ? await getAuthorizedHomeRouteForUserId(userId)
    : "/login";

  return (
    <main className="min-h-screen bg-slate-100 pb-12">
      <FlowExitBar
        backHref={backHref}
        backLabel={userId ? "Back to dashboard" : "Back to login"}
        showSignOut={Boolean(userId)}
      />
      <section className="mx-4 max-w-2xl rounded-2xl sm:mx-auto bg-white p-6 shadow-xl sm:p-8">
        <Image
          src="/logo.png"
          alt="Grouh Academy logo"
          width={160}
          height={40}
          className="h-10 w-auto"
        />
        <h1 className="mt-8 text-3xl font-bold text-[#1c1d52]">
          Account security
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Set up Google Authenticator to add a second verification step to your
          account.
        </p>
        {recovered === "1" && (
          <p
            role="status"
            className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-[#397d3a]"
          >
            Your backup code worked and your old authenticator was removed.
            Set up Google Authenticator on your new phone to protect your
            account again.
          </p>
        )}
        <MfaSettings />
      </section>
    </main>
  );
}

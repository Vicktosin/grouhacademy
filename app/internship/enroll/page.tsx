import { ArrowRight, ClipboardList } from "lucide-react";
import Link from "next/link";

export default function InternshipEnrollPage() {
  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-[28px] bg-white shadow-[0_20px_60px_rgba(28,29,82,0.12)]">
      <div className="bg-[#1C1D52] px-6 py-9 text-white sm:px-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9be28a]">
          Internship application
        </p>
        <h1 className="mt-3 text-3xl font-bold">
          Start with your entrance assessment.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
          Choose a track, tell us about your experience, and take the entrance
          assessment at no cost. You will see your score immediately.
        </p>
      </div>
      <div className="p-6 sm:p-10">
        <div className="flex gap-3 rounded-2xl bg-[#f8fbff] p-5">
          <ClipboardList className="h-6 w-6 shrink-0 text-[#5FBB46]" />
          <div>
            <h2 className="text-sm font-bold text-[#1C1D52]">
              Acceptance fee only after you pass
            </h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Paystack payment is not available before the assessment.
              Successful applicants are shown their score and then invited to
              pay the one-time acceptance fee.
            </p>
          </div>
        </div>
        <Link
          href="/internship/onboarding"
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5FBB46] px-5 py-3.5 text-sm font-bold text-[#14204f]"
        >
          Begin application <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

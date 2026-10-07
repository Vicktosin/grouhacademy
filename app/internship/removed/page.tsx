import { UserX } from "lucide-react";
import Link from "next/link";

// Where an intern lands when an admin has taken them out of the internship
// (see lib/admin-intern-control.ts). Their work is kept; an admin can
// restore their access.

export const metadata = { title: "Internship access removed" };

export default function InternshipRemovedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f8fb] px-4 py-10">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
          <UserX className="h-6 w-6 text-amber-600" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-[#1C1D52]">
          Your internship access has been removed
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          An administrator has taken you out of the internship, so your
          dashboard is closed for now. Your payment, assessment and work are
          kept safe.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          If you think this is a mistake, please contact the Grouh Academy
          team and they can restore your access.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg bg-[#1C1D52] px-5 py-2.5 text-xs font-bold text-white"
        >
          Back to home
        </Link>
      </section>
    </main>
  );
}

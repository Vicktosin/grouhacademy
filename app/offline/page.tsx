import Link from 'next/link'

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fbff] px-6">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-[0_16px_45px_rgba(28,29,82,0.12)]">
        <img src="/icons/icon-192.png" alt="Grouh Academy" className="mx-auto h-20 w-20 rounded-2xl" />
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-[#5FBB46]">You&apos;re offline</p>
        <h1 className="mt-2 text-2xl font-bold text-[#1C1D52]">Check your connection</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">Grouh Academy needs an internet connection to load the latest learning content and account information.</p>
        <Link href="/" className="mt-7 inline-flex rounded-lg bg-[#5FBB46] px-5 py-3 text-sm font-bold text-[#14204f]">Try again</Link>
      </section>
    </main>
  )
}

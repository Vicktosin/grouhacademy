'use client'

import { ArrowLeft, Download } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type Payment = { id: string; reference: string; invoice: string; student: string; email: string; track: string; amountLabel: string; status: string; method: string; date: string; createdDate: string; paidDate: string; cohort: string }

export default function InternshipPaymentDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [payment, setPayment] = useState<Payment | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/internship/payments/${slug}/details`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load payment.')
        setPayment(data.payment)
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load payment.'))
  }, [slug])

  return <div className="mx-auto max-w-[1100px] space-y-5 p-6"><Link href="/admin/internship/payments" className="inline-flex items-center gap-2 text-xs font-semibold text-[#1C1D52] hover:text-blue-600"><ArrowLeft className="h-4 w-4" />Back to payments</Link>{error ? <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : !payment ? <p className="rounded-xl bg-white p-6 text-sm text-slate-500">Loading payment…</p> : <section className="rounded-[28px] bg-white p-6 shadow-[0_10px_30px_rgba(28,29,82,0.08)]"><div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5FBB46]">Payment detail</p><h1 className="mt-1 text-2xl font-semibold text-[#1C1D52]">{payment.reference}</h1></div><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-3 py-2 text-[10px] font-semibold text-[#14204f]"><Download className="h-3.5 w-3.5" />Download receipt</button></div><div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><div className="rounded-[24px] bg-[#f8fbff] p-5"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Student</p><p className="mt-4 text-2xl font-bold text-[#1C1D52]">{payment.student}</p><p className="mt-1 text-xs text-slate-500">{payment.email}</p><div className="mt-5 space-y-3"><Row label="Track" value={payment.track} /><Row label="Amount" value={payment.amountLabel} /><Row label="Method" value={payment.method} /><Row label="Cohort" value={payment.cohort} /></div></div><div className="rounded-[24px] border border-slate-200 bg-white p-5"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Summary</p><div className="mt-4 space-y-3 text-sm"><Row label="Reference" value={payment.reference} /><Row label="Payment date" value={payment.date} /><Row label="Status" value={payment.status} /></div></div></div></section>}</div>
}

function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 rounded-xl bg-white p-3.5"><span className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{label}</span><span className="text-right text-sm font-semibold text-[#1C1D52]">{value}</span></div> }

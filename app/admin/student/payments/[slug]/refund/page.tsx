'use client'

import { AlertTriangle, ArrowLeft, Download, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type Payment = { reference: string; student: string; email: string; item: string; amount: number; currency: string; provider: string; status: string; dateLabel: string }
const money = (amount: number, currency: string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)

export default function StudentPaymentRefundPage() {
  const { slug } = useParams<{ slug: string }>()
  const [payment, setPayment] = useState<Payment | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { fetch(`/api/admin/student/payments/${slug}`, { cache: 'no-store' }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to load payment.'); setPayment(data.payment) }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load payment.')) }, [slug])
  const download = () => { if (!payment) return; const csv = [['Reference', payment.reference], ['Learner', payment.student], ['Item', payment.item], ['Amount', money(payment.amount, payment.currency)], ['Status', payment.status], ['Date', payment.dateLabel]].map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')).join('\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = `${payment.reference}-refund-summary.csv`; link.click(); URL.revokeObjectURL(url) }
  return <div className="mx-auto max-w-[850px] space-y-5 p-6"><Link href="/admin/student/payments" className="inline-flex items-center gap-2 text-xs font-semibold text-[#1C1D52]"><ArrowLeft className="h-4 w-4" />Back to payments</Link>{error ? <p className="rounded-xl bg-red-50 p-5 text-sm text-red-700">{error}</p> : !payment ? <p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading payment…</p> : <section className="rounded-3xl bg-white p-6 shadow-[0_10px_30px_rgba(28,29,82,0.08)]"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">Refund review</p><h1 className="mt-1 text-2xl font-semibold text-[#1C1D52]">{payment.reference}</h1></div><button type="button" onClick={download} className="inline-flex items-center gap-2 rounded-lg bg-[#f3f6fb] px-3 py-2 text-xs font-semibold text-[#1C1D52]"><Download className="h-3.5 w-3.5" />Export summary</button></header><div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800"><AlertTriangle className="mr-2 inline h-4 w-4" />Refund processing is not connected to a provider action yet; this view reflects the live payment record.</div><div className="mt-5 space-y-3">{[['Learner', `${payment.student} · ${payment.email}`], ['Item', payment.item], ['Amount', money(payment.amount, payment.currency)], ['Provider', payment.provider], ['Payment status', payment.status], ['Date', payment.dateLabel]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 rounded-xl bg-[#f8fbff] p-4"><span className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{label}</span><span className="text-right text-sm font-semibold text-[#1C1D52]">{value}</span></div>)}</div></section>}</div>
}

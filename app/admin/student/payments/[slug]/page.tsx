'use client'

import { ArrowLeft, CalendarDays, Download, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import type React from 'react'

type Payment = { id: string; reference: string; invoice: string; student: string; email: string; item: string; amount: number; currency: string; provider: string; status: string; dateLabel: string }
const money = (amount: number, currency: string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)

export default function StudentPaymentDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [payment, setPayment] = useState<Payment | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { fetch(`/api/admin/student/payments/${slug}`, { cache: 'no-store' }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to load payment.'); setPayment(data.payment) }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load payment.')) }, [slug])
  const download = () => { if (!payment) return; const rows = [['Reference', payment.reference], ['Learner', payment.student], ['Email', payment.email], ['Item', payment.item], ['Amount', money(payment.amount, payment.currency)], ['Provider', payment.provider], ['Status', payment.status], ['Date', payment.dateLabel]]; const csv = rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')).join('\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = `${payment.reference}-payment.csv`; link.click(); URL.revokeObjectURL(url) }
  return <div className="mx-auto max-w-[1000px] space-y-5 p-6"><Link href="/admin/student/payments" className="inline-flex items-center gap-2 text-xs font-semibold text-[#1C1D52]"><ArrowLeft className="h-4 w-4" />Back to payments</Link>{error ? <p className="rounded-xl bg-red-50 p-5 text-sm text-red-700">{error}</p> : !payment ? <p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading payment…</p> : <section className="rounded-3xl bg-white p-6 shadow-[0_10px_30px_rgba(28,29,82,0.08)]"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">Transaction detail</p><h1 className="mt-1 text-2xl font-semibold text-[#1C1D52]">{payment.reference}</h1></div><button type="button" onClick={download} className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-3 py-2 text-xs font-semibold text-[#14204f]"><Download className="h-3.5 w-3.5" />Download summary</button></header><div className="mt-6 grid gap-4 sm:grid-cols-2"><Info label="Learner" value={`${payment.student} · ${payment.email}`} /><Info label="Item" value={payment.item} /><Info label="Amount" value={money(payment.amount, payment.currency)} /><Info label="Provider" value={payment.provider} /><Info label="Status" value={payment.status} /><Info label="Date" value={payment.dateLabel} icon={<CalendarDays className="h-4 w-4" />} /></div></section>}</div>
}
function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) { return <div className="rounded-xl bg-[#f8fbff] p-4"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[#1C1D52]">{icon}{value}</p></div> }

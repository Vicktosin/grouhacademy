'use client'

import { Edit3, Plus, Power, Trash2, X } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import AdminShell from '@/components/AdminShell'

type Status = 'DRAFT' | 'PUBLISHED' | 'DISABLED'
type Track = { id: string; name: string; duration: string; price: number; acceptanceFee: number; description: string; features: string[]; requirements: string[]; certificateEligibility: string; companyPlacement: boolean; mentorAvailability: boolean; communityAvailability: boolean; status: Status; inUse: boolean; _count: Record<string, number> }
type Draft = Omit<Track, 'id' | 'inUse' | '_count'>

const emptyDraft: Draft = { name: '', duration: '', price: 0, acceptanceFee: 0, description: '', features: [], requirements: [], certificateEligibility: '', companyPlacement: false, mentorAvailability: false, communityAvailability: false, status: 'DRAFT' }
const statusStyle: Record<Status, string> = { PUBLISHED: 'bg-emerald-100 text-emerald-700', DRAFT: 'bg-amber-100 text-amber-700', DISABLED: 'bg-slate-200 text-slate-600' }

function listValue(items: string[]) { return items.join('\n') }
function listFrom(value: string) { return value.split('\n').map((item) => item.trim()).filter(Boolean) }

export default function InternshipTracksPage() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadTracks() {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/internship/tracks', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to load tracks.')
      setTracks(data.tracks)
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to load tracks.') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetch('/api/admin/internship/tracks', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load tracks.')
        return data.tracks as Track[]
      })
      .then(setTracks)
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'Unable to load tracks.'))
      .finally(() => setLoading(false))
  }, [])

  function startCreate() { setDraft(emptyDraft); setEditingId(null); setError(''); setOpen(true) }
  function startEdit(track: Track) { setDraft({ name: track.name, duration: track.duration, price: track.price, acceptanceFee: track.acceptanceFee, description: track.description, features: track.features, requirements: track.requirements, certificateEligibility: track.certificateEligibility, companyPlacement: track.companyPlacement, mentorAvailability: track.mentorAvailability, communityAvailability: track.communityAvailability, status: track.status }); setEditingId(track.id); setError(''); setOpen(true) }
  function closeForm() { if (!saving) setOpen(false) }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/admin/internship/tracks', { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, id: editingId ?? undefined }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to save track.')
      setOpen(false); setMessage(editingId ? 'Track updated.' : 'Track created.'); await loadTracks()
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to save track.') }
    finally { setSaving(false) }
  }

  async function setStatus(track: Track) {
    const status: Status = track.status === 'PUBLISHED' ? 'DISABLED' : 'PUBLISHED'
    setError(''); setMessage('')
    try {
      const response = await fetch('/api/admin/internship/tracks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...track, status }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to change track status.')
      setMessage(status === 'PUBLISHED' ? 'Track published.' : 'Track unpublished.'); await loadTracks()
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to change track status.') }
  }

  async function remove(track: Track) {
    if (!window.confirm(`Remove “${track.name}”? This cannot be undone.`)) return
    setError(''); setMessage('')
    try {
      const response = await fetch('/api/admin/internship/tracks', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: track.id }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to remove track.')
      setMessage('Track removed.'); await loadTracks()
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to remove track.') }
  }

  return <AdminShell workspace="internship"><div className="mx-auto max-w-[1180px] space-y-5"><header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">Internship administration</p><h1 className="mt-2 text-2xl font-semibold text-[#1C1D52] sm:text-3xl">Tracks</h1><p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">Create and manage the internship tracks available to applicants, cohorts, tasks, and assessments.</p></div><button type="button" onClick={startCreate} className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-bold text-[#14204f]"><Plus className="h-4 w-4" />Add track</button></header>{message && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">{message}</p>}{error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{error}</p>}<section className="overflow-hidden rounded-2xl bg-white shadow-[0_7px_20px_rgba(28,29,82,0.08)]">{loading ? <p className="p-8 text-center text-xs text-slate-500">Loading tracks…</p> : tracks.length === 0 ? <div className="p-10 text-center"><p className="text-sm font-semibold text-[#1C1D52]">No internship tracks yet.</p><button type="button" onClick={startCreate} className="mt-4 text-xs font-bold text-[#397d3a]">Create the first track</button></div> : <div className="divide-y divide-slate-100">{tracks.map((track) => <article key={track.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-bold text-[#1C1D52]">{track.name}</h2><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${statusStyle[track.status]}`}>{track.status.toLowerCase()}</span>{track.inUse && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-semibold text-slate-500">In use</span>}</div><p className="mt-1 text-xs text-slate-500">{track.duration} · Acceptance fee ₦{track.acceptanceFee.toLocaleString()} · Programme fee ₦{track.price.toLocaleString()}</p><p className="mt-2 max-w-2xl text-[11px] leading-5 text-slate-500">{track.description}</p></div><div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => startEdit(track)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-[#1C1D52]"><Edit3 className="h-3.5 w-3.5" />Edit</button><button type="button" onClick={() => setStatus(track)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-[#1C1D52]"><Power className="h-3.5 w-3.5" />{track.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}</button><button type="button" disabled={track.inUse} title={track.inUse ? 'Unpublish tracks in use; they cannot be deleted.' : 'Remove track'} onClick={() => remove(track)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-[10px] font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" />Remove</button></div></article>)}</div>}</section>{open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#11132f]/60 p-4"><form onSubmit={save} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold text-[#1C1D52]">{editingId ? 'Edit track' : 'New track'}</h2><p className="mt-1 text-xs text-slate-500">Published tracks are available in the internship workflow.</p></div><button type="button" onClick={closeForm} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Track name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} /><Field label="Duration" value={draft.duration} onChange={(value) => setDraft({ ...draft, duration: value })} placeholder="e.g. 3 months" /><Field label="Programme fee (₦)" type="number" value={String(draft.price)} onChange={(value) => setDraft({ ...draft, price: Number(value) })} /><Field label="Acceptance fee (₦)" type="number" value={String(draft.acceptanceFee)} onChange={(value) => setDraft({ ...draft, acceptanceFee: Number(value) })} /><label className="text-[10px] font-semibold text-[#1C1D52] sm:col-span-2">Description<textarea required value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-[#5FBB46]" /></label><Field label="Certificate eligibility" value={draft.certificateEligibility} onChange={(value) => setDraft({ ...draft, certificateEligibility: value })} className="sm:col-span-2" /><label className="text-[10px] font-semibold text-[#1C1D52]">Features (one per line)<textarea value={listValue(draft.features)} onChange={(event) => setDraft({ ...draft, features: listFrom(event.target.value) })} rows={4} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-[#5FBB46]" /></label><label className="text-[10px] font-semibold text-[#1C1D52]">Requirements (one per line)<textarea value={listValue(draft.requirements)} onChange={(event) => setDraft({ ...draft, requirements: listFrom(event.target.value) })} rows={4} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-[#5FBB46]" /></label><label className="text-[10px] font-semibold text-[#1C1D52]">Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Status })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-normal outline-none focus:border-[#5FBB46]"><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="DISABLED">Unpublished</option></select></label><div className="flex flex-wrap content-end gap-x-4 gap-y-2 pb-1 text-[10px] text-[#1C1D52]">{([['companyPlacement', 'Company placement'], ['mentorAvailability', 'Mentor available'], ['communityAvailability', 'Community access']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })} className="accent-[#5FBB46]" />{label}</label>)}</div></div><div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={closeForm} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-[#1C1D52]">Cancel</button><button disabled={saving} className="rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-bold text-[#14204f] disabled:opacity-60">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create track'}</button></div></form></div>}</div></AdminShell>
}

function Field({ label, value, onChange, type = 'text', placeholder, className = '' }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; className?: string }) {
  return <label className={`text-[10px] font-semibold text-[#1C1D52] ${className}`}>{label}<input required type={type} min={type === 'number' ? 0 : undefined} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-normal outline-none focus:border-[#5FBB46]" /></label>
}

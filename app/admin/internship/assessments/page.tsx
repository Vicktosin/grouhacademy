'use client'

import { ChevronDown, PencilLine, Plus, Search, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import AdminShell from '@/components/AdminShell'

type QuestionRow = {
  id: string
  assessmentId: string
  assessmentTitle: string
  track: string
  prompt: string
  instructions: string
  options: Array<{ id: string; optionText: string }>
  correctOptionIndex: number
}

type AssessmentRow = {
  id: string
  title: string
  track: string
  questionCount: number
  passingScore: number
  instructions: string
}

export default function InternshipAssessmentsPage() {
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [assessments, setAssessments] = useState<AssessmentRow[]>([])
  const [track, setTrack] = useState('All')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/internship/assessments', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Assessment data request failed (${response.status}).`)
        const payload = (await response.json()) as { questions?: QuestionRow[]; assessments?: AssessmentRow[] }
        setQuestions(payload.questions ?? [])
        setAssessments(payload.assessments ?? [])
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Assessment data is unavailable.'))
      .finally(() => setLoading(false))
  }, [])

  const trackOptions = useMemo(() => ['All', ...new Set(assessments.map((assessment) => assessment.track))], [assessments])

  const visibleAssessments = useMemo(() => {
    const term = query.trim().toLowerCase()
    return assessments.filter((assessment) => {
      const matchesTrack = track === 'All' || assessment.track === track
      const assessmentQuestions = questions.filter((question) => question.assessmentId === assessment.id)
      const searchable = `${assessment.title} ${assessment.track} ${assessmentQuestions.map((question) => question.prompt).join(' ')}`.toLowerCase()
      return matchesTrack && (!term || searchable.includes(term))
    })
  }, [assessments, questions, query, track])

  async function handleDelete(question: QuestionRow) {
    try {
      const response = await fetch('/api/admin/internship/assessments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || 'Unable to delete this question.')
      }
      setQuestions((current) => current.filter((currentQuestion) => currentQuestion.id !== question.id))
      setAssessments((current) => current.map((assessment) => assessment.id === question.assessmentId ? { ...assessment, questionCount: Math.max(0, assessment.questionCount - 1) } : assessment))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this question.')
    }
  }

  async function handleDeleteEmptyAssessment(assessmentId: string) {
    setError(null)
    try {
      const response = await fetch('/api/admin/internship/assessments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || 'Unable to delete this assessment.')
      }
      setAssessments((current) => current.filter((assessment) => assessment.id !== assessmentId))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this assessment.')
    }
  }

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">Entrance exam</p>
            <h1 className="mt-2 text-2xl font-semibold text-[#1C1D52] sm:text-3xl">Existing exam questions</h1>
            <p className="mt-2 text-xs text-slate-500">Manage the objectivity-based questions used in the internship entrance exam.</p>
          </div>

          <Link href="/admin/internship/assessments/new" className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-semibold text-[#14204f] hover:bg-[#4aaa3e]">
            <Plus className="h-4 w-4" />
            Create Assessment
          </Link>
        </header>

        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700" role="alert">{error}</p>}

        <section className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-5">
          <div className="flex flex-col gap-3 py-4 xl:flex-row xl:items-center xl:justify-between">
            <label className="flex w-full max-w-[320px] items-center gap-2 rounded-lg bg-[#f3f6fb] px-3 py-2.5 text-xs text-slate-400">
              <Search className="h-3.5 w-3.5" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent outline-none placeholder:text-slate-400" placeholder="Search question or track" />
            </label>

            <FilterSelect label="Track" value={track} onChange={setTrack} options={trackOptions} />
          </div>

          {loading ? (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">Loading exam question bank…</p>
          ) : visibleAssessments.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">No assessments found for this track yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] border-collapse text-left text-[10px]">
                <thead>
                  <tr className="bg-[#f5f8fb] text-slate-600">
                    <th className="px-3 py-3 font-semibold">Assessment</th>
                    <th className="px-3 py-3 font-semibold">Track</th>
                    <th className="px-3 py-3 font-semibold">Passing score</th>
                    <th className="px-3 py-3 font-semibold">Questions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAssessments.map((assessment) => {
                    const assessmentQuestions = questions.filter((question) => question.assessmentId === assessment.id)
                    return <tr key={assessment.id} className="border-b border-slate-100 align-top text-[#1C1D52]">
                      <td className="px-3 py-3.5">
                        <p className="font-semibold text-[#1C1D52]">{assessment.title}</p>
                        {assessment.instructions ? <p className="mt-1 text-[9px] text-slate-500">{assessment.instructions}</p> : null}
                      </td>
                      <td className="px-3 py-3.5 text-slate-600">{assessment.track}</td>
                      <td className="px-3 py-3.5 text-slate-600">
                        {assessment.passingScore}%
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="font-semibold text-slate-600">{assessmentQuestions.length} question{assessmentQuestions.length === 1 ? '' : 's'}</p>
                        {assessmentQuestions.length === 0 ? (
                          <button type="button" onClick={() => handleDeleteEmptyAssessment(assessment.id)} className="mt-2 inline-flex items-center gap-1 rounded bg-red-50 px-2 py-1 font-semibold text-red-600 hover:bg-red-100"><Trash2 className="h-3 w-3" />Delete empty assessment</button>
                        ) : <div className="mt-2 space-y-2">
                          {assessmentQuestions.map((question, index) => (
                            <div key={question.id} className="rounded-lg bg-slate-50 p-2.5">
                              <p className="font-semibold">{index + 1}. {question.prompt}</p>
                              <div className="mt-2 flex gap-2">
                                <Link href={`/admin/internship/assessments/new?edit=${encodeURIComponent(question.id)}`} className="inline-flex items-center gap-1 rounded bg-[#f3f6fb] px-2 py-1 font-semibold text-[#1C1D52] hover:bg-[#e8edf7]"><PencilLine className="h-3 w-3" />Edit</Link>
                                <button type="button" onClick={() => handleDelete(question)} className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-1 font-semibold text-red-600 hover:bg-red-100"><Trash2 className="h-3 w-3" />Delete</button>
                              </div>
                            </div>
                          ))}
                        </div>}
                      </td>
                    </tr>
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  )
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="relative flex w-fit items-center">
      <span className="sr-only">Filter by {label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 appearance-none rounded-lg px-3 pr-8 text-[10px] font-semibold text-[#1C1D52] shadow-[inset_0_0_0_1px_#d8dee8] outline-none">
        {options.map((option) => (
          <option key={option} value={option}>{label}: {option}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-500" />
    </label>
  )
}

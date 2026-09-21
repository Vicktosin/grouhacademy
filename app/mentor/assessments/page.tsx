import { AssessmentAttemptStatus, RoleName } from '@/generated/prisma/client'
import { MentorBadge, MentorPage } from '@/components/MentorPage'
import { getPrisma } from '@/lib/prisma'
import { requireRouteAccess } from '@/lib/route-guards'

function statusLabel(status: AssessmentAttemptStatus) {
  return status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default async function MentorAssessmentsPage() {
  const mentorId = await requireRouteAccess({ requiredRoles: [RoleName.MENTOR], redirectTo: '/login' })
  const prisma = getPrisma()
  const assignments = await prisma.mentorAssignment.findMany({
    where: { mentorId, status: 'ACTIVE' },
    select: { internId: true, programId: true },
  })
  const assignedInternPrograms = assignments.map(({ internId, programId }) => ({ studentId: internId, programId }))
  const attempts = await getPrisma().assessmentAttempt.findMany({
    where: assignedInternPrograms.length ? { application: { OR: assignedInternPrograms } } : { id: { in: [] } },
    include: { application: { include: { student: { select: { name: true, email: true } }, program: { select: { name: true } } } } },
    orderBy: { updatedAt: 'desc' },
  })

  return <MentorPage title="Assessment results" description="Live entrance-assessment results for interns assigned to you.">
    <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-[#1C1D52]">Assigned intern results</h2><span className="text-xs text-slate-500">{attempts.length} result{attempts.length === 1 ? '' : 's'}</span></div>
      {attempts.length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">No assessment attempts from your assigned interns yet.</p> : <div className="mt-5 space-y-3">{attempts.map((attempt) => <article key={attempt.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold text-[#1C1D52]">{attempt.application.student.name ?? attempt.application.student.email}</p><p className="mt-1 text-[10px] text-slate-500">{attempt.application.program.name} · {attempt.submittedAt ? `Submitted ${attempt.submittedAt.toLocaleDateString()}` : 'Not submitted'}</p></div><div className="flex items-center gap-3"><span className="text-xs font-bold text-[#1C1D52]">{attempt.scorePercent == null ? '—' : `${attempt.scorePercent}%`}</span><MentorBadge tone={attempt.status === 'PASSED' ? 'green' : attempt.status === 'FAILED' ? 'red' : 'amber'}>{statusLabel(attempt.status)}</MentorBadge></div></article>)}</div>}
    </section>
  </MentorPage>
}

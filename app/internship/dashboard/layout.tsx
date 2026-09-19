import { redirect } from 'next/navigation'
import { getCurrentUserId } from '@/lib/route-guards'
import { hasInternshipWorkspaceAccess } from '@/lib/internship-access'
import { getPrisma } from '@/lib/prisma'

export default async function InternshipDashboardLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId()
  if (!userId) redirect('/login')
  if (!await hasInternshipWorkspaceAccess(userId)) {
    const application = await getPrisma().internshipApplication.findFirst({
      where: { studentId: userId },
      include: { attempts: { where: { status: { in: ['PASSED', 'FAILED'] } }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    })
    redirect(application?.attempts.length ? '/internship/results' : application ? '/internship/assessment/readiness' : '/internship/onboarding')
  }
  return children
}

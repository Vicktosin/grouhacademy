import { getPrisma } from '@/lib/prisma'

export type InternshipAccessStatus = {
  hasApplication: boolean
  acceptanceFeePaid: boolean
  assessmentPassed: boolean
  programName: string | null
  acceptanceFeeAmount: number | null
  currency: string | null
  premiumTier: 'NONE' | 'TIER_100K' | 'TIER_400K'
}

export async function getInternshipAccessStatus(userId: string): Promise<InternshipAccessStatus> {
  const prisma = getPrisma()

  const application = await prisma.internshipApplication.findFirst({
    where: { studentId: userId },
    include: { program: true, payment: true },
    orderBy: { createdAt: 'desc' },
  })

  if (!application) {
    return {
      hasApplication: false,
      acceptanceFeePaid: false,
      assessmentPassed: false,
      programName: null,
      acceptanceFeeAmount: null,
      currency: null,
      premiumTier: 'NONE',
    }
  }

  return {
    hasApplication: true,
    acceptanceFeePaid: application.payment?.status === 'PAID',
    programName: application.program.name,
    assessmentPassed: (await prisma.assessmentAttempt.findFirst({ where: { applicationId: application.id, status: 'PASSED' }, select: { id: true } })) !== null,
    acceptanceFeeAmount: application.program.acceptanceFee,
    currency: application.payment?.currency ?? 'NGN',
    premiumTier: application.premiumTier,
  }
}

export async function hasInternshipWorkspaceAccess(userId: string): Promise<boolean> {
  const application = await getPrisma().internshipApplication.findFirst({
    where: { studentId: userId, payment: { is: { status: 'PAID' } }, attempts: { some: { status: 'PASSED' } } },
    select: { id: true },
  })

  return Boolean(application)
}

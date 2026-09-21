export type PaystackWebhookEvent = {
  event?: string
  status?: string
  reference?: string | null
  amount?: number | string | null
  currency?: string | null
  metadata?: Record<string, unknown> | null
  data?: {
    event?: string
    status?: string
    reference?: string | null
    amount?: number | string | null
    currency?: string | null
    metadata?: Record<string, unknown> | null
  }
}

export async function settleSuccessfulPaystackPayment(prisma: any, payload: PaystackWebhookEvent) {
  const eventData = payload.data ?? payload
  const reference = typeof eventData.reference === 'string' ? eventData.reference : null
  const status = eventData.status ?? payload.status
  const metadata = (eventData.metadata ?? payload.metadata ?? {}) as Record<string, unknown>
  const applicationId = typeof metadata.applicationId === 'string' ? metadata.applicationId : undefined

  if (status !== 'success') {
    return { updatedInternshipPayment: false, updatedGenericPayment: false }
  }

  let updatedInternshipPayment = false
  let updatedGenericPayment = false

  if (reference) {
    const internshipPayment = await prisma.internshipPayment.findUnique({
      where: { reference },
      include: { application: { include: { program: true } } },
    }).catch(() => null)

    if (internshipPayment && internshipPayment.status !== 'PAID') {
      await prisma.internshipPayment.update({
        where: { id: internshipPayment.id },
        data: { status: 'PAID', paidAt: new Date() },
      })

      updatedInternshipPayment = true

      if (internshipPayment.application) {
        const now = new Date()
        const nextCohort = await prisma.internshipCohort.findFirst({
          where: {
            programId: internshipPayment.application.programId,
            startDate: { gt: now },
          },
          orderBy: { startDate: 'asc' },
        }).catch(() => null)

        await prisma.internshipApplication.update({
          where: { id: internshipPayment.applicationId },
          data: {
            cohortId: nextCohort?.id ?? internshipPayment.application.cohortId ?? null,
          },
        }).catch(() => null)
      }
    }
  }

  if (!updatedInternshipPayment && applicationId) {
    const internshipPayment = await prisma.internshipPayment.findUnique({
      where: { applicationId },
      include: { application: { include: { program: true } } },
    }).catch(() => null)

    if (internshipPayment && internshipPayment.status !== 'PAID') {
      await prisma.internshipPayment.update({
        where: { id: internshipPayment.id },
        data: { status: 'PAID', paidAt: new Date() },
      })
      updatedInternshipPayment = true
    }
  }

  if (!updatedInternshipPayment && reference) {
    const genericPayment = await prisma.payment.findUnique({ where: { reference } }).catch(() => null)

    if (genericPayment && genericPayment.status !== 'PAID') {
      await prisma.payment.update({
        where: { reference },
        data: { status: 'PAID', paidAt: new Date() },
      })
      updatedGenericPayment = true
    }
  }

  return { updatedInternshipPayment, updatedGenericPayment }
}

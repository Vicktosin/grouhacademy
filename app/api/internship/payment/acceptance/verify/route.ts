import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { assignApplicationCohort, type CohortDb } from '@/lib/internship-cohort'

export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get('reference')
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!reference) return NextResponse.json({ message: 'Missing payment reference.' }, { status: 400 })
  if (!secretKey) return NextResponse.json({ message: 'Paystack is not configured.' }, { status: 503 })

  const prisma = getPrisma()

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    const data = await response.json()
    if (!response.ok || data.data?.status !== 'success') {
      return NextResponse.json({ message: 'Payment was not successful.' }, { status: 402 })
    }

    const applicationId = data.data.metadata?.applicationId as string | undefined
    if (
      !applicationId ||
      data.data.reference !== reference ||
      data.data.metadata?.purpose !== 'internship_acceptance_fee'
    ) {
      return NextResponse.json({ message: 'Payment reference is missing application context.' }, { status: 400 })
    }

    // Paystack returns to this endpoint through the customer's browser. That
    // navigation can arrive without the Supabase session cookie (for example,
    // when the callback host differs from the host where payment began). The
    // Paystack verification plus this exact persisted reference are therefore
    // the authority for settling the payment; browser authentication must not
    // leave a successful payment pending.
    //
    // Metadata alone must never settle a different or superseded payment
    // reference, so require the reference stored on the application payment.
    const application = await prisma.internshipApplication.findFirst({
      where: { id: applicationId, payment: { is: { reference } } },
      include: { program: true, payment: true },
    })
    if (!application) {
      return NextResponse.json({ message: 'This payment does not belong to your account.' }, { status: 403 })
    }

    const passedAttempt = await prisma.assessmentAttempt.findFirst({
      where: { applicationId, status: 'PASSED' },
      select: { id: true },
    })
    if (!passedAttempt) {
      return NextResponse.json({ message: 'A passed entrance assessment is required to verify this payment.' }, { status: 403 })
    }

    if (
      data.data.amount !== application.program.acceptanceFee * 100 ||
      data.data.currency !== application.payment?.currency
    ) {
      return NextResponse.json({ message: 'Payment amount or currency does not match this application.' }, { status: 400 })
    }

    await prisma.internshipPayment.update({
      where: { applicationId },
      data: { status: 'PAID', paidAt: new Date() },
    })

    await assignApplicationCohort(prisma as unknown as CohortDb, application)

    return NextResponse.json({ status: 'success' })
  } catch (error) {
    console.error('Failed to verify acceptance fee payment:', error)
    return NextResponse.json({ message: 'Payment verification failed.' }, { status: 500 })
  }
}

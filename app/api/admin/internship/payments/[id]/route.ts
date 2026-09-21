import { NextResponse } from 'next/server'

import { InternshipPaymentStatus, RoleName } from '@/generated/prisma/client'
import { getPrisma } from '@/lib/prisma'
import { userHasRole } from '@/lib/rbac'
import { getCurrentUserId } from '@/lib/route-guards'

const VALID_STATUSES = new Set<InternshipPaymentStatus>([
  InternshipPaymentStatus.PENDING,
  InternshipPaymentStatus.PAID,
  InternshipPaymentStatus.FAILED,
  InternshipPaymentStatus.CANCELLED,
])

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getCurrentUserId()
  if (!adminId || !(await userHasRole(adminId, RoleName.ADMIN))) {
    return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 })
  }

  const { id } = await params
  const prisma = getPrisma()

  let body: { status?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const rawStatus = body.status
  if (!rawStatus || typeof rawStatus !== 'string') {
    return NextResponse.json({ error: 'A payment status is required.' }, { status: 400 })
  }

  const normalizedStatus = rawStatus.toUpperCase()
  if (!VALID_STATUSES.has(normalizedStatus as InternshipPaymentStatus)) {
    return NextResponse.json({ error: 'Unsupported payment status.' }, { status: 400 })
  }

  const payment = await prisma.internshipPayment.findUnique({ where: { id } })
  if (!payment) {
    return NextResponse.json({ error: 'Payment not found.' }, { status: 404 })
  }

  const updatedPayment = await prisma.internshipPayment.update({
    where: { id },
    data: {
      status: normalizedStatus as InternshipPaymentStatus,
      paidAt: normalizedStatus === InternshipPaymentStatus.PAID ? payment.paidAt ?? new Date() : null,
    },
  })

  return NextResponse.json({
    payment: {
      id: updatedPayment.id,
      status: updatedPayment.status,
      paidAt: updatedPayment.paidAt,
    },
  })
}

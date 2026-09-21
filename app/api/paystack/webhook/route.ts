import { createHmac } from 'node:crypto'
import { NextResponse } from 'next/server'

import { getPrisma } from '@/lib/prisma'
import { settleSuccessfulPaystackPayment } from '@/lib/paystack-webhook'

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ message: 'Paystack is not configured.' }, { status: 503 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-paystack-signature') ?? ''
  const expectedSignature = createHmac('sha512', secretKey).update(rawBody).digest('hex')

  if (signature !== expectedSignature) {
    return NextResponse.json({ message: 'Invalid Paystack signature.' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ message: 'Malformed Paystack payload.' }, { status: 400 })
  }

  const event = payload.event
  const data = (payload.data ?? {}) as Record<string, unknown>

  if (event !== 'charge.success' || data.status !== 'success') {
    return NextResponse.json({ status: 'ignored' })
  }

  const prisma = getPrisma()
  await settleSuccessfulPaystackPayment(prisma, payload as any)

  return NextResponse.json({ status: 'success' })
}

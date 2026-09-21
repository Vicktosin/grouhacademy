import test from 'node:test'
import assert from 'node:assert/strict'

import { settleSuccessfulPaystackPayment, type PaystackSettlementPrisma } from '../lib/paystack-webhook'

test('marks internship payment as paid when Paystack charge.success arrives for a bank transfer', async () => {
  const calls: Record<string, unknown>[] = []

  const prisma = {
    internshipPayment: {
      findUnique: async () => ({
        id: 'payment-1',
        applicationId: 'app-1',
        status: 'PENDING',
        amount: 250000,
        currency: 'NGN',
        application: {
          id: 'app-1',
          programId: 'program-1',
          cohortId: null,
        },
      }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push({ model: 'internshipPayment', data })
        return { id: 'payment-1', ...data }
      },
    },
    payment: {
      findUnique: async () => null,
    },
    internshipApplication: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push({ model: 'internshipApplication', data })
        return { id: 'app-1', ...data }
      },
    },
    internshipCohort: {
      findFirst: async () => null,
    },
  }

  const result = await settleSuccessfulPaystackPayment(prisma as unknown as PaystackSettlementPrisma, {
    reference: 'acceptance_app-1_123',
    status: 'success',
    amount: 25000000,
    currency: 'NGN',
    metadata: {
      applicationId: 'app-1',
      purpose: 'internship_acceptance_fee',
    },
  })

  assert.equal(result.updatedInternshipPayment, true)
  assert.equal(calls.some((call) => call.model === 'internshipPayment'), true)
  assert.equal(calls.some((call) => call.model === 'internshipApplication'), true)
})

import { NextResponse } from 'next/server'
import { RoleName } from '@/generated/prisma/client'
import { getPrisma } from '@/lib/prisma'
import { userHasRole } from '@/lib/rbac'
import { getCurrentUserId } from '@/lib/route-guards'

const types = new Set(['select', 'textarea', 'text'])
const optionsOf = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean) : []

async function admin() { const id = await getCurrentUserId(); return Boolean(id && await userHasRole(id, RoleName.ADMIN)) }
function values(body: Record<string, unknown>) { const prompt = String(body.prompt ?? '').trim(); const fieldType = String(body.fieldType ?? 'text'); const options = optionsOf(body.options); if (!prompt || !types.has(fieldType) || (fieldType === 'select' && !options.length)) return null; return { prompt, fieldType, options, required: Boolean(body.required), active: Boolean(body.active), order: Number.isInteger(body.order) ? Number(body.order) : 0 } }

export async function GET() { if (!await admin()) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 }); const questions = await getPrisma().internshipOnboardingQuestion.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }); return NextResponse.json({ questions: questions.map((question) => ({ ...question, options: optionsOf(question.options) })) }) }
export async function POST(request: Request) { if (!await admin()) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 }); const body = await request.json().catch(() => null); const question = body && typeof body === 'object' ? values(body as Record<string, unknown>) : null; if (!question) return NextResponse.json({ error: 'Provide a prompt and valid field configuration.' }, { status: 400 }); return NextResponse.json({ question: await getPrisma().internshipOnboardingQuestion.create({ data: question }) }, { status: 201 }) }
export async function PUT(request: Request) { if (!await admin()) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 }); const body = await request.json().catch(() => null); const id = String(body?.id ?? '').trim(); const question = body && typeof body === 'object' ? values(body as Record<string, unknown>) : null; if (!id || !question) return NextResponse.json({ error: 'Provide a valid question update.' }, { status: 400 }); return NextResponse.json({ question: await getPrisma().internshipOnboardingQuestion.update({ where: { id }, data: question }) }) }
export async function DELETE(request: Request) { if (!await admin()) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 }); const body = await request.json().catch(() => null); const id = String(body?.id ?? '').trim(); if (!id) return NextResponse.json({ error: 'A question id is required.' }, { status: 400 }); await getPrisma().internshipOnboardingQuestion.delete({ where: { id } }); return NextResponse.json({ deletedId: id }) }

import { NextResponse } from 'next/server'
import { RoleName } from '@/generated/prisma/client'
import { getPrisma } from '@/lib/prisma'
import { userHasRole } from '@/lib/rbac'
import { getCurrentUserId } from '@/lib/route-guards'

async function adminId() { const id = await getCurrentUserId(); return id && await userHasRole(id, RoleName.ADMIN) ? id : null }

export async function GET() {
  const id = await adminId()
  if (!id) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 })
  const user = await getPrisma().user.findUnique({ where: { id }, include: { profile: true, settings: true } })
  if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  return NextResponse.json({ name: user.name ?? '', email: user.email, avatarUrl: user.avatarUrl, phone: user.profile?.phone ?? '', bio: user.profile?.bio ?? '', timezone: user.settings?.timezone ?? 'Africa/Lagos' })
}

export async function PATCH(request: Request) {
  const id = await adminId()
  if (!id) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body.name !== 'string' || !body.name.trim()) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  const prisma = getPrisma()
  await prisma.$transaction([prisma.user.update({ where: { id }, data: { name: body.name.trim() } }), prisma.profile.upsert({ where: { userId: id }, create: { userId: id, phone: typeof body.phone === 'string' ? body.phone : null, bio: typeof body.bio === 'string' ? body.bio : null }, update: { phone: typeof body.phone === 'string' ? body.phone : undefined, bio: typeof body.bio === 'string' ? body.bio : undefined } }), prisma.userSettings.upsert({ where: { userId: id }, create: { userId: id, timezone: typeof body.timezone === 'string' ? body.timezone : 'Africa/Lagos' }, update: { timezone: typeof body.timezone === 'string' ? body.timezone : undefined } })])
  return NextResponse.json({ success: true })
}

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, RoleName } from '../generated/prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL })
const prisma = new PrismaClient({ adapter })

// This seed is deliberately limited to the RBAC records the application needs
// to authorize real users. It must never create demo users, courses, payments,
// cohorts, assessments, or any other launch data.
const roles: RoleName[] = [
  RoleName.STUDENT,
  RoleName.INTERN,
  RoleName.INSTRUCTOR,
  RoleName.MENTOR,
  RoleName.ADMIN,
]

const permissions = [
  'user:create', 'user:view', 'user:edit', 'user:delete', 'user:suspend', 'user:restore',
  'student:view', 'student:manage', 'student:suspend', 'student:restore',
  'course:create', 'course:view', 'course:edit', 'course:delete', 'course:publish', 'course:unpublish', 'course:manage',
  'instructor:view', 'instructor:manage', 'instructor:approve',
  'enrollment:view', 'enrollment:manage',
  'payment:view', 'payment:manage', 'payment:refund',
  'certificate:view', 'certificate:issue', 'certificate:revoke',
  'internship:create', 'internship:view', 'internship:edit', 'internship:delete', 'internship:manage',
  'application:view', 'application:manage', 'application:approve', 'application:reject',
  'assessment:create', 'assessment:view', 'assessment:edit', 'assessment:manage', 'assessment:review',
  'intern:view', 'intern:manage', 'mentor:view', 'mentor:manage', 'mentor:assign',
  'task:create', 'task:view', 'task:edit', 'task:delete', 'task:review',
  'project:create', 'project:view', 'project:manage', 'project:review',
  'reports:view', 'reports:manage', 'notification:view', 'notification:manage',
  'settings:view', 'settings:manage', 'audit:view',
] as const

const rolePermissions: Record<RoleName, readonly string[]> = {
  STUDENT: ['course:view', 'enrollment:view', 'enrollment:manage', 'certificate:view', 'internship:view', 'application:view', 'assessment:view', 'task:view', 'project:view', 'notification:view', 'settings:view'],
  INTERN: ['internship:view', 'intern:view', 'task:view', 'task:edit', 'project:view', 'project:manage', 'assessment:view', 'application:view', 'notification:view'],
  INSTRUCTOR: ['course:create', 'course:view', 'course:edit', 'course:manage', 'course:publish', 'course:unpublish', 'student:view', 'student:manage', 'enrollment:view', 'enrollment:manage', 'assessment:create', 'assessment:view', 'assessment:edit', 'assessment:manage', 'assessment:review', 'certificate:view', 'certificate:issue', 'notification:view', 'reports:view'],
  MENTOR: ['intern:view', 'intern:manage', 'mentor:view', 'mentor:manage', 'mentor:assign', 'task:create', 'task:view', 'task:edit', 'task:delete', 'task:review', 'project:view', 'project:manage', 'project:review', 'assessment:view', 'assessment:review', 'internship:view', 'application:view', 'notification:view'],
  ADMIN: permissions,
}

async function main() {
  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    })
  }

  for (const key of permissions) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    })
  }

  for (const [roleName, keys] of Object.entries(rolePermissions) as [RoleName, readonly string[]][]) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } })

    for (const key of keys) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key } })
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      })
    }
  }

  console.log('RBAC baseline seeded successfully')
}

main()
  .catch((error) => {
    console.error('RBAC seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

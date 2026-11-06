import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";
import { parseTemplate } from "../route";

// ── GET /api/admin/internship/task-library/[id] ───────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const { id } = await params;

  const template = await getPrisma().internshipTaskTemplate.findUnique({
    where: { id },
    include: {
      program: { select: { id: true, name: true } },
      level: { select: { id: true, name: true } },
      labScenario: { select: { id: true, title: true, kind: true } },
      _count: { select: { tasks: true } },
    },
  });
  if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  return NextResponse.json({ template });
}

// ── PUT /api/admin/internship/task-library/[id] ───────────────────────────────

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const { id } = await params;

  const prisma = getPrisma();
  const existing = await prisma.internshipTaskTemplate.findUnique({
    where: { id },
    select: { id: true, archived: true, _count: { select: { tasks: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  if (existing.archived)
    return NextResponse.json({ error: "Archived templates cannot be edited. Unarchive it first." }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const parsed = await parseTemplate(body as Record<string, unknown>);
  if (typeof parsed === "string")
    return NextResponse.json({ error: parsed }, { status: 400 });

  const template = await prisma.internshipTaskTemplate.update({
    where: { id },
    data: parsed,
    include: {
      program: { select: { id: true, name: true } },
      level: { select: { id: true, name: true } },
      _count: { select: { tasks: true } },
    },
  });

  return NextResponse.json({ template });
}

// ── DELETE /api/admin/internship/task-library/[id] ────────────────────────────
// Soft-delete (archive). Hard delete is not allowed once tasks exist.

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const { id } = await params;

  const prisma = getPrisma();
  const existing = await prisma.internshipTaskTemplate.findUnique({
    where: { id },
    select: { archived: true, _count: { select: { tasks: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  if (existing._count.tasks > 0) {
    // Has materialised tasks — only soft-delete allowed
    await prisma.internshipTaskTemplate.update({ where: { id }, data: { archived: true } });
    return NextResponse.json({ archived: true, tasksPreserved: existing._count.tasks });
  }
  // No materialised tasks — hard delete is safe
  await prisma.internshipTaskTemplate.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}

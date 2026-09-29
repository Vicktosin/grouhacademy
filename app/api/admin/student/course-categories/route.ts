import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { courseSlug } from "@/lib/course-data";
import { requireAdminApi } from "@/lib/api-guards";

function categoryInput(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const name = String((body as { name?: unknown }).name ?? "").trim();
  return name ? { name, slug: courseSlug(name) } : null;
}

export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const categories = await getPrisma().courseCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { courses: true } } },
  });
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const input = categoryInput(await request.json().catch(() => null));
  if (!input)
    return NextResponse.json(
      { error: "A category name is required." },
      { status: 400 },
    );

  try {
    const category = await getPrisma().courseCategory.create({ data: input });
    return NextResponse.json({ category }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "A category with this name or slug already exists." },
      { status: 409 },
    );
  }
}

export async function PATCH(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    name?: string;
  } | null;
  const input = categoryInput(body);
  if (!body?.id || !input)
    return NextResponse.json(
      { error: "A category id and name are required." },
      { status: 400 },
    );

  try {
    const category = await getPrisma().courseCategory.update({
      where: { id: body.id },
      data: input,
    });
    return NextResponse.json({ category });
  } catch {
    return NextResponse.json(
      { error: "Unable to update category. Check that the name is unique." },
      { status: 409 },
    );
  }
}

export async function DELETE(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
  } | null;
  if (!body?.id)
    return NextResponse.json(
      { error: "A category id is required." },
      { status: 400 },
    );

  const prisma = getPrisma();
  const category = await prisma.courseCategory.findUnique({
    where: { id: body.id },
    include: { _count: { select: { courses: true } } },
  });
  if (!category)
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  if (category._count.courses > 0)
    return NextResponse.json(
      {
        error:
          "This category is already assigned to courses and cannot be removed.",
      },
      { status: 409 },
    );

  await prisma.courseCategory.delete({ where: { id: body.id } });
  return NextResponse.json({ success: true });
}

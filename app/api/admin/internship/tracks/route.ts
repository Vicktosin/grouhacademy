import { InternshipProgramStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAdminApi, requireSupportOrAdminApi } from "@/lib/api-guards";

const statuses = new Set(Object.values(InternshipProgramStatus));

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTrack(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  const duration = String(body.duration ?? "").trim();
  const description = String(body.description ?? "").trim();
  const certificateEligibility = String(
    body.certificateEligibility ?? "",
  ).trim();
  const price = Number(body.price);
  const acceptanceFee = Number(body.acceptanceFee);
  const status = String(
    body.status ?? InternshipProgramStatus.DRAFT,
  ) as InternshipProgramStatus;
  const features = stringList(body.features);
  const requirements = stringList(body.requirements);

  if (
    !name ||
    !duration ||
    !description ||
    !certificateEligibility ||
    !Number.isInteger(price) ||
    price < 0 ||
    !Number.isInteger(acceptanceFee) ||
    acceptanceFee < 0 ||
    !statuses.has(status)
  )
    return null;

  return {
    name,
    duration,
    description,
    certificateEligibility,
    price,
    acceptanceFee,
    status,
    features,
    requirements,
    companyPlacement: Boolean(body.companyPlacement),
    mentorAvailability: Boolean(body.mentorAvailability),
    communityAvailability: Boolean(body.communityAvailability),
  };
}

export async function GET() {
  const access = await requireSupportOrAdminApi();
  if (access instanceof NextResponse) return access;

  // Support Admins only pick tracks (for resources): no fees or settings.
  if (!access.isMainAdmin)
    return NextResponse.json({
      tracks: await getPrisma().internshipProgram.findMany({
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, status: true },
      }),
    });

  const tracks = await getPrisma().internshipProgram.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          applications: true,
          cohorts: true,
          tracks: true,
          assessments: true,
          modules: true,
          projects: true,
          resources: true,
          mentorAssignments: true,
          payments: true,
          progress: true,
          conversations: true,
          announcements: true,
          internshipCertificates: true,
          groups: true,
        },
      },
    },
  });

  return NextResponse.json({
    tracks: tracks.map((track) => ({
      ...track,
      features: stringList(track.features),
      requirements: stringList(track.requirements),
      inUse: Object.values(track._count).some(Boolean),
    })),
  });
}

export async function POST(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json(
      { error: "Track details are required." },
      { status: 400 },
    );
  const track = parseTrack(body as Record<string, unknown>);
  if (!track)
    return NextResponse.json(
      {
        error:
          "Provide a name, duration, description, certificate eligibility, non-negative whole-number fees, and a valid status.",
      },
      { status: 400 },
    );

  const baseSlug = slugify(track.name);
  if (!baseSlug)
    return NextResponse.json(
      { error: "Use a track name containing letters or numbers." },
      { status: 400 },
    );
  const prisma = getPrisma();
  const duplicate = await prisma.internshipProgram.findUnique({
    where: { slug: baseSlug },
    select: { id: true },
  });
  const created = await prisma.internshipProgram.create({
    data: {
      ...track,
      slug: duplicate ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug,
    },
  });
  return NextResponse.json({ track: created }, { status: 201 });
}

export async function PUT(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json(
      { error: "Track details are required." },
      { status: 400 },
    );
  const id = String((body as Record<string, unknown>).id ?? "").trim();
  const track = parseTrack(body as Record<string, unknown>);
  if (!id || !track)
    return NextResponse.json(
      { error: "Provide a valid track update." },
      { status: 400 },
    );

  const prisma = getPrisma();
  const existing = await prisma.internshipProgram.findUnique({
    where: { id },
    select: { id: true, slug: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Track not found." }, { status: 404 });
  const baseSlug = slugify(track.name);
  const conflict = await prisma.internshipProgram.findFirst({
    where: { slug: baseSlug, id: { not: id } },
    select: { id: true },
  });
  const updated = await prisma.internshipProgram.update({
    where: { id },
    data: {
      ...track,
      slug: conflict ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug,
    },
  });
  return NextResponse.json({ track: updated });
}

export async function DELETE(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? "").trim();
  if (!id)
    return NextResponse.json(
      { error: "A track id is required." },
      { status: 400 },
    );

  const prisma = getPrisma();
  const track = await prisma.internshipProgram.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          applications: true,
          cohorts: true,
          tracks: true,
          assessments: true,
          modules: true,
          projects: true,
          resources: true,
          mentorAssignments: true,
          payments: true,
          progress: true,
          conversations: true,
          announcements: true,
          internshipCertificates: true,
          groups: true,
        },
      },
    },
  });
  if (!track)
    return NextResponse.json({ error: "Track not found." }, { status: 404 });
  if (Object.values(track._count).some(Boolean))
    return NextResponse.json(
      {
        error:
          "This track cannot be removed because it is already used by applications, cohorts, payments, assessments, tasks, or other internship records. Unpublish it instead.",
      },
      { status: 409 },
    );

  await prisma.internshipProgram.delete({ where: { id } });
  return NextResponse.json({ deletedId: id });
}

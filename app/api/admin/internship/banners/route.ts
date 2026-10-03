import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";
import {
  BANNER_BUCKET,
  isValidBannerLink,
  removeBannerImages,
} from "@/lib/dashboard-banners";

function optionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function optionalDate(value: unknown) {
  const text = optionalText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isBannerImage(url: string) {
  return url.includes(`/storage/v1/object/public/${BANNER_BUCKET}/`);
}

function parseBanner(body: Record<string, unknown>) {
  const title = String(body.title ?? "").trim();
  const imageUrl = String(body.imageUrl ?? "").trim();
  const mobileImageUrl = optionalText(body.mobileImageUrl);
  const buttonLabel = optionalText(body.buttonLabel);
  const buttonUrl = optionalText(body.buttonUrl);
  const startsAt = optionalDate(body.startsAt);
  const endsAt = optionalDate(body.endsAt);
  const sortOrder = Number(body.sortOrder ?? 0);

  if (!title || title.length > 120)
    return "Give the banner a name (up to 120 characters).";
  if (!imageUrl || !isBannerImage(imageUrl)) return "Upload a banner image.";
  if (mobileImageUrl && !isBannerImage(mobileImageUrl))
    return "Upload the phone image again.";
  if (!buttonLabel !== !buttonUrl)
    return "Add both the button text and the button link, or leave both empty.";
  if (buttonLabel && buttonLabel.length > 40)
    return "Keep the button text under 40 characters.";
  if (buttonUrl && !isValidBannerLink(buttonUrl))
    return "The button link must start with / (a page on this site) or https://.";
  if (startsAt === undefined || endsAt === undefined)
    return "Enter valid start and end dates.";
  if (startsAt && endsAt && endsAt <= startsAt)
    return "The end date must be after the start date.";
  if (!Number.isInteger(sortOrder))
    return "Display order must be a whole number.";

  return {
    title,
    imageUrl,
    mobileImageUrl,
    buttonLabel,
    buttonUrl,
    startsAt,
    endsAt,
    sortOrder,
    isActive: body.isActive !== false,
  };
}

export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const banners = await getPrisma().dashboardBanner.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ banners });
}

export async function POST(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json(
      { error: "Banner details are required." },
      { status: 400 },
    );
  const banner = parseBanner(body as Record<string, unknown>);
  if (typeof banner === "string")
    return NextResponse.json({ error: banner }, { status: 400 });
  const created = await getPrisma().dashboardBanner.create({ data: banner });
  return NextResponse.json({ banner: created }, { status: 201 });
}

export async function PUT(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json(
      { error: "Banner details are required." },
      { status: 400 },
    );
  const id = String((body as Record<string, unknown>).id ?? "").trim();
  const banner = parseBanner(body as Record<string, unknown>);
  if (typeof banner === "string")
    return NextResponse.json({ error: banner }, { status: 400 });
  if (!id)
    return NextResponse.json(
      { error: "A banner id is required." },
      { status: 400 },
    );

  const prisma = getPrisma();
  const existing = await prisma.dashboardBanner.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Banner not found." }, { status: 404 });
  const updated = await prisma.dashboardBanner.update({
    where: { id },
    data: banner,
  });
  await removeBannerImages(
    [existing.imageUrl, existing.mobileImageUrl].filter(
      (url) => url !== updated.imageUrl && url !== updated.mobileImageUrl,
    ),
  );
  return NextResponse.json({ banner: updated });
}

export async function DELETE(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? "").trim();
  if (!id)
    return NextResponse.json(
      { error: "A banner id is required." },
      { status: 400 },
    );

  const prisma = getPrisma();
  const banner = await prisma.dashboardBanner.findUnique({ where: { id } });
  if (!banner)
    return NextResponse.json({ error: "Banner not found." }, { status: 404 });
  await prisma.dashboardBanner.delete({ where: { id } });
  await removeBannerImages([banner.imageUrl, banner.mobileImageUrl]);
  return NextResponse.json({ deletedId: id });
}

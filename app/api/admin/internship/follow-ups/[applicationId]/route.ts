import { NextResponse } from "next/server";
import { FollowUpStatus } from "@/generated/prisma/client";
import { requireSupportOrAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";

type Params = { params: Promise<{ applicationId: string }> };

/** Body: any of { status, note, nextFollowUpAt (ISO date or null) }. */
export async function PATCH(request: Request, { params }: Params) {
  const access = await requireSupportOrAdminApi();
  if (access instanceof NextResponse) return access;
  const { applicationId } = await params;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body)
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const data: {
    status?: FollowUpStatus;
    note?: string | null;
    nextFollowUpAt?: Date | null;
  } = {};
  if (body.status !== undefined) {
    if (
      typeof body.status !== "string" ||
      !(Object.values(FollowUpStatus) as string[]).includes(body.status)
    )
      return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    data.status = body.status as FollowUpStatus;
  }
  if (body.note !== undefined)
    data.note =
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 2000)
        : null;
  if (body.nextFollowUpAt !== undefined) {
    if (body.nextFollowUpAt === null || body.nextFollowUpAt === "")
      data.nextFollowUpAt = null;
    else {
      const date = new Date(String(body.nextFollowUpAt));
      if (Number.isNaN(date.getTime()))
        return NextResponse.json({ error: "Invalid date." }, { status: 400 });
      data.nextFollowUpAt = date;
    }
  }

  const prisma = getPrisma();
  const application = await prisma.internshipApplication.findUnique({
    where: { id: applicationId },
    select: { id: true },
  });
  if (!application)
    return NextResponse.json(
      { error: "Applicant not found." },
      { status: 404 },
    );

  const followUp = await prisma.internshipFollowUp.upsert({
    where: { applicationId },
    create: { applicationId, ...data },
    update: data,
  });
  return NextResponse.json({ followUp });
}

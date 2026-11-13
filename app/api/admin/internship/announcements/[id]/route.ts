import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { deleteAnnouncement, updateAnnouncement } from "@/lib/announcements";

// Edit or delete an announcement (same rules as the MCP tools).

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  try {
    const result = await updateAnnouncement(id, body);
    if (!result.ok)
      return NextResponse.json(
        { error: result.error },
        { status: result.error === "Announcement not found." ? 404 : 400 },
      );
    return NextResponse.json(result.value);
  } catch (error) {
    console.error("Failed to update announcement:", error);
    return NextResponse.json({ error: "Unable to update the announcement." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const { id } = await params;
  try {
    const result = await deleteAnnouncement(id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ deletedId: id });
  } catch (error) {
    console.error("Failed to delete announcement:", error);
    return NextResponse.json({ error: "Unable to delete the announcement." }, { status: 500 });
  }
}

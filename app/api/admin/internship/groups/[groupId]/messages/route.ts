import { NextResponse } from "next/server";
import { chatTopic } from "@/lib/realtime";
import { requireSupportOrAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";
import { adminGroupMessages, postTeamMessage } from "@/lib/group-chat";

type Params = { params: Promise<{ groupId: string }> };

/** A group's discussion for the admin. ?after=<ISO time> for new ones only. */
export async function GET(request: Request, { params }: Params) {
  const access = await requireSupportOrAdminApi();
  if (access instanceof NextResponse) return access;
  const { groupId } = await params;
  const group = await getPrisma().internshipGroup.findUnique({
    where: { id: groupId },
    select: { id: true },
  });
  if (!group)
    return NextResponse.json({ error: "Group not found." }, { status: 404 });
  const after = new URL(request.url).searchParams.get("after");
  const since = after ? new Date(after) : undefined;
  if (since && Number.isNaN(since.getTime()))
    return NextResponse.json({ error: "Invalid time." }, { status: 400 });
  return NextResponse.json({
    messages: await adminGroupMessages(groupId, since),
    // Where to listen for new messages (see lib/realtime).
    realtimeTopic: chatTopic({ kind: "group", groupId }),
  });
}

/** Posts a message into the group's chat as the academy team. */
export async function POST(request: Request, { params }: Params) {
  const access = await requireSupportOrAdminApi();
  if (access instanceof NextResponse) return access;
  const body = (await request.json().catch(() => null)) as {
    content?: unknown;
  } | null;
  const result = await postTeamMessage(
    access.userId,
    [(await params).groupId],
    typeof body?.content === "string" ? body.content : "",
  );
  if ("error" in result)
    return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}

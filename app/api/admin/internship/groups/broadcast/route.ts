import { NextResponse } from "next/server";
import { requireSupportOrAdminApi } from "@/lib/api-guards";
import { postTeamMessage } from "@/lib/group-chat";

/**
 * Posts the same message into several groups' chats as the academy team.
 * Body: { groupIds: string[], content: string }.
 */
export async function POST(request: Request) {
  const access = await requireSupportOrAdminApi();
  if (access instanceof NextResponse) return access;
  const body = (await request.json().catch(() => null)) as {
    groupIds?: unknown;
    content?: unknown;
  } | null;
  const groupIds = Array.isArray(body?.groupIds)
    ? body.groupIds.filter((id): id is string => typeof id === "string").slice(0, 500)
    : [];
  const result = await postTeamMessage(
    access.userId,
    groupIds,
    typeof body?.content === "string" ? body.content : "",
  );
  if ("error" in result)
    return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}

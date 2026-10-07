import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/api-guards";
import {
  InternControlError,
  moveIntern,
  removeIntern,
  restoreIntern,
} from "@/lib/admin-intern-control";

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/**
 * Admin changes to one intern (`id` is their application):
 *   { action: "move", programId, levelId, cohortId?, groupId? }
 *   { action: "remove" } · { action: "restore" }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const id = (await params).id;
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  try {
    switch (body?.action) {
      case "move": {
        const programId = text(body.programId);
        const levelId = text(body.levelId);
        if (!programId || !levelId)
          return NextResponse.json(
            { error: "Choose a track and level." },
            { status: 400 },
          );
        await moveIntern(id, {
          programId,
          levelId,
          cohortId: text(body.cohortId),
          groupId: text(body.groupId),
        });
        return NextResponse.json({ message: "Intern updated." });
      }
      case "remove":
        await removeIntern(id);
        return NextResponse.json({
          message: "Intern removed. They can be restored at any time.",
        });
      case "restore":
        await restoreIntern(id);
        return NextResponse.json({ message: "Intern restored." });
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof InternControlError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error(`Failed to update intern application ${id}.`, error);
    return NextResponse.json(
      { error: "Unable to update this intern." },
      { status: 500 },
    );
  }
}

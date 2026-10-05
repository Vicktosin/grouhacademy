import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/route-guards";
import { getPrisma } from "@/lib/prisma";
import { audienceWhere, workspaceFromRequest } from "@/lib/learner-audience";

// `?workspace=courses|internship` counts only that side.
export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const prisma = getPrisma();

  try {
    const count = await prisma.notification.count({
      where: {
        userId,
        read: false,
        ...audienceWhere(workspaceFromRequest(request)),
      },
    });
    return NextResponse.json({ count });
  } catch (error) {
    console.error("Failed to load unread notification count:", error);
    return NextResponse.json(
      { error: "Unable to load notifications." },
      { status: 500 },
    );
  }
}

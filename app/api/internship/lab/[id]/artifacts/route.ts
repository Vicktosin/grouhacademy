import { NextResponse } from "next/server";
import { requireInternApi } from "@/lib/lab-api";
import { ARTIFACT_TYPES, areArtifactsEnabled, createArtifactUpload, type ArtifactType } from "@/lib/lab-artifacts";
import { getPrisma } from "@/lib/prisma";

/**
 * Where to upload a screenshot or site snapshot for this exercise's task
 * submission. Body: { type: "screenshot" | "snapshot" }. The upload goes
 * straight to storage; the key is then sent with the submission.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireInternApi();
  if (userId instanceof NextResponse) return userId;
  if (!areArtifactsEnabled()) return NextResponse.json({ error: "Uploads aren't set up." }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { type?: unknown } | null;
  const type = body?.type as ArtifactType;
  if (!(type in ARTIFACT_TYPES)) return NextResponse.json({ error: "Unknown upload." }, { status: 400 });
  const scenario = await getPrisma().labScenario.findUnique({ where: { id: (await params).id }, select: { kind: true } });
  const fits = type === "snapshot" ? scenario?.kind === "WORDPRESS" : scenario?.kind === "WEB" || scenario?.kind === "REACT";
  if (!fits) return NextResponse.json({ error: "Not for this exercise." }, { status: 400 });
  try {
    return NextResponse.json({ ...(await createArtifactUpload(userId, type)), maxBytes: ARTIFACT_TYPES[type].maxBytes });
  } catch (error) {
    console.error("[lab-artifacts] Upload URL failed.", error);
    return NextResponse.json({ error: "Upload isn't available right now." }, { status: 500 });
  }
}

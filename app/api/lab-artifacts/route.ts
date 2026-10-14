import { NextResponse } from "next/server";
import { RoleName } from "@/generated/prisma/client";
import { artifactOwner, readLocalArtifact, saveLocalArtifact, ARTIFACT_TYPES } from "@/lib/lab-artifacts";
import { isAssignedIntern } from "@/lib/mentor-data";
import { userHasRole } from "@/lib/rbac";
import { getCurrentUserId } from "@/lib/route-guards";

// Local development without Supabase only: uploads and downloads of lab
// submission artifacts (in production they go to and from storage directly).

const keyFrom = (request: Request) => new URL(request.url).searchParams.get("key") ?? "";

export async function PUT(request: Request) {
  const userId = await getCurrentUserId();
  const key = keyFrom(request);
  if (!userId || artifactOwner(key) !== userId) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  const max = key.endsWith(".zip") ? ARTIFACT_TYPES.snapshot.maxBytes : ARTIFACT_TYPES.screenshot.maxBytes;
  if (!bytes.length || bytes.length > max) return NextResponse.json({ error: "Too big." }, { status: 413 });
  try {
    await saveLocalArtifact(key, bytes);
  } catch {
    return NextResponse.json({ error: "Uploads go to storage." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  const key = keyFrom(request);
  const owner = artifactOwner(key);
  if (!userId || !owner) return new Response("Not found", { status: 404 });
  const allowed =
    userId === owner ||
    (await userHasRole(userId, RoleName.ADMIN)) ||
    ((await userHasRole(userId, RoleName.MENTOR)) && (await isAssignedIntern(userId, owner)));
  if (!allowed) return new Response("Not allowed.", { status: 403 });
  const bytes = await readLocalArtifact(key);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": key.endsWith(".zip") ? "application/zip" : "image/webp", "Cache-Control": "private, max-age=3600" },
  });
}

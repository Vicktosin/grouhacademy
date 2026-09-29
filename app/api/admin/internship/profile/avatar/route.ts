import { NextResponse } from "next/server";
import { getPlatformSettings } from "@/lib/platform-settings";
import { getPrisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/api-guards";

const types = ["image/png", "image/jpeg", "image/webp"];
export async function POST(request: Request) {
  const id = await requireAdminApi();
  if (id instanceof NextResponse) return id;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !types.includes(file.type))
    return NextResponse.json(
      { error: "Upload a PNG, JPEG, or WebP image." },
      { status: 400 },
    );
  const settings = await getPlatformSettings();
  if (file.size > settings.maxUploadSizeMb * 1024 * 1024)
    return NextResponse.json(
      { error: `Image must be under ${settings.maxUploadSizeMb}MB.` },
      { status: 400 },
    );
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const storage = createSupabaseAdminClient().storage.from("avatars");
  const path = `${id}/admin-avatar.${ext}`;
  const { error } = await storage.upload(path, await file.arrayBuffer(), {
    contentType: file.type,
    upsert: true,
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  const avatarUrl = `${storage.getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  await getPrisma().user.update({ where: { id }, data: { avatarUrl } });
  return NextResponse.json({ avatarUrl });
}

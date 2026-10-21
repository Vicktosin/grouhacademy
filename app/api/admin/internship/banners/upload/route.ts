import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getPlatformSettings } from "@/lib/platform-settings";
import { requireSupportOrAdminApi } from "@/lib/api-guards";
import { bannerStorage, ensureBannerBucket } from "@/lib/dashboard-banners";

const types: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: Request) {
  const access = await requireSupportOrAdminApi();
  if (access instanceof NextResponse) return access;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !types[file.type])
    return NextResponse.json(
      { error: "Upload a PNG, JPEG, WebP, or GIF image." },
      { status: 400 },
    );
  const settings = await getPlatformSettings();
  if (file.size > settings.maxUploadSizeMb * 1024 * 1024)
    return NextResponse.json(
      { error: `Image must be under ${settings.maxUploadSizeMb}MB.` },
      { status: 400 },
    );

  try {
    await ensureBannerBucket();
  } catch (error) {
    console.error("Failed to prepare banner storage:", error);
    return NextResponse.json(
      { error: "Banner image storage is unavailable." },
      { status: 500 },
    );
  }

  const storage = bannerStorage();
  const path = `${randomUUID()}.${types[file.type]}`;
  const { error } = await storage.upload(path, await file.arrayBuffer(), {
    contentType: file.type,
    cacheControl: "31536000",
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: storage.getPublicUrl(path).data.publicUrl });
}

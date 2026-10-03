import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Public Supabase Storage bucket holding banner images. It is created on the
// first upload, so no manual setup is needed.
export const BANNER_BUCKET = "banners";

export function bannerStorage() {
  return createSupabaseAdminClient().storage.from(BANNER_BUCKET);
}

/** Creates the public banner bucket if it does not exist yet. */
export async function ensureBannerBucket() {
  const client = createSupabaseAdminClient();
  const { data } = await client.storage.getBucket(BANNER_BUCKET);
  if (data) return;
  const { error } = await client.storage.createBucket(BANNER_BUCKET, {
    public: true,
  });
  if (error && !/already exists/i.test(error.message)) throw error;
}

/** The object path of a banner image URL, or null if it is not one of ours. */
function storagePath(url: string | null | undefined) {
  const marker = `/storage/v1/object/public/${BANNER_BUCKET}/`;
  const index = url?.indexOf(marker) ?? -1;
  return url && index >= 0
    ? decodeURIComponent(url.slice(index + marker.length).split("?")[0])
    : null;
}

/** Best-effort removal of banner images that are no longer used. */
export async function removeBannerImages(urls: (string | null | undefined)[]) {
  const paths = urls.map(storagePath).filter((path): path is string => !!path);
  if (paths.length === 0) return;
  const { error } = await bannerStorage().remove(paths);
  if (error) console.error("Failed to remove banner images:", error);
}

/** Button links may be site paths ("/student") or full https URLs. */
export function isValidBannerLink(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

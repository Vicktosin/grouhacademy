import { flyerFileName } from "./layout";

// Browser-only helpers for saving a graduation flyer to the device as a
// JPEG: the intern's own download (FlyerStep) and the admin testimonials
// page. Older flyers were saved as PNG, so they're converted here.

export const FLYER_JPEG_QUALITY = 0.88;

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Any image blob as a JPEG (white behind any transparency). */
export async function toJpeg(blob: Blob): Promise<Blob> {
  if (blob.type === "image/jpeg") return blob;
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);
    const jpeg = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", FLYER_JPEG_QUALITY),
    );
    if (!jpeg) throw new Error("The image couldn't be converted.");
    return jpeg;
  } finally {
    bitmap.close();
  }
}

/** Downloads a saved flyer (by URL) to the device as "<name>.jpg". */
export async function downloadFlyerJpeg(url: string, name: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("The flyer couldn't be fetched.");
  downloadBlob(await toJpeg(await response.blob()), flyerFileName(name, "jpg"));
}

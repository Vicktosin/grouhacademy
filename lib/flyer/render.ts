import {
  FLYER_HEIGHT,
  FLYER_TEMPLATE_URL,
  FLYER_WIDTH,
  NAME_STYLE,
  PHOTO_CIRCLE,
  fitNameSize,
  type Placement,
} from "./layout";

// Draws the graduation flyer (2160 x 2700) in three layers:
//  1. the template image (background, headline, ring, confetti, cap);
//  2. the graduate's photo, exactly as uploaded, clipped to the circle;
//  3. their name, in Poppins Bold.
// The caller waits for the template and the font first (loadFlyerAssets).

type Context = CanvasRenderingContext2D;
type Drawable = CanvasImageSource & { width: number; height: number };

let template: Promise<HTMLImageElement> | null = null;

/** Loads the template image once. */
export function loadTemplate() {
  template ??= new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The flyer template didn't load."));
    image.src = FLYER_TEMPLATE_URL;
  }).catch((error) => {
    template = null;
    throw error;
  });
  return template;
}

/** Waits for Poppins Bold (with the characters of this name) and the template. */
export async function loadFlyerAssets(name: string) {
  const [image] = await Promise.all([
    loadTemplate(),
    document.fonts.load(`${NAME_STYLE.weight} ${NAME_STYLE.size}px ${NAME_STYLE.family}`, name || "Student Name"),
  ]);
  return image;
}

function drawPhoto(ctx: Context, photo: Drawable, placement: Placement) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(PHOTO_CIRCLE.x, PHOTO_CIRCLE.y, PHOTO_CIRCLE.radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(photo, placement.x, placement.y, photo.width * placement.scale, photo.height * placement.scale);
  ctx.restore();
}

function drawName(ctx: Context, name: string) {
  ctx.save();
  const font = (size: number) => `${NAME_STYLE.weight} ${size}px ${NAME_STYLE.family}`;
  const size = fitNameSize((s) => {
    ctx.font = font(s);
    return ctx.measureText(name).width;
  });
  ctx.font = font(size);
  ctx.fillStyle = NAME_STYLE.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  // Place the top of the capitals at NAME_STYLE.capTop, whatever the size.
  const capHeight = ctx.measureText("H").actualBoundingBoxAscent;
  ctx.fillText(name, NAME_STYLE.x, NAME_STYLE.capTop + capHeight);
  ctx.restore();
}

/** Draws the whole flyer onto a 2160 x 2700 canvas context. */
export function drawFlyer(
  ctx: Context,
  { template, photo, placement, name }: { template: Drawable; photo: Drawable | null; placement: Placement | null; name: string },
) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, FLYER_WIDTH, FLYER_HEIGHT);
  ctx.drawImage(template, 0, 0, FLYER_WIDTH, FLYER_HEIGHT);
  if (photo && placement) drawPhoto(ctx, photo, placement);
  if (name) drawName(ctx, name);
  ctx.restore();
}

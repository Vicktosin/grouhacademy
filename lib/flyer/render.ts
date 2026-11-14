import {
  FLYER_HEIGHT,
  FLYER_NOTES,
  FLYER_TEMPLATE_URL,
  FLYER_WIDTH,
  NAME_STYLE,
  PHOTO_CIRCLE,
  SILHOUETTE,
  fitNameSize,
  type Placement,
} from "./layout";

// Draws the graduation flyer (2160 x 2700) in three layers:
//  1. the template image (background, headline, ring, confetti, cap);
//  2. the graduate's photo, exactly as uploaded, clipped to the circle
//     (before they upload one: a plain person silhouette);
//  3. their name, in Poppins Bold;
//  4. "(formerly Grouh Academy)" under the logo, and the register link
//     under the name.
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
    ...Object.values(FLYER_NOTES).map((note) =>
      document.fonts.load(`${note.weight} ${note.size}px ${NAME_STYLE.family}`, note.text),
    ),
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

/** A generic person silhouette (head and shoulders) for the empty circle. */
function drawSilhouette(ctx: Context) {
  const { x, y, radius } = PHOTO_CIRCLE;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = SILHOUETTE.background;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.fillStyle = SILHOUETTE.figure;
  ctx.beginPath();
  ctx.arc(x, y - 150, 215, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y + 560, 470, 470, 0, 0, Math.PI * 2);
  ctx.fill();
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
  const baseline = NAME_STYLE.capTop + capHeight;
  ctx.fillText(name, NAME_STYLE.x, baseline);
  ctx.restore();
  return baseline;
}

function drawNote(ctx: Context, note: { text: string; weight: number; size: number; color: string; x: number }, baseline: number) {
  ctx.save();
  ctx.font = `${note.weight} ${note.size}px ${NAME_STYLE.family}`;
  ctx.fillStyle = note.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(note.text, note.x, baseline);
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
  else drawSilhouette(ctx);
  drawNote(ctx, FLYER_NOTES.formerly, FLYER_NOTES.formerly.baseline);
  // The link sits a fixed gap below the name's baseline (cap height of the link text).
  const nameBaseline = name ? drawName(ctx, name) : NAME_STYLE.capTop + NAME_STYLE.size * 0.74;
  drawNote(ctx, FLYER_NOTES.website, nameBaseline + FLYER_NOTES.website.gap + FLYER_NOTES.website.size * 0.74);
  ctx.restore();
}

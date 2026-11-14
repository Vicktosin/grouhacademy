import {
  FLYER_COLORS,
  FLYER_HEIGHT,
  FLYER_TEXT,
  FLYER_WIDTH,
  GLOW,
  MAZE_LINES,
  MAZE_WIDTH,
  PILL_GROUP,
  PILLS,
  POP_OUT,
  RING_WIDTH,
  RINGS,
  fitNameSize,
  type Placement,
} from "./layout";

// Draws the graduation flyer (1080 x 1350) in four layers:
//  1. background: fill, white maze lines, green glow, grey rings;
//  2. the funnel pills (behind the person);
//  3. the person's cut-out, clipped to the pills plus the pop-out above
//     the green pill, so the head rises out of it;
//  4. the text.
// The caller waits for the font first (loadFlyerFont).

type Context = CanvasRenderingContext2D;

/** Waits for Poppins 700 and 800 (canvas text needs the font loaded). */
export async function loadFlyerFont(family: string) {
  await Promise.all([
    document.fonts.load(`700 36px ${family}`, "I just completed my"),
    document.fonts.load(`800 104px ${family}`, "Sabirole Student Name"),
  ]);
}

function pillPath(path: Path2D, x: number, y: number, width: number, height: number) {
  const r = height / 2;
  path.moveTo(x + r, y);
  path.lineTo(x + width - r, y);
  path.arc(x + width - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  path.lineTo(x + r, y + height);
  path.arc(x + r, y + r, r, Math.PI / 2, (Math.PI * 3) / 2);
  path.closePath();
}

function applyGroupTransform(ctx: Context) {
  ctx.translate(PILL_GROUP.x, PILL_GROUP.y);
  ctx.rotate((PILL_GROUP.rotation * Math.PI) / 180);
}

function drawBackground(ctx: Context) {
  ctx.fillStyle = FLYER_COLORS.background;
  ctx.fillRect(0, 0, FLYER_WIDTH, FLYER_HEIGHT);

  ctx.save();
  ctx.strokeStyle = FLYER_COLORS.maze;
  ctx.lineWidth = MAZE_WIDTH;
  ctx.lineJoin = "miter";
  ctx.lineCap = "square";
  for (const line of MAZE_LINES) {
    ctx.beginPath();
    line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  ctx.restore();

  const glow = ctx.createRadialGradient(GLOW.x, GLOW.y, 0, GLOW.x, GLOW.y, GLOW.radius);
  glow.addColorStop(0, `rgba(${FLYER_COLORS.glow}, ${GLOW.opacity})`);
  glow.addColorStop(1, `rgba(${FLYER_COLORS.glow}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, FLYER_WIDTH, FLYER_HEIGHT);

  ctx.save();
  ctx.strokeStyle = FLYER_COLORS.ring;
  ctx.lineWidth = RING_WIDTH;
  for (const ring of RINGS) {
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPills(ctx: Context) {
  ctx.save();
  applyGroupTransform(ctx);
  for (const pill of PILLS) {
    const path = new Path2D();
    pillPath(path, pill.x, pill.y, pill.width, pill.height);
    ctx.fillStyle = pill.color;
    ctx.fill(path);
  }
  ctx.restore();
}

function drawPerson(ctx: Context, cutout: CanvasImageSource & { width: number; height: number }, placement: Placement) {
  ctx.save();
  applyGroupTransform(ctx);
  const clip = new Path2D();
  for (const pill of PILLS) pillPath(clip, pill.x, pill.y, pill.width, pill.height);
  clip.rect(POP_OUT.x, POP_OUT.y, POP_OUT.width, POP_OUT.height);
  // Nonzero: the overlapping pop-out and green pill are one area.
  ctx.clip(clip, "nonzero");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    cutout,
    placement.x,
    placement.y,
    cutout.width * placement.scale,
    cutout.height * placement.scale,
  );
  ctx.restore();
}

function drawText(ctx: Context, family: string, name: string) {
  ctx.save();
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  ctx.fillStyle = FLYER_COLORS.intro;
  ctx.font = `700 ${FLYER_TEXT.introSize}px ${family}`;
  FLYER_TEXT.introLines.forEach((line, i) =>
    ctx.fillText(line, FLYER_WIDTH / 2, FLYER_TEXT.introTop + i * FLYER_TEXT.introLineHeight),
  );

  // "Sabi" + "role" centred as one word.
  const brandTop =
    FLYER_TEXT.introTop + FLYER_TEXT.introLines.length * FLYER_TEXT.introLineHeight + FLYER_TEXT.brandGap;
  ctx.font = `800 ${FLYER_TEXT.brandSize}px ${family}`;
  ctx.textAlign = "left";
  const [sabi, role] = FLYER_TEXT.brand;
  const sabiWidth = ctx.measureText(sabi).width;
  const start = (FLYER_WIDTH - (sabiWidth + ctx.measureText(role).width)) / 2;
  ctx.fillStyle = FLYER_COLORS.sabi;
  ctx.fillText(sabi, start, brandTop);
  ctx.fillStyle = FLYER_COLORS.role;
  ctx.fillText(role, start + sabiWidth, brandTop);

  // The graduate's name, bottom left, on one line.
  ctx.textBaseline = "alphabetic";
  const size = fitNameSize((s) => {
    ctx.font = `800 ${s}px ${family}`;
    return ctx.measureText(name).width;
  });
  ctx.font = `800 ${size}px ${family}`;
  ctx.fillStyle = FLYER_COLORS.name;
  ctx.fillText(name, FLYER_TEXT.nameX, FLYER_TEXT.nameBaseline);
  ctx.restore();
}

/** Draws the whole flyer onto a 1080 x 1350 canvas context. */
export function drawFlyer(
  ctx: Context,
  {
    cutout,
    placement,
    name,
    fontFamily,
  }: {
    cutout: (CanvasImageSource & { width: number; height: number }) | null;
    placement: Placement | null;
    name: string;
    fontFamily: string;
  },
) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, FLYER_WIDTH, FLYER_HEIGHT);
  drawBackground(ctx);
  drawPills(ctx);
  if (cutout && placement) drawPerson(ctx, cutout, placement);
  drawText(ctx, fontFamily, name);
  ctx.restore();
}

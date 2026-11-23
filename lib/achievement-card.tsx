import { readFile } from "node:fs/promises";
import path from "node:path";
/* eslint-disable @next/next/no-img-element -- drawn into a PNG by next/og, not a page */
import { ImageResponse } from "next/og";
import { accomplishmentLine, badgeEmoji, rarityTheme } from "@/lib/achievements-shared";
import { readSharePhoto } from "@/lib/lab-media";
import type { ShareCard } from "@/lib/referrals";
import { getSiteUrl } from "@/lib/site-url";

// The achievement card interns share: a 1080 × 1080 image (the standard
// square post for WhatsApp Status, Instagram and LinkedIn) drawn on the
// server. The pop-up's preview, the file they share and the link preview
// on WhatsApp/LinkedIn are all this same image. ?size=og draws a 600 px
// copy for link previews (WhatsApp skips large preview images).


const arrayBuffer = (bytes: Buffer) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

let assets: Promise<{ black: ArrayBuffer; bold: ArrayBuffer; logo: string }> | null = null;
function loadAssets() {
  assets ??= Promise.all([
    // Fixed paths, so only these files are bundled with the route.
    readFile(path.join(process.cwd(), "assets/fonts/Lato-Black.ttf")),
    readFile(path.join(process.cwd(), "assets/fonts/Lato-Bold.ttf")),
    readFile(path.join(process.cwd(), "public/logo-white.png")),
  ]).then(([black, bold, logo]) => ({ black: arrayBuffer(black), bold: arrayBuffer(bold), logo: `data:image/png;base64,${logo.toString("base64")}` }));
  assets.catch(() => (assets = null));
  return assets;
}

/** The profile picture as a data URL, or null (then initials are drawn). */
async function fetchAvatar(url: string | null) {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !/^image\/(png|jpe?g)/.test(type)) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 3_000_000) return null;
    return `data:${type.split(";")[0]};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

function initials(name: string) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "");
  return letters.join("") || "G";
}

/** Confetti pieces at fixed spots (from the share code, so a card never changes). */
function confetti(seed: string, colors: string[]) {
  let state = [...seed].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  const random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const pieces: Array<{ x: number; y: number; w: number; h: number; rotate: number; color: string; round: boolean }> = [];
  while (pieces.length < 24) {
    // Around the edges, clear of the text in the middle, the logo and the label.
    const edge = pieces.length % 4;
    const along = random() * 1000 + 40;
    const depth = random() * 140 + 20;
    const [x, y] = edge === 0 ? [along, depth] : edge === 1 ? [1080 - depth, along] : edge === 2 ? [along, 1080 - depth - 170] : [depth, along];
    const piece = {
      x,
      y,
      w: 10 + random() * 16,
      h: 18 + random() * 22,
      rotate: random() * 360,
      color: colors[Math.floor(random() * colors.length)],
      round: random() > 0.6,
    };
    if ((y < 190 && (x < 280 || x > 500)) || (x > 150 && x < 930 && y > 190 && y < 900)) continue;
    pieces.push(piece);
  }
  return pieces;
}

function titleSize(title: string) {
  if (title.length <= 12) return 112;
  if (title.length <= 18) return 96;
  if (title.length <= 26) return 82;
  if (title.length <= 36) return 70;
  return 58;
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

export async function renderAchievementCard(card: ShareCard, size: "full" | "og") {
  const [{ black, bold, logo }, photo] = await Promise.all([
    loadAssets(),
    card.photoKey ? readSharePhoto(card.photoKey) : fetchAvatar(card.avatarUrl),
  ]);
  const theme = rarityTheme(card.rarity);
  const line = accomplishmentLine({
    ...card.accomplishment,
    taskTitle: card.accomplishment.taskTitle ? clip(card.accomplishment.taskTitle, 46) : null,
  });
  const host = new URL(getSiteUrl()).host.replace(/^www\./, "");
  const program = card.track ? `${card.track} Internship` : "Internship Programme";
  const pieces = confetti(card.code, [theme.from, theme.to, "#5FBB46", "#FFFFFF", "#FDE047"]);
  const px = size === "og" ? 600 : 1080;
  // Drawn at 1080 px; every length goes through u() so the preview copy is drawn natively at 600.
  const u = (value: number) => Math.round((value * px) / 1080 * 10) / 10;
  const label = card.rarity === "COMMON" ? "Achievement unlocked" : theme.label;

  return new ImageResponse(
    (
      <div
        style={{
          width: px,
          height: px,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          fontFamily: "Lato",
          color: "#FFFFFF",
          backgroundColor: "#14153F",
          backgroundImage: `radial-gradient(circle at 50% 36%, ${theme.glow} 0%, rgba(20,21,63,0) 46%), radial-gradient(circle at 0% 100%, rgba(95,187,70,0.35) 0%, rgba(20,21,63,0) 40%), linear-gradient(160deg, #23256A 0%, #14153F 60%, #0D0E2E 100%)`,
        }}
      >
        {pieces.map((piece, index) => (
          <div
            key={index}
            style={{
              position: "absolute",
              left: u(piece.x),
              top: u(piece.y),
              width: u(piece.w),
              height: u(piece.round ? piece.w : piece.h),
              borderRadius: piece.round ? 999 : u(4),
              backgroundColor: piece.color,
              opacity: 0.85,
              transform: `rotate(${piece.rotate}deg)`,
            }}
          />
        ))}

        {/* Header: logo and rarity. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${u(56)}px ${u(64)}px 0` }}>
          <img src={logo} alt="SabiRole" width={u(151)} height={u(90)} style={{ objectFit: "contain" }} />
          <div
            style={{
              display: "flex",
              padding: `${u(14)}px ${u(28)}px`,
              borderRadius: 999,
              backgroundImage: `linear-gradient(90deg, ${theme.from}, ${theme.to})`,
              color: "#14153F",
              fontSize: u(26),
              fontWeight: 900,
              letterSpacing: u(3),
              textTransform: "uppercase",
            }}
          >
            {label}
          </div>
        </div>

        {/* Photo, badge, title. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1, padding: `0 ${u(72)}px ${u(16)}px` }}>
          <div style={{ display: "flex", position: "relative", width: u(300), height: u(300) }}>
            <div
              style={{
                display: "flex",
                width: u(300),
                height: u(300),
                borderRadius: 999,
                padding: u(10),
                backgroundImage: `linear-gradient(135deg, ${theme.from}, ${theme.to})`,
                boxShadow: `0 0 ${u(80)}px ${theme.glow}`,
              }}
            >
              {photo ? (
                <img src={photo} alt="" width={u(280)} height={u(280)} style={{ borderRadius: 999, objectFit: "cover", border: `${u(6)}px solid #14153F` }} />
              ) : (
                <div
                  style={{
                    display: "flex",
                    width: u(280),
                    height: u(280),
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#1C1D52",
                    border: `${u(6)}px solid #14153F`,
                    fontSize: u(120),
                    fontWeight: 900,
                  }}
                >
                  {initials(card.name)}
                </div>
              )}
            </div>
            <div
              style={{
                position: "absolute",
                right: u(-18),
                bottom: u(-6),
                width: u(116),
                height: u(116),
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#FFFFFF",
                border: `${u(6)}px solid ${theme.to}`,
                fontSize: u(64),
              }}
            >
              {badgeEmoji(card.icon)}
            </div>
          </div>

          <div style={{ display: "flex", marginTop: u(40), fontSize: u(30), fontWeight: 900, letterSpacing: u(8), color: theme.accent }}>
            I JUST UNLOCKED
          </div>
          <div
            style={{
              display: "flex",
              textAlign: "center",
              justifyContent: "center",
              marginTop: u(14),
              fontSize: u(titleSize(card.title)),
              fontWeight: 900,
              lineHeight: 1.04,
              letterSpacing: u(-1),
              maxWidth: u(940),
            }}
          >
            {card.title}
          </div>
          {line && (
            <div
              style={{
                display: "flex",
                marginTop: u(22),
                padding: `${u(10)}px ${u(26)}px`,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.1)",
                border: `${u(2)}px solid rgba(255,255,255,0.18)`,
                fontSize: u(28),
                fontWeight: 700,
                color: "rgba(255,255,255,0.88)",
              }}
            >
              {line}
            </div>
          )}
        </div>

        {/* Who, where, and the invitation. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            margin: `0 ${u(48)}px ${u(48)}px`,
            padding: `${u(28)}px ${u(36)}px`,
            borderRadius: u(32),
            backgroundColor: "#FFFFFF",
            color: "#1C1D52",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", maxWidth: u(600) }}>
            <div style={{ display: "flex", fontSize: u(38), fontWeight: 900 }}>{clip(card.name, 26)}</div>
            <div style={{ display: "flex", marginTop: u(4), fontSize: u(25), fontWeight: 700, color: "#5B6170" }}>
              {clip(`SabiRole · ${program}`, 64)}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: u(22), fontWeight: 700, color: "#5B6170" }}>Start yours at</div>
            <div style={{ display: "flex", fontSize: u(32), fontWeight: 900, color: "#3E9A2B" }}>{host}</div>
          </div>
        </div>
      </div>
    ),
    {
      width: px,
      height: px,
      fonts: [
        { name: "Lato", data: black, weight: 900, style: "normal" },
        { name: "Lato", data: bold, weight: 700, style: "normal" },
      ],
      headers: {
        // The URL changes with the photo (?v=), so a copy can be kept a while.
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}

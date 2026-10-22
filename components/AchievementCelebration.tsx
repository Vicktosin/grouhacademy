"use client";

import { Check, Download, ImagePlus, Link2, Loader2, Share2, UserRound, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { WhatsAppIcon } from "@/components/CommunityInvite";
import { ACHIEVEMENT_CHECK_EVENT } from "@/lib/achievement-events";
import { accomplishmentLine, badgeEmoji, rarityTheme, type ShareChannel } from "@/lib/achievements-shared";

// The pop-up an intern sees when they unlock an achievement: confetti, a
// short fanfare and a buzz on phones, then one button to brag about it. That
// opens their share card (drawn on the server, app/brag/[code]/card) with
// the ways to post it. The card's link (/brag/<code>) shows the card as a
// link preview and takes whoever taps it to sign up, credited to this intern.

type Unlock = {
  id: string;
  titleSnapshot: string;
  messageSnapshot: string;
  raritySnapshot: string;
  iconSnapshot: string;
  accomplishment: unknown;
};

type Share = {
  shareUrl: string;
  cardUrl: string;
  shareText: string;
  customPhoto: boolean;
  canUploadPhoto: boolean;
};

const SOUND_KEY = "grouh-achievement-sound";
// Unlocks mostly follow the intern's own actions, which ask for a check at
// once (checkForAchievements). The regular check only catches the rest (a
// mentor's review), and only while the tab is visible: every check is a
// billed serverless call.
const CHECK_EVERY_MS = 5 * 60_000;
// Coming back to the tab checks again, but not more often than this.
const MIN_GAP_MS = 60_000;

function soundOn() {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

/** A short rising fanfare with a sparkle, made in the browser (no audio file). */
function playFanfare(rarity: string) {
  const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    const context = new AudioContextClass();
    void context.resume();
    const master = context.createGain();
    master.gain.value = 0.22;
    master.connect(context.destination);
    const big = rarity === "EPIC" || rarity === "LEGENDARY";
    // C major arpeggio up to the octave; rarer awards hold a full chord.
    const notes = big ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [523.25, 659.25, 783.99, 1046.5];
    const start = context.currentTime + 0.02;
    notes.forEach((frequency, index) => {
      const at = start + index * 0.09;
      const last = index === notes.length - 1;
      for (const [type, detune, level] of [["triangle", 0, 1], ["sine", 1200, 0.18]] as const) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        oscillator.detune.value = detune;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(level, at + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, at + (last ? (big ? 1.4 : 0.9) : 0.32));
        oscillator.connect(gain).connect(master);
        oscillator.start(at);
        oscillator.stop(at + 1.6);
      }
    });
    if (big) {
      // A soft chord under the last note.
      for (const frequency of [261.63, 329.63, 392]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        const at = start + notes.length * 0.09;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.35, at + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 1.5);
        oscillator.connect(gain).connect(master);
        oscillator.start(at);
        oscillator.stop(at + 1.6);
      }
    }
    window.setTimeout(() => void context.close(), 2500);
  } catch {
    // Sound is a bonus; some browsers block it until the page has been used.
  }
}

/** Confetti bursting from the middle of the screen, then falling. */
function Confetti({ colors, burst }: { colors: string[]; burst: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.scale(ratio, ratio);
    const pieces = Array.from({ length: burst }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 6 + Math.random() * 11;
      return {
        x: width / 2,
        y: height * 0.42,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6,
        size: 6 + Math.random() * 7,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.3,
        wobble: Math.random() * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        round: Math.random() > 0.7,
      };
    });
    let frame = 0;
    let animation = 0;
    const draw = () => {
      frame += 1;
      context.clearRect(0, 0, width, height);
      const fade = Math.max(0, 1 - Math.max(0, frame - 150) / 60);
      for (const piece of pieces) {
        piece.vx *= 0.985;
        piece.vy = piece.vy * 0.985 + 0.32;
        piece.x += piece.vx + Math.sin((frame + piece.wobble) / 8) * 0.6;
        piece.y += piece.vy;
        piece.rotation += piece.spin;
        context.save();
        context.globalAlpha = fade;
        context.translate(piece.x, piece.y);
        context.rotate(piece.rotation);
        context.fillStyle = piece.color;
        if (piece.round) {
          context.beginPath();
          context.arc(0, 0, piece.size / 2, 0, Math.PI * 2);
          context.fill();
        } else {
          context.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2 + Math.abs(Math.sin(frame / 6 + piece.wobble)) * piece.size * 0.6);
        }
        context.restore();
      }
      if (fade > 0) animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, [colors, burst]);
  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-10 h-full w-full" />;
}

/**
 * The card's address on this site. Share links use the canonical domain
 * (NEXT_PUBLIC_APP_URL), which may differ from the one the page is on
 * (www or not); a download from the other domain is blocked by the
 * browser, so the card is always fetched from this one.
 */
function onThisSite(url: string) {
  const parsed = new URL(url, window.location.href);
  return `${parsed.pathname}${parsed.search}`;
}

/** Crops a photo to a square JPEG (the card shows it in a circle). */
async function squarePhoto(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const size = Math.min(640, side);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser can't prepare photos.");
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) throw new Error("This browser can't prepare photos.");
    return blob;
  } finally {
    bitmap.close();
  }
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3v-11Zm6.5 0h3.8v1.6h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1v5.35h-4v-4.75c0-1.13-.02-2.6-1.58-2.6-1.59 0-1.83 1.24-1.83 2.52v4.83h-4v-11Z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.87.25-1.46 1.5-1.46h1.6V4.46A21 21 0 0 0 14.27 4.3c-2.3 0-3.87 1.4-3.87 3.98v2.22H7.8v3h2.6V21h3.1Z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z" />
    </svg>
  );
}

export default function AchievementCelebration({ enabled }: { enabled: boolean }) {
  const [unlock, setUnlock] = useState<Unlock | null>(null);
  const [stage, setStage] = useState<"celebrate" | "share">("celebrate");
  const [share, setShare] = useState<Share | null>(null);
  const [cardFile, setCardFile] = useState<File | null>(null);
  // The card couldn't be downloaded as a file: sharing falls back to the link.
  const [cardFailed, setCardFailed] = useState(false);
  const [cardLoaded, setCardLoaded] = useState(false);
  const [busy, setBusy] = useState<"" | "prepare" | "photo">("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [sound, setSound] = useState(() => typeof window === "undefined" || soundOn());
  const dialogRef = useRef<HTMLDivElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const shown = useRef(new Set<string>());
  const fetching = useRef(false);
  const open = useRef(false);
  const lastCheck = useRef(0);

  /** `force`: a check asked for on purpose (page open, an action, the next
   *  of several), not just the tab coming back or the regular check. */
  const loadPending = useCallback(async (force = false) => {
    if (!enabled || fetching.current || open.current) return;
    if (!force && Date.now() - lastCheck.current < MIN_GAP_MS) return;
    lastCheck.current = Date.now();
    fetching.current = true;
    try {
      const response = await fetch("/api/internship/achievements/pending", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { unlock: Unlock | null };
      if (!data.unlock || shown.current.has(data.unlock.id) || open.current) return;
      shown.current.add(data.unlock.id);
      open.current = true;
      setUnlock(data.unlock);
      setStage("celebrate");
      setShare(null);
      setCardFile(null);
      setCardFailed(false);
      setMessage("");
      if (soundOn()) playFanfare(data.unlock.raritySnapshot);
      navigator.vibrate?.([40, 60, 40, 60, 120]);
      // Seen: it won't pop up again, even if they close it straight away.
      void fetch("/api/internship/achievements/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unlockId: data.unlock.id }),
      }).catch((error) => console.error("Could not mark the achievement as seen:", error));
    } catch (error) {
      console.error("Could not check for new achievements:", error);
    } finally {
      fetching.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    // A moment after the page opens, so it doesn't land mid-load.
    const first = window.setTimeout(() => void loadPending(true), 800);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadPending();
    }, CHECK_EVERY_MS);
    const check = () => void loadPending();
    const checkNow = () => void loadPending(true);
    const onVisible = () => document.visibilityState === "visible" && check();
    window.addEventListener("focus", check);
    window.addEventListener(ACHIEVEMENT_CHECK_EVENT, checkNow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      window.removeEventListener("focus", check);
      window.removeEventListener(ACHIEVEMENT_CHECK_EVENT, checkNow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadPending]);

  // Focus the main button when the pop-up opens; give focus back when it closes.
  useEffect(() => {
    if (!unlock) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => previous?.focus();
  }, [unlock, stage]);

  // The card as a file, ready before they tap Share (phones only allow
  // sharing straight from a tap, with no download in between).
  useEffect(() => {
    if (!share) return;
    let cancelled = false;
    fetch(onThisSite(share.cardUrl), { signal: AbortSignal.timeout(30_000) })
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(`Card ${response.status}`))))
      .then((blob) => {
        if (!cancelled) setCardFile(new File([blob], "grouh-academy-achievement.png", { type: "image/png" }));
      })
      .catch((error) => {
        console.error("Could not prepare the card image:", error);
        if (!cancelled) setCardFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [share]);

  function dismiss() {
    open.current = false;
    setUnlock(null);
    setShare(null);
    setCardFile(null);
    setCardFailed(false);
    setCardLoaded(false);
    setMessage("");
    // Several can arrive together (a perfect score unlocks a few): show the next.
    window.setTimeout(() => void loadPending(true), 700);
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    try {
      window.localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {
      // Not remembered in this browser; it still applies now.
    }
  }

  async function startBragging() {
    if (!unlock) return;
    setBusy("prepare");
    setMessage("");
    try {
      const response = await fetch(`/api/internship/achievements/${unlock.id}/share`, { method: "POST" });
      const data = (await response.json()) as Share & { error?: string };
      if (!response.ok) throw new Error(data.error || "Your card couldn't be made. Try again.");
      setCardFile(null);
      setCardFailed(false);
      setShare(data);
      setCardLoaded(false);
      setStage("share");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your card couldn't be made. Try again.");
    } finally {
      setBusy("");
    }
  }

  function record(channel: ShareChannel) {
    if (!unlock) return;
    void fetch(`/api/internship/achievements/${unlock.id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel }),
    }).catch(() => undefined);
  }

  function download() {
    if (!cardFile) return;
    const url = URL.createObjectURL(cardFile);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = cardFile.name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function copyLink(quiet = false) {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.shareUrl);
      if (!quiet) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
      return true;
    } catch {
      if (!quiet) setMessage(`Copy this link: ${share.shareUrl}`);
      return false;
    }
  }

  const canShareFile = Boolean(cardFile && typeof navigator !== "undefined" && navigator.canShare?.({ files: [cardFile] }));

  /** The phone's share sheet with the card and its link (WhatsApp Status, Instagram Story, anywhere). */
  async function shareCard() {
    if (!share) return;
    if (!cardFile) {
      if (!cardFailed) return;
      // No picture to hand over: share the link, whose preview is the card.
      record("native");
      if (navigator.share) {
        try {
          await navigator.share({ text: share.shareText });
        } catch (error) {
          if (!(error instanceof Error && error.name === "AbortError")) void copyLink();
        }
      } else {
        void copyLink();
      }
      return;
    }
    record("native");
    if (!canShareFile) {
      download();
      void copyLink(true);
      setMessage("Card saved and link copied. Post the picture and paste the link with it.");
      return;
    }
    try {
      await navigator.share({ files: [cardFile], text: share.shareText });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      download();
      setMessage("Your card was saved instead. Post it from your photos.");
    }
  }

  async function shareInstagram() {
    if (!share || (!cardFile && !cardFailed)) return;
    record("instagram");
    // Instagram only takes the picture, so the link goes on the clipboard
    // for its Link sticker.
    const copiedLink = await copyLink(true);
    if (!cardFile) {
      window.open(onThisSite(share.cardUrl), "_blank", "noopener,noreferrer");
    } else if (canShareFile) {
      try {
        await navigator.share({ files: [cardFile] });
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) download();
      }
    } else {
      download();
    }
    setMessage(
      copiedLink
        ? "Link copied! In your Instagram Story, add the Link sticker and paste it so friends can tap through."
        : `In Instagram, add a Link sticker with: ${share.shareUrl}`,
    );
  }

  function openLink(channel: ShareChannel, url: string) {
    record(channel);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function choosePhoto(file: File | null) {
    if (!unlock || !file) return;
    setBusy("photo");
    setMessage("");
    try {
      const body = await squarePhoto(file);
      const response = await fetch(`/api/internship/achievements/${unlock.id}/share/photo`, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body,
      });
      const data = (await response.json()) as { cardUrl?: string; error?: string };
      if (!response.ok || !data.cardUrl) throw new Error(data.error || "Your photo couldn't be added.");
      setCardLoaded(false);
      setCardFile(null);
      setCardFailed(false);
      setShare((current) => current && { ...current, cardUrl: data.cardUrl!, customPhoto: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your photo couldn't be added.");
    } finally {
      setBusy("");
      if (photoInput.current) photoInput.current.value = "";
    }
  }

  async function chooseProfilePhoto() {
    if (!unlock || !share?.customPhoto) return;
    setBusy("photo");
    try {
      const response = await fetch(`/api/internship/achievements/${unlock.id}/share/photo`, { method: "DELETE" });
      const data = (await response.json()) as { cardUrl?: string };
      if (response.ok && data.cardUrl) {
        setCardLoaded(false);
        setCardFile(null);
        setCardFailed(false);
        setShare((current) => current && { ...current, cardUrl: data.cardUrl!, customPhoto: false });
      }
    } finally {
      setBusy("");
    }
  }

  if (!unlock) return null;
  const theme = rarityTheme(unlock.raritySnapshot);
  const line = accomplishmentLine((unlock.accomplishment ?? {}) as Parameters<typeof accomplishmentLine>[0]);
  const big = unlock.raritySnapshot === "EPIC" || unlock.raritySnapshot === "LEGENDARY";
  const gradient = `linear-gradient(135deg, ${theme.from}, ${theme.to})`;
  const encodedText = share ? encodeURIComponent(share.shareText) : "";
  const encodedUrl = share ? encodeURIComponent(share.shareUrl) : "";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center overflow-y-auto bg-[#0b0c26]/80 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <Confetti key={unlock.id} colors={[theme.from, theme.to, "#5FBB46", "#FFFFFF", "#FDE047"]} burst={big ? 260 : 170} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievement-title"
        style={{ "--glow": theme.glow } as CSSProperties}
        className="achievement-pop relative my-auto w-full max-w-[400px] overflow-hidden rounded-[28px] bg-[#16174A] text-white shadow-[0_30px_120px_rgba(0,0,0,0.55)]"
        onKeyDown={(event) => {
          if (event.key === "Escape") dismiss();
          if (event.key !== "Tab" || !dialogRef.current) return;
          const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]")];
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-72"
          style={{ background: `radial-gradient(circle at 50% 30%, ${theme.glow}, transparent 65%)` }}
        />
        <div className="relative flex items-center justify-between px-5 pt-5">
          <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#14153F]" style={{ backgroundImage: gradient }}>
            {theme.label}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleSound}
              aria-label={sound ? "Turn celebration sound off" : "Turn celebration sound on"}
              className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"
            >
              {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            {stage === "share" && (
              <button type="button" onClick={dismiss} aria-label="Close" className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {stage === "celebrate" ? (
          <div className="relative px-6 pb-6 pt-3 text-center">
            <div className="relative mx-auto mt-2 flex h-36 w-36 items-center justify-center">
              <div
                aria-hidden="true"
                className="achievement-rays absolute -inset-10 rounded-full opacity-70"
                style={{ background: `repeating-conic-gradient(from 0deg, ${theme.glow} 0deg 10deg, transparent 10deg 30deg)` }}
              />
              <div className="achievement-badge relative flex h-28 w-28 items-center justify-center rounded-full p-1.5 shadow-[0_0_60px_var(--glow)]" style={{ backgroundImage: gradient }}>
                <span className="flex h-full w-full items-center justify-center rounded-full bg-[#16174A] text-6xl">{badgeEmoji(unlock.iconSnapshot)}</span>
              </div>
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-white/60">You are now</p>
            <h2
              id="achievement-title"
              className="mt-1 bg-clip-text text-[2rem] font-black leading-[1.05] tracking-tight text-transparent sm:text-4xl"
              style={{ backgroundImage: `linear-gradient(90deg, #FFFFFF, ${theme.accent}, #FFFFFF)` }}
            >
              {unlock.titleSnapshot}
            </h2>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-white/75">{unlock.messageSnapshot}</p>
            {line && (
              <p className="mx-auto mt-4 inline-block max-w-full truncate rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white/85">
                {line}
              </p>
            )}

            <p className="mt-7 text-sm font-semibold text-white/85">Brag about it to your friends? 😎</p>
            <button
              type="button"
              data-autofocus
              onClick={() => void startBragging()}
              disabled={busy === "prepare"}
              className="achievement-shine relative mt-3 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 py-4 text-base font-black text-[#14153F] shadow-[0_10px_30px_var(--glow)] outline-none transition focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#16174A] active:scale-[0.98] disabled:opacity-70"
              style={{ backgroundImage: gradient }}
            >
              {busy === "prepare" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />}
              Brag about it 🎉
            </button>
            {message && <p role="status" className="mt-3 text-xs text-red-200">{message}</p>}
            <p className="mt-4 text-[11px] text-white/45">Tap anywhere else to close</p>
          </div>
        ) : (
          share && (
            <div className="relative px-5 pb-5 pt-3">
              <h2 id="achievement-title" className="text-center text-lg font-black">Show it off</h2>
              <p className="mt-1 text-center text-xs text-white/60">Friends who tap your card land on our sign-up page.</p>

              <div className="relative mx-auto mt-4 aspect-square w-full max-w-[300px] overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element -- the generated card */}
                <img
                  src={onThisSite(share.cardUrl)}
                  alt={`Your achievement card: ${unlock.titleSnapshot}`}
                  width={1080}
                  height={1080}
                  onLoad={() => setCardLoaded(true)}
                  className={`h-full w-full transition-opacity duration-300 ${cardLoaded ? "opacity-100" : "opacity-0"}`}
                />
                {(!cardLoaded || busy === "photo") && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-7 w-7 animate-spin text-white/60" />
                  </div>
                )}
              </div>

              {share.canUploadPhoto && (
                <div className="mt-3 flex justify-center gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => void chooseProfilePhoto()}
                    disabled={busy === "photo"}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${share.customPhoto ? "bg-white/10 text-white/80 hover:bg-white/15" : "bg-white text-[#14153F]"}`}
                  >
                    <UserRound className="h-3.5 w-3.5" /> Profile photo
                  </button>
                  <button
                    type="button"
                    onClick={() => photoInput.current?.click()}
                    disabled={busy === "photo"}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${share.customPhoto ? "bg-white text-[#14153F]" : "bg-white/10 text-white/80 hover:bg-white/15"}`}
                  >
                    <ImagePlus className="h-3.5 w-3.5" /> {share.customPhoto ? "Change photo" : "Use another photo"}
                  </button>
                  <input
                    ref={photoInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    className="hidden"
                    onChange={(event) => void choosePhoto(event.target.files?.[0] ?? null)}
                  />
                </div>
              )}

              <button
                type="button"
                data-autofocus
                onClick={() => void shareCard()}
                disabled={!cardFile && !cardFailed}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-base font-black text-[#14153F] outline-none transition focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#16174A] active:scale-[0.98] disabled:opacity-60"
                style={{ backgroundImage: gradient }}
              >
                {!cardFile && !cardFailed ? <Loader2 className="h-5 w-5 animate-spin" /> : canShareFile || cardFailed ? <Share2 className="h-5 w-5" /> : <Download className="h-5 w-5" />}
                {cardFailed ? "Share my link" : canShareFile || !cardFile ? "Share my card" : "Download my card"}
              </button>
              {canShareFile && (
                <p className="mt-1.5 text-center text-[11px] text-white/50">Pick WhatsApp → My status, Instagram Story, or any app</p>
              )}

              <div className="mt-4 grid grid-cols-6 gap-1">
                {[
                  { label: "WhatsApp", icon: <WhatsAppIcon className="h-5 w-5" />, style: "bg-[#25D366] text-white", action: () => openLink("whatsapp", `https://wa.me/?text=${encodedText}`) },
                  { label: "Instagram", icon: <InstagramIcon className="h-5 w-5" />, style: "bg-[linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)] text-white", action: () => void shareInstagram(), needsFile: true },
                  { label: "LinkedIn", icon: <LinkedInIcon className="h-5 w-5" />, style: "bg-[#0A66C2] text-white", action: () => openLink("linkedin", `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`) },
                  { label: "Facebook", icon: <FacebookIcon className="h-5 w-5" />, style: "bg-[#1877F2] text-white", action: () => openLink("facebook", `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`) },
                  { label: "X", icon: <XIcon className="h-4 w-4" />, style: "bg-black text-white ring-1 ring-white/20", action: () => openLink("x", `https://x.com/intent/post?text=${encodedText}`) },
                  {
                    label: copied ? "Copied" : "Copy link",
                    icon: copied ? <Check className="h-5 w-5" /> : <Link2 className="h-5 w-5" />,
                    style: "bg-white/10 text-white",
                    action: () => {
                      record("copy");
                      void copyLink();
                    },
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    disabled={item.needsFile && !cardFile && !cardFailed}
                    className="flex flex-col items-center gap-1 whitespace-nowrap text-[10px] font-semibold tracking-tight text-white/75 disabled:opacity-50"
                  >
                    <span className={`flex h-11 w-11 items-center justify-center rounded-full transition active:scale-95 ${item.style}`}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              {message && <p role="status" className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-center text-xs leading-5 text-white/85">{message}</p>}
              <button type="button" onClick={dismiss} className="mt-4 w-full rounded-2xl py-2.5 text-sm font-semibold text-white/60 hover:text-white">
                Done
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

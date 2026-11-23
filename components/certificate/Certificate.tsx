"use client";

import { Cormorant_Garamond, Great_Vibes, Lato, Parisienne, Poppins } from "next/font/google";
import { useEffect, useId, useRef, useState, type Ref } from "react";
import {
  FALLBACK_BRANDING,
  brandText,
  useCertificateBranding,
  type CertificateBranding,
} from "./branding";

// Certificates load their own fonts so they look the same on every device,
// on screen and in the downloaded PDF.
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "block",
});
// The director's signature.
const script = Great_Vibes({
  subsets: ["latin"],
  weight: "400",
  display: "block",
});
// The recipient's name: still a flowing script, but with clearer capitals
// and open letters, so names read easily on screen and in print.
const nameScript = Parisienne({
  subsets: ["latin"],
  weight: "400",
  display: "block",
});
// The SabiRole wordmark (used when no logo image is set in settings).
const wordmark = Poppins({
  subsets: ["latin"],
  weight: ["700"],
  display: "block",
});
const sans = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "block",
});

// A certificate is always laid out at these exact pixel dimensions: Letter
// landscape at 96dpi (11in x 8.5in). On screen ScaledCertificate shrinks it
// as a whole; the PDF download captures it at this size, so the file matches
// what's on screen exactly.
export const CERT_WIDTH = 1056;
export const CERT_HEIGHT = 816;

// Where employers can check a certificate (the public /verify page).
const VERIFY_HOST = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://sabirole.com"
)
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");

const NAVY = "#1C1D52";
const GREEN = "#4ea83a";
const GOLD = "#c9a227";

export type CertificateContent = {
  /** e.g. "Certificate of Completion". */
  heading: string;
  /** Small line above the heading, e.g. "Official certification". */
  eyebrow: string;
  recipientName: string;
  /**
   * The sentence between the recipient and the achievement. "{academyName}"
   * and "{issuerName}" are filled from platform settings (./branding).
   */
  statement: string;
  /** The course or internship track, shown prominently. */
  achievement: string;
  /** A supporting line under the achievement, e.g. dates. */
  detail: string;
  issuedLabel: string;
  certificateNumber: string;
  verificationId?: string;
  /** When set, the certificate is stamped as revoked on this date. */
  revokedLabel?: string | null;
};

function nameSize(name: string) {
  if (name.length <= 22) return 70;
  if (name.length <= 30) return 60;
  if (name.length <= 40) return 50;
  return 42;
}

/** "SabiRole": "Sabi" in navy and "Role" in green, in Poppins. */
function Wordmark() {
  return (
    <p
      className="text-[46px] font-bold leading-none tracking-[-0.01em]"
      style={wordmark.style}
      aria-label="SabiRole"
    >
      <span style={{ color: NAVY }}>Sabi</span>
      <span style={{ color: GREEN }}>Role</span>
    </p>
  );
}

function Corner({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 80 80"
      className={`absolute h-20 w-20 ${className}`}
      aria-hidden="true"
    >
      <g fill="none" stroke={GOLD} strokeLinecap="round">
        <path d="M4 76 V4 H76" strokeWidth="2.5" />
        <path d="M14 76 V14 H76" strokeWidth="1" />
        <path
          d="M14 34 C24 34 34 24 34 14 M34 14 C30 22 22 30 14 34"
          strokeWidth="1.2"
        />
      </g>
      <path d="M24 24 l5 -5 l5 5 l-5 5 z" fill={GOLD} />
      <circle cx="4" cy="4" r="3.5" fill={GOLD} />
    </svg>
  );
}

function Seal({ id, issuerName }: { id: string; issuerName: string }) {
  // The ring fits 38 characters at 7.4px (e.g. "SABIROLE • CERTIFIED
  // EXCELLENCE •"); longer issuer names get smaller letters to still fit.
  const ringText = `${issuerName.toUpperCase()} • CERTIFIED EXCELLENCE •`;
  const ringFontSize = Math.min(7.4, (7.4 * 38) / ringText.length);
  // A gold rosette: a serrated outer ring around a smooth medallion.
  const points = Array.from({ length: 64 }, (_, i) => {
    const angle = (i / 64) * Math.PI * 2;
    const radius = i % 2 === 0 ? 50 : 45.5;
    return `${(60 + radius * Math.cos(angle)).toFixed(2)},${(60 + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
  return (
    <svg
      viewBox="0 0 120 150"
      className="h-[150px] w-[120px]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6dd8a" />
          <stop offset="50%" stopColor="#d9b03a" />
          <stop offset="100%" stopColor="#a8821c" />
        </linearGradient>
        <path
          id={`${id}-arc`}
          d="M60 60 m-31 0 a31 31 0 1 1 62 0 a31 31 0 1 1 -62 0"
        />
      </defs>
      <path d="M44 96 L34 146 L46 136 L54 148 L58 100 Z" fill={NAVY} />
      <path d="M76 96 L86 146 L74 136 L66 148 L62 100 Z" fill={GREEN} />
      <polygon points={points} fill={`url(#${id}-gold)`} />
      <circle
        cx="60"
        cy="60"
        r="41"
        fill="none"
        stroke="#fff6d6"
        strokeWidth="1.2"
      />
      <circle cx="60" cy="60" r="38" fill={NAVY} />
      <circle
        cx="60"
        cy="60"
        r="35.5"
        fill="none"
        stroke={GOLD}
        strokeWidth="0.8"
      />
      {/* Text fitted exactly once around the circle (2πr, r = 31). */}
      <text
        fill="#f6dd8a"
        fontSize={ringFontSize.toFixed(2)}
        fontWeight="700"
        style={sans.style}
      >
        <textPath
          href={`#${id}-arc`}
          startOffset="0"
          textLength="190"
          lengthAdjust="spacing"
        >
          {ringText}
        </textPath>
      </text>
      <path
        d="M60 45 l4.4 9 9.9 1.4 -7.2 7 1.7 9.9 -8.8 -4.7 -8.8 4.7 1.7 -9.9 -7.2 -7 9.9 -1.4 z"
        fill="#f6dd8a"
      />
    </svg>
  );
}

export function CertificateFace({
  content,
  ref,
  branding: brandingOverride,
}: {
  content: CertificateContent;
  ref?: Ref<HTMLDivElement>;
  /** Defaults to the platform settings (loaded once per page). */
  branding?: CertificateBranding;
}) {
  const id = useId().replace(/:/g, "");
  const loaded = useCertificateBranding();
  const branding = brandingOverride ?? loaded ?? FALLBACK_BRANDING;
  return (
    <div
      ref={ref}
      className={`${sans.className} relative overflow-hidden bg-[#fffdf8] text-[#1C1D52]`}
      style={{
        width: CERT_WIDTH,
        height: CERT_HEIGHT,
      }}
    >
      {/* Guilloche-style watermark */}
      <svg
        viewBox="0 0 600 600"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 opacity-[0.06]"
        aria-hidden="true"
      >
        {Array.from({ length: 18 }, (_, i) => (
          <circle
            key={i}
            cx={(300 + 60 * Math.cos((i / 18) * Math.PI * 2)).toFixed(2)}
            cy={(300 + 60 * Math.sin((i / 18) * Math.PI * 2)).toFixed(2)}
            r="220"
            fill="none"
            stroke={GREEN}
            strokeWidth="1.5"
          />
        ))}
      </svg>

      {/* Navy outer frame. Drawn as its own layer rather than a CSS border on
          the certificate, so positions inside are identical in the PDF. */}
      <div
        className="absolute inset-0"
        style={{ border: `14px solid ${NAVY}` }}
      />
      {/* Double gold frame and corner ornaments */}
      <div
        className="absolute inset-[36px]"
        style={{ border: `2px solid ${GOLD}` }}
      />
      <div
        className="absolute inset-[44px]"
        style={{ border: `1px solid ${GOLD}99` }}
      />
      <Corner className="left-[28px] top-[28px]" />
      <Corner className="right-[28px] top-[28px] -scale-x-100" />
      <Corner className="bottom-[28px] left-[28px] -scale-y-100" />
      <Corner className="bottom-[28px] right-[28px] -scale-100" />

      {/* Main text, centred in the space above the signature row */}
      <div className="absolute inset-x-[102px] bottom-[228px] top-[64px] flex flex-col items-center justify-center text-center">
        {/* A logo image set in settings, else the SabiRole wordmark. A
            plain <img>: the logo may be any URL, and the PDF capture
            inlines it as it is. */}
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt={branding.academyName}
            className="h-[52px] w-auto max-w-[320px] object-contain"
          />
        ) : (
          <Wordmark />
        )}
        <p
          className="mt-4 text-[11px] font-bold uppercase tracking-[0.38em]"
          style={{ color: GREEN }}
        >
          {content.eyebrow}
        </p>
        {/* Not an <h2>: the site forces its own font and size on headings. */}
        <p
          role="heading"
          aria-level={2}
          className="mt-1 text-[64px] font-bold leading-none tracking-[0.01em]"
          style={{ ...serif.style, color: NAVY }}
        >
          {content.heading}
        </p>
        <div className="mt-4 flex items-center gap-3" aria-hidden="true">
          <span className="h-px w-28" style={{ background: GOLD }} />
          <span
            className="h-2.5 w-2.5 rotate-45"
            style={{ background: GOLD }}
          />
          <span className="h-px w-28" style={{ background: GOLD }} />
        </div>
        <p className="mt-6 text-[12px] font-bold uppercase tracking-[0.24em] text-slate-500">
          This certificate is proudly presented to
        </p>
        <p
          className="mt-2 leading-[1.2]"
          style={{
            ...nameScript.style,
            color: NAVY,
            fontSize: nameSize(content.recipientName),
          }}
        >
          {content.recipientName}
        </p>
        <span className="mt-1 h-[2px] w-[560px]" style={{ background: GOLD }} />
        <p className="mt-6 max-w-[660px] text-balance text-[15px] leading-[26px] text-slate-600">
          {brandText(content.statement, branding)}
        </p>
        <p
          className="mt-3 max-w-[780px] text-[30px] font-black leading-tight"
          style={{ color: GREEN }}
        >
          {content.achievement}
        </p>
        {content.detail && (
          <p className="mt-2 text-[13px] text-slate-500">{content.detail}</p>
        )}
      </div>

      <div className="absolute inset-x-[110px] bottom-[66px] grid grid-cols-[1fr_auto_1fr] items-end gap-8">
        <div className="text-left">
          <p className="text-[34px] leading-none" style={script.style}>
            Emmanuel Thomas
          </p>
          <div className="mt-2 w-56 border-t border-slate-300 pt-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]">
              Emmanuel Thomas
            </p>
            <p className="text-[10px] text-slate-500">Academy Director</p>
          </div>
        </div>
        <Seal id={id} issuerName={branding.issuerName} />
        <div className="text-right">
          <p
            className="text-[22px] font-semibold leading-none"
            style={serif.style}
          >
            {content.issuedLabel}
          </p>
          <div className="ml-auto mt-2 w-56 border-t border-slate-300 pt-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]">
              Date of issue
            </p>
            <p className="text-[10px] text-slate-500">
              Certificate No. {content.certificateNumber}
            </p>
            {content.verificationId && (
              <p className="text-[10px] text-slate-500">
                Verification ID {content.verificationId}
              </p>
            )}
            <p className="text-[10px] font-semibold" style={{ color: GREEN }}>
              Verify at {VERIFY_HOST}/verify
            </p>
          </div>
        </div>
      </div>

      {content.revokedLabel && (
        <>
          <div className="absolute inset-0 bg-white/45" aria-hidden="true" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[18deg] rounded-xl border-[6px] border-red-600 px-12 py-5 text-center text-red-600 shadow-[0_0_0_3px_rgba(255,255,255,0.8)]">
            <p className="text-[96px] font-black uppercase leading-none tracking-[0.12em]">
              Revoked
            </p>
            <p className="mt-2 text-[16px] font-bold uppercase tracking-[0.3em]">
              {content.revokedLabel}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Shrinks the fixed-size certificate to fit its container without changing
 * its internal layout, so it never reflows differently on a phone.
 */
export function ScaledCertificate({
  content,
  faceRef,
}: {
  content: CertificateContent;
  faceRef?: Ref<HTMLDivElement>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // ResizeObserver also reports the initial size when observing starts.
    const observer = new ResizeObserver(() =>
      setScale(Math.min(1, container.clientWidth / CERT_WIDTH)),
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="mx-auto w-full overflow-hidden rounded-sm shadow-[0_18px_50px_rgba(28,29,82,0.18)]"
      style={{ maxWidth: CERT_WIDTH, height: CERT_HEIGHT * scale }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: CERT_WIDTH,
          height: CERT_HEIGHT,
        }}
      >
        <CertificateFace content={content} ref={faceRef} />
      </div>
    </div>
  );
}

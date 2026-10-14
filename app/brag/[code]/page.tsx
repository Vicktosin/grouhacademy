import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cardUrl, loadShareCard, shareUrl } from "@/lib/referrals";
import BragRedirect from "./BragRedirect";

// The link on an intern's achievement card. Link previews (WhatsApp, LinkedIn,
// Facebook, X) read the card from these tags; people who tap it go straight
// on to sign up (the register page records the visit with ?ref).

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const card = await loadShareCard((await params).code);
  if (!card) return { title: "Grouh Academy", robots: { index: false } };
  const title = `${card.name} just unlocked "${card.title}"`;
  const description = card.track
    ? `${card.name} earned this in Grouh Academy's ${card.track} internship. Start your own internship today.`
    : `${card.name} earned this at Grouh Academy. Start your own internship today.`;
  const image = { url: cardUrl(card.code, card.photoKey, "og"), width: 600, height: 600, alt: title };
  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: shareUrl(card.code) },
    openGraph: { type: "website", siteName: "Grouh Academy", url: shareUrl(card.code), title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default async function BragPage({ params }: Props) {
  const card = await loadShareCard((await params).code);
  if (!card) notFound();
  const register = `/register?ref=${encodeURIComponent(card.code)}`;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#14153F] px-4 py-10 text-center text-white">
      {/* eslint-disable-next-line @next/next/no-img-element -- the generated card, already sized */}
      <img
        src={cardUrl(card.code, card.photoKey)}
        alt={`${card.name}'s achievement: ${card.title}`}
        width={1080}
        height={1080}
        className="w-full max-w-[420px] rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
      />
      <a href={register} className="rounded-full bg-[#5FBB46] px-8 py-3.5 text-base font-black text-[#14153F]">
        Start your internship
      </a>
      <BragRedirect to={register} />
    </main>
  );
}

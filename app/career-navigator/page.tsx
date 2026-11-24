import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import CareerNavigator from "@/components/career-navigator/CareerNavigator";
import { SKILL_IDS, SKILLS, type NavigatorOffer, type SkillId } from "@/lib/career-navigator";
import { getPrisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["400", "600", "800"], display: "swap" });

export const metadata: Metadata = {
  title: "Career Navigator: find the digital skill that fits you",
  description: "Answer 12 quick questions and find the digital skill that suits your strengths. Free, by Sabirole.",
  alternates: { canonical: "/career-navigator" },
};

// New tracks and price changes appear within about ten minutes.
export const revalidate = 600;

/** Each skill's open track and price, or null if they can't be loaded. */
async function loadOffers(): Promise<Partial<Record<SkillId, NavigatorOffer>> | null> {
  try {
    const programs = await getPrisma().internshipProgram.findMany({
      where: { status: "PUBLISHED" },
      select: { name: true, slug: true, acceptanceFee: true },
    });
    const offers: Partial<Record<SkillId, NavigatorOffer>> = {};
    for (const id of SKILL_IDS) {
      const program = programs.find(({ name }) => SKILLS[id].match.test(name));
      if (program) offers[id] = { slug: program.slug, price: program.acceptanceFee };
    }
    return offers;
  } catch (error) {
    console.error("Unable to load tracks for Career Navigator", error);
    return null;
  }
}

export default async function CareerNavigatorPage() {
  return (
    <div className={display.className}>
      <CareerNavigator offers={await loadOffers()} siteUrl={getSiteUrl()} leadForm={Boolean(process.env.CAREER_NAVIGATOR_SHEET_URL && process.env.CAREER_NAVIGATOR_SHEET_SECRET)} />
    </div>
  );
}

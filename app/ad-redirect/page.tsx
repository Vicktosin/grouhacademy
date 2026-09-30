import type { Metadata } from "next";
import Image from "next/image";
import { Lato } from "next/font/google";
import { WhatsAppIcon } from "@/components/CommunityInvite";
import CommunityLink from "@/components/CommunityLink";
import logo from "../../public/logo.png";
import teamImage from "../../public/internship-team.jpg";

// Same heavy display face as the internship landing page.
const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Join our community",
  description:
    "Learn more about the Grouh Academy internship program in our WhatsApp community.",
  alternates: { canonical: "/ad-redirect" },
  // Ad traffic only; keep it out of search results.
  robots: { index: false, follow: false },
};

export default function AdRedirectPage() {
  return (
    <main
      className={`lp ${lato.className} relative min-h-screen overflow-hidden bg-[#f7faf7] text-[#141650]`}
    >
      <div className="hero-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-8 sm:px-8">
        <Image
          className="h-10 w-auto self-start"
          src={logo}
          alt="Grouh Academy"
          priority
        />

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1">
            <h1 className="text-[clamp(3rem,7vw,5rem)] font-black leading-none tracking-[-0.045em]">
              Welcome<span className="text-[#5FBB46]">.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-slate-600 sm:text-xl">
              To learn more about our internship program, join our community.
              Click the link below.
            </p>
            <CommunityLink
              location="ad_page"
              className="button-primary mt-9 w-full text-base sm:w-auto"
            >
              <WhatsAppIcon className="h-5 w-5" />
              Join our community
            </CommunityLink>
          </div>

          <div className="order-1 lg:order-2">
            <div className="overflow-hidden rounded-[2rem] bg-[#141650] p-2.5 shadow-[0_30px_80px_-28px_rgba(20,22,80,.45)]">
              <Image
                className="aspect-[4/3] w-full rounded-[1.45rem] object-cover"
                src={teamImage}
                alt="Grouh Academy interns collaborating on a project"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

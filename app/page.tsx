import CurriculumSection from "@/components/CurriculumSection";
import Whyus from "@/components/Whyus";
import Container from "../components/Container";
import React from "react";
import InternshipSection from "@/components/InternshipSection";
import LearningProcess from "@/components/LearningProcess";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { getPublicTracks } from "@/lib/public-tracks";
import { listPublicTestimonials } from "@/lib/testimonials";

// Newly approved testimonials appear within about ten minutes.
export const revalidate = 600;

export const metadata: Metadata = {
  title: "Get Work Experience with Our Virtual Internship",
  description:
    "Your gateway to rewarding internship experience. Build practical skills through SabiRole's virtual internship.",
  alternates: { canonical: "/" },
};

/** The homepage still renders (and builds) if the database can't be reached. */
async function internTestimonials() {
  try {
    return await listPublicTestimonials();
  } catch (error) {
    console.error("Unable to load intern testimonials for the homepage", error);
    return [];
  }
}

const page = async () => {
  const [testimonials, tracks] = await Promise.all([internTestimonials(), getPublicTracks()]);
  const siteUrl = getSiteUrl();
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "EducationalOrganization",
        "@id": `${siteUrl}/#organization`,
        name: "SabiRole",
        url: siteUrl,
        logo: `${siteUrl}/logo.png`,
        description:
          "Virtual internships that build practical work experience.",
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "SabiRole",
        url: siteUrl,
        publisher: { "@id": `${siteUrl}/#organization` },
      },
    ],
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="relative min-h-screen pt-24 pb-8 md:pt-32 md:pb-14">
        <div className="pointer-events-none absolute inset-0 -z-10 h-full">
          {/* Background Video */}
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          >
            <source src="CAN_YOU_CONVERT_THESE_IMAGE_TO.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#000C33_0%,rgba(0,12,51,0.9)_25%,rgba(0,12,51,0.6)_50%,rgba(0,12,51,0.25)_75%,rgba(0,12,51,0)_100%)]" />
        </div>
        <Container className="relative z-10">
          <div className="grid gap-10 xl:grid-cols-[1.5fr_0.5fr] xl:items-center">
            <div className="max-w-2xl bg-[#ffffff]/10 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl shadow-slate-950/30">
              <span className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/90 shadow-lg shadow-slate-950/20">
                <span className="h-2.5 w-2.5 rounded-full bg-[#5FBB46]" />
                2,000+ people trained
              </span>

              <h1 className="hero-title mt-8 text-5xl font-bold tracking-tight text-white sm:text-7xl">
                Get work experience with our{" "}
                <span className="text-[#5FBB46]">virtual internship</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-white/75">
                Your gateway to rewarding internship.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <a
                  href="/register"
                  className="inline-flex items-center justify-center rounded-full bg-[#5FBB46] px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-[#5FBB46]/30 transition hover:bg-[#4aaa3e]"
                >
                  Apply for Internship
                </a>
              </div>
            </div>

          </div>

        </Container>
      </section>
      <Whyus />
      <CurriculumSection tracks={tracks} />
      <InternshipSection />
      <LearningProcess />
      <Testimonials interns={testimonials} />
      <FAQ />
    </main>
  );
};

export default page;

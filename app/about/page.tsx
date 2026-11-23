import AboutCTA from "@/components/AboutCTA";
import AboutHero from "@/components/AboutHero";
import AcademyStats from "@/components/AcademyStats";
import LearningPhilosophy from "@/components/LearningPhilosophy";
import MeetTheTeam from "@/components/MeetTheTeam";
import MissionVision from "@/components/MissionVision";
import OurStory from "@/components/OurStory";
import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About SabiRole",
  description:
    "Learn how SabiRole helps people build practical digital skills and move confidently into the next stage of their careers.",
  alternates: { canonical: "/about" },
};

const page = () => {
  return (
    <div>
      <AboutHero />
      <OurStory />
      <MissionVision />
      <LearningPhilosophy />
      <AcademyStats />
      <MeetTheTeam />
      <AboutCTA />
    </div>
  );
};

export default page;

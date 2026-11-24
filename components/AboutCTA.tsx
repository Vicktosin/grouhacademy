import Link from "next/link";
import React from "react";

const AboutCTA = () => {
  return (
    <section className="py-24 lg:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div
          className="rounded-3xl overflow-hidden relative"
          style={{
            background: "linear-gradient(135deg, #141650 0%, #0d0f3a 100%)",
            minHeight: 320,
          }}
        >
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute rounded-full"
              style={{
                width: 400,
                height: 400,
                top: "-100px",
                left: "50%",
                transform: "translateX(-50%)",
                background:
                  "radial-gradient(circle, rgba(77,184,72,0.12) 0%, transparent 70%)",
              }}
            />
          </div>
          <div className="relative text-center py-20 px-8">
            <p
              className="text-xs font-bold tracking-widest uppercase mb-4"
              style={{ color: "#4db848" }}
            >
              Ready to start?
            </p>
            <h2
              className="text-4xl lg:text-5xl font-black text-white mb-6"
              style={{ fontFamily: "Fraunces, serif" }}
            >
              You've seen who we are.
              <br />
              Now let's build your future.
            </h2>
            <p className="text-white/60 text-lg mb-10 max-w-lg mx-auto">
              Join 2,000+ people who chose to learn differently — and land
              differently.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/tracks"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-white font-bold text-base transition-all hover:scale-105"
                style={{ background: "#4db848" }}
              >
                Browse Tracks
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 12h14M12 5l7 7-7 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <Link
                href="/internship"
                className="inline-flex items-center justify-center px-8 py-4 rounded-full font-bold text-base border-2 text-white transition-all hover:bg-white/10"
                style={{ borderColor: "rgba(255,255,255,0.25)" }}
              >
                Apply for Internship
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutCTA;

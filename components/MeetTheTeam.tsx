"use client";

import React, { useState } from "react";
import { TEAM } from "@/constants/data/team";

const MeetTheTeam = () => {
  const [active, setActive] = useState<number | null>(null);

  return (
    <section className="py-24 lg:py-32" style={{ background: "#f8f9fe" }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-16">
          <div>
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-8 h-px" style={{ background: "#4db848" }} />
              <span
                className="text-xs font-bold tracking-widest uppercase"
                style={{ color: "#4db848" }}
              >
                The people
              </span>
            </div>
            <h2
              className="text-4xl lg:text-5xl font-black leading-tight"
              style={{ fontFamily: "Fraunces, serif", color: "#141650" }}
            >
              Meet the team
              <br />
              behind the work.
            </h2>
          </div>
          <p
            className="text-base leading-relaxed max-w-sm lg:text-right"
            style={{ color: "#9295b8" }}
          >
            Practitioners first, educators second. Everyone on our team has done
            the work they teach.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 max-w-3xl">
          {TEAM.map((member, i) => (
            <div
              key={i}
              className="group rounded-2xl overflow-hidden border-2 transition-all duration-300 cursor-pointer"
              style={{
                borderColor: active === i ? "#4db848" : "#e8e9f8",
                background: "white",
                transform: active === i ? "translateY(-4px)" : "none",
                boxShadow:
                  active === i ? "0 16px 40px rgba(77,184,72,0.15)" : "none",
              }}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <div
                className="relative overflow-hidden"
                style={{ aspectRatio: "4/5", background: "#f3f4fc" }}
              >
                <img
                  src={member.avatar}
                  alt={`${member.name}, ${member.role}`}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              <div className="p-6">
                <p
                  className="font-black text-base mb-0.5"
                  style={{ color: "#141650" }}
                >
                  {member.name}
                </p>
                <p
                  className="text-xs font-semibold mb-3"
                  style={{ color: "#4db848" }}
                >
                  {member.role}
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "#6b6f9a" }}
                >
                  {member.bio}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MeetTheTeam;

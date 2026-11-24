import React from "react";

const PROCESS_STEPS: { num: string; label: string; desc: string }[] = [
  { num: "01", label: "Onboarding", desc: "Choose your internship track and level." },
  { num: "02", label: "Optional assessment", desc: "Take a short skills check if you want to." },
  { num: "03", label: "Payment", desc: "Complete payment to secure your place." },
  { num: "04", label: "Start internship", desc: "Begin your tailored internship journey." },
  { num: "05", label: "Build", desc: "Work on practical tasks and build real projects." },
];

const LearningProcess = () => {
  return (
    <section className="py-24 lg:py-32 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-px" style={{ backgroundColor: "#4db848" }} />
            <span
              className="text-sm font-semibold tracking-widest uppercase"
              style={{ color: "#4db848" }}
            >
              The Path
            </span>
            <div className="w-8 h-px" style={{ backgroundColor: "#4db848" }} />
          </div>
          <h2
            className="text-4xl lg:text-5xl font-black leading-tight"
            style={{ fontFamily: "Fraunces, serif", color: "#141650" }}
          >
            Your path to practical work experience.
          </h2>
        </div>

        <div className="relative">
          {/* Connector line */}
          <div
            className="hidden lg:block absolute top-10 left-0 right-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, #e8e9f8 10%, #e8e9f8 90%, transparent)",
              top: "2.5rem",
            }}
          />

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-4">
            {PROCESS_STEPS.map((step, i) => (
              <div
                key={i}
                className="relative flex flex-col items-center text-center group"
              >
                {/* Node */}
                <div
                  className="relative w-20 h-20 rounded-2xl flex flex-col items-center justify-center mb-4 z-10 border-2 transition-all duration-300 group-hover:shadow-lg"
                  style={{
                    backgroundColor:
                      i === 4 ? "#141650" : i % 2 === 0 ? "#f2fbf2" : "#f3f4fc",
                    borderColor:
                      i === 4 ? "#141650" : i % 2 === 0 ? "#4db848" : "#e8e9f8",
                  }}
                >
                  <span
                    className="text-xs font-bold tracking-widest"
                    style={{ color: i === 4 ? "#4db848" : "#a0a3c4" }}
                  >
                    {step.num}
                  </span>
                </div>
                <h3
                  className="font-bold text-sm mb-2 leading-tight"
                  style={{ color: "#141650" }}
                >
                  {step.label}
                </h3>
                <p className="text-gray-400 text-xs leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default LearningProcess;

import React from "react";

const Requirements = () => {
  const general = [
    "Conversational English — written and spoken",
    "Stable internet connection and a working laptop or desktop",
    "Genuine motivation to learn, ship, and receive critique",
  ];

  return (
    <section className="py-24" id="requirements">
      <div className="max-w-6xl mx-auto px-6">
        <div>
          <div>
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-8 h-px" style={{ background: "#4db848" }} />
              <span
                className="text-xs font-bold tracking-widest uppercase"
                style={{ color: "#4db848" }}
              >
                Prerequisites
              </span>
              <div className="w-8 h-px" style={{ background: "#4db848" }} />
            </div>
            <h2
              className="font-display font-black text-[#1C1D52] mb-6"
              style={{
                fontSize: "clamp(2rem, 4vw, 3rem)",
                letterSpacing: "-0.02em",
              }}
            >
              Requirements
            </h2>
            <p className="text-slate-400 mb-8 leading-relaxed text-sm">
              All applicants must meet these general requirements.
            </p>
            <div className="flex flex-col gap-3">
              {general.map((r, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: "rgba(77,184,72,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  >
                    <span
                      style={{
                        color: "#5FBB46",
                        fontSize: "10px",
                        fontWeight: 700,
                      }}
                    >
                      {i + 1}
                    </span>
                  </div>
                  <p className="text-[#1C1D52] text-sm leading-relaxed">{r}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Requirements;

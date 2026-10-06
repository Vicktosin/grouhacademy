import { ImageResponse } from "next/og";
import type { FollowUpRow } from "@/lib/internship-follow-ups";

// The square application-summary card attached to an applicant's follow-up
// WhatsApp message.

const NAVY = "#1C1D52";
const GREEN = "#5FBB46";

function date(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });
}

export function followUpCardImage(row: FollowUpRow) {
  const passed = row.stage === "PASSED_UNPAID";
  // The image font may lack the naira sign, so spell the currency out.
  const fee = row.fee === null ? "—" : `NGN ${row.fee.toLocaleString("en-NG")}`;
  const details: Array<[string, string]> = [
    ["Track", row.track],
    ["Level", row.level],
    [
      "Entrance exam",
      row.score === null
        ? "—"
        : `${row.score}%${row.passMark !== null ? `  (pass mark ${row.passMark}%)` : ""}`,
    ],
    ["Status", passed ? "Passed — awaiting acceptance fee" : "Not passed yet"],
    ["Acceptance fee", fee],
    [
      "Next cohort",
      row.nextCohort
        ? `Starts ${date(row.nextCohort.startDate)}`
        : "Starting soon",
    ],
  ];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#F0F7FF",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          backgroundColor: NAVY,
          color: "white",
          padding: "52px 72px 44px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 6,
            color: "#9be28a",
            fontWeight: 700,
          }}
        >
          GROUH ACADEMY · INTERNSHIP
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            marginTop: 20,
            opacity: 0.75,
          }}
        >
          Application summary for
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 58,
            fontWeight: 800,
            marginTop: 8,
            lineHeight: 1.1,
          }}
        >
          {row.name}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            alignSelf: "flex-start",
            backgroundColor: passed ? GREEN : "#f59e0b",
            color: NAVY,
            borderRadius: 999,
            padding: "12px 28px",
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          {passed ? "You passed the entrance exam" : "So close — try again"}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          margin: "32px 72px 0",
          backgroundColor: "white",
          borderRadius: 32,
          padding: "16px 40px",
        }}
      >
        {details.map(([label, value], index) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "17px 0",
              borderTop: index === 0 ? "none" : "2px solid #E7EEF8",
              fontSize: 28,
            }}
          >
            <div style={{ display: "flex", color: "#64748b" }}>{label}</div>
            <div
              style={{
                display: "flex",
                color: NAVY,
                fontWeight: 700,
                maxWidth: 560,
                textAlign: "right",
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: "auto",
          padding: "28px 72px 40px",
        }}
      >
        <div
          style={{
            display: "flex",
            backgroundColor: passed ? GREEN : NAVY,
            color: passed ? NAVY : "white",
            borderRadius: 20,
            padding: "24px 40px",
            fontSize: 32,
            fontWeight: 800,
          }}
        >
          {passed
            ? "Log in and pay your acceptance fee"
            : "Log in and retake the assessment"}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontSize: 24,
            color: "#64748b",
          }}
        >
          {row.values.loginLink.replace(/^https?:\/\//, "")}
        </div>
      </div>
    </div>,
    {
      width: 1080,
      height: 1080,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

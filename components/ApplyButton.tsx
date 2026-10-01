"use client";

import { sendGAEvent } from "@next/third-parties/google";
import Link from "next/link";
import { trackMetaEvent } from "@/lib/meta-pixel";
import LpIcon, { ENROLL_URL } from "./LpIcon";

/** Landing page "Proceed to register" link; reports a lead to Meta Pixel and GA on click. */
export default function ApplyButton() {
  return (
    <Link
      className="button-primary mt-8 text-base"
      href={ENROLL_URL}
      onClick={() => {
        trackMetaEvent("Lead");
        // GA4's recommended lead event, so it appears in its lead reports.
        sendGAEvent("event", "generate_lead", { location: "landing_page" });
      }}
    >
      Proceed to register
      <LpIcon name="arrow" />
    </Link>
  );
}

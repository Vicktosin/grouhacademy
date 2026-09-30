"use client";

import { sendGAEvent } from "@next/third-parties/google";
import type { ReactNode } from "react";
import { COMMUNITY_URL } from "@/lib/community";

/**
 * Link to the WhatsApp community that also records a `join_community` event in
 * Google Analytics. `location` names where the click came from (e.g.
 * "ad_page"), so each placement can be compared in GA reports.
 */
export default function CommunityLink({
  location,
  className,
  children,
}: {
  location: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={COMMUNITY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => sendGAEvent("event", "join_community", { location })}
    >
      {children}
    </a>
  );
}

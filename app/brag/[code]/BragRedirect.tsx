"use client";

import { useEffect } from "react";

/** Sends people on to sign up at once (link-preview bots don't run this, so they keep the card). */
export default function BragRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return null;
}

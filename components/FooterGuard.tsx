"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { isAppRoute } from "@/lib/app-routes";
import Footer from "./Footer";

export default function FooterGuard() {
  const pathname = usePathname() || "/";

  // The public footer belongs to the marketing site only.
  if (isAppRoute(pathname)) return null;

  return <Footer />;
}

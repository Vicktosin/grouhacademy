"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { isAppRoute } from "@/lib/app-routes";
import Header from "./Header";

export default function HeaderGuard() {
  const pathname = usePathname() || "/";

  // The public header belongs to the marketing site only.
  if (isAppRoute(pathname)) return null;

  return <Header />;
}

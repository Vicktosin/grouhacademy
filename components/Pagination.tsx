"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

// Page navigation for admin tables. Shows the first and last pages and the
// ones around the current page ("1 … 4 5 6 … 20") instead of every number,
// so it fits a phone screen however many pages there are; on small screens
// Previous/Next shrink to arrows.

/** The page numbers to show, with null for a gap. */
export function pageWindow(page: number, totalPages: number): Array<number | null> {
  const shown = new Set([1, totalPages, page - 1, page, page + 1]);
  const pages = [...shown].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const out: Array<number | null> = [];
  pages.forEach((n, i) => {
    if (i > 0 && n - pages[i - 1] > 1) {
      // A gap of exactly one page shows that page rather than "…".
      if (n - pages[i - 1] === 2) out.push(n - 1);
      else out.push(null);
    }
    out.push(n);
  });
  return out;
}

export default function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const edge =
    "inline-flex h-8 items-center gap-1 rounded-lg px-2.5 shadow-[inset_0_0_0_1px_#d8dee8] disabled:opacity-40 sm:px-3";
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className={edge}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-3 w-3" />
        <span className="hidden sm:inline">Previous</span>
      </button>
      {pageWindow(page, totalPages).map((number, index) =>
        number === null ? (
          <span key={`gap-${index}`} className="px-1 text-slate-400">
            …
          </span>
        ) : (
          <button
            key={number}
            type="button"
            onClick={() => onChange(number)}
            aria-current={page === number ? "page" : undefined}
            className={`h-8 min-w-8 rounded-lg px-1 text-[10px] ${page === number ? "bg-[#1C1D52] text-white" : "shadow-[inset_0_0_0_1px_#d8dee8]"}`}
          >
            {number}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className={edge}
        aria-label="Next page"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="h-3 w-3" />
      </button>
    </nav>
  );
}

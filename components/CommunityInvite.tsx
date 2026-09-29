import { ExternalLink, MessageCircle } from "lucide-react";
import { COMMUNITY_URL } from "@/lib/community";

/** WhatsApp community invite card used across the internship application flow. */
export default function CommunityInvite({
  title,
  description,
  className = "",
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <aside
      className={`flex flex-col gap-5 rounded-2xl border border-[#5FBB46]/20 bg-white p-6 text-left shadow-[0_8px_24px_rgba(28,29,82,0.09)] sm:flex-row sm:items-center sm:p-7 ${className}`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e8f7eb] text-[#5FBB46]">
        <MessageCircle className="h-5 w-5" />
      </span>
      <div className="flex-1">
        <h2 className="text-base font-bold text-[#1C1D52]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <a
        href={COMMUNITY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#5FBB46] px-4 py-3 text-xs font-bold text-[#3f9a2c] transition hover:bg-[#5FBB46] hover:text-white"
      >
        Join the community
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </aside>
  );
}

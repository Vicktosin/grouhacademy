import { renderAchievementCard } from "@/lib/achievement-card";
import { loadShareCard } from "@/lib/referrals";

/** The share card image (public: it's what the intern chose to post). ?size=og for link previews. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const card = await loadShareCard((await params).code);
  if (!card) return new Response("Not found", { status: 404 });
  const size = new URL(request.url).searchParams.get("size") === "og" ? "og" : "full";
  try {
    return await renderAchievementCard(card, size);
  } catch (error) {
    console.error("[brag] Card image failed.", error);
    return new Response("The card couldn't be drawn.", { status: 500 });
  }
}

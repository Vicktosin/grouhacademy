import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { handleTavusEvent } from "@/lib/interviews";
import { tavusConfig } from "@/lib/tavus";

// Tavus conversation callbacks (shutdown, transcript, recording). Tavus
// doesn't sign callbacks, so the URL carries TAVUS_WEBHOOK_SECRET.

function secretMatches(given: string | null, expected: string) {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const config = tavusConfig();
  const secret = new URL(request.url).searchParams.get("secret");
  if (!config || !secretMatches(secret, config.webhookSecret))
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const event = await request.json().catch(() => null);
  if (!event || typeof event !== "object")
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  try {
    await handleTavusEvent(event);
  } catch (error) {
    console.error("[tavus-webhook] Failed to handle event.", error);
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

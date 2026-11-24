import { NextResponse } from "next/server";
import { SKILL_IDS, SKILLS, type SkillId } from "@/lib/career-navigator";

// Saves a Career Navigator lead to a Google Sheet, through the Apps Script in
// docs/career-navigator-sheet.md. Nothing goes in our database.

function field(body: unknown, key: string) {
  const value = (body as Record<string, unknown> | null)?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function problem(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  const url = process.env.CAREER_NAVIGATOR_SHEET_URL;
  const secret = process.env.CAREER_NAVIGATOR_SHEET_SECRET;
  const unavailable = "We couldn't save that right now. Please join the WhatsApp community instead.";
  if (!url || !secret) return problem(unavailable, 503);

  const body = await request.json().catch(() => null);
  // Hidden field: people never see it, spam bots fill it in.
  if (field(body, "website")) return NextResponse.json({ ok: true });

  const name = field(body, "name");
  const phone = field(body, "phone").replace(/[\s()-]/g, "");
  const skill = field(body, "skill") as SkillId;
  if (!name || name.length > 80) return problem("Please enter your name.");
  if (!/^\+?\d{10,15}$/.test(phone)) return problem("Please enter a valid WhatsApp number.");
  if (!SKILL_IDS.includes(skill)) return problem("Please take the quiz first.");
  if ((body as { consent?: unknown }).consent !== true) return problem("Please tick the box so we may message you.");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, name, phone, skill: SKILLS[skill].name }),
      signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok !== true) throw new Error(`Sheet answered ${response.status}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Unable to save a Career Navigator lead", error);
    return problem(unavailable, 503);
  }
}

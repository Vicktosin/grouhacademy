import { NextResponse } from "next/server";
import { Resend } from "resend";

import { CONTACT_INBOX, CONTACT_SENDER, CONTACT_TOPICS } from "@/lib/contact";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function field(body: unknown, key: string) {
  const value = (body as Record<string, unknown> | null)?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  // Hidden "website" field: people never see it, spam bots fill it in.
  // Pretend success so bots don't learn they were caught.
  if (field(body, "website")) return NextResponse.json({ ok: true });

  const name = field(body, "name");
  const email = field(body, "email");
  const message = field(body, "message");
  const topic = CONTACT_TOPICS[field(body, "topic")] ?? CONTACT_TOPICS.other;

  if (!name || name.length > 100)
    return NextResponse.json(
      { error: "Please enter your name (up to 100 characters)." },
      { status: 400 },
    );
  if (!EMAIL_PATTERN.test(email) || email.length > 254)
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  if (!message || message.length > 5000)
    return NextResponse.json(
      { error: "Please enter a message (up to 5,000 characters)." },
      { status: 400 },
    );

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Contact form: RESEND_API_KEY is not set.");
    return NextResponse.json(
      { error: "Messages can't be sent right now. Please email us directly." },
      { status: 503 },
    );
  }

  const { error } = await new Resend(apiKey).emails.send({
    from: CONTACT_SENDER,
    to: CONTACT_INBOX,
    // Replying in the inbox goes straight to the person who wrote in.
    replyTo: email,
    subject: `Contact form: ${topic} — ${name}`,
    text: `Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\n${message}`,
    html: `<p><strong>Name:</strong> ${escapeHtml(name)}<br><strong>Email:</strong> ${escapeHtml(email)}<br><strong>Topic:</strong> ${escapeHtml(topic)}</p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
  });

  if (error) {
    console.error("Contact form: Resend rejected the email.", error);
    return NextResponse.json(
      { error: "Your message couldn't be sent. Please try again shortly." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}

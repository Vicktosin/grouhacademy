"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Mail, MapPin, MessageSquare, Phone } from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { CONTACT_INBOX, CONTACT_TOPICS } from "@/lib/contact";

const contactDetails = [
  {
    icon: Mail,
    label: "Email us",
    value: CONTACT_INBOX,
    href: `mailto:${CONTACT_INBOX}`,
  },
  {
    icon: Phone,
    label: "Call us",
    value: "+234 800 123 4567",
    href: "tel:+2348001234567",
  },
  { icon: MapPin, label: "Based in", value: "Lagos, Nigeria", href: "#" },
];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          Object.fromEntries(new FormData(event.currentTarget)),
        ),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.error ?? "Your message couldn't be sent.");
      setSubmitted(true);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Your message couldn't be sent.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-[#141650]">
      <section className="bg-[#141650] text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
          <Breadcrumbs current="Contact" dark />
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#8edb70]">
            We are here to help
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
            Let&apos;s talk about your next step.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
            Questions about a course, the internship, or where to begin? Send us
            a note and our team will get back to you within two business days.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[0.9fr_1fr] lg:gap-16 lg:px-8 lg:py-16">
        <div>
          <h2 className="text-2xl font-black sm:text-3xl">
            A real person is on the other side.
          </h2>
          <p className="mt-4 max-w-md leading-7 text-slate-600">
            Tell us what you are working toward. We can help you choose a
            learning path, understand enrollment, or connect you with the right
            team.
          </p>
          <div className="mt-8 space-y-5">
            {contactDetails.map(({ icon: Icon, label, value, href }) => (
              <a
                key={label}
                href={href}
                className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-[#5fbb46] hover:shadow-sm"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#e8f4e4] text-[#4db848]">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                    {label}
                  </span>
                  <span className="mt-1 block text-sm font-semibold">
                    {value}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </div>

        <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-[0_24px_70px_-28px_rgba(20,22,80,0.45)] sm:p-8 lg:justify-self-end">
          {submitted ? (
            <div className="flex min-h-[380px] flex-col items-center justify-center text-center">
              <CheckCircle2 className="h-14 w-14 text-[#4db848]" />
              <h2 className="mt-5 text-2xl font-black">Message received.</h2>
              <p className="mt-3 max-w-sm leading-7 text-slate-600">
                Thanks for reaching out. Our team will review your note and
                reply within two business days.
              </p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="mt-6 text-sm font-bold text-[#4db848] hover:text-[#3d963b]"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="mb-7 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#141650] text-white">
                  <MessageSquare className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-black">Send us a message</h2>
                  <p className="text-sm text-slate-500">
                    We&apos;ll get back to you soon.
                  </p>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Name
                  <input
                    required
                    name="name"
                    type="text"
                    placeholder="Your name"
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 px-4 font-normal outline-none transition focus:border-[#4db848] focus:ring-2 focus:ring-[#4db848]/15"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Email
                  <input
                    required
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 px-4 font-normal outline-none transition focus:border-[#4db848] focus:ring-2 focus:ring-[#4db848]/15"
                  />
                </label>
              </div>
              <label className="block text-sm font-semibold">
                What can we help with?
                <select
                  name="topic"
                  defaultValue="course"
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-white px-4 font-normal outline-none focus:border-[#4db848]"
                >
                  {Object.entries(CONTACT_TOPICS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Message
                <textarea
                  required
                  name="message"
                  rows={5}
                  placeholder="Tell us a little about what you need..."
                  className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-[#4db848] focus:ring-2 focus:ring-[#4db848]/15"
                />
              </label>
              {/* Spam trap: hidden from people, filled in by bots. */}
              <input
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
              />
              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-full bg-[#5fbb46] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#4aaa3e] disabled:cursor-wait disabled:opacity-70"
              >
                {sending ? "Sending…" : "Send message"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

"use client";

import { MailCheck, RotateCw, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";

type SupportAdmin = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  /** Has opened the invitation sent to their email. */
  confirmed: boolean;
  lastSignInAt: string | null;
};

type Notice = { text: string; error: boolean; link?: string | null };

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default function SupportAdminsPage() {
  const [users, setUsers] = useState<SupportAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/internship/support-admins", {
      cache: "no-store",
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    if (response?.ok) setUsers(data.users);
    else setNotice({ text: data?.error ?? "Unable to load Support Admins.", error: true });
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads once; state is set after the request
    void load();
  }, []);

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setNotice(null);
    const response = await fetch("/api/admin/internship/support-admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
      }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setNotice({ text: data?.error ?? "Unable to invite this Support Admin.", error: true });
      return;
    }
    formElement.reset();
    setNotice({
      text: data.emailed
        ? `Invitation sent to ${data.user.email}. They confirm their email from it, then sign in with the password you set.`
        : `Account created for ${data.user.email}, but no email was sent (email isn't set up here). Development only: open this link to confirm it.`,
      error: false,
      link: data.devLink,
    });
    await load();
  }

  async function resend(user: SupportAdmin) {
    setNotice(null);
    const response = await fetch("/api/admin/internship/support-admins", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, action: "resend" }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setNotice(
      response?.ok
        ? {
            text: data.emailed
              ? `A new invitation was sent to ${user.email}.`
              : "No email was sent (email isn't set up here). Development only: open this link to confirm it.",
            error: false,
            link: data.devLink,
          }
        : { text: data?.error ?? "Unable to resend the invitation.", error: true },
    );
  }

  async function revoke(user: SupportAdmin) {
    if (
      !window.confirm(
        `Revoke ${user.name || user.email}'s Support Admin access? They won't be able to sign in. Their resources, group messages and follow-up history are kept.`,
      )
    )
      return;
    setNotice(null);
    const response = await fetch("/api/admin/internship/support-admins", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    if (!response?.ok) {
      setNotice({ text: data?.error ?? "Unable to revoke access.", error: true });
      return;
    }
    setNotice({ text: `${user.email} no longer has Support Admin access.`, error: false });
    await load();
  }

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-3xl space-y-5">
        <header>
          <h1 className="text-2xl font-semibold text-[#1C1D52]">Support Admins</h1>
          <p className="mt-2 text-sm text-slate-500">
            Staff who add resources (for you to publish), upload banners,
            message groups and follow up applicants, in their own workspace.
            They never see payments or revenue, and can&apos;t publish, delete
            or remove group members.
          </p>
        </header>

        <form
          onSubmit={invite}
          className="grid gap-4 rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:grid-cols-2"
        >
          <h2 className="text-sm font-bold text-[#1C1D52] sm:col-span-2">
            Invite a Support Admin
          </h2>
          <label className="text-xs font-semibold text-[#1C1D52]">
            Name
            <input
              required
              name="name"
              maxLength={120}
              className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5 font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-[#1C1D52]">
            Company email
            <input
              required
              type="email"
              name="email"
              className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5 font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-[#1C1D52] sm:col-span-2">
            Password
            <input
              required
              minLength={10}
              type="password"
              name="password"
              autoComplete="new-password"
              className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5 font-normal"
            />
            <span className="mt-1 block font-normal text-slate-500">
              At least 10 characters. Give it to them yourself (not by email).
              They can only sign in after confirming the invitation sent to
              their email, so they need both.
            </span>
          </label>
          <button
            disabled={busy}
            className="rounded-lg bg-[#5FBB46] px-4 py-3 text-sm font-semibold text-[#14204f] disabled:opacity-60 sm:col-span-2"
          >
            {busy ? "Sending invitation…" : "Send invitation"}
          </button>
        </form>

        {notice && (
          <p
            role={notice.error ? "alert" : "status"}
            className={`rounded-xl p-3 text-sm ${notice.error ? "bg-red-50 text-red-700" : "bg-[#e8f7eb] text-[#397d3a]"}`}
          >
            {notice.text}
            {notice.link && (
              <a href={notice.link} className="mt-1 block break-all font-semibold underline">
                {notice.link}
              </a>
            )}
          </p>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
          <h2 className="text-sm font-bold text-[#1C1D52]">Current Support Admins</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {users.map((user) => (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-[#1C1D52]">{user.name || user.email}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Invited {shortDate(user.createdAt)}
                    {user.lastSignInAt && ` · last signed in ${shortDate(user.lastSignInAt)}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {user.confirmed ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f7eb] px-2 py-1 text-[10px] font-semibold text-[#397d3a]">
                      <MailCheck className="h-3 w-3" /> Active
                    </span>
                  ) : (
                    <>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-800">
                        Waiting for email confirmation
                      </span>
                      <button
                        type="button"
                        onClick={() => void resend(user)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-[#1C1D52]"
                      >
                        <RotateCw className="h-3 w-3" /> Resend invitation
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => void revoke(user)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-[10px] font-semibold text-red-600"
                  >
                    <UserX className="h-3 w-3" /> Revoke
                  </button>
                </div>
              </li>
            ))}
            {!loading && users.length === 0 && (
              <li className="py-3 text-sm text-slate-500">No Support Admins yet.</li>
            )}
            {loading && <li className="py-3 text-sm text-slate-500">Loading…</li>}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}

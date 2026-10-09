"use client";

import {
  Camera,
  CheckCircle2,
  KeyRound,
  Loader2,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// The signed-in admin's own profile: name, phone, timezone, bio and photo
// (saved through /api/admin/internship/profile), and their password.

type Profile = {
  name: string;
  email: string;
  avatarUrl: string | null;
  phone: string;
  timezone: string;
  bio: string;
};
type Message = { text: string; error: boolean } | null;

/** Shrinks a photo to a small square-ish avatar before upload (a few KB). */
async function shrinkAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 256 / Math.min(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85),
  );
  if (blob?.type === "image/webp") return blob;
  const jpeg = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!jpeg) throw new Error("This browser can't prepare the photo.");
  return jpeg;
}

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState({ next: "", confirm: "" });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<Message>(null);

  useEffect(() => {
    fetch("/api/admin/internship/profile", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Unable to load your profile.");
        setProfile(body as Profile);
      })
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : "Unable to load your profile."),
      );
  }, []);

  const change = (patch: Partial<Profile>) => {
    setProfile((current) => (current ? { ...current, ...patch } : current));
    setMessage(null);
  };

  async function save() {
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/internship/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone,
          timezone: profile.timezone,
          bio: profile.bio,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to save.");
      setMessage({ text: "Profile saved.", error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Unable to save.", error: true });
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      const small = await shrinkAvatar(file);
      form.set("file", new File([small], `avatar.${small.type === "image/webp" ? "webp" : "jpg"}`, { type: small.type }));
      const response = await fetch("/api/admin/internship/profile/avatar", { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to upload the photo.");
      change({ avatarUrl: body.avatarUrl as string });
      setMessage({ text: "Photo updated.", error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Unable to upload the photo.", error: true });
    } finally {
      setUploading(false);
    }
  }

  async function changePassword() {
    setPasswordMessage(null);
    if (password.next.length < 8) {
      setPasswordMessage({ text: "Use at least 8 characters.", error: true });
      return;
    }
    if (password.next !== password.confirm) {
      setPasswordMessage({ text: "The passwords don't match.", error: true });
      return;
    }
    setChangingPassword(true);
    const { error } = await createSupabaseBrowserClient().auth.updateUser({ password: password.next });
    setChangingPassword(false);
    if (error) {
      setPasswordMessage({ text: error.message, error: true });
      return;
    }
    setPassword({ next: "", confirm: "" });
    setPasswordMessage({ text: "Password changed.", error: false });
  }

  const initials = (profile?.name || profile?.email || "A")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[1200px] space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">
              Account
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[#1C1D52] sm:text-3xl">
              Admin profile
            </h1>
            <p className="mt-2 text-xs text-slate-500">
              Manage your admin account details, photo and password.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!profile || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-semibold text-[#14204f] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Saving…" : "Save profile"}
          </button>
        </header>

        {loadError && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-xs font-semibold text-red-700" role="alert">
            {loadError}
          </p>
        )}

        {!profile ? (
          !loadError && (
            <div className="flex justify-center rounded-[28px] bg-white p-10 shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
              <Loader2 className="h-6 w-6 animate-spin text-[#5FBB46]" />
            </div>
          )
        ) : (
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[28px] bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#1C1D52] text-xl font-bold text-white ring-4 ring-[#edf3ff]">
                    {profile.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatarUrl} alt="Your photo" className="h-full w-full object-cover" />
                    ) : (
                      initials
                    )}
                    {uploading && (
                      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70">
                        <Loader2 className="h-5 w-5 animate-spin text-[#5FBB46]" />
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                    aria-label="Change photo"
                    className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#1C1D52] text-white shadow-lg disabled:opacity-60"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void uploadAvatar(file);
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold text-[#1C1D52]">
                    {profile.name || profile.email}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">Administrator</p>
                  <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#e8faf7] px-2 py-1 text-[9px] font-semibold text-teal-600">
                    <ShieldCheck className="h-3 w-3" /> Account verified
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <Field label="Full name" value={profile.name} onChange={(name) => change({ name })} />
                <label className="block text-[10px] font-semibold text-slate-500">
                  Email (you sign in with it)
                  <input
                    value={profile.email}
                    readOnly
                    className="mt-2 block w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 outline-none"
                  />
                </label>
                <Field label="Phone number" value={profile.phone} onChange={(phone) => change({ phone })} />
                <Field label="Timezone" value={profile.timezone} onChange={(timezone) => change({ timezone })} />
                <label className="block text-[10px] font-semibold text-slate-500">
                  Bio
                  <textarea
                    rows={4}
                    value={profile.bio}
                    onChange={(event) => change({ bio: event.target.value })}
                    className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#1C1D52] outline-none"
                  />
                </label>
              </div>

              <Notice message={message} />
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf3ff] text-[#1C1D52]">
                  <KeyRound className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-[#1C1D52]">Account security</h2>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Choose a new password of at least 8 characters.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <Field
                  label="New password"
                  type="password"
                  value={password.next}
                  onChange={(next) => setPassword((current) => ({ ...current, next }))}
                />
                <Field
                  label="Confirm new password"
                  type="password"
                  value={password.confirm}
                  onChange={(confirm) => setPassword((current) => ({ ...current, confirm }))}
                />
              </div>

              <button
                type="button"
                onClick={() => void changePassword()}
                disabled={changingPassword || !password.next}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-4 py-2.5 text-[10px] font-semibold text-white disabled:opacity-60"
              >
                {changingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                Change password
              </button>

              <Notice message={passwordMessage} />
            </section>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function Notice({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className={`mt-5 flex items-center gap-2 rounded-xl p-3 text-[10px] font-semibold ${message.error ? "bg-red-50 text-red-700" : "bg-[#e8faf7] text-teal-700"}`}
    >
      {!message.error && <CheckCircle2 className="h-4 w-4" />} {message.text}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "password";
}) {
  return (
    <label className="block text-[10px] font-semibold text-slate-500">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={type === "password" ? "new-password" : undefined}
        className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#1C1D52] outline-none"
      />
    </label>
  );
}

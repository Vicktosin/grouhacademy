"use client";

import {
  Copy,
  Download,
  MessageCircle,
  MessageSquareText,
  Phone,
  RotateCcw,
  Search,
  Share2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import AdminShell from "@/components/AdminShell";
import {
  DEFAULT_TEMPLATES,
  PLACEHOLDERS,
  renderTemplate,
  whatsAppLink,
  type FollowUpStageKey,
} from "@/lib/follow-up-templates";
import type { FollowUpRow } from "@/lib/internship-follow-ups";

type Templates = Record<FollowUpStageKey, string>;
type Status = FollowUpRow["followUp"]["status"];

const STATUSES: Array<{ value: string; label: string; tone: string }> = [
  {
    value: "NOT_CONTACTED",
    label: "Not contacted",
    tone: "bg-slate-100 text-slate-600",
  },
  { value: "CONTACTED", label: "Contacted", tone: "bg-sky-100 text-sky-700" },
  {
    value: "NO_ANSWER",
    label: "No answer",
    tone: "bg-amber-100 text-amber-700",
  },
  {
    value: "INTERESTED",
    label: "Interested",
    tone: "bg-[#e8f7eb] text-[#397d3a]",
  },
  {
    value: "NOT_INTERESTED",
    label: "Not interested",
    tone: "bg-red-50 text-red-700",
  },
];
const statusInfo = (value: string) =>
  STATUSES.find((status) => status.value === value) ?? STATUSES[0];

const STAGES: Array<{ key: FollowUpStageKey; label: string }> = [
  { key: "PASSED_UNPAID", label: "Passed, not paid" },
  { key: "FAILED", label: "Failed exam" },
];

function daysAgo(iso: string | null) {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

function shortDate(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      })
    : "—";
}

const endOfToday = () => {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
};

export default function FollowUpsPage() {
  const [rows, setRows] = useState<FollowUpRow[]>([]);
  const [templates, setTemplates] = useState<Templates>(DEFAULT_TEMPLATES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<FollowUpStageKey>("PASSED_UNPAID");
  const [selected, setSelected] = useState<FollowUpRow | null>(null);
  const [editingTemplates, setEditingTemplates] = useState(false);

  // Filters
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState("All");
  const [level, setLevel] = useState("All");
  const [status, setStatus] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
  const [triedToPayOnly, setTriedToPayOnly] = useState(false);
  const [whatsAppOnly, setWhatsAppOnly] = useState(false);
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    fetch("/api/admin/internship/follow-ups", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load follow-ups.");
        const data = (await response.json()) as {
          rows: FollowUpRow[];
          templates: Templates;
        };
        setRows(data.rows);
        setTemplates(data.templates);
      })
      .catch((loadError: unknown) =>
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const stageRows = useMemo(
    () => rows.filter((row) => row.stage === stage),
    [rows, stage],
  );
  const trackOptions = useMemo(
    () => [...new Set(stageRows.map((row) => row.track))].sort(),
    [stageRows],
  );
  const levelOptions = useMemo(
    () => [...new Set(stageRows.map((row) => row.level))],
    [stageRows],
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTime = to ? new Date(`${to}T23:59:59`).getTime() : null;
    const due = endOfToday().getTime();
    const list = stageRows.filter((row) => {
      const examTime = row.examDate ? new Date(row.examDate).getTime() : 0;
      return (
        (!term ||
          `${row.name} ${row.email} ${row.whatsapp ?? ""} ${row.phone ?? ""}`
            .toLowerCase()
            .includes(term)) &&
        (track === "All" || row.track === track) &&
        (level === "All" || row.level === level) &&
        (status === "All" || row.followUp.status === status) &&
        (fromTime === null || examTime >= fromTime) &&
        (toTime === null || examTime <= toTime) &&
        (!dueOnly ||
          (row.followUp.nextFollowUpAt !== null &&
            new Date(row.followUp.nextFollowUpAt).getTime() <= due)) &&
        (!triedToPayOnly || row.triedToPay) &&
        (!whatsAppOnly || row.whatsappNumber !== null)
      );
    });
    const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
    return list.sort((a, b) => {
      if (sort === "oldest") return time(a.examDate) - time(b.examDate);
      if (sort === "score") return (b.score ?? -1) - (a.score ?? -1);
      if (sort === "due")
        return (
          (time(a.followUp.nextFollowUpAt) || Infinity) -
          (time(b.followUp.nextFollowUpAt) || Infinity)
        );
      return time(b.examDate) - time(a.examDate);
    });
  }, [
    stageRows,
    query,
    track,
    level,
    status,
    from,
    to,
    dueOnly,
    triedToPayOnly,
    whatsAppOnly,
    sort,
  ]);

  const resetFilters = () => {
    setQuery("");
    setTrack("All");
    setLevel("All");
    setStatus("All");
    setFrom("");
    setTo("");
    setDueOnly(false);
    setTriedToPayOnly(false);
    setWhatsAppOnly(false);
    setSort("newest");
  };

  /** Applies a saved change to one person everywhere it shows. */
  const patchRow = (
    applicationId: string,
    followUp: Partial<FollowUpRow["followUp"]>,
  ) => {
    setRows((current) =>
      current.map((row) =>
        row.applicationId === applicationId
          ? { ...row, followUp: { ...row.followUp, ...followUp } }
          : row,
      ),
    );
    setSelected((current) =>
      current?.applicationId === applicationId
        ? { ...current, followUp: { ...current.followUp, ...followUp } }
        : current,
    );
  };

  const dueCount = stageRows.filter(
    (row) =>
      row.followUp.nextFollowUpAt &&
      new Date(row.followUp.nextFollowUpAt) <= endOfToday(),
  ).length;

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1C1D52] sm:text-3xl">
              Follow-ups
            </h1>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
              Applicants who sat the entrance exam but haven&apos;t paid.
              Message them on WhatsApp or call, and keep track of who&apos;s
              been contacted. Anyone who pays leaves the list automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditingTemplates(true)}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#1C1D52]"
          >
            <MessageSquareText className="h-4 w-4 text-[#5FBB46]" />
            Message templates
          </button>
        </header>

        {error && (
          <p
            className="rounded-lg bg-red-50 px-4 py-3 text-xs font-semibold text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {STAGES.map((item) => {
            const count = rows.filter((row) => row.stage === item.key).length;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setStage(item.key);
                  setTriedToPayOnly(false);
                }}
                className={`rounded-lg px-4 py-2.5 text-xs font-semibold ${
                  stage === item.key
                    ? "bg-[#1C1D52] text-white"
                    : "bg-white text-slate-600 shadow-[0_4px_12px_rgba(28,29,82,0.06)]"
                }`}
              >
                {item.label} ({count})
              </button>
            );
          })}
          {dueCount > 0 && (
            <button
              type="button"
              onClick={() => setDueOnly(true)}
              className="rounded-lg bg-amber-100 px-4 py-2.5 text-xs font-semibold text-amber-800"
            >
              {dueCount} due today
            </button>
          )}
        </div>

        <section className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-5">
          <div className="grid gap-3 border-b border-slate-100 pb-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex items-center gap-2 rounded-lg bg-[#f3f6fb] px-3 py-2.5 text-xs text-slate-400 sm:col-span-2">
              <Search className="h-3.5 w-3.5" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent text-[#1C1D52] outline-none"
                placeholder="Search name, email or phone..."
              />
            </label>
            <FilterSelect
              label="Track"
              value={track}
              onChange={setTrack}
              options={trackOptions}
            />
            <FilterSelect
              label="Level"
              value={level}
              onChange={setLevel}
              options={levelOptions}
            />
            <FilterSelect
              label="Status"
              value={status}
              onChange={setStatus}
              options={STATUSES.map((item) => item.value)}
              labelFor={(value) => statusInfo(value).label}
            />
            <label className="text-[10px] font-semibold text-slate-500">
              {stage === "PASSED_UNPAID" ? "Passed from" : "Failed from"}
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-[#1C1D52]"
              />
            </label>
            <label className="text-[10px] font-semibold text-slate-500">
              To
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-[#1C1D52]"
              />
            </label>
            <FilterSelect
              label="Sort by"
              value={sort}
              onChange={setSort}
              options={["newest", "oldest", "score", "due"]}
              labelFor={(value) =>
                ({
                  newest: "Most recent exam",
                  oldest: "Oldest exam",
                  score: "Highest score",
                  due: "Next follow-up date",
                })[value] ?? value
              }
              noAll
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-3 text-xs text-slate-600">
            <Check
              checked={dueOnly}
              onChange={setDueOnly}
              label="Follow-up due today"
            />
            {stage === "PASSED_UNPAID" && (
              <Check
                checked={triedToPayOnly}
                onChange={setTriedToPayOnly}
                label="Tried to pay"
              />
            )}
            <Check
              checked={whatsAppOnly}
              onChange={setWhatsAppOnly}
              label="Has WhatsApp number"
            />
            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-[#1C1D52]"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Clear filters
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[960px] text-left">
              <thead className="bg-[#f8fbff] text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Applicant</th>
                  <th className="px-3 py-3">Track · Level</th>
                  <th className="px-3 py-3">Exam</th>
                  <th className="px-3 py-3">WhatsApp</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Next follow-up</th>
                  <th className="px-3 py-3">Last contact</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-[11px] text-[#1C1D52]">
                {visible.map((row) => {
                  const info = statusInfo(row.followUp.status);
                  const due =
                    row.followUp.nextFollowUpAt &&
                    new Date(row.followUp.nextFollowUpAt) <= endOfToday();
                  return (
                    <tr
                      key={row.applicationId}
                      className="border-t border-slate-100 align-top"
                    >
                      <td className="px-3 py-3">
                        <p className="font-semibold">{row.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {row.email}
                        </p>
                        {row.triedToPay && (
                          <span className="mt-1 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-semibold text-violet-700">
                            Tried to pay
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {row.track} · {row.level}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold">
                          {row.score !== null ? `${row.score}%` : "—"}
                          {row.stage === "FAILED" && row.attempts > 1 && (
                            <span className="font-normal text-slate-400">
                              {" "}
                              · {row.attempts} tries
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {daysAgo(row.examDate)}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {row.whatsapp ?? row.phone ?? (
                          <span className="text-slate-300">None</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-[9px] font-semibold ${info.tone}`}
                        >
                          {info.label}
                        </span>
                      </td>
                      <td
                        className={`px-3 py-3 ${due ? "font-semibold text-amber-700" : "text-slate-500"}`}
                      >
                        {shortDate(row.followUp.nextFollowUpAt)}
                      </td>
                      <td className="px-3 py-3 text-slate-500">
                        {row.followUp.lastContactedAt ? (
                          <>
                            {daysAgo(row.followUp.lastContactedAt)}
                            <span className="block text-[10px] text-slate-400">
                              {row.followUp.lastContactedBy ?? ""} ·{" "}
                              {row.followUp.contactCount}×
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelected(row)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#5FBB46] px-3 py-2 text-[10px] font-bold text-[#14204f]"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Follow up
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && visible.length === 0 && (
            <p className="py-12 text-center text-sm text-slate-500">
              {stageRows.length
                ? "No one matches these filters."
                : "No one to follow up here."}
            </p>
          )}
          {loading && (
            <p className="py-12 text-center text-sm text-slate-500">
              Loading...
            </p>
          )}
          {!loading && visible.length > 0 && (
            <p className="pt-3 text-[10px] text-slate-400">
              Showing {visible.length} of {stageRows.length}
            </p>
          )}
        </section>
      </div>

      {selected && (
        <FollowUpPanel
          row={selected}
          template={templates[selected.stage]}
          onClose={() => setSelected(null)}
          onChange={(followUp) => patchRow(selected.applicationId, followUp)}
          onMoved={() =>
            // Their old application leaves the list; the new track's
            // appears once they've taken its assessment.
            setRows((current) =>
              current.filter(
                (row) => row.applicationId !== selected.applicationId,
              ),
            )
          }
        />
      )}
      {editingTemplates && (
        <TemplateEditor
          templates={templates}
          sampleRows={rows}
          onClose={() => setEditingTemplates(false)}
          onSaved={setTemplates}
        />
      )}
    </AdminShell>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  labelFor = (option) => option,
  noAll = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labelFor?: (option: string) => string;
  noAll?: boolean;
}) {
  return (
    <label className="text-[10px] font-semibold text-slate-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-[#1C1D52]"
      >
        {!noAll && <option value="All">All</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {labelFor(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-[#5FBB46]"
      />
      {label}
    </label>
  );
}

/** One applicant: summary card, editable message, contact and tracking. */
function FollowUpPanel({
  row,
  template,
  onClose,
  onChange,
  onMoved,
}: {
  row: FollowUpRow;
  template: string;
  onClose: () => void;
  onChange: (followUp: Partial<FollowUpRow["followUp"]>) => void;
  onMoved: () => void;
}) {
  const cardUrl = `/api/admin/internship/follow-ups/${row.applicationId}/card`;
  const [message, setMessage] = useState(() =>
    renderTemplate(template, row.values),
  );
  const [card, setCard] = useState<Blob | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [form, setForm] = useState({
    status: row.followUp.status as Status,
    note: row.followUp.note ?? "",
    nextFollowUpAt: row.followUp.nextFollowUpAt?.slice(0, 10) ?? "",
  });
  const [saving, setSaving] = useState(false);

  // Fetch the card once so Share can attach it straight away (phones need
  // the file ready within the tap). Its preview address is released when
  // the panel closes.
  const [cardPreview, setCardPreview] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let previewUrl: string | null = null;
    fetch(cardUrl)
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return;
        previewUrl = URL.createObjectURL(blob);
        setCard(blob);
        setCardPreview(previewUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [cardUrl]);

  const fileName = `${row.name.replace(/[^\w]+/g, "-")}-summary.png`;

  async function logContact(channel: "WHATSAPP" | "CALL") {
    const response = await fetch(
      `/api/admin/internship/follow-ups/${row.applicationId}/contact`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, stage: row.stage }),
      },
    ).catch(() => null);
    if (!response?.ok) return;
    const data = (await response.json()) as {
      followUp: Partial<FollowUpRow["followUp"]>;
    };
    onChange(data.followUp);
    if (data.followUp.status)
      setForm((current) => ({
        ...current,
        status: data.followUp.status as Status,
      }));
  }

  /**
   * Copies the card, then opens the chat with the message typed in. WhatsApp
   * links can't carry images, so the admin pastes the card (Ctrl+V) before
   * sending.
   */
  function openWhatsApp() {
    if (!row.whatsappNumber) return;
    let copied = false;
    try {
      const blob = card ?? fetch(cardUrl).then((response) => response.blob());
      void navigator.clipboard
        .write([new ClipboardItem({ "image/png": blob })])
        .then(() => {
          copied = true;
          setNotice({
            text: "Chat opened with the message typed in. The summary picture is copied: press Ctrl+V in the chat to attach it, then send.",
            error: false,
          });
        })
        .catch(() => {
          if (!copied)
            setNotice({
              text: "Chat opened with the message typed in. The picture couldn't be copied here; use Download picture and attach it.",
              error: true,
            });
        });
    } catch {
      setNotice({
        text: "Chat opened. This browser can't copy pictures; use Download picture and attach it.",
        error: true,
      });
    }
    window.open(
      whatsAppLink(row.whatsappNumber, message),
      "_blank",
      "noopener",
    );
    void logContact("WHATSAPP");
  }

  /** Phones: the share sheet sends the picture and message together. */
  async function share() {
    if (!card) return;
    const file = new File([card], fileName, { type: "image/png" });
    if (!navigator.canShare?.({ files: [file], text: message })) {
      setNotice({
        text: "Sharing pictures isn't supported in this browser. Use the WhatsApp button instead.",
        error: true,
      });
      return;
    }
    try {
      await navigator.share({ files: [file], text: message });
      void logContact("WHATSAPP");
    } catch {
      // Share sheet closed.
    }
  }

  function download() {
    if (!card) return;
    const url = URL.createObjectURL(card);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/admin/internship/follow-ups/${row.applicationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: form.status,
            note: form.note,
            nextFollowUpAt: form.nextFollowUpAt
              ? new Date(`${form.nextFollowUpAt}T09:00:00`).toISOString()
              : null,
          }),
        },
      );
      if (!response.ok) throw new Error();
      onChange({
        status: form.status,
        note: form.note.trim() || null,
        nextFollowUpAt: form.nextFollowUpAt
          ? new Date(`${form.nextFollowUpAt}T09:00:00`).toISOString()
          : null,
      });
      setNotice({ text: "Saved.", error: false });
    } catch {
      setNotice({ text: "Unable to save.", error: true });
    } finally {
      setSaving(false);
    }
  }

  const callNumbers = [
    { label: "Call WhatsApp number", number: row.whatsapp },
    { label: "Call other number", number: row.phone },
  ].filter(
    (item, index, list): item is { label: string; number: string } =>
      Boolean(item.number) &&
      list.findIndex((other) => other.number === item.number) === index,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#11132f]/60"
      role="dialog"
      aria-modal="true"
      aria-label={`Follow up ${row.name}`}
    >
      <div className="h-full w-full max-w-3xl overflow-y-auto bg-[#f7f9fc] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#1C1D52]">{row.name}</h2>
            <p className="text-xs text-slate-500">
              {row.track} · {row.level} ·{" "}
              {row.stage === "PASSED_UNPAID"
                ? `passed with ${row.score ?? "—"}%`
                : `scored ${row.score ?? "—"}% (pass mark ${row.passMark ?? "—"}%)`}{" "}
              · {daysAgo(row.examDate).toLowerCase()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-[260px_1fr]">
          <div className="space-y-2">
            {cardPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cardPreview}
                alt={`Application summary for ${row.name}`}
                className="w-full rounded-xl border border-slate-200 bg-white"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-xs text-slate-400">
                Creating summary picture...
              </div>
            )}
            <button
              type="button"
              onClick={download}
              disabled={!card}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#1C1D52] disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" /> Download picture
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                Message
              </span>
              <span className="flex gap-3 text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(message)}
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-[#1C1D52]"
                >
                  <Copy className="h-3 w-3" /> Copy text
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMessage(renderTemplate(template, row.values))
                  }
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-[#1C1D52]"
                >
                  <RotateCcw className="h-3 w-3" /> Reset to template
                </button>
              </span>
            </div>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={11}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs leading-5 text-[#1C1D52] outline-none focus:border-[#5FBB46]"
            />
            <p className="text-[10px] text-slate-400">
              Edit freely for this person. Changes here aren&apos;t saved to the
              template.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openWhatsApp}
                disabled={!row.whatsappNumber}
                title={
                  row.whatsappNumber ? undefined : "No usable phone number"
                }
                className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </button>
              <button
                type="button"
                onClick={() => void share()}
                disabled={!card}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#1C1D52] disabled:opacity-50"
              >
                <Share2 className="h-4 w-4" /> Share (phone)
              </button>
              {callNumbers.map((item) => (
                <a
                  key={item.number}
                  href={`tel:${item.number.replace(/[^\d+]/g, "")}`}
                  onClick={() => void logContact("CALL")}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#1C1D52]"
                >
                  <Phone className="h-4 w-4" /> {item.label}
                  <span className="font-normal text-slate-400">
                    {item.number}
                  </span>
                </a>
              ))}
            </div>
            {notice && (
              <p
                className={`rounded-lg px-3 py-2 text-[11px] ${notice.error ? "bg-amber-50 text-amber-800" : "bg-[#e8f7eb] text-[#397d3a]"}`}
                role="status"
              >
                {notice.text}
              </p>
            )}
          </div>
        </div>

        <ChangeTrack row={row} onMoved={onMoved} />

        <div className="mx-5 mb-5 space-y-3 rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.06)]">
          <h3 className="text-sm font-bold text-[#1C1D52]">Follow-up record</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[10px] font-semibold text-slate-500">
              Status
              <select
                value={form.status}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value as Status })
                }
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-[#1C1D52]"
              >
                {STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-semibold text-slate-500">
              Follow up again on
              <input
                type="date"
                value={form.nextFollowUpAt}
                onChange={(event) =>
                  setForm({ ...form, nextFollowUpAt: event.target.value })
                }
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-[#1C1D52]"
              />
            </label>
          </div>
          <label className="block text-[10px] font-semibold text-slate-500">
            Notes
            <textarea
              value={form.note}
              onChange={(event) =>
                setForm({ ...form, note: event.target.value })
              }
              rows={3}
              placeholder="e.g. Will pay on Friday after salary"
              className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-[#1C1D52] outline-none focus:border-[#5FBB46]"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[10px] text-slate-400">
              {row.followUp.lastContactedAt
                ? `Last contacted ${daysAgo(row.followUp.lastContactedAt).toLowerCase()}${row.followUp.lastContactedBy ? ` by ${row.followUp.lastContactedBy}` : ""} · ${row.followUp.contactCount} contact${row.followUp.contactCount === 1 ? "" : "s"} in total`
                : "Not contacted yet"}
            </p>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-lg bg-[#1C1D52] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save record"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Edit the message for each list, with placeholders and a live preview. */
function TemplateEditor({
  templates,
  sampleRows,
  onClose,
  onSaved,
}: {
  templates: Templates;
  sampleRows: FollowUpRow[];
  onClose: () => void;
  onSaved: (templates: Templates) => void;
}) {
  const [stage, setStage] = useState<FollowUpStageKey>("PASSED_UNPAID");
  const [drafts, setDrafts] = useState<Templates>(templates);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sample = sampleRows.find((row) => row.stage === stage);
  const previewValues = sample?.values ?? {
    firstName: "Ada",
    name: "Ada Okafor",
    track: "AI Automation",
    level: "Entry",
    fee: "₦25,000",
    score: "85",
    passMark: "70",
    nextCohort: "November cohort",
    nextCohortDate: "Tuesday, 3 November 2026",
    countdown: "That's just 2 days to go!",
    loginLink: "https://grouhacademy.space/login",
  };

  /** Inserts a {placeholder} where the cursor is. */
  const insert = (key: string) => {
    const element = textareaRef.current;
    const token = `{${key}}`;
    const text = drafts[stage];
    const start = element?.selectionStart ?? text.length;
    const end = element?.selectionEnd ?? text.length;
    setDrafts({
      ...drafts,
      [stage]: text.slice(0, start) + token + text.slice(end),
    });
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  async function save(body: string) {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(
        "/api/admin/internship/follow-ups/templates",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage, body }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        templates?: Templates;
        error?: string;
      };
      if (!response.ok || !data.templates)
        throw new Error(data.error ?? "Unable to save.");
      onSaved(data.templates);
      setDrafts((current) => ({ ...current, [stage]: data.templates![stage] }));
      setNotice({
        text: "Template saved. New follow-ups use it straight away.",
        error: false,
      });
    } catch (saveError) {
      setNotice({
        text:
          saveError instanceof Error ? saveError.message : "Unable to save.",
        error: true,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#11132f]/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Message templates"
    >
      <div className="max-h-full w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#1C1D52]">
              Message templates
            </h2>
            <p className="text-xs text-slate-500">
              The ready-made WhatsApp message for each list. Placeholders are
              filled in for each person, and admins can still edit the message
              before sending.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex gap-2">
            {STAGES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setStage(item.key);
                  setNotice(null);
                }}
                className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                  stage === item.key
                    ? "bg-[#1C1D52] text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
              Insert
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => insert(item.key)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-[#1C1D52] hover:border-[#5FBB46] hover:bg-[#f4faf2]"
                  title={`{${item.key}}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
              Template
              <textarea
                ref={textareaRef}
                value={drafts[stage]}
                onChange={(event) =>
                  setDrafts({ ...drafts, [stage]: event.target.value })
                }
                rows={16}
                className="mt-2 block w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs normal-case leading-5 tracking-normal text-[#1C1D52] outline-none focus:border-[#5FBB46]"
              />
            </label>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                Preview{sample ? ` (${sample.name})` : " (example)"}
              </p>
              <div className="mt-2 whitespace-pre-wrap rounded-xl bg-[#e7fbe0] px-4 py-3 text-xs leading-5 text-[#1C1D52]">
                {renderTemplate(drafts[stage], previewValues)}
              </div>
            </div>
          </div>

          {notice && (
            <p
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${notice.error ? "bg-red-50 text-red-700" : "bg-[#e8f7eb] text-[#397d3a]"}`}
              role="status"
            >
              {notice.text}
            </p>
          )}

          <div className="flex flex-wrap justify-between gap-2">
            <button
              type="button"
              onClick={() => void save("")}
              disabled={saving}
              className="rounded-lg px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60"
            >
              Restore the built-in message
            </button>
            <button
              type="button"
              onClick={() => void save(drafts[stage])}
              disabled={saving || !drafts[stage].trim()}
              className="rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-bold text-[#14204f] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save template"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type TrackOption = {
  id: string;
  name: string;
  levels: Array<{ id: string; name: string; acceptanceFee: number }>;
};

/**
 * Moves an applicant who hasn't paid to another track. They take the new
 * track's assessment, then pay its fee (which may differ).
 */
function ChangeTrack({ row, onMoved }: { row: FollowUpRow; onMoved: () => void }) {
  const [open, setOpen] = useState(false);
  const [tracks, setTracks] = useState<TrackOption[] | null>(null);
  const [programId, setProgramId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; error: boolean } | null>(null);

  function start() {
    setOpen(true);
    if (tracks) return;
    fetch("/api/admin/internship/follow-ups/track-options", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => setTracks(body.tracks ?? []))
      .catch(() => setTracks([]));
  }

  const track = tracks?.find((item) => item.id === programId);
  const level = track?.levels.find((item) => item.id === levelId);

  async function move() {
    setBusy(true);
    setResult(null);
    const response = await fetch(
      `/api/admin/internship/follow-ups/${row.applicationId}/track`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId, levelId }),
      },
    ).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    setBusy(false);
    setConfirming(false);
    if (!response?.ok) {
      setResult({ text: body?.error ?? "Unable to change their track.", error: true });
      return;
    }
    setResult({ text: body.message, error: false });
    onMoved();
  }

  const done = result && !result.error;
  return (
    <div className="mx-5 mb-5 space-y-3 rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[#1C1D52]">Change track</h3>
          <p className="text-[10px] text-slate-500">
            Currently {row.track} ({row.level}). For applicants who want a different track.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={start}
            className="rounded-lg bg-[#eef3ff] px-3 py-2 text-xs font-semibold text-[#1C1D52]"
          >
            Change track
          </button>
        )}
      </div>
      {open && !done && (
        <>
          {!tracks ? (
            <p className="text-xs text-slate-500">Loading tracks…</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-[10px] font-semibold text-slate-500">
                New track
                <select
                  value={programId}
                  onChange={(event) => {
                    setProgramId(event.target.value);
                    const next = tracks.find((item) => item.id === event.target.value);
                    setLevelId(next?.levels[0]?.id ?? "");
                    setConfirming(false);
                  }}
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-[#1C1D52]"
                >
                  <option value="">Choose a track</option>
                  {tracks.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] font-semibold text-slate-500">
                Level
                <select
                  value={levelId}
                  onChange={(event) => {
                    setLevelId(event.target.value);
                    setConfirming(false);
                  }}
                  disabled={!track}
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-[#1C1D52] disabled:bg-slate-50"
                >
                  {track?.levels.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · ₦{item.acceptanceFee.toLocaleString("en-NG")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {track && level && (
            <p className="rounded-lg bg-sky-50 px-3 py-2.5 text-[11px] leading-5 text-sky-800">
              {row.name.split(" ")[0]} will take the <strong>{track.name}</strong> ({level.name}) assessment
              the next time they log in. If they pass, their acceptance fee is{" "}
              <strong>₦{level.acceptanceFee.toLocaleString("en-NG")}</strong>
              {row.values.fee ? ` (was ${row.values.fee})` : ""}. Their old result is kept on record but won&apos;t count.
            </p>
          )}
          {confirming ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void move()}
                disabled={busy}
                className="rounded-lg bg-[#1C1D52] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Moving…" : `Yes, move to ${track?.name}`}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="rounded-lg px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={!track || !level}
                className="rounded-lg bg-[#1C1D52] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Move to this track
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}
      {result && (
        <p
          className={`rounded-lg px-3 py-2.5 text-xs font-semibold ${result.error ? "bg-red-50 text-red-700" : "bg-[#e8f7eb] text-[#397d3a]"}`}
          role="status"
        >
          {result.text}
        </p>
      )}
    </div>
  );
}

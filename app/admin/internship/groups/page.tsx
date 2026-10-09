"use client";

import {
  ChevronDown,
  ChevronRight,
  Crown,
  Megaphone,
  MessageCircle,
  MessageCircleOff,
  Plus,
  Save,
  Search,
  Trash2,
  UserMinus,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { BroadcastDialog, GroupChatDialog } from "@/components/AdminGroupChat";
import CohortPicker, { rememberedCohort } from "@/components/admin/CohortPicker";

type CohortOption = {
  id: string;
  name: string;
  programId: string;
  programName: string;
  startDate: string;
  endDate: string;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED";
  groupCount: number;
};

type MoveTarget = { id: string; label: string };

type GroupMember = {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
  moveTargets?: MoveTarget[];
};

type GroupRecord = {
  id: string;
  number: number;
  programName: string;
  capacity: number;
  leaderId: string | null;
  discussionOpen: boolean;
  members: GroupMember[];
};

type UnplacedIntern = { userId: string; name: string; email: string };

type GroupsPayload = {
  cohorts: CohortOption[];
  legacyGroupCount: number;
  selected: string | null;
  defaultCapacity: number;
  groups: GroupRecord[];
  unplaced: UnplacedIntern[];
};

type GroupAction =
  | { action: "createGroup"; cohortId: string; capacity?: string }
  | { action: "updateCapacity"; groupId: string; capacity: number }
  | { action: "addMember"; groupId: string; userId: string }
  | { action: "removeMember"; groupId: string; userId: string }
  | { action: "setLeader"; groupId: string; userId: string }
  | { action: "deleteGroup"; groupId: string }
  | { action: "setDiscussion"; groupId: string; open: boolean }
  | { action: "setCohortDiscussion"; cohortId: string; open: boolean };

const UNASSIGNED = "unassigned";
const PICKER_KEY = "admin-groups";
/** With more groups than this, cards start folded to one line each. */
const FOLD_ABOVE = 4;

export default function InternshipGroupsPage() {
  const [data, setData] = useState<GroupsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newCapacity, setNewCapacity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [chatGroup, setChatGroup] = useState<GroupRecord | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  // Which group cards are unfolded, and the intern search.
  const [unfolded, setUnfolded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  // keepUnfolded: after an action, keep the same cards open.
  const load = useCallback(async (cohortId?: string | null, keepUnfolded = false) => {
    setLoading(true);
    try {
      const query = cohortId ? `?cohortId=${encodeURIComponent(cohortId)}` : "";
      const response = await fetch(`/api/admin/internship/groups${query}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(payload?.error || "Unable to load groups.");
      setData(payload as GroupsPayload);
      if (!keepUnfolded) {
        // Few groups: show them all open. Many: one line each.
        const loaded = (payload as GroupsPayload).groups;
        setUnfolded(new Set(loaded.length <= FOLD_ABOVE ? loaded.map((g) => g.id) : []));
        setSearch("");
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to load groups.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The cohort shown last time, if there was one.
    const timer = window.setTimeout(() => {
      void load(rememberedCohort(PICKER_KEY));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function act(payload: GroupAction) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/admin/internship/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(result?.error || "Unable to update the group.");
      setSuccess(result?.message ?? "Group updated.");
      await load(data?.selected, true);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to update the group.",
      );
    } finally {
      setBusy(false);
    }
  }

  const selected = data?.selected ?? null;
  const isLegacy = selected === UNASSIGNED;
  const groups = useMemo(() => data?.groups ?? [], [data]);
  const unplaced = data?.unplaced ?? [];
  const groupsWithRoom = groups.filter(
    (group) => group.members.length < group.capacity,
  );
  const placedCount = groups.reduce(
    (sum, group) => sum + group.members.length,
    0,
  );

  // Finding an intern: only the groups (and unplaced interns) that match.
  const term = search.trim().toLowerCase();
  const matches = (person: { name: string; email: string }) =>
    !term || `${person.name} ${person.email}`.toLowerCase().includes(term);
  const shownGroups = term ? groups.filter((group) => group.members.some(matches)) : groups;
  const shownUnplaced = unplaced.filter(matches);
  const pausedCount = groups.filter((group) => !group.discussionOpen).length;
  const allUnfolded = shownGroups.length > 0 && shownGroups.every((group) => unfolded.has(group.id));
  const toggleCard = (id: string) =>
    setUnfolded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function removeMember(group: GroupRecord, member: GroupMember) {
    if (
      !window.confirm(
        `Remove ${member.name} from Group ${group.number}?\n\nThey'll be placed in a group with space the next time they open Group Discussion. To put them in a specific group, use "Move to" instead.`,
      )
    )
      return;
    void act({ action: "removeMember", groupId: group.id, userId: member.userId });
  }

  function deleteGroup(group: GroupRecord) {
    if (
      !window.confirm(
        `Delete Group ${group.number}? Its past messages and meetings will also be deleted.`,
      )
    )
      return;
    void act({ action: "deleteGroup", groupId: group.id });
  }

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header className="rounded-[28px] bg-[#5FBB46] px-6 py-6 text-[#14204f] shadow-[0_12px_30px_rgba(95,187,70,0.2)] sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#14204f]/70">
                Internship teams
              </p>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
                Groups
              </h1>
              <p className="mt-2 max-w-2xl text-[11px] leading-5 text-[#14204f]/80">
                Interns join a group in their cohort the first time they open
                Group Discussion, and the first member becomes leader. Use this
                page to rebalance groups or change leaders.
              </p>
            </div>
            <div className="text-[#14204f]">
              <CohortPicker
                cohorts={data?.cohorts ?? []}
                value={selected}
                storageKey={PICKER_KEY}
                disabled={!data}
                extras={
                  (data?.legacyGroupCount ?? 0) > 0
                    ? [{ id: UNASSIGNED, label: `Groups without a cohort (${data!.legacyGroupCount})` }]
                    : []
                }
                onChange={(id) => {
                  setError(null);
                  setSuccess(null);
                  void load(id);
                }}
              />
            </div>
          </div>
        </header>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
            {success}
          </p>
        )}

        {isLegacy && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
            These groups were created before groups belonged to cohorts, and
            their members come from more than one cohort. Move each intern into
            a group in their own cohort, then delete the empty groups.
          </p>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Groups"
            value={String(groups.length)}
            detail={isLegacy ? "Without a cohort" : "In this cohort"}
          />
          <MetricCard
            label="Interns placed"
            value={String(placedCount)}
            detail="Members across all groups"
          />
          <MetricCard
            label="Not in a group"
            value={isLegacy ? "–" : String(unplaced.length)}
            detail="Haven't opened Group Discussion yet"
          />
        </section>

        {!isLegacy && selected && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void act({
                action: "createGroup",
                cohortId: selected,
                capacity: newCapacity,
              });
              setNewCapacity("");
            }}
            className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(28,29,82,0.09)]"
          >
            <label className="block text-[10px] font-semibold text-slate-500">
              New group capacity
              <input
                type="number"
                min={1}
                max={100}
                value={newCapacity}
                onChange={(event) => setNewCapacity(event.target.value)}
                placeholder={String(data?.defaultCapacity ?? 12)}
                className="mt-1 block w-32 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-[#1C1D52] outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-[#5FBB46] px-4 py-2.5 text-xs font-semibold text-[#14204f] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Create group
            </button>
            <p className="text-[10px] text-slate-500">
              Leave capacity empty to use the platform default (
              {data?.defaultCapacity ?? 12}).
            </p>
            {groups.length > 0 && (
              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    // Any paused: open them all. None paused: pause them all.
                    const open = pausedCount > 0;
                    if (
                      window.confirm(
                        open
                          ? `Open the discussion again for all ${groups.length} groups in this cohort?`
                          : `Pause the discussion for all ${groups.length} groups in this cohort? Members can still read their messages but can't post.`,
                      )
                    )
                      void act({ action: "setCohortDiscussion", cohortId: selected, open });
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#1C1D52] disabled:opacity-60"
                >
                  {pausedCount > 0 ? <MessageCircle className="h-4 w-4" /> : <MessageCircleOff className="h-4 w-4" />}
                  {pausedCount > 0 ? "Open all discussions" : "Pause all discussions"}
                </button>
                <button
                  type="button"
                  onClick={() => setBroadcasting(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1C1D52] px-4 py-2.5 text-xs font-semibold text-white"
                >
                  <Megaphone className="h-4 w-4" />
                  Message groups
                </button>
              </div>
            )}
          </form>
        )}

        {/* Refreshing after an action keeps the groups on screen. */}
        {loading && !data ? (
          <p className="rounded-xl bg-white px-4 py-3 text-xs text-slate-500">
            Loading groups…
          </p>
        ) : !selected ? (
          <p className="rounded-xl bg-white px-4 py-3 text-xs text-slate-500">
            Create a cohort first. Groups are organised within cohorts.
          </p>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
            <section className="grid content-start gap-4 lg:grid-cols-2">
              {groups.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
                  <label className="relative min-w-[220px] flex-1">
                    <span className="sr-only">Find an intern</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Find an intern by name or email"
                      className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-[#1C1D52] outline-none focus:border-[#5FBB46]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setUnfolded(new Set(allUnfolded ? [] : shownGroups.map((group) => group.id)))}
                    className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-[#1C1D52]"
                  >
                    {allUnfolded ? "Collapse all" : "Expand all"}
                  </button>
                  {pausedCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold text-amber-800">
                      {pausedCount} of {groups.length} discussion{groups.length === 1 ? "" : "s"} paused
                    </span>
                  )}
                </div>
              )}
              {term && shownGroups.length === 0 && (
                <p className="rounded-xl bg-white px-4 py-3 text-xs text-slate-500 lg:col-span-2">
                  No group has an intern matching “{search.trim()}”.
                </p>
              )}
              {groups.length === 0 && (
                <p className="rounded-xl bg-white px-4 py-3 text-xs text-slate-500 lg:col-span-2">
                  No groups yet. The first intern to open Group Discussion
                  creates Group 1, or you can create one above.
                </p>
              )}
              {shownGroups.map((group) => (
                <GroupCard
                  key={`${group.id}-${group.capacity}`}
                  group={group}
                  // Searching opens the groups that match.
                  expanded={Boolean(term) || unfolded.has(group.id)}
                  onToggle={() => toggleCard(group.id)}
                  isMatch={term ? matches : undefined}
                  isLegacy={isLegacy}
                  busy={busy}
                  moveTargets={groupsWithRoom
                    .filter((other) => other.id !== group.id)
                    .map((other) => ({
                      id: other.id,
                      label: `Group ${other.number}`,
                    }))}
                  onAct={(payload) => void act(payload)}
                  onRemove={(member) => removeMember(group, member)}
                  onDelete={() => deleteGroup(group)}
                  onOpenChat={() => setChatGroup(group)}
                />
              ))}
            </section>

            {!isLegacy && (
              <aside className="h-fit rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
                <h2 className="text-sm font-bold text-[#1C1D52]">
                  Not in a group
                </h2>
                <p className="mt-1 text-[10px] leading-5 text-slate-500">
                  Interns in this cohort who haven&apos;t been placed yet.
                  They&apos;ll be placed automatically when they open Group
                  Discussion, or you can add them now.
                </p>
                {unplaced.length === 0 ? (
                  <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
                    Everyone in this cohort is in a group.
                  </p>
                ) : shownUnplaced.length === 0 ? (
                  <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
                    No one here matches your search.
                  </p>
                ) : (
                  <ul className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto">
                    {shownUnplaced.map((intern) => (
                      <li
                        key={intern.userId}
                        className="rounded-xl border border-slate-200 p-3"
                      >
                        <p className="text-xs font-semibold text-[#1C1D52]">
                          {intern.name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {intern.email}
                        </p>
                        <GroupSelect
                          placeholder={
                            groupsWithRoom.length
                              ? "Add to group…"
                              : "No group has space"
                          }
                          targets={groupsWithRoom.map((group) => ({
                            id: group.id,
                            label: `Group ${group.number} (${group.members.length}/${group.capacity})`,
                          }))}
                          disabled={busy}
                          onSelect={(groupId) =>
                            void act({
                              action: "addMember",
                              groupId,
                              userId: intern.userId,
                            })
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </aside>
            )}
          </div>
        )}
      </div>
      {chatGroup && (
        <GroupChatDialog group={chatGroup} onClose={() => setChatGroup(null)} />
      )}
      {broadcasting && (
        <BroadcastDialog
          groups={groups}
          cohortName={
            data?.cohorts.find((cohort) => cohort.id === selected)?.name ?? "This cohort"
          }
          onClose={() => setBroadcasting(false)}
          onSent={(message) => {
            setBroadcasting(false);
            setError(null);
            setSuccess(message);
          }}
        />
      )}
    </AdminShell>
  );
}

function GroupCard({
  group,
  isLegacy,
  busy,
  moveTargets,
  expanded,
  onToggle,
  isMatch,
  onAct,
  onRemove,
  onDelete,
  onOpenChat,
}: {
  group: GroupRecord;
  isLegacy: boolean;
  busy: boolean;
  moveTargets: MoveTarget[];
  expanded: boolean;
  onToggle: () => void;
  /** While searching: whether a member matches (they're highlighted). */
  isMatch?: (member: GroupMember) => boolean;
  onAct: (payload: GroupAction) => void;
  onRemove: (member: GroupMember) => void;
  onDelete: () => void;
  onOpenChat: () => void;
}) {
  const [capacity, setCapacity] = useState(String(group.capacity));
  const isFull = group.members.length >= group.capacity;
  const leader = group.members.find((member) => member.userId === group.leaderId);

  return (
    <article className="rounded-2xl bg-white shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          )}
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-bold text-[#1C1D52]">
              <UsersRound className="h-4 w-4 text-[#5FBB46]" />
              Group {group.number}
              {!group.discussionOpen && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-800">Paused</span>
              )}
            </span>
            <span className={`block truncate text-[10px] font-semibold ${isFull ? "text-amber-600" : "text-slate-500"}`}>
              {isLegacy ? `${group.programName} · ` : ""}
              {group.members.length} / {group.capacity} members{isFull ? " · full" : ""}
              {leader ? ` · Leader: ${leader.name}` : ""}
            </span>
          </span>
        </button>
        <div className="flex items-center gap-2">
          <DiscussionSwitch
            open={group.discussionOpen}
            disabled={busy}
            label={`Group ${group.number} discussion`}
            onChange={(open) => onAct({ action: "setDiscussion", groupId: group.id, open })}
          />
          <button
            type="button"
            onClick={onOpenChat}
            aria-label={`Chat with Group ${group.number}`}
            title="Chat with group"
            className="rounded-lg bg-[#eef3ff] p-2 text-[#1C1D52]"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-3">
          <div className="flex flex-wrap items-start justify-end gap-3">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onAct({
                  action: "updateCapacity",
                  groupId: group.id,
                  capacity: Number(capacity),
                });
              }}
              className="flex items-end gap-2"
            >
              <label className="text-[9px] font-semibold text-slate-500">
                Capacity
                <input
                  type="number"
                  min={Math.max(1, group.members.length)}
                  max={100}
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                  className="mt-1 block w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-[#1C1D52] outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={busy || capacity === String(group.capacity)}
                aria-label={`Save capacity for Group ${group.number}`}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>

          {group.members.length === 0 ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-[10px] text-slate-500">This group is empty.</p>
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[9px] font-semibold text-red-600 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete group
              </button>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {group.members.map((member) => {
                const isLeader = member.userId === group.leaderId;
                return (
                  <li
                    key={member.userId}
                    className={`flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between ${isMatch?.(member) ? "-mx-2 rounded-lg bg-yellow-50 px-2" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-[#1C1D52]">
                        {member.name}
                        {isLeader && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                            <Crown className="h-3 w-3" />
                            Leader
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        {member.email}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!isLeader && !isLegacy && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            onAct({
                              action: "setLeader",
                              groupId: group.id,
                              userId: member.userId,
                            })
                          }
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[9px] font-semibold text-slate-700 disabled:opacity-60"
                        >
                          Make leader
                        </button>
                      )}
                      <GroupSelect
                        placeholder="Move to…"
                        targets={isLegacy ? (member.moveTargets ?? []) : moveTargets}
                        disabled={busy}
                        compact
                        onSelect={(groupId) =>
                          onAct({
                            action: "addMember",
                            groupId,
                            userId: member.userId,
                          })
                        }
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onRemove(member)}
                        aria-label={`Remove ${member.name}`}
                        className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 disabled:opacity-60"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

/** On/off switch for a group's discussion (on: members can post). */
function DiscussionSwitch({
  open,
  disabled,
  label,
  onChange,
}: {
  open: boolean;
  disabled: boolean;
  label: string;
  onChange: (open: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={open}
      aria-label={label}
      title={open ? "Discussion on: members can post. Click to pause." : "Discussion paused: members can only read. Click to open."}
      disabled={disabled}
      onClick={() => onChange(!open)}
      className="flex items-center gap-1.5 rounded-full text-[10px] font-semibold text-slate-600 disabled:opacity-50"
    >
      <span className={`relative h-5 w-9 rounded-full transition ${open ? "bg-[#5FBB46]" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${open ? "left-[18px]" : "left-0.5"}`} />
      </span>
      {open ? "On" : "Off"}
    </button>
  );
}

function GroupSelect({
  placeholder,
  targets,
  disabled,
  compact = false,
  onSelect,
}: {
  placeholder: string;
  targets: MoveTarget[];
  disabled: boolean;
  compact?: boolean;
  onSelect: (groupId: string) => void;
}) {
  return (
    <select
      value=""
      disabled={disabled || targets.length === 0}
      onChange={(event) => {
        if (event.target.value) onSelect(event.target.value);
      }}
      className={`rounded-lg border border-slate-200 bg-slate-50 text-[#1C1D52] outline-none disabled:opacity-50 ${compact ? "px-2 py-1.5 text-[9px]" : "mt-2 w-full px-2 py-2 text-[10px]"}`}
    >
      <option value="">
        {targets.length === 0 && compact ? "No group has space" : placeholder}
      </option>
      {targets.map((target) => (
        <option key={target.id} value={target.id}>
          {target.label}
        </option>
      ))}
    </select>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-[#1C1D52]">{value}</p>
      <p className="mt-1 text-[10px] text-slate-500">{detail}</p>
    </div>
  );
}

"use client";

import { Captions, Loader2, MessageSquareText, Mic, MicOff, PhoneOff, Video, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MeetingLine, PersonId } from "@/lib/office-life/story";
import { canListen, canSpeak, listen, speak, stopSpeaking } from "@/lib/office-life/speech";
import { Avatar, CoachCard, personById, type Act, type DayData, type StepView } from "./shared";

// Meet: a video-call room without video. The manager, co-workers and client
// speak their lines aloud (the browser's voices) with captions; at each of
// the intern's turns they answer by speaking (turned into text) or typing.
// The meeting is marked once it ends.

type MeetingStep = Extract<StepView, { kind: "meeting" }>;
type Said = { speaker: PersonId | "you"; text: string };

const SLOT: Record<PersonId, number> = { ceo: 0, manager: 1, supporter: 2, challenger: 3, client: 4 };

export default function MeetApp({ day, act, onDone }: { day: DayData; act: Act; onDone: (message: string) => void }) {
  const current = day.steps.find((step): step is MeetingStep => step.kind === "meeting" && step.available);
  const past = day.steps.filter((step): step is MeetingStep => step.kind === "meeting" && step.done);
  const upcoming = day.steps.filter((step): step is MeetingStep => step.kind === "meeting" && !step.done && !step.available);
  // Which meeting the intern has joined (each one starts in its lobby).
  const [joinedId, setJoinedId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const reviewing = past.find((step) => step.id === reviewId);

  if (current && joinedId === current.id)
    return <Room key={current.id} day={day} meeting={current} act={act} onLeave={() => setJoinedId(null)} onDone={onDone} />;
  if (current) return <Lobby key={current.id} day={day} meeting={current} onJoin={() => setJoinedId(current.id)} />;
  if (reviewing) return <Recap day={day} meeting={reviewing} onBack={() => setReviewId(null)} />;

  return (
    <div className="flex h-full min-h-[560px] flex-col items-center justify-center gap-4 bg-[#202124] p-6 text-center text-white">
      <Video className="h-10 w-10 text-[#8AB4F8]" />
      <p className="text-[18px]">No meeting right now</p>
      {upcoming.length > 0 && <p className="text-[13px] text-[#BDC1C6]">Next: {upcoming[0].title}, once you&apos;ve finished the steps before it.</p>}
      {past.length > 0 && (
        <div className="mt-2 w-full max-w-md space-y-2 text-left">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#9AA0A6]">Earlier today</p>
          {past.map((step) => (
            <button key={step.id} type="button" onClick={() => setReviewId(step.id)} className="flex w-full items-center justify-between rounded-lg bg-[#303134] px-4 py-3 text-[14px] hover:bg-[#3C4043]">
              {step.title}
              <span className="text-[12px] text-[#8AB4F8]">Transcript and feedback</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Lobby({ day, meeting, onJoin }: { day: DayData; meeting: MeetingStep; onJoin: () => void }) {
  const [level, setLevel] = useState(0);
  const [micState, setMicState] = useState<"idle" | "on" | "blocked">("idle");
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => () => stopRef.current(), []);

  async function testMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      context.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let frame = 0;
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setLevel(Math.min(1, data.reduce((sum, value) => sum + value, 0) / data.length / 60));
        frame = requestAnimationFrame(tick);
      };
      tick();
      setMicState("on");
      stopRef.current = () => {
        cancelAnimationFrame(frame);
        stream.getTracks().forEach((track) => track.stop());
        void context.close();
      };
    } catch {
      setMicState("blocked");
    }
  }

  return (
    <div className="grid h-full min-h-[560px] items-center gap-8 bg-white p-6 text-[#202124] md:grid-cols-[1fr_340px] md:p-10">
      <div className="flex aspect-video flex-col items-center justify-center rounded-xl bg-[#202124] text-white">
        <Avatar person="you" size="h-24 w-24 text-[26px]" />
        <p className="mt-3 text-[14px] text-[#BDC1C6]">Camera is off (voice meeting)</p>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={() => void testMic()} className="inline-flex items-center gap-2 rounded-full bg-[#3C4043] px-4 py-2 text-[13px] hover:bg-[#4A4D51]">
            <Mic className="h-4 w-4" /> {micState === "on" ? "Microphone on" : "Check microphone"}
          </button>
          <button
            type="button"
            onClick={() => void speak("Hello. You can hear the meeting.", "female", 1)}
            className="inline-flex items-center gap-2 rounded-full bg-[#3C4043] px-4 py-2 text-[13px] hover:bg-[#4A4D51]"
          >
            <Volume2 className="h-4 w-4" /> Test sound
          </button>
        </div>
        {micState === "on" && (
          <div className="mt-3 h-1.5 w-40 overflow-hidden rounded-full bg-[#3C4043]">
            <div className="h-full rounded-full bg-[#8AB4F8] transition-all" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
        )}
        {micState === "blocked" && <p className="mt-3 text-[12px] text-[#F28B82]">Microphone blocked. You can still type your answers.</p>}
      </div>
      <div className="text-center md:text-left">
        <p className="text-[24px]">{meeting.title}</p>
        <p className="mt-2 text-[14px] text-[#5F6368]">{meeting.agenda}</p>
        <div className="mt-4 flex justify-center gap-2 md:justify-start">
          {meeting.participants.map((id) => (
            <span key={id} title={personById(day.people, id).name}>
              <Avatar person={personById(day.people, id)} />
            </span>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-[#5F6368]">
          {meeting.participants.map((id) => personById(day.people, id).name.split(" ")[0]).join(", ")} {meeting.participants.length === 1 ? "is" : "are"} waiting
        </p>
        <button
          type="button"
          onClick={() => {
            stopRef.current();
            onJoin();
          }}
          className="mt-6 rounded-full bg-[#0B57D0] px-8 py-3 text-[15px] font-medium text-white hover:bg-[#0842A0]"
        >
          Join now
        </button>
        {!canSpeak() && <p className="mt-3 text-[12px] text-[#C5221F]">This browser can&apos;t play the voices: you&apos;ll read captions instead.</p>}
        {!canListen() && <p className="mt-2 text-[12px] text-[#5F6368]">Speaking isn&apos;t supported in this browser: you&apos;ll type your answers. Chrome works best.</p>}
      </div>
    </div>
  );
}

function Room({ day, meeting, act, onLeave, onDone }: { day: DayData; meeting: MeetingStep; act: Act; onLeave: () => void; onDone: (message: string) => void }) {
  const [index, setIndex] = useState(0);
  // The line spoken most recently (so whoever is speaking can be shown).
  const [spoken, setSpoken] = useState(-1);
  const [answers, setAnswers] = useState<string[]>([]);
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [panel, setPanel] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const stopListening = useRef<() => void>(() => {});
  const lines: MeetingLine[] = meeting.lines;
  const line = lines[index];
  const finished = index >= lines.length;
  const people = useMemo(() => meeting.participants.map((id) => personById(day.people, id)), [meeting, day.people]);
  // Everything said so far, from the script and the intern's answers.
  const said = useMemo(() => {
    const out: Said[] = [];
    let answered = 0;
    lines.slice(0, Math.min(index + 1, lines.length)).forEach((item, i) => {
      if (!("you" in item)) out.push({ speaker: item.speaker, text: item.text });
      else if (i < index) out.push({ speaker: "you", text: answers[answered++] || "(said nothing)" });
    });
    return out;
  }, [lines, index, answers]);

  // Each line someone says: speak it, show it, then move on.
  useEffect(() => {
    if (!line || "you" in line) return;
    const controller = new AbortController();
    const person = personById(day.people, line.speaker);
    const words = line.text.split(/\s+/).length;
    const done = canSpeak() ? speak(line.text, person.voice, SLOT[line.speaker], controller.signal) : new Promise((resolve) => setTimeout(resolve, 900 + words * 330));
    void done.then(() => {
      if (controller.signal.aborted) return;
      setSpoken(index);
      setTimeout(() => setIndex((i) => i + 1), 450);
    });
    return () => controller.abort();
  }, [line, index, day.people]);

  useEffect(() => () => {
    stopSpeaking();
    stopListening.current();
  }, []);

  function startListening() {
    setNotice(null);
    setListening(true);
    const before = answer ? `${answer} ` : "";
    stopListening.current = listen(
      (text) => setAnswer(`${before}${text}`.trim()),
      (error) => {
        setListening(false);
        if (error) setNotice(error);
      },
    );
  }

  function finishTurn() {
    stopListening.current();
    setListening(false);
    const text = answer.trim();
    setAnswers((list) => [...list, text]);
    setAnswer("");
    setIndex((i) => i + 1);
  }

  async function endMeeting() {
    setSubmitting(true);
    const failure = await act({ action: "meeting", stepId: meeting.id, turns: answers });
    setSubmitting(false);
    if (failure) return setNotice(failure);
    onDone(`"${meeting.title}" has ended. The notes are in your inbox.`);
  }

  const speaking: PersonId | "you" | null = listening ? "you" : line && !("you" in line) && spoken < index ? line.speaker : null;
  const last = said[said.length - 1];
  const youTurn = line && "you" in line ? line : null;

  return (
    <div className="flex h-full min-h-[560px] flex-col bg-[#202124] text-white">
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
          <div className={`grid flex-1 gap-3 ${people.length + 1 <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2"}`}>
            {[...people, "you" as const].map((person) => {
              const id = person === "you" ? "you" : person.id;
              const active = speaking === id;
              return (
                <div
                  key={id}
                  className={`relative flex min-h-[130px] items-center justify-center rounded-xl bg-[#3C4043] transition ${active ? "ring-4 ring-[#8AB4F8]" : ""}`}
                >
                  <div className={`rounded-full ${active ? "animate-pulse" : ""}`}>
                    <Avatar person={person} size="h-16 w-16 text-[20px] sm:h-20 sm:w-20 sm:text-[24px]" />
                  </div>
                  <span className="absolute bottom-2 left-3 text-[12px] font-medium sm:text-[13px]">
                    {person === "you" ? `${day.you} (you)` : `${person.name} · ${person.role}`}
                  </span>
                  {person === "you" && !listening && <MicOff className="absolute bottom-2 right-3 h-4 w-4 text-[#F28B82]" />}
                </div>
              );
            })}
          </div>

          {captions && last && !youTurn && !finished && (
            <p className="mx-auto mt-3 max-w-3xl rounded-lg bg-black/60 px-4 py-2 text-center text-[15px] leading-6">
              <span className="font-semibold text-[#8AB4F8]">{last.speaker === "you" ? "You" : personById(day.people, last.speaker).name.split(" ")[0]}: </span>
              {last.text}
            </p>
          )}

          {youTurn && (
            <div className="mx-auto mt-3 w-full max-w-3xl rounded-xl bg-[#303134] p-4">
              <p className="text-[13px] font-semibold text-[#FDD663]">Your turn</p>
              <p className="mt-1 text-[14px] text-[#E8EAED]">{youTurn.you}</p>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={canListen() ? "Press the microphone and speak, or type here" : "Type what you'd say"}
                className="mt-3 w-full resize-none rounded-lg bg-[#202124] px-3 py-2 text-[14px] text-white outline-none ring-1 ring-[#5F6368] focus:ring-[#8AB4F8]"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {canListen() && (
                  <button
                    type="button"
                    onClick={() => (listening ? (stopListening.current(), setListening(false)) : startListening())}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium ${listening ? "bg-[#F28B82] text-[#202124]" : "bg-[#8AB4F8] text-[#202124]"}`}
                  >
                    {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {listening ? "Stop speaking" : "Speak"}
                  </button>
                )}
                <button type="button" onClick={finishTurn} disabled={!answer.trim()} className="rounded-full bg-[#E8EAED] px-4 py-2 text-[13px] font-medium text-[#202124] disabled:opacity-40">
                  I&apos;m done
                </button>
                {listening && <span className="text-[12px] text-[#8AB4F8]">Listening…</span>}
              </div>
              {notice && <p className="mt-2 text-[12px] text-[#F28B82]">{notice}</p>}
            </div>
          )}

          {finished && (
            <div className="mx-auto mt-3 w-full max-w-md rounded-xl bg-[#303134] p-5 text-center">
              <p className="text-[16px]">The meeting is over.</p>
              <button type="button" disabled={submitting} onClick={() => void endMeeting()} className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#0B57D0] px-6 py-2.5 text-[14px] font-medium">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Saving the notes…" : "Leave the meeting"}
              </button>
              {notice && <p className="mt-2 text-[12px] text-[#F28B82]">{notice}</p>}
            </div>
          )}
        </div>

        {panel && (
          <aside className="hidden w-80 shrink-0 flex-col border-l border-[#3C4043] bg-white text-[#202124] md:flex">
            <p className="border-b border-[#E8EAED] px-4 py-3 text-[15px] font-medium">Transcript</p>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-[13px]">
              {said.map((item, i) => (
                <p key={i}>
                  <strong>{item.speaker === "you" ? "You" : personById(day.people, item.speaker).name}</strong>
                  <br />
                  {item.text}
                </p>
              ))}
            </div>
          </aside>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="hidden truncate text-[14px] sm:block">{meeting.title}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title={captions ? "Turn off captions" : "Turn on captions"}
            onClick={() => setCaptions(!captions)}
            className={`rounded-full p-3 ${captions ? "bg-[#8AB4F8] text-[#202124]" : "bg-[#3C4043]"}`}
          >
            <Captions className="h-5 w-5" />
          </button>
          <button type="button" title="Transcript" onClick={() => setPanel(!panel)} className={`hidden rounded-full p-3 md:block ${panel ? "bg-[#8AB4F8] text-[#202124]" : "bg-[#3C4043]"}`}>
            <MessageSquareText className="h-5 w-5" />
          </button>
          <button
            type="button"
            title="Leave call"
            onClick={() => {
              if (!finished && !window.confirm("Leave the meeting? You'll need to start it again.")) return;
              stopSpeaking();
              stopListening.current();
              if (finished) void endMeeting();
              else onLeave();
            }}
            className="rounded-full bg-[#EA4335] px-5 py-3"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
        <span className="hidden w-24 sm:block" />
      </div>
    </div>
  );
}

function Recap({ day, meeting, onBack }: { day: DayData; meeting: MeetingStep; onBack: () => void }) {
  const turns = meeting.submission?.kind === "meeting" ? meeting.submission.turns : [];
  let turn = 0;
  return (
    <div className="h-full min-h-[560px] overflow-y-auto bg-white p-6 text-[#202124]">
      <button type="button" onClick={onBack} className="text-[13px] text-[#0B57D0]">
        ← Back
      </button>
      <h2 className="mt-2 text-[20px]">{meeting.title}</h2>
      <div className="mt-4 space-y-3 text-[14px]">
        {meeting.lines.map((line, i) => (
          <p key={i}>
            <strong>{"you" in line ? "You" : personById(day.people, line.speaker).name}:</strong> {"you" in line ? turns[turn++]?.text || "(said nothing)" : line.text}
          </p>
        ))}
      </div>
      {meeting.feedback && <CoachCard feedback={meeting.feedback} />}
    </div>
  );
}

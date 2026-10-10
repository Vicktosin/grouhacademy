import { z } from "zod";
import { AiUnavailableError, generateObject } from "@/lib/ai";
import type { Cast, PersonId, Step } from "@/lib/office-life/story";

// Marks one piece of Office Life work (an email, a meeting, a report or the
// build summary) with a single AI call, which also writes the reply in
// character: the person emailed answers, the manager comments on a report
// or the build. Without AI, simple rules mark it and a written reply is
// used, so Office Life always works.

export type Feedback = {
  score: number;
  strengths: string[];
  improvements: string[];
  /** The in-character reply (emails, reports, build) or meeting notes. */
  reply: string;
  /** Who the reply is from. */
  from: PersonId;
  source: "ai" | "rules";
};

export type Submission =
  | { kind: "email"; to: PersonId[]; cc: PersonId[]; subject: string; body: string }
  | { kind: "meeting"; turns: Array<{ prompt: string; text: string }> }
  | { kind: "report"; fields: Array<{ label: string; text: string }> }
  | { kind: "work"; summary: string; link: string };

const schema = z.object({
  score: z.number().int().min(0).max(100),
  strengths: z.array(z.string()).max(3),
  improvements: z.array(z.string()).max(3),
  reply: z.string(),
});

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const names = (cast: Cast, ids: PersonId[]) => ids.map((id) => `${cast[id].name} (${cast[id].role})`).join(", ") || "nobody";

/** Recipients the step expected that the intern left out, and extra ones. */
export function addressingProblems(step: Extract<Step, { kind: "email" }>, to: PersonId[], cc: PersonId[]) {
  const problems: string[] = [];
  const all = new Set([...to, ...cc]);
  for (const id of step.to) if (!to.includes(id)) problems.push(`${id === "client" ? "The client" : "The main recipient"} should be in To.`);
  for (const id of step.cc) if (!all.has(id)) problems.push(`Copy ${id === "ceo" ? "the CEO" : "your manager"} (Cc), as asked.`);
  if (step.cc.length === 0 && cc.length > 0) problems.push("Nobody needed copying on this one; keep Cc for people who need to know.");
  return problems;
}

function replyAuthor(step: Step): PersonId {
  if (step.kind === "email") return step.to[0];
  return "manager";
}

function describe(cast: Cast, step: Step, submission: Submission, you: string) {
  switch (submission.kind) {
    case "email":
      return `${you} sent an email.
To: ${names(cast, submission.to)}
Cc: ${names(cast, submission.cc)}
Subject: ${submission.subject}

${submission.body}`;
    case "meeting":
      return `What ${you} said in the meeting "${step.title}", turn by turn:
${submission.turns.map((turn, i) => `${i + 1}. (Prompt: ${turn.prompt})\n${turn.text || "(said nothing)"}`).join("\n\n")}`;
    case "report":
      return `${you}'s report:
${submission.fields.map((field) => `${field.label}:\n${field.text}`).join("\n\n")}`;
    case "work":
      return `${you}'s summary of the work:
${submission.summary}
Link or details: ${submission.link || "(none)"}`;
  }
}

function replyInstructions(cast: Cast, step: Step, you: string) {
  const author = cast[replyAuthor(step)];
  switch (step.kind) {
    case "email":
      return `Write "reply" as ${author.name}, ${author.role}, answering ${you}'s email in character: natural, brief (40 to 110 words), signed with your first name, reacting to what ${you} actually wrote. If the email was rude, unclear or missing something important, react the way a real person would, politely.`;
    case "meeting":
      return `Write "reply" as short meeting notes (decisions and action points, 40 to 100 words) as ${cast.manager.name} would send after the meeting.`;
    case "report":
      return `Write "reply" as ${cast.manager.name}'s short reply to the report (30 to 90 words): encouraging, specific, and with one piece of advice.`;
    default:
      return `Write "reply" as ${cast.manager.name}'s short review of the work (40 to 110 words): what's good, what to fix, and a next step.`;
  }
}

/** One AI call: the mark, two or three strengths and improvements, and the reply. */
export async function gradeStep(
  cast: Cast,
  step: Exclude<Step, { kind: "inbox" }>,
  submission: Submission,
  you: string,
): Promise<Feedback> {
  const addressing = step.kind === "email" && submission.kind === "email" ? addressingProblems(step, submission.to, submission.cc) : [];
  try {
    const result = await generateObject({
      task: "office life",
      schema,
      effort: "low",
      maxTokens: 900,
      system: `You run "Office Life" at Grouh Academy: interns in Nigeria practise everyday work at ${cast.company.name}, a made-up Lagos agency (${cast.company.about}). The intern, ${you}, works in the ${cast.department} team with ${cast.manager.name} (manager), ${cast.supporter.name} (${cast.supporter.role}) and ${cast.challenger.name} (${cast.challenger.role}); the CEO is ${cast.ceo.name}. The client is ${cast.client.name}, ${cast.client.role}: ${cast.clientBusiness}. The project is ${cast.project}.

Mark the intern's work as a fair, encouraging workplace coach would. Score 0 to 100 against the rubric: 85+ is ready for a real workplace, 60 to 84 is good with fixes, below 60 needs real work. Strengths and improvements: specific to what they wrote, one short sentence each, plain English. Never mention AI, Grouh Academy or that this is practice in "reply".`,
      prompt: `Task: ${"task" in step ? step.task : step.agenda}
Rubric: ${step.rubric}
${addressing.length ? `Addressing problems already found (count them in the score): ${addressing.join(" ")}\n` : ""}
${describe(cast, step, submission, you)}

${replyInstructions(cast, step, you)}`,
    });
    return {
      score: result.score,
      strengths: result.strengths,
      improvements: [...addressing, ...result.improvements].slice(0, 4),
      reply: result.reply.trim(),
      from: replyAuthor(step),
      source: "ai",
    };
  } catch (error) {
    if (!(error instanceof AiUnavailableError)) console.error("[office life] marking failed, using rules:", error);
    return gradeByRules(cast, step, submission, you, addressing);
  }
}

/** Without AI: length, completeness and addressing, and a written reply. */
function gradeByRules(
  cast: Cast,
  step: Exclude<Step, { kind: "inbox" }>,
  submission: Submission,
  you: string,
  addressing: string[],
): Feedback {
  const improvements = [...addressing];
  const strengths: string[] = [];
  let score = 70;
  const author = replyAuthor(step);
  const first = (id: PersonId) => cast[id].name.split(" ")[0];
  let reply = "";

  if (submission.kind === "email") {
    const length = words(submission.body);
    if (!submission.subject.trim()) {
      score -= 10;
      improvements.push("Add a clear subject line.");
    } else strengths.push("You gave the email a subject line.");
    if (length < 40) {
      score -= 15;
      improvements.push("Say a little more: the reader needs enough detail to act.");
    } else if (length > 350) {
      score -= 5;
      improvements.push("Keep emails shorter and easier to scan.");
    } else strengths.push("The length is about right for a work email.");
    if (!new RegExp(`\\b${you.split(" ")[0]}\\b`, "i").test(submission.body.slice(-120))) {
      score -= 5;
      improvements.push("Sign off with your name.");
    }
    score -= addressing.length * 10;
    reply = `Hi ${you},\n\nThanks for your email. Noted, and I'll get back to you if I have any questions.\n\n${first(author)}`;
  } else if (submission.kind === "meeting") {
    const answered = submission.turns.filter((turn) => words(turn.text) >= 8).length;
    score = Math.round(40 + (answered / Math.max(1, submission.turns.length)) * 50);
    if (answered === submission.turns.length) strengths.push("You spoke up at every turn.");
    else improvements.push("Contribute fully at every turn of the meeting.");
    reply = `Notes from "${step.title}": thanks everyone. Actions are in the follow-up email.`;
  } else if (submission.kind === "report") {
    const filled = submission.fields.filter((field) => words(field.text) >= 5).length;
    score = Math.round(40 + (filled / submission.fields.length) * 50);
    if (filled === submission.fields.length) strengths.push("Every part of the report is filled in.");
    else improvements.push("Fill in every part of the report with specifics.");
    reply = `Thanks, ${you}. Report received. Good work today.\n\n${first("manager")}`;
  } else {
    const length = words(submission.summary);
    score = length >= 60 ? 75 : length >= 25 ? 60 : 45;
    if (length < 60) improvements.push("Explain what you built and why in more detail.");
    else strengths.push("A clear summary of the work.");
    reply = `Thanks, ${you}. I'll review this and come back to you.\n\n${first("manager")}`;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 4),
    reply,
    from: author,
    source: "rules",
  };
}

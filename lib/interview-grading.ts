import { z } from "zod";
import { generateObject } from "@/lib/ai";

// Scores a practice-interview transcript with AI (Claude Sonnet 5.5 is
// about $0.05 per 15-minute interview; free Gemini, OpenRouter or Groq
// keys work too, see lib/ai.ts). Needs one AI key.

export const InterviewFeedbackSchema = z.object({
  overallScore: z
    .number()
    .int()
    .describe("0-100 overall interview performance"),
  summary: z.string().describe("Two or three sentences for the intern"),
  strengths: z.array(z.string()).describe("What the intern did well"),
  improvements: z
    .array(z.string())
    .describe("Specific, actionable things to do better next time"),
  questions: z.array(
    z.object({
      question: z.string(),
      score: z.number().int().describe("0-10 for the answer to this question"),
      feedback: z.string(),
    }),
  ),
});

export type InterviewFeedback = z.infer<typeof InterviewFeedbackSchema>;

export type TranscriptTurn = { role: string; content: string };

const SYSTEM_PROMPT = `You are an experienced hiring manager reviewing a practice job interview for an intern at SabiRole, a Nigerian internship programme. The interview was run by an AI interviewer; "assistant" turns are the interviewer and "user" turns are the intern.

Assess the intern's answers fairly for someone at the stated level: relevance, depth and correctness for the track, structure and clarity, use of concrete examples, and professionalism. Questions the interviewer never got to, or the intern didn't answer, score 0 and say so. Speech-to-text errors are expected; judge meaning, not transcription mistakes.

Write feedback directly to the intern ("you"), encouraging but honest, with concrete suggestions they can practise. Keep each item short.`;

export async function gradeInterview(input: {
  track: string;
  level: string;
  questions: string[];
  transcript: TranscriptTurn[];
}): Promise<InterviewFeedback> {
  const conversation = input.transcript
    .filter((turn) => turn.role === "user" || turn.role === "assistant")
    .map(
      (turn) =>
        `${turn.role === "user" ? "Intern" : "Interviewer"}: ${turn.content.trim()}`,
    )
    .join("\n");

  const output = await generateObject({
    task: "interview grading",
    schema: InterviewFeedbackSchema,
    system: SYSTEM_PROMPT,
    prompt: `Track: ${input.track}
Level: ${input.level}

Planned questions:
${input.questions.map((question, index) => `${index + 1}. ${question}`).join("\n")}

Transcript:
${conversation}

Grade this interview. Include one entry in "questions" for each planned question, in order.`,
    maxTokens: 16000,
    effort: "medium",
  });

  const feedback = output;
  return {
    ...feedback,
    overallScore: Math.max(0, Math.min(100, feedback.overallScore)),
    questions: feedback.questions.map((item) => ({
      ...item,
      score: Math.max(0, Math.min(10, item.score)),
    })),
  };
}

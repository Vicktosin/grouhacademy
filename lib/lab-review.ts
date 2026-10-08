import { z } from "zod";
import { generateObject } from "@/lib/ai";
import type { LabCheckResult, LabFiles } from "@/lib/lab-shared";

// AI code review for Practice Lab code and backend API submissions (Claude
// Sonnet 5.5 is a few cents each; free Gemini, OpenRouter or Groq keys work
// too, see lib/ai.ts). Optional: needs one AI key.

export const LabReviewSchema = z.object({
  rating: z.number().int().describe("0-10 code quality for the intern's level"),
  summary: z.string().describe("Two sentences for the intern"),
  strengths: z.array(z.string()),
  improvements: z
    .array(z.string())
    .describe("Specific, actionable suggestions, referring to their code"),
});

export type LabReview = z.infer<typeof LabReviewSchema>;

const FRONT_END_PROMPT = `You are a senior front-end developer mentoring interns at Grouh Academy, a Nigerian tech internship programme. Review an intern's solution to a practice exercise.

Judge it for someone at the stated level: does it meet the brief, is the code correct, readable and well structured, are HTML semantics, accessibility, CSS and (for React) component/state patterns sensible. Automatic check results are included; failing checks usually point at what to fix first.

Write to the intern ("you"), encouraging and specific: quote or name the parts of their code you mean. Keep each item short. Don't rewrite the whole solution.`;

const BACKEND_PROMPT = `You are a senior backend engineer mentoring interns at Grouh Academy, a Nigerian tech internship programme. Review an intern's solution to a practice exercise: a Node.js + Express API using a SQLite database through require("./db") (db.query(sql, params) returns { rows, rowCount }; db.prepare(sql).all/get/run also work). It runs in a simulator that behaves like Express 5.

Judge it for someone at the stated level: does it meet the brief; are routes RESTful with the right methods and status codes (201 on create, 204 on delete, 400 for bad input, 404 when missing, 401/403 for auth); is input validated; are errors handled (async errors, a final error handler, no leaked stack traces); are SQL queries parameterised (never built by joining strings with user input) and is the schema sensible; are passwords hashed and secrets read from process.env; is the code readable and sensibly split into files. Test results are included; "Hidden test" results come from tests the intern can't see, so mention what kind of case may be failing without guessing details.

Write to the intern ("you"), encouraging and specific: quote or name the parts of their code you mean. Keep each item short. Don't rewrite the whole solution.`;

export async function reviewLabCode(input: {
  /** Backend APIs get a backend engineer's review. */
  backend?: boolean;
  track: string;
  level: string;
  kindLabel: string;
  title: string;
  brief: string;
  files: LabFiles;
  checkResults: LabCheckResult[];
}): Promise<LabReview> {
  const code = Object.entries(input.files)
    .map(([name, contents]) => `--- ${name} ---\n${contents}`)
    .join("\n\n");
  const checks = input.checkResults.length
    ? input.checkResults
        .map((check) => `${check.passed ? "PASS" : "FAIL"}: ${check.label}`)
        .join("\n")
    : "(no checks)";

  const output = await generateObject({
    task: "lab review",
    schema: LabReviewSchema,
    system: input.backend ? BACKEND_PROMPT : FRONT_END_PROMPT,
    prompt: `Track: ${input.track}
Level: ${input.level}
Exercise (${input.kindLabel}): ${input.title}

Brief:
${input.brief}

${input.backend ? "API tests" : "Automatic checks"}:
${checks}

Intern's code:
${code}`,
    maxTokens: 16000,
    effort: "medium",
  });

  return {
    ...output,
    rating: Math.max(0, Math.min(10, output.rating)),
  };
}

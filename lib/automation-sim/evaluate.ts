import { z } from "zod";
import { generateObject, isAiEnabled } from "@/lib/ai";
import {
  allSteps,
  fillTemplate,
  OTHER_CATEGORY,
  parseCategories,
  type AiLabels,
  type SampleRecord,
  type Step,
  type Workflow,
} from "@/lib/automation-sim/model";

// The AI steps of the automation simulator: each sorts a record's text into
// the categories the intern listed. AI when a key is set (Claude, or free
// Gemini, OpenRouter or Groq; see lib/ai.ts; one call per AI step, for all
// records at once), otherwise simple
// keyword rules. Answers are remembered so re-running the same text with the
// same categories gives the same result.

const MAX_REMEMBERED = 2000;
const remembered = new Map<string, string>();

type Category = { name: string; description: string };

const ClassifySchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      category: z.string().describe(`Exactly one category name from the list, or "${OTHER_CATEGORY}"`),
    }),
  ),
});

const PROMPT = `You are the AI step inside a no-code automation workflow for a Nigerian business. Sort each item of text into exactly one of the given categories, using the category names and what they mean. Answer with the category name exactly as written. If no category fits, answer "${OTHER_CATEGORY}". Judge by meaning, not keywords.`;

const STOP_WORDS = new Set(
  "about after again also any asks because been before being from have into just more most only other over same some such than that their them then there these they this those very wants what when where which while will with would your".split(" "),
);
const stems = (text: string) =>
  (text.toLowerCase().match(/[a-z]{4,}/g) ?? [])
    .filter((word) => !STOP_WORDS.has(word))
    .map((word) => word.slice(0, 5));

/** Keyword fallback: the category whose name and meaning share the most words with the text. */
function classifyWithRules(text: string, categories: Category[]) {
  const words = new Set(stems(text));
  const keywords = categories.map((category) => new Set(stems(`${category.name} ${category.description}`)));
  // Words in more than one category don't help tell them apart.
  const shared = new Set(
    keywords.flatMap((set, i) => [...set].filter((word) => keywords.some((other, j) => j !== i && other.has(word)))),
  );
  let best = OTHER_CATEGORY;
  let bestHits = 0;
  categories.forEach((category, i) => {
    const hits = [...keywords[i]].filter((word) => !shared.has(word) && words.has(word)).length;
    if (hits > bestHits) {
      best = category.name;
      bestHits = hits;
    }
  });
  return best;
}

async function classifyWithAi(items: Array<{ id: string; text: string }>, categories: Category[]) {
  const output = await generateObject({
    task: "automation sorting",
    schema: ClassifySchema,
    system: PROMPT,
    prompt: `Categories:
${categories.map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ""}`).join("\n")}

Items:
${items.map((item) => `[${item.id}] ${item.text || "(empty)"}`).join("\n\n")}`,
    maxTokens: 4000,
    effort: "low",
  });
  return new Map(output.results.map((r) => [r.id, r.category]));
}

const keyFor = (text: string, categories: Category[]) =>
  JSON.stringify([text, categories.map((c) => [c.name, c.description])]);

function remember(key: string, category: string) {
  if (remembered.size >= MAX_REMEMBERED) remembered.delete(remembered.keys().next().value!);
  remembered.set(key, category);
}

/** Sorts every record's text for one AI step. */
async function classifyStep(step: Extract<Step, { type: "AI" }>, records: SampleRecord[]) {
  const categories = parseCategories(step.categories);
  const names = new Map(categories.map((c) => [c.name.toLowerCase(), c.name]));
  const out: Record<string, string> = {};
  const todo: Array<{ id: string; text: string; key: string }> = [];
  for (const record of records) {
    const text = fillTemplate(step.input, record.data).slice(0, 2000);
    const key = keyFor(text, categories);
    const known = remembered.get(key);
    if (known) out[record.id] = known;
    else todo.push({ id: record.id, text, key });
  }
  if (!todo.length) return out;

  let answers: Map<string, string> | null = null;
  if (isAiEnabled()) {
    try {
      answers = await classifyWithAi(todo, categories);
    } catch (error) {
      console.error("AI step failed; using keyword rules.", error);
    }
  }
  for (const item of todo) {
    const answer = answers?.get(item.id);
    const category = answer
      ? (names.get(answer.trim().toLowerCase()) ?? OTHER_CATEGORY)
      : classifyWithRules(item.text, categories);
    out[item.id] = category;
    // Only remember real AI answers, so the rules never stick once a key is set.
    if (answer) remember(item.key, category);
  }
  return out;
}

/** AI results for every AI step in the workflow, for these records. */
export async function aiLabelsFor(workflow: Workflow, records: SampleRecord[]): Promise<AiLabels> {
  const aiSteps = allSteps(workflow.steps).filter(
    (step): step is Extract<Step, { type: "AI" }> => step.type === "AI",
  );
  const results = await Promise.all(aiSteps.map((step) => classifyStep(step, records)));
  return Object.fromEntries(aiSteps.map((step, i) => [step.id, results[i]]));
}

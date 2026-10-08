import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import { AiUnavailableError, aiProviders, generateObject } from "../lib/ai";

// The provider chain, with fetch faked so no real API is called.

const KEYS = ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY", "GROQ_API_KEY", "XAI_API_KEY"];
const schema = z.object({ rating: z.number().int(), summary: z.string() });
const ask = () =>
  generateObject({ task: "test", schema, system: "Rate it.", prompt: "Some work", maxTokens: 1000, effort: "low" });

type Call = { url: string; body: { model: string; messages: Array<{ role: string; content: string }> } };

async function withProviders(
  keys: Record<string, string>,
  answer: (url: string) => Response,
  run: (calls: Call[]) => Promise<void>,
) {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  const savedFetch = globalThis.fetch;
  const savedWarn = console.warn;
  const calls: Call[] = [];
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, keys);
  console.warn = () => {};
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return answer(url);
  }) as typeof fetch;
  try {
    await run(calls);
  } finally {
    globalThis.fetch = savedFetch;
    console.warn = savedWarn;
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

const reply = (content: string) =>
  Response.json({ choices: [{ message: { content } }] });

test("with no keys, AI is off and asking fails cleanly", async () => {
  await withProviders({}, () => reply("{}"), async (calls) => {
    assert.deepEqual(aiProviders(), []);
    await assert.rejects(ask(), AiUnavailableError);
    assert.equal(calls.length, 0);
  });
});

test("a failing provider is skipped and the next one answers", async () => {
  await withProviders(
    { GEMINI_API_KEY: "g", OPENROUTER_API_KEY: "o", GROQ_API_KEY: "q" },
    (url) =>
      url.includes("googleapis")
        ? new Response("quota exceeded", { status: 429 })
        : // Fenced JSON with extra text still counts.
          reply('Here you go:\n```json\n{"rating": 7, "summary": "Good"}\n```'),
    async (calls) => {
      assert.deepEqual(aiProviders(), ["Gemini", "OpenRouter", "Groq"]);
      assert.deepEqual(await ask(), { rating: 7, summary: "Good" });
      assert.equal(calls.length, 2);
      assert.match(calls[1].url, /openrouter\.ai/);
      assert.equal(calls[1].body.model, "openrouter/free");
      // The schema is spelled out for providers without Claude's structured output.
      assert.match(calls[1].body.messages[0].content, /"rating"/);
    },
  );
});

test("an answer that doesn't match the schema moves on", async () => {
  await withProviders(
    { OPENROUTER_API_KEY: "o", GROQ_API_KEY: "q" },
    (url) => (url.includes("openrouter") ? reply('{"rating": "great"}') : reply('{"rating": 4, "summary": "Ok"}')),
    async (calls) => {
      assert.deepEqual(await ask(), { rating: 4, summary: "Ok" });
      assert.match(calls[1].url, /groq\.com/);
    },
  );
});

test("when every provider fails, the error says why", async () => {
  await withProviders({ GROQ_API_KEY: "q" }, () => new Response("down", { status: 503 }), async () => {
    await assert.rejects(ask(), /Groq: HTTP 503/);
  });
});

test("models can be changed with environment variables", async () => {
  await withProviders({ GROQ_API_KEY: "q", GROQ_MODEL: "qwen/qwen3-32b" }, () => reply('{"rating": 1, "summary": "x"}'), async (calls) => {
    await ask();
    assert.equal(calls[0].body.model, "qwen/qwen3-32b");
  });
  delete process.env.GROQ_MODEL;
});

test("images go to a vision model as image parts", async () => {
  await withProviders({ GROQ_API_KEY: "q", GROQ_MODEL: "openai/gpt-oss-120b" }, () => reply('{"rating": 5, "summary": "x"}'), async (calls) => {
    await generateObject({
      task: "test",
      schema,
      system: "Rate it.",
      prompt: "An ad",
      maxTokens: 1000,
      effort: "low",
      images: [{ label: "Ad A: image", mediaType: "image/webp", data: "AAAA" }],
    });
    assert.equal(calls[0].body.model, "qwen/qwen3.8-27b");
    const content = calls[0].body.messages[1].content as unknown as Array<{ type: string; image_url?: { url: string } }>;
    assert.equal(content[2].type, "image_url");
    assert.equal(content[2].image_url?.url, "data:image/webp;base64,AAAA");
  });
  delete process.env.GROQ_MODEL;
});

test("if no provider can read the images, it's judged from the words", async () => {
  await withProviders(
    { GROQ_API_KEY: "q" },
    () => reply('{"rating": 4, "summary": "words only"}'),
    async (calls) => {
      let first = true;
      globalThis.fetch = (async (url: string, init: RequestInit) => {
        calls.push({ url, body: JSON.parse(String(init.body)) });
        if (first) {
          first = false;
          return new Response("model can't see", { status: 400 });
        }
        return reply('{"rating": 4, "summary": "words only"}');
      }) as typeof fetch;
      const answer = await generateObject({
        task: "test", schema, system: "Rate it.", prompt: "An ad", maxTokens: 1000, effort: "low",
        images: [{ label: "Ad A", mediaType: "image/png", data: "AAAA" }],
      });
      assert.equal(answer.summary, "words only");
      assert.equal(typeof calls[1].body.messages[1].content, "string");
    },
  );
});

// Sets up the Tavus AI interviewer (a "PAL") used for interns' practice
// interviews. Run once; put the printed PAL id in TAVUS_PAL_ID.
//
//   npx tsx scripts/tavus-create-interviewer.ts                    # list faces
//   npx tsx scripts/tavus-create-interviewer.ts --face <face_id>   # preview
//   npx tsx scripts/tavus-create-interviewer.ts --face <face_id> --apply
//
// Needs TAVUS_API_KEY in .env.local or .env. The per-interview details (intern's name,
// track, level, questions) are added to each conversation by the app, so
// one interviewer serves every track.

import { config } from "dotenv";
// Same files Next.js reads; .env.local wins over .env.
config({ path: [".env.local", ".env"], quiet: true });
import { tavusRequest } from "../lib/tavus";

const SYSTEM_PROMPT = `You are Ada, a friendly, professional interviewer at Grouh Academy, a Nigerian tech internship programme. You run realistic practice job interviews for interns so they can build confidence.

How you interview:
- Ask one question at a time and wait for the full answer. Candidates may pause to think; don't rush or interrupt them.
- Keep your own turns short and natural, like a real interviewer: one or two sentences.
- You may ask one brief follow-up to go deeper ("Can you give an example?"), then move on.
- Stay encouraging and neutral. Do not give scores, corrections or model answers during the interview; feedback comes afterwards.
- If the candidate goes off topic, steer them back politely. If they ask for help with an answer, say you'd love to hear their own thinking.
- Use clear, simple English suited to a Nigerian audience.

The specific questions, the candidate's name, their track and level, and the time available are given in the conversation context. Follow them.`;

const args = process.argv.slice(2);
const faceArg = args.indexOf("--face");
const faceId = faceArg >= 0 ? args[faceArg + 1] : undefined;
const apply = args.includes("--apply");

type Face = {
  face_id: string;
  face_name: string;
  status: string;
  face_type?: string;
};

async function main() {
  const apiKey = process.env.TAVUS_API_KEY;
  if (!apiKey) {
    console.error("✖ Set TAVUS_API_KEY in .env.local (or .env) first.");
    process.exitCode = 1;
    return;
  }

  if (!faceId) {
    const result = await tavusRequest<{ data?: Face[] }>(
      apiKey,
      "/faces?verbose=true&limit=100",
      { method: "GET" },
    );
    const faces = (result.data ?? []).filter(
      (face) => face.status === "completed",
    );
    console.log(
      "Faces you can use (pick one and re-run with --face <face_id>):\n",
    );
    for (const face of faces)
      console.log(
        `  ${face.face_id.padEnd(16)} ${face.face_name}${face.face_type ? `  [${face.face_type}]` : ""}`,
      );
    if (!faces.length)
      console.log("  (none ready - check your Tavus dashboard)");
    return;
  }

  const pal = {
    pal_name: "Grouh Academy practice interviewer",
    default_face_id: faceId,
    pipeline_mode: "full",
    system_prompt: SYSTEM_PROMPT,
    languages: ["en"],
    layers: {
      // Candidates think before answering; don't jump in on short pauses.
      conversational_flow: {
        turn_taking_patience: "high",
        pal_interruptibility: "medium",
      },
      // Visual analysis isn't needed to grade answers; keep it off.
      perception: { perception_model: "off" },
    },
  };

  if (!apply) {
    console.log("Preview only. Would create this interviewer:\n");
    console.log(JSON.stringify(pal, null, 2));
    console.log("\nRe-run with --apply to create it.");
    return;
  }

  const created = await tavusRequest<{ pal_id: string }>(apiKey, "/pals", {
    method: "POST",
    body: pal,
  });
  console.log(
    `✔ Interviewer created. Add this to .env and to Vercel:\n\nTAVUS_PAL_ID=${created.pal_id}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

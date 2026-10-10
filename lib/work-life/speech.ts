"use client";

// The voices in Work Life meetings, using only what the browser has: its
// built-in text-to-speech for the manager, co-workers and client, and its
// speech recognition for the intern (Chrome and Edge; elsewhere they type).
// Nothing is recorded or uploaded by us, and it costs nothing to run.

type VoiceKind = "female" | "male";

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;

/** The browser's English voices, once they've loaded. */
function englishVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve([]);
  voicesReady ??= new Promise((resolve) => {
    const pick = () => window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("en"));
    const now = pick();
    if (now.length) return resolve(now);
    const done = () => resolve(pick());
    window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    // Some browsers never fire the event: go with what there is.
    window.setTimeout(done, 1500);
  });
  return voicesReady;
}

const FEMALE = /female|woman|zira|samantha|victoria|karen|moira|tessa|fiona|susan|hazel|libby|sonia|aria|jenny|ezinne|abeo/i;
const MALE = /\bmale\b|\bman\b|david|daniel|alex|fred|george|james|ryan|guy|thomas|mark|oliver/i;
const preference = (voice: SpeechSynthesisVoice) =>
  voice.lang === "en-NG" ? 0 : voice.lang === "en-GB" ? 1 : voice.lang === "en-US" ? 2 : 3;

/** A voice for each person, different from the others where the browser allows. */
export async function voiceFor(kind: VoiceKind, slot: number) {
  const voices = (await englishVoices()).slice().sort((a, b) => preference(a) - preference(b));
  const matching = voices.filter((voice) => (kind === "female" ? FEMALE.test(voice.name) : MALE.test(voice.name) && !FEMALE.test(voice.name)));
  const pool = matching.length ? matching : voices;
  return pool.length ? pool[slot % pool.length] : null;
}

export function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Says `text` in a person's voice, a sentence at a time (Chrome cuts long
 * speech short). Resolves when it's finished or stopped.
 */
export async function speak(text: string, kind: VoiceKind, slot: number, signal?: AbortSignal) {
  if (!canSpeak()) return;
  const voice = await voiceFor(kind, slot);
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  for (const sentence of sentences) {
    if (signal?.aborted) return;
    await new Promise<void>((resolve) => {
      // Some browsers never say they've finished: move on after about as
      // long as the sentence takes to say.
      const fallback = window.setTimeout(resolve, 2500 + sentence.split(/\s+/).length * 450);
      const done = () => {
        window.clearTimeout(fallback);
        resolve();
      };
      const utterance = new SpeechSynthesisUtterance(sentence.trim());
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? "en-GB";
      // A little difference between people even with the same voice.
      utterance.pitch = (kind === "female" ? 1.08 : 0.88) + (slot % 3) * 0.05;
      utterance.rate = 1;
      utterance.onend = done;
      utterance.onerror = done;
      signal?.addEventListener("abort", () => {
        window.speechSynthesis.cancel();
        done();
      });
      window.speechSynthesis.speak(utterance);
    });
  }
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

// ---------------------------------------------------------- listening

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canListen() {
  return recognitionClass() !== null;
}

/**
 * Turns what the intern says into text as they speak. `onText` gets the
 * whole answer so far each time it changes. Returns a function that stops.
 */
export function listen(onText: (text: string) => void, onStop: (error?: string) => void) {
  const Recognition = recognitionClass();
  if (!Recognition) {
    onStop("Speaking isn't supported in this browser: type your answer instead.");
    return () => {};
  }
  let finalText = "";
  let stopped = false;
  let reported = false;
  const finish = (error?: string) => {
    if (reported) return;
    reported = true;
    onStop(error);
  };
  let languages = ["en-NG", "en-GB", "en-US"];
  let recognition: Recognition;

  const begin = () => {
    recognition = new Recognition();
    recognition.lang = languages[0];
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += `${result[0].transcript.trim()} `;
        else interim += result[0].transcript;
      }
      onText(`${finalText}${interim}`.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "language-not-supported" && languages.length > 1) {
        languages = languages.slice(1);
        return;
      }
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        stopped = true;
        finish("Microphone access was blocked: allow it in your browser, or type your answer.");
      }
    };
    recognition.onend = () => {
      // Chrome stops after a pause: carry on until the intern says they're done.
      if (!stopped) begin();
      else finish();
    };
    recognition.start();
  };
  begin();

  return () => {
    stopped = true;
    recognition?.stop();
  };
}

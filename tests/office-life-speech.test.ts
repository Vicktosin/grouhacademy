import assert from "node:assert/strict";
import test from "node:test";

import { listen } from "../lib/office-life/speech";

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  static startError: Error | null = null;

  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((event: never) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    FakeRecognition.instances.push(this);
  }

  start() {
    if (FakeRecognition.startError) throw FakeRecognition.startError;
  }

  stop() {
    this.onend?.();
  }

  abort() {
    this.onend?.();
  }
}

function withFakeWindow(run: () => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  FakeRecognition.instances = [];
  FakeRecognition.startError = null;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { SpeechRecognition: FakeRecognition },
  });
  try {
    run();
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

test("Office Life reports when speech recognition cannot start", () => {
  withFakeWindow(() => {
    FakeRecognition.startError = new Error("permission denied");
    let error: string | undefined;

    const stop = listen(() => {}, (message) => {
      error = message;
    });

    assert.match(error ?? "", /Couldn't start speech recognition/);
    assert.doesNotThrow(stop);
  });
});

test("Office Life reports microphone capture errors instead of restarting silently", () => {
  withFakeWindow(() => {
    let error: string | undefined;
    listen(() => {}, (message) => {
      error = message;
    });

    const recognition = FakeRecognition.instances[0];
    recognition.onerror?.({ error: "audio-capture" });
    recognition.onend?.();

    assert.match(error ?? "", /No microphone is available/);
    assert.equal(FakeRecognition.instances.length, 1);
  });
});

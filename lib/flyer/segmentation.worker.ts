/// <reference lib="webworker" />
import { loadModels, processPhoto } from "./segment-core";

// The flyer's background removal, off the page's main thread (see
// ./segment for the page side). Messages:
//   { type: "warm" }                      → { type: "ready" } | { type: "load-failed" }
//   { type: "process", id, photo }        → { type: "result", id, result } | { type: "error", id }

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async (event: MessageEvent) => {
  const message = event.data;
  if (message?.type === "warm") {
    try {
      await loadModels();
      self.postMessage({ type: "ready" });
    } catch (error) {
      console.error("Flyer models failed to load:", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
      self.postMessage({ type: "load-failed" });
    }
    return;
  }
  if (message?.type === "process") {
    const photo = message.photo as ImageBitmap;
    try {
      const result = await processPhoto(photo);
      self.postMessage({ type: "result", id: message.id, result }, result.ok ? [result.cutout] : []);
    } catch (error) {
      console.error("Flyer background removal failed:", error);
      self.postMessage({ type: "error", id: message.id });
    } finally {
      photo.close();
    }
  }
};

// Uploads a screenshot or WordPress snapshot of a Practice Lab task
// submission straight to storage (see lib/lab-artifacts); in the browser.
// Returns its key, or null if it couldn't be uploaded: the submission still
// goes ahead, just without it.

export async function uploadLabArtifact(
  scenarioId: string,
  type: "screenshot" | "snapshot",
  blob: Blob,
): Promise<string | null> {
  try {
    const response = await fetch(`/api/internship/lab/${scenarioId}/artifacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    if (!response.ok) return null;
    const upload = (await response.json()) as { key: string; uploadUrl: string; method: "PUT"; maxBytes: number };
    if (blob.size > upload.maxBytes) {
      console.warn(`The ${type} is too big to upload (${blob.size} bytes).`);
      return null;
    }
    const sent = await fetch(upload.uploadUrl, {
      method: upload.method,
      headers: { "Content-Type": type === "snapshot" ? "application/zip" : "image/webp" },
      body: blob,
    });
    return sent.ok ? upload.key : null;
  } catch (error) {
    console.warn(`The ${type} couldn't be uploaded:`, error);
    return null;
  }
}

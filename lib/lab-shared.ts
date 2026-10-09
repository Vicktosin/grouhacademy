import { transform } from "sucrase";

// Practice Lab pieces shared by the intern workspace and the admin builder.
// Safe in the browser (no database access).

/** Code exercises, done in the editor. */
export type LabKindKey = "WEB" | "REACT";
/** Simulators: scored against goals, test records or API tests. */
export type SimLabKind = "ADS" | "SOCIAL" | "AUTOMATION" | "BACKEND" | "WORDPRESS" | "CONTENT";
/** Every kind of exercise. */
export type AnyLabKind = LabKindKey | SimLabKind;

export function isCodeKind(kind: AnyLabKind): kind is LabKindKey {
  return kind === "WEB" || kind === "REACT";
}
export type LabFiles = Record<string, string>;
export type LabCheck = { label: string; code: string };
export type LabCheckResult = { label: string; passed: boolean; error?: string };

/** The files each kind of exercise has, in tab order. */
export const LAB_FILES: Record<LabKindKey, string[]> = {
  WEB: ["index.html", "styles.css", "script.js"],
  REACT: ["App.jsx", "styles.css"],
};

export const LAB_KIND_LABEL: Record<AnyLabKind, string> = {
  WEB: "HTML, CSS & JavaScript",
  REACT: "React",
  ADS: "Ad campaign (Ads Studio)",
  SOCIAL: "Social media",
  AUTOMATION: "AI automation",
  BACKEND: "Backend API",
  WORDPRESS: "WordPress",
  CONTENT: "AI content",
};

export const DEFAULT_STARTER: Record<LabKindKey, LabFiles> = {
  WEB: {
    "index.html": `<main class="card">
  <h1>Hello, Grouh Academy!</h1>
  <p>Edit index.html, styles.css and script.js.</p>
  <button id="greet">Say hi</button>
</main>`,
    "styles.css": `body {
  font-family: system-ui, sans-serif;
  display: grid;
  place-items: center;
  min-height: 100vh;
  margin: 0;
  background: #f0f7ff;
}

.card {
  background: white;
  padding: 2rem;
  border-radius: 1rem;
  box-shadow: 0 8px 24px rgba(28, 29, 82, 0.1);
}`,
    "script.js": `document.getElementById("greet").addEventListener("click", () => {
  console.log("Hi!");
});`,
  },
  REACT: {
    "App.jsx": `import { useState } from "react";

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <main className="card">
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(count + 1)}>Add one</button>
    </main>
  );
}`,
    "styles.css": `body {
  font-family: system-ui, sans-serif;
  display: grid;
  place-items: center;
  min-height: 100vh;
  margin: 0;
  background: #f0f7ff;
}

.card {
  background: white;
  padding: 2rem;
  border-radius: 1rem;
}`,
  },
};

export const EXAMPLE_CHECKS: Record<LabKindKey, LabCheck[]> = {
  WEB: [
    {
      label: "The page has a heading",
      code: `return document.querySelector("h1")?.textContent.trim().length > 0;`,
    },
  ],
  REACT: [
    {
      label: "Clicking the button adds one",
      code: `const button = document.querySelector("button");
button.click();
await new Promise((resolve) => setTimeout(resolve, 50));
return document.querySelector("h1").textContent.includes("1");`,
    },
  ],
};

/** Keeps only this kind's files, filling any missing ones from `fallback`. */
export function normalizeFiles(
  kind: LabKindKey,
  value: unknown,
  fallback: LabFiles = DEFAULT_STARTER[kind],
): LabFiles {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    LAB_FILES[kind].map((name) => [
      name,
      typeof source[name] === "string"
        ? (source[name] as string)
        : (fallback[name] ?? ""),
    ]),
  );
}

export function normalizeChecks(value: unknown): LabCheck[] {
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is LabCheck =>
            Boolean(item) &&
            typeof item.label === "string" &&
            typeof item.code === "string",
        )
        .map(({ label, code }) => ({ label: label.trim(), code }))
        .filter((item) => item.label && item.code.trim())
    : [];
}

/** What the sandboxed preview is asked to render. */
export type LabRenderPayload = {
  css: string;
  html: string;
  /** Classic script (WEB) or ES module (REACT). */
  script: string;
  module: boolean;
};

/**
 * Turns an exercise's files into a preview payload. React's App.jsx is
 * compiled with Sucrase and rendered into #root; React itself is loaded
 * by the preview page.
 */
export function buildPreview(
  kind: LabKindKey,
  files: LabFiles,
): { payload: LabRenderPayload } | { error: string } {
  if (kind === "WEB") {
    // Accept either body markup or a whole HTML document.
    let html = files["index.html"] ?? "";
    let css = files["styles.css"] ?? "";
    if (/<body[\s>]/i.test(html) && typeof DOMParser !== "undefined") {
      const doc = new DOMParser().parseFromString(html, "text/html");
      css =
        Array.from(doc.querySelectorAll("style"))
          .map((style) => style.textContent ?? "")
          .join("\n") +
        "\n" +
        css;
      html = doc.body.innerHTML;
    }
    return {
      payload: { css, html, script: files["script.js"] ?? "", module: false },
    };
  }

  let compiled: string;
  try {
    compiled = transform(files["App.jsx"] ?? "", {
      transforms: ["jsx"],
      jsxRuntime: "automatic",
      production: true,
    }).code;
  } catch (error) {
    return {
      error: `App.jsx has a syntax error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!/export\s+default\s+/.test(compiled))
    return {
      error:
        "App.jsx must export a component: `export default function App() { … }`",
    };
  const script = `${compiled.replace(/export\s+default\s+/, "const __LabApp = ")}
import { createRoot as __labCreateRoot } from "react-dom/client";
import { jsx as __labJsx } from "react/jsx-runtime";
__labCreateRoot(document.getElementById("root")).render(__labJsx(__LabApp, {}));
await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
window.__labDone?.();`;
  return {
    payload: {
      css: files["styles.css"] ?? "",
      html: '<div id="root"></div>',
      script,
      module: true,
    },
  };
}

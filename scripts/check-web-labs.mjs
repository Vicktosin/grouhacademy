// Checks the Web Practice Lab exercises in a real browser (Edge or Chrome):
// the model answer must pass every check, and the starter must not pass.
//
//   npx tsx scripts/check-web-labs.mjs

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { LAB_EXERCISES } from "../data/lab-exercises/index.ts";

const exe = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].find(existsSync);
if (!exe) throw new Error("Edge or Chrome is needed.");
const port = 9334;
const browser = spawn(exe, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(path.join(os.tmpdir(), "labs-"))}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let target;
for (let i = 0; i < 60 && !target; i++) {
  await sleep(500);
  target = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).then((list) => list.find((item) => item.type === "page")).catch(() => null);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => (ws.onopen = resolve));
let next = 0;
const waiting = new Map();
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id) waiting.get(message.id)?.(message.result);
};
const call = (method, params = {}) => new Promise((resolve) => { const id = ++next; waiting.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
await call("Page.enable");
const { frameTree } = await call("Page.getFrameTree");
await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 800, deviceScaleFactor: 1, mobile: true });

async function score(item, files) {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${files["styles.css"]}</style></head><body>${files["index.html"]}<script>${files["script.js"]}</script></body></html>`;
  await call("Page.setDocumentContent", { frameId: frameTree.frame.id, html });
  await sleep(150);
  const failed = [];
  for (const check of item.checks) {
    const { result, exceptionDetails } = await call("Runtime.evaluate", { expression: `(() => { ${check.code} })()`, returnByValue: true });
    if (exceptionDetails || result.value !== true) failed.push(check.label);
  }
  return failed;
}

let bad = 0;
for (const item of LAB_EXERCISES.filter((entry) => entry.kind === "WEB")) {
  const name = `${item.track} ${item.level} W${item.week}`;
  const solved = await score(item, item.solutionFiles);
  const starter = await score(item, item.starterFiles);
  const passed = (item.checks.length - starter.length) / item.checks.length;
  const ok = solved.length === 0 && passed < 0.7;
  if (!ok) bad++;
  console.log(ok ? "ok  " : "FAIL", name, solved.length ? `model fails: ${solved.join("; ")}` : "", `starter ${Math.round(passed * 100)}%`);
}
ws.close();
browser.kill();
process.exit(bad ? 1 : 0);

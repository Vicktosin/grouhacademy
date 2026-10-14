// The Practice Lab preview: a bare page, loaded in a sandboxed iframe
// (opaque origin, so interns' code can't reach this site's cookies, storage
// or APIs), that renders the code the workspace posts to it, reports console
// output and errors, and runs the exercise's checks. Its relaxed security
// headers (inline/eval for the intern's code and checks) are set for this
// path only in next.config.ts.
//
// React comes from this site (public/lab-runtime/react-<version>, production
// ES module builds), not a CDN, so previews don't depend on another service.
// A test checks the files match the installed React version.

export const REACT_VERSION = "19.2.8";
const REACT = `/lab-runtime/react-${REACT_VERSION}`;
// Draws the page into an image for submission screenshots (lib/lab-screenshots).
export const SCREENSHOT_VERSION = "4.7.0";
const SCREENSHOT = `/lab-runtime/modern-screenshot-${SCREENSHOT_VERSION}/index.mjs`;

const HARNESS = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script type="importmap">
${JSON.stringify({
  imports: {
    react: `${REACT}/react.mjs`,
    "react/jsx-runtime": `${REACT}/jsx-runtime.mjs`,
    "react-dom": `${REACT}/react-dom.mjs`,
    "react-dom/client": `${REACT}/react-dom-client.mjs`,
  },
})}
</script>
<script>
(function () {
  var send = function (message) {
    message.__lab = true;
    parent.postMessage(message, "*");
  };
  var format = function (value) {
    if (typeof value === "string") return value;
    try { return JSON.stringify(value); } catch (e) { return String(value); }
  };
  ["log", "info", "warn", "error"].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      var args = Array.prototype.slice.call(arguments);
      send({ type: "console", level: level, text: args.map(format).join(" ") });
      original.apply(console, args);
    };
  });
  addEventListener("error", function (event) {
    send({ type: "console", level: "error",
      text: event.message + (event.lineno ? " (line " + event.lineno + ")" : "") });
  });
  addEventListener("unhandledrejection", function (event) {
    send({ type: "console", level: "error", text: String(event.reason) });
  });

  var rendered = false;
  window.__labDone = function () {
    if (rendered) return;
    rendered = true;
    send({ type: "rendered" });
  };

  var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  var timeout = function (ms) {
    return new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error("Timed out")); }, ms);
    });
  };

  async function runChecks(checks) {
    var results = [];
    for (var i = 0; i < checks.length; i++) {
      var check = checks[i];
      try {
        var passed = await Promise.race([new AsyncFunction(check.code)(), timeout(3000)]);
        results.push({ label: check.label, passed: passed === true });
      } catch (error) {
        results.push({ label: check.label, passed: false,
          error: error && error.message ? error.message : String(error) });
      }
    }
    send({ type: "checks", results: results });
  }

  // A picture of the page as it is now, up to maxHeight tall, for mentors.
  async function screenshot(options) {
    try {
      var lib = await import("${SCREENSHOT}");
      var root = document.documentElement;
      var height = Math.min(
        Math.max(root.scrollHeight, document.body.scrollHeight, innerHeight),
        options.maxHeight || 2400
      );
      var background = getComputedStyle(document.body).backgroundColor;
      var context = await lib.createContext(root, {
        width: innerWidth,
        height: height,
        scale: options.scale || 1,
        type: "image/webp",
        quality: options.quality || 0.72,
        backgroundColor: !background || background === "rgba(0, 0, 0, 0)" ? "#ffffff" : background,
        timeout: 8000,
        autoDestruct: true,
      });
      // The library reads browser default styles from a hidden iframe, which
      // this sandboxed page can't reach (it gets an origin of its own). A
      // shadow root reset with all: initial gives the same defaults.
      var host = document.createElement("div");
      host.style.cssText = "all: initial; position: fixed; left: -99999px; top: 0; visibility: hidden";
      document.documentElement.appendChild(host);
      var shadowBody = document.createElement("div");
      host.attachShadow({ mode: "open" }).appendChild(shadowBody);
      context.sandbox = {
        contentWindow: {
          document: {
            body: shadowBody,
            createElement: function (name) { return document.createElement(name); },
            createElementNS: function (ns, name) { return document.createElementNS(ns, name); },
          },
          getComputedStyle: function (element, pseudo) { return getComputedStyle(element, pseudo); },
        },
        remove: function () { host.remove(); },
      };
      var blob = await lib.domToBlob(context);
      send({ type: "screenshot", blob: blob, width: innerWidth, height: height });
    } catch (error) {
      send({ type: "screenshot", error: error && error.message ? error.message : String(error) });
    }
  }

  addEventListener("message", function (event) {
    var data = event.data;
    if (!data || !data.__lab) return;
    if (data.type === "render") {
      var style = document.createElement("style");
      style.textContent = data.css || "";
      document.head.appendChild(style);
      document.body.innerHTML = data.html || "";
      if (data.script) {
        var script = document.createElement("script");
        if (data.module) script.type = "module";
        script.textContent = data.script;
        document.body.appendChild(script);
      }
      // Plain scripts run as they're added; React signals when it's drawn.
      if (!data.module)
        requestAnimationFrame(function () { requestAnimationFrame(window.__labDone); });
    } else if (data.type === "check") {
      runChecks(data.checks || []);
    } else if (data.type === "screenshot") {
      screenshot(data);
    }
  });

  send({ type: "ready" });
})();
</script>
</head>
<body></body>
</html>`;

export function GET() {
  return new Response(HARNESS, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

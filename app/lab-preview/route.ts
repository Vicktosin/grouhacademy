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

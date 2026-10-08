// The JavaScript that runs inside the QuickJS sandbox before the intern's
// code: a small Node-like environment (require, console, timers, process,
// Buffer) and the packages a backend exercise may use: express (Express 5
// behaviour, so rejected async handlers reach the error handler), cors,
// morgan, helmet, body-parser, cookie-parser, bcrypt, jsonwebtoken, crypto,
// uuid, dotenv, path, util and ./db (SQLite, run by the host).
//
// It talks to the host only through __host: sql(sql, paramsJson) → JSON,
// log(level, text) and load(path) → the file wrapped as a function.
//
// Kept as a plain string (no backticks or dollar-brace inside) so no
// bundler or compiler ever rewrites it.

export const PRELUDE = String.raw`
"use strict";
(function () {
var G = globalThis;
var host = G.__host;
delete G.__host;

// ---------------------------------------------------------------- console
function inspect(value, seen) {
  if (value instanceof Error) {
    var head = String(value);
    // Only the intern's own files, not the simulator's.
    var frames = String(value.stack || "").split("\n").filter(function (line) {
      return line.trim() && line.indexOf("prelude.js") === -1;
    });
    return frames.length ? head + "\n" + frames.join("\n") : head;
  }
  if (typeof value === "string") return value;
  if (typeof value === "function") return "[Function: " + (value.name || "anonymous") + "]";
  if (value === undefined) return "undefined";
  if (typeof value === "bigint") return String(value) + "n";
  if (typeof value === "symbol") return String(value);
  if (value instanceof Buf) return "<Buffer " + value.toString("hex").replace(/(..)/g, "$1 ").trim() + ">";
  seen = seen || [];
  try {
    return JSON.stringify(value, function (key, v) {
      if (typeof v === "bigint") return String(v) + "n";
      if (typeof v === "function") return "[Function: " + (v.name || "anonymous") + "]";
      if (v === undefined) return "undefined";
      if (v instanceof Error) return String(v);
      if (v && typeof v === "object") {
        if (seen.indexOf(v) !== -1) return "[Circular]";
        seen.push(v);
      }
      return v;
    }, 2);
  } catch (e) {
    return String(value);
  }
}
function format(args) {
  var list = Array.prototype.slice.call(args);
  var out = [];
  if (typeof list[0] === "string" && /%[sdifjoO%]/.test(list[0])) {
    var first = list.shift();
    first = first.replace(/%([sdifjoO%])/g, function (m, f) {
      if (f === "%") return "%";
      if (!list.length) return m;
      var v = list.shift();
      if (f === "s") return typeof v === "string" ? v : inspect(v);
      if (f === "d" || f === "i") return String(f === "i" ? parseInt(v, 10) : Number(v));
      if (f === "f") return String(parseFloat(v));
      return inspect(v);
    });
    out.push(first);
  }
  for (var i = 0; i < list.length; i++) out.push(inspect(list[i]));
  return out.join(" ");
}
function logger(level) {
  return function () { host.log(level, format(arguments)); };
}
G.console = {
  log: logger("log"),
  info: logger("info"),
  debug: logger("log"),
  warn: logger("warn"),
  error: logger("error"),
  trace: logger("log"),
  dir: logger("log"),
  table: logger("log"),
  time: function () {},
  timeEnd: function () {},
};

// ----------------------------------------------------------------- timers
// Virtual time: a pending timer runs as soon as the request is otherwise
// waiting, in order of when it's due.
var timers = [];
var timerSeq = 0;
var virtualNow = 0;
function addTimer(fn, ms, args, every) {
  if (typeof fn !== "function") throw new TypeError("The callback must be a function.");
  var id = ++timerSeq;
  var delay = Math.max(0, Number(ms) || 0);
  timers.push({ id: id, at: virtualNow + delay, fn: fn, args: args, every: every ? Math.max(1, delay) : 0 });
  return id;
}
G.setTimeout = function (fn, ms) { return addTimer(fn, ms, Array.prototype.slice.call(arguments, 2), false); };
G.setInterval = function (fn, ms) { return addTimer(fn, ms, Array.prototype.slice.call(arguments, 2), true); };
G.setImmediate = function (fn) { return addTimer(fn, 0, Array.prototype.slice.call(arguments, 1), false); };
G.clearTimeout = G.clearInterval = G.clearImmediate = function (id) {
  timers = timers.filter(function (t) { return t.id !== id; });
};
G.queueMicrotask = function (fn) { Promise.resolve().then(fn); };
function runNextTimer(maxDelay) {
  if (!timers.length) return false;
  timers.sort(function (a, b) { return a.at - b.at || a.id - b.id; });
  if (timers[0].at > virtualNow + maxDelay) return false;
  var timer = timers.shift();
  virtualNow = timer.at;
  if (timer.every) { timer.at += timer.every; timers.push(timer); }
  try { timer.fn.apply(null, timer.args); } catch (e) { console.error("Uncaught error in a timer:", e); }
  return true;
}

// ------------------------------------------------------- bytes and Buffer
function utf8Encode(str) {
  var out = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      var d = str.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}
function utf8Decode(bytes) {
  var out = "";
  for (var i = 0; i < bytes.length; ) {
    var b = bytes[i++];
    var c;
    if (b < 0x80) c = b;
    else if (b < 0xe0) c = ((b & 31) << 6) | (bytes[i++] & 63);
    else if (b < 0xf0) c = ((b & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
    else c = ((b & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
    if (c > 0xffff) { c -= 0x10000; out += String.fromCharCode(0xd800 + (c >> 10), 0xdc00 + (c & 1023)); }
    else out += String.fromCharCode(c);
  }
  return out;
}
var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function toBase64(bytes, url) {
  var out = "";
  for (var i = 0; i < bytes.length; i += 3) {
    var n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] +
      (i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=") +
      (i + 2 < bytes.length ? B64[n & 63] : "=");
  }
  return url ? out.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : out;
}
function fromBase64(str) {
  var clean = String(str).replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+/]/g, "");
  var out = [];
  for (var i = 0; i < clean.length; i += 4) {
    var n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) |
      ((B64.indexOf(clean[i + 2]) & 63) << 6) | (B64.indexOf(clean[i + 3]) & 63);
    out.push((n >> 16) & 255);
    if (i + 2 < clean.length) out.push((n >> 8) & 255);
    if (i + 3 < clean.length) out.push(n & 255);
  }
  return out;
}
function toHex(bytes) {
  var out = "";
  for (var i = 0; i < bytes.length; i++) out += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
  return out;
}
function Buf(bytes) { this.bytes = bytes; this.length = bytes.length; }
Buf.prototype.toString = function (encoding) {
  var enc = String(encoding || "utf8").toLowerCase();
  if (enc === "hex") return toHex(this.bytes);
  if (enc === "base64") return toBase64(this.bytes, false);
  if (enc === "base64url") return toBase64(this.bytes, true);
  return utf8Decode(this.bytes);
};
Buf.prototype.toJSON = function () { return { type: "Buffer", data: this.bytes.slice() }; };
Buf.prototype.equals = function (other) { return other instanceof Buf && toHex(other.bytes) === toHex(this.bytes); };
function bytesOf(value, encoding) {
  if (value instanceof Buf) return value.bytes.slice();
  if (Array.isArray(value)) return value.map(function (b) { return b & 255; });
  var enc = String(encoding || "utf8").toLowerCase();
  var str = String(value);
  if (enc === "hex") {
    var out = [];
    for (var i = 0; i + 1 < str.length; i += 2) out.push(parseInt(str.slice(i, i + 2), 16));
    return out;
  }
  if (enc === "base64" || enc === "base64url") return fromBase64(str);
  return utf8Encode(str);
}
G.Buffer = {
  from: function (value, encoding) { return new Buf(bytesOf(value, encoding)); },
  isBuffer: function (value) { return value instanceof Buf; },
  byteLength: function (value) { return bytesOf(value).length; },
  concat: function (list) { var all = []; list.forEach(function (b) { all = all.concat(b.bytes); }); return new Buf(all); },
  alloc: function (n) { var out = []; for (var i = 0; i < n; i++) out.push(0); return new Buf(out); },
};
G.btoa = function (s) { return toBase64(String(s).split("").map(function (c) { return c.charCodeAt(0) & 255; }), false); };
G.atob = function (s) { return fromBase64(s).map(function (b) { return String.fromCharCode(b); }).join(""); };

// ----------------------------------------------------------------- SHA-256
var K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
function sha256(bytes) {
  var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  var msg = bytes.slice();
  var bitLength = bytes.length * 8;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  for (var s = 7; s >= 0; s--) msg.push(s >= 4 ? 0 : (bitLength >>> (s * 8)) & 255);
  var w = new Array(64);
  for (var off = 0; off < msg.length; off += 64) {
    for (var i = 0; i < 16; i++)
      w[i] = (msg[off + i * 4] << 24) | (msg[off + i * 4 + 1] << 16) | (msg[off + i * 4 + 2] << 8) | msg[off + i * 4 + 3];
    for (i = 16; i < 64; i++) {
      var x = w[i - 15], y = w[i - 2];
      var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (i = 0; i < 64; i++) {
      var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      var ch = (e & f) ^ (~e & g);
      var t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
      var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var t2 = (S0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }
  var out = [];
  for (i = 0; i < 8; i++) out.push((h[i] >>> 24) & 255, (h[i] >>> 16) & 255, (h[i] >>> 8) & 255, h[i] & 255);
  return out;
}
function hmacSha256(keyBytes, msgBytes) {
  var key = keyBytes.length > 64 ? sha256(keyBytes) : keyBytes.slice();
  while (key.length < 64) key.push(0);
  var inner = key.map(function (b) { return b ^ 0x36; });
  var outer = key.map(function (b) { return b ^ 0x5c; });
  return sha256(outer.concat(sha256(inner.concat(msgBytes))));
}
function randomBytes(n) {
  var out = [];
  for (var i = 0; i < n; i++) out.push(Math.floor(Math.random() * 256));
  return out;
}
function randomUUID() {
  var b = randomBytes(16);
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  var hex = toHex(b);
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
}
function digestOut(bytes, encoding) {
  return encoding ? new Buf(bytes).toString(encoding) : new Buf(bytes);
}
function hasher(make) {
  var parts = [];
  return {
    update: function (data, enc) { parts = parts.concat(bytesOf(data, enc)); return this; },
    digest: function (enc) { return digestOut(make(parts), enc); },
  };
}
function checkAlgorithm(name) {
  if (String(name).toLowerCase().replace("-", "") !== "sha256")
    throw new Error("Only sha256 is available in the simulator.");
}
var cryptoModule = {
  randomUUID: randomUUID,
  randomBytes: function (n) { return new Buf(randomBytes(n)); },
  randomInt: function (min, max) {
    if (max === undefined) { max = min; min = 0; }
    return min + Math.floor(Math.random() * (max - min));
  },
  createHash: function (algorithm) {
    checkAlgorithm(algorithm);
    return hasher(function (bytes) { return sha256(bytes); });
  },
  createHmac: function (algorithm, key) {
    checkAlgorithm(algorithm);
    var keyBytes = bytesOf(key);
    return hasher(function (bytes) { return hmacSha256(keyBytes, bytes); });
  },
  timingSafeEqual: function (a, b) { return toHex(bytesOf(a)) === toHex(bytesOf(b)); },
};
G.crypto = { randomUUID: randomUUID };

// ------------------------------------------------- bcrypt (practice only)
// Behaves like bcrypt (salted, $2b$ hashes of the usual length) but is not
// real bcrypt: fine for learning, never for a real app's passwords.
var SALT_CHARS = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function genSalt(rounds) {
  var r = Math.max(4, Math.min(31, Number(rounds) || 10));
  var salt = "";
  for (var i = 0; i < 22; i++) salt += SALT_CHARS[Math.floor(Math.random() * 64)];
  return "$2b$" + (r < 10 ? "0" + r : String(r)) + "$" + salt;
}
function bcryptHash(password, saltOrRounds) {
  if (typeof password !== "string") throw new Error("data and salt arguments required");
  var salt = typeof saltOrRounds === "string" && /^\$2[aby]\$\d\d\$/.test(saltOrRounds)
    ? saltOrRounds.slice(0, 29)
    : genSalt(saltOrRounds);
  var digest = toBase64(sha256(utf8Encode(salt + password)), false).replace(/[+=]/g, ".").replace(/\//g, "/");
  return salt + digest.slice(0, 31);
}
function bcryptCompare(password, hash) {
  if (typeof password !== "string" || typeof hash !== "string") return false;
  return hash.length === 60 && bcryptHash(password, hash.slice(0, 29)) === hash;
}
function promised(fn, cbIndex) {
  return function () {
    var args = Array.prototype.slice.call(arguments);
    var cb = typeof args[cbIndex] === "function" ? args[cbIndex] : null;
    var self = this;
    var p = new Promise(function (resolve, reject) {
      try { resolve(fn.apply(self, args.slice(0, cbIndex))); } catch (e) { reject(e); }
    });
    if (cb) { p.then(function (v) { cb(null, v); }, function (e) { cb(e); }); return undefined; }
    return p;
  };
}
var bcryptModule = {
  genSaltSync: genSalt,
  hashSync: bcryptHash,
  compareSync: bcryptCompare,
  genSalt: promised(genSalt, 1),
  hash: promised(bcryptHash, 2),
  compare: promised(bcryptCompare, 2),
  getRounds: function (hash) { return parseInt(String(hash).slice(4, 6), 10); },
};

// ------------------------------------------------------ jsonwebtoken (HS256)
function JsonWebTokenError(message) { var e = new Error(message); e.name = "JsonWebTokenError"; return e; }
function TokenExpiredError(message, expiredAt) {
  var e = new Error(message); e.name = "TokenExpiredError"; e.expiredAt = expiredAt; return e;
}
function seconds(value) {
  if (typeof value === "number") return value;
  var m = /^\s*(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w|y)?\s*$/i.exec(String(value));
  if (!m) throw new Error("expiresIn should be a number of seconds or a string like \"1h\" or \"7d\"");
  var n = parseFloat(m[1]);
  var unit = (m[2] || "ms").toLowerCase();
  if (!m[2]) return n / 1000;
  return n * { ms: 0.001, s: 1, m: 60, h: 3600, d: 86400, w: 604800, y: 31557600 }[unit];
}
function b64json(value) { return toBase64(utf8Encode(JSON.stringify(value)), true); }
function signToken(payload, secret, options) {
  if (secret === undefined || secret === null || secret === "") throw new Error("secretOrPrivateKey must have a value");
  options = options || {};
  var body = typeof payload === "object" && payload !== null ? Object.assign({}, payload) : payload;
  if (typeof body === "object") {
    var now = Math.floor(Date.now() / 1000);
    if (body.iat === undefined && !options.noTimestamp) body.iat = now;
    if (options.expiresIn !== undefined) body.exp = Math.floor((body.iat || now) + seconds(options.expiresIn));
    if (options.subject !== undefined) body.sub = options.subject;
    if (options.issuer !== undefined) body.iss = options.issuer;
    if (options.audience !== undefined) body.aud = options.audience;
  }
  var head = b64json({ alg: "HS256", typ: "JWT" }) + "." + b64json(body);
  return head + "." + toBase64(hmacSha256(utf8Encode(String(secret)), utf8Encode(head)), true);
}
function decodeToken(token, options) {
  if (typeof token !== "string") return null;
  var parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    var header = JSON.parse(utf8Decode(fromBase64(parts[0])));
    var payload = JSON.parse(utf8Decode(fromBase64(parts[1])));
    return options && options.complete ? { header: header, payload: payload, signature: parts[2] } : payload;
  } catch (e) {
    return null;
  }
}
function verifyToken(token, secret, options) {
  options = options || {};
  if (!token) throw JsonWebTokenError("jwt must be provided");
  if (typeof token !== "string" || token.split(".").length !== 3) throw JsonWebTokenError("jwt malformed");
  var parts = token.split(".");
  var decoded = decodeToken(token, { complete: true });
  if (!decoded) throw JsonWebTokenError("invalid token");
  if (decoded.header.alg !== "HS256") throw JsonWebTokenError("invalid algorithm");
  var expected = toBase64(hmacSha256(utf8Encode(String(secret)), utf8Encode(parts[0] + "." + parts[1])), true);
  if (expected !== parts[2]) throw JsonWebTokenError("invalid signature");
  var p = decoded.payload;
  if (p && typeof p.exp === "number" && !options.ignoreExpiration && Math.floor(Date.now() / 1000) >= p.exp)
    throw TokenExpiredError("jwt expired", new Date(p.exp * 1000));
  return p;
}
function withCallback(fn) {
  return function () {
    var args = Array.prototype.slice.call(arguments);
    var cb = typeof args[args.length - 1] === "function" ? args.pop() : null;
    if (!cb) return fn.apply(null, args);
    var result, error = null;
    try { result = fn.apply(null, args); } catch (e) { error = e; }
    G.queueMicrotask(function () { cb(error, error ? undefined : result); });
    return undefined;
  };
}
var jwtModule = {
  sign: withCallback(signToken),
  verify: withCallback(verifyToken),
  decode: decodeToken,
  JsonWebTokenError: JsonWebTokenError,
  TokenExpiredError: TokenExpiredError,
};

// -------------------------------------------------------- ./db (SQLite)
function sqlValue(v) {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return Number(v);
  if (v !== null && typeof v === "object") return JSON.stringify(v);
  return v;
}
function sqlParams(params) {
  if (params === undefined || params === null) return [];
  if (Array.isArray(params)) return params.map(sqlValue);
  if (typeof params === "object") {
    var out = {};
    Object.keys(params).forEach(function (k) { out[k] = sqlValue(params[k]); });
    return out;
  }
  return [sqlValue(params)];
}
function runSql(sql, params, exec) {
  if (typeof sql !== "string") throw new TypeError("The SQL must be a string.");
  var out = JSON.parse(host.sql(sql, JSON.stringify(exec ? null : sqlParams(params))));
  if (out.error) {
    var e = new Error(out.error);
    e.code = out.code;
    throw e;
  }
  return out;
}
function statementArgs(args) {
  if (args.length === 1 && args[0] !== null && typeof args[0] === "object") return args[0];
  return Array.prototype.slice.call(args);
}
var db = {
  /** node-postgres style: const { rows } = await db.query(sql, [a, b]) */
  query: function (sql, params) {
    return new Promise(function (resolve) {
      var r = runSql(sql, params);
      resolve({
        rows: r.rows,
        rowCount: r.rows.length || r.changes,
        changes: r.changes,
        lastInsertId: r.lastId,
        fields: r.columns.map(function (name) { return { name: name }; }),
      });
    });
  },
  /** better-sqlite3 style: db.prepare(sql).all(a, b) / .get() / .run() */
  prepare: function (sql) {
    return {
      all: function () { return runSql(sql, statementArgs(arguments)).rows; },
      get: function () { return runSql(sql, statementArgs(arguments)).rows[0]; },
      run: function () {
        var r = runSql(sql, statementArgs(arguments));
        return { changes: r.changes, lastInsertRowid: r.lastId };
      },
    };
  },
  exec: function (sql) { runSql(sql, null, true); return db; },
  transaction: function (fn) {
    return function () {
      runSql("BEGIN", null, true);
      try {
        var result = fn.apply(this, arguments);
        runSql("COMMIT", null, true);
        return result;
      } catch (e) {
        runSql("ROLLBACK", null, true);
        throw e;
      }
    };
  },
  /** Promise helpers: await db.all(sql, params) / db.get / db.run */
  all: function (sql, params) { return db.query(sql, params).then(function (r) { return r.rows; }); },
  get: function (sql, params) { return db.query(sql, params).then(function (r) { return r.rows[0]; }); },
  run: function (sql, params) {
    return db.query(sql, params).then(function (r) { return { changes: r.changes, lastID: r.lastInsertId, lastInsertRowid: r.lastInsertId }; });
  },
};

// ----------------------------------------------------------------- express
var STATUS = {
  100: "Continue", 200: "OK", 201: "Created", 202: "Accepted", 204: "No Content",
  301: "Moved Permanently", 302: "Found", 303: "See Other", 304: "Not Modified", 307: "Temporary Redirect", 308: "Permanent Redirect",
  400: "Bad Request", 401: "Unauthorized", 402: "Payment Required", 403: "Forbidden", 404: "Not Found",
  405: "Method Not Allowed", 406: "Not Acceptable", 408: "Request Timeout", 409: "Conflict", 410: "Gone",
  413: "Payload Too Large", 415: "Unsupported Media Type", 422: "Unprocessable Entity", 429: "Too Many Requests",
  500: "Internal Server Error", 501: "Not Implemented", 502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout",
};
var MIME = {
  json: "application/json", html: "text/html", text: "text/plain", txt: "text/plain",
  css: "text/css", js: "application/javascript", xml: "application/xml", csv: "text/csv",
};
function httpError(status, message, extra) {
  var e = new Error(message);
  e.status = e.statusCode = status;
  e.expose = status < 500;
  if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
  return e;
}
function escapeRe(s) { return s.replace(/[.+?^=!:(){}$|[\]\\\/]/g, "\\$&"); }
function compilePath(path, end) {
  if (path instanceof RegExp) return { re: path, keys: [] };
  if (Array.isArray(path)) {
    var parts = path.map(function (p) { return compilePath(p, end); });
    return {
      re: new RegExp(parts.map(function (p) { return "(?:" + p.re.source + ")"; }).join("|"), "i"),
      keys: [].concat.apply([], parts.map(function (p) { return p.keys; })),
    };
  }
  var keys = [];
  var src = "^";
  var segments = String(path).replace(/\/+$/, "").split("/").slice(1);
  var star = 0;
  segments.forEach(function (seg) {
    var optional = /^:(\w+)\?$/.exec(seg);
    if (optional) { keys.push(optional[1]); src += "(?:\\/([^\\/]+?))?"; return; }
    if (seg === "*" || /^\*\w*$/.test(seg) || /^\{?\*\w+\}?$/.test(seg)) {
      keys.push(seg.replace(/[{}*]/g, "") || String(star++));
      src += "(?:\\/(.*))?";
      return;
    }
    var out = "";
    var last = 0;
    var re = /:(\w+)|\*/g;
    var m;
    while ((m = re.exec(seg))) {
      out += escapeRe(seg.slice(last, m.index));
      if (m[0] === "*") { keys.push(String(star++)); out += "(.*)"; }
      else { keys.push(m[1]); out += "([^\\/]+?)"; }
      last = re.lastIndex;
    }
    out += escapeRe(seg.slice(last));
    src += "\\/" + out;
  });
  src += end ? "\\/?$" : "(?=\\/|$)";
  return { re: new RegExp(src, "i"), keys: keys };
}
function decodeParam(value) {
  if (value === undefined) return undefined;
  try { return decodeURIComponent(value); } catch (e) { throw httpError(400, "Failed to decode param '" + value + "'"); }
}
var METHODS = ["get", "post", "put", "patch", "delete", "options", "head", "all"];
var routeGroup = 0;
function flatten(list) {
  var out = [];
  (function add(items) {
    items.forEach(function (item) { if (Array.isArray(item)) add(item); else out.push(item); });
  })(list);
  return out;
}
function makeRouter(options) {
  options = options || {};
  var router = function (req, res, next) { router.handle(req, res, next); };
  router.stack = [];
  router.mergeParams = Boolean(options.mergeParams);
  router.use = function () {
    var args = flatten(Array.prototype.slice.call(arguments));
    var path = "/";
    if (typeof args[0] === "string" || args[0] instanceof RegExp) path = args.shift();
    if (!args.length) throw new TypeError("app.use() requires a middleware function");
    var compiled = compilePath(path, false);
    args.forEach(function (fn) {
      if (typeof fn !== "function") throw new TypeError("app.use() requires a middleware function but got a " + typeof fn);
      router.stack.push({ method: null, re: compiled.re, keys: compiled.keys, fn: fn, group: 0 });
    });
    return router;
  };
  function addRoute(method, path, handlers) {
    var fns = flatten(handlers);
    if (!fns.length) throw new TypeError("Route." + method.toLowerCase() + "() requires a callback function");
    var compiled = compilePath(path, true);
    var group = ++routeGroup;
    fns.forEach(function (fn) {
      if (typeof fn !== "function")
        throw new TypeError("Route." + method.toLowerCase() + "() requires a callback function but got a " + Object.prototype.toString.call(fn));
      router.stack.push({ method: method, re: compiled.re, keys: compiled.keys, fn: fn, group: group, path: path });
    });
    return router;
  }
  METHODS.forEach(function (m) {
    router[m] = function (path) {
      return addRoute(m.toUpperCase(), path, Array.prototype.slice.call(arguments, 1));
    };
  });
  router["delete"] = function (path) { return addRoute("DELETE", path, Array.prototype.slice.call(arguments, 1)); };
  router.route = function (path) {
    var chain = {};
    METHODS.forEach(function (m) {
      chain[m] = function () { addRoute(m.toUpperCase(), path, Array.prototype.slice.call(arguments)); return chain; };
    });
    return chain;
  };
  router.param = function () {};
  router.handle = function (req, res, out) {
    var stack = router.stack;
    var idx = 0;
    var skipGroup = 0;
    var parentParams = req.params || {};
    var baseUrl = req.baseUrl;
    var path = req.path;
    function next(err) {
      // Every layer sees the path relative to this router.
      req.baseUrl = baseUrl;
      req.path = path;
      req.url = path + req._search;
      if (err === "route") { err = undefined; } else { skipGroup = 0; }
      if (err === "router") { req.params = parentParams; return out(); }
      while (idx < stack.length) {
        var layer = stack[idx++];
        if (skipGroup && layer.group === skipGroup) continue;
        var match = layer.re.exec(path);
        if (!match) continue;
        if (layer.method) {
          if (err) continue;
          var method = req.method === "HEAD" && layer.method === "GET" ? "GET" : req.method;
          if (layer.method !== "ALL" && layer.method !== method) continue;
        }
        var params = router.mergeParams ? Object.assign({}, parentParams) : {};
        try {
          layer.keys.forEach(function (key, i) {
            var v = decodeParam(match[i + 1]);
            if (v !== undefined) params[key] = v;
          });
        } catch (e) {
          err = e;
          continue;
        }
        req.params = params;
        if (!layer.method) {
          var matched = match[0];
          if (matched && matched !== "/") {
            req.baseUrl = baseUrl + matched;
            req.path = path.slice(matched.length) || "/";
            if (req.path[0] !== "/") req.path = "/" + req.path;
            req.url = req.path + req._search;
          }
        } else {
          skipGroup = layer.group;
          req.route = { path: layer.path, method: layer.method.toLowerCase() };
        }
        return call(layer.fn, err, req, res, next);
      }
      req.params = parentParams;
      out(err);
    }
    next();
  };
  return router;
}
function call(fn, err, req, res, next) {
  try {
    var result;
    if (err) {
      if (fn.length !== 4) return next(err);
      result = fn(err, req, res, next);
    } else {
      if (fn.length === 4) return next();
      result = fn(req, res, next);
    }
    // Express 5: a rejected promise goes to the error handler.
    if (result && typeof result.then === "function")
      result.then(undefined, function (e) { next(e || new Error("Rejected promise")); });
  } catch (e) {
    next(e);
  }
}
var lastApp = null;
function express() {
  var app = makeRouter({});
  var settings = { "x-powered-by": true, env: "development" };
  app.locals = {};
  app.settings = settings;
  app.set = function (key, value) {
    if (arguments.length === 1) return settings[key];
    settings[key] = value;
    return app;
  };
  var routerGet = app.get;
  app.get = function (path) {
    if (arguments.length === 1 && typeof path === "string") return settings[path];
    return routerGet.apply(app, arguments);
  };
  app.enable = function (key) { settings[key] = true; return app; };
  app.disable = function (key) { settings[key] = false; return app; };
  app.enabled = function (key) { return Boolean(settings[key]); };
  app.disabled = function (key) { return !settings[key]; };
  app.listen = function () {
    var args = Array.prototype.slice.call(arguments);
    var cb = typeof args[args.length - 1] === "function" ? args.pop() : null;
    var port = args[0] === undefined ? 3000 : args[0];
    if (cb) G.setTimeout(cb, 0);
    return { close: function (fn) { if (fn) fn(); }, address: function () { return { port: Number(port) || 3000 }; }, on: function () {} };
  };
  app.render = function () { throw new Error("Views aren't available in the simulator. Send JSON with res.json()."); };
  lastApp = app;
  return app;
}
express.Router = makeRouter;
function jsonParser(options) {
  options = options || {};
  return function jsonParser(req, res, next) {
    if (req._bodyParsed) return next();
    if (!/json/i.test(req.get("content-type") || "")) return next();
    req._bodyParsed = true;
    var raw = req._rawBody;
    if (!raw) { req.body = {}; return next(); }
    try {
      req.body = JSON.parse(raw);
    } catch (e) {
      return next(httpError(400, String(e.message || e), { type: "entity.parse.failed", body: raw }));
    }
    if (options.strict !== false && (req.body === null || typeof req.body !== "object"))
      return next(httpError(400, "Unexpected token in JSON: only objects and arrays are allowed", { type: "entity.parse.failed" }));
    next();
  };
}
function parseForm(raw) {
  var out = {};
  String(raw || "").split("&").forEach(function (pair) {
    if (!pair) return;
    var i = pair.indexOf("=");
    var key = decodeForm(i === -1 ? pair : pair.slice(0, i));
    var value = i === -1 ? "" : decodeForm(pair.slice(i + 1));
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = [].concat(out[key], value);
    else out[key] = value;
  });
  return out;
}
function decodeForm(s) {
  try { return decodeURIComponent(s.replace(/\+/g, " ")); } catch (e) { return s; }
}
function formParser() {
  return function urlencodedParser(req, res, next) {
    if (req._bodyParsed) return next();
    if (!/x-www-form-urlencoded/i.test(req.get("content-type") || "")) return next();
    req._bodyParsed = true;
    req.body = parseForm(req._rawBody);
    next();
  };
}
function textParser() {
  return function textParser(req, res, next) {
    if (req._bodyParsed) return next();
    if (!/^text\//i.test(req.get("content-type") || "")) return next();
    req._bodyParsed = true;
    req.body = req._rawBody || "";
    next();
  };
}
express.json = jsonParser;
express.urlencoded = formParser;
express.text = textParser;
express.raw = textParser;
express["static"] = function () { return function (req, res, next) { next(); }; };

function parseCookies(header) {
  var out = {};
  String(header || "").split(";").forEach(function (part) {
    var i = part.indexOf("=");
    if (i === -1) return;
    var key = part.slice(0, i).trim();
    if (key) out[key] = decodeForm(part.slice(i + 1).trim().replace(/^"|"$/g, ""));
  });
  return out;
}

function createRequest(input) {
  var full = String(input.path || "/");
  var q = full.indexOf("?");
  var pathname = q === -1 ? full : full.slice(0, q);
  var search = q === -1 ? "" : full.slice(q);
  var headers = {};
  Object.keys(input.headers || {}).forEach(function (k) { headers[k.toLowerCase()] = String(input.headers[k]); });
  if (input.body && !headers["content-length"]) headers["content-length"] = String(utf8Encode(input.body).length);
  headers.host = headers.host || "localhost:3000";
  var req = {
    method: String(input.method || "GET").toUpperCase(),
    url: full,
    originalUrl: full,
    path: pathname || "/",
    baseUrl: "",
    _search: search,
    query: parseForm(search.slice(1)),
    params: {},
    headers: headers,
    body: undefined,
    _rawBody: input.body || "",
    ip: "127.0.0.1",
    ips: [],
    protocol: "http",
    secure: false,
    hostname: "localhost",
    cookies: undefined,
    signedCookies: {},
  };
  req.get = req.header = function (name) {
    var key = String(name).toLowerCase();
    if (key === "referer" || key === "referrer") return headers.referer || headers.referrer;
    return headers[key];
  };
  req.is = function (type) {
    var ct = headers["content-type"] || "";
    if (!ct) return null;
    var want = MIME[type] || type;
    return ct.indexOf(want.replace("*", "")) !== -1 ? type : false;
  };
  req.accepts = function () { return arguments[0] || "*/*"; };
  return req;
}

function createResponse(req, onFinish) {
  var listeners = { finish: [] };
  var res = {
    statusCode: 200,
    statusMessage: "",
    headers: {},
    body: "",
    headersSent: false,
    finished: false,
    writableEnded: false,
    locals: {},
    req: req,
  };
  function assertOpen() {
    if (res.headersSent)
      throw Object.assign(new Error("Cannot set headers after they are sent to the client"), { code: "ERR_HTTP_HEADERS_SENT" });
  }
  res.status = function (code) {
    var n = Number(code);
    if (!Number.isInteger(n) || n < 100 || n > 999)
      throw new RangeError("Invalid status code: " + code + ". Status code must be an integer between 100 and 999.");
    res.statusCode = n;
    return res;
  };
  res.set = res.header = function (field, value) {
    if (field && typeof field === "object") {
      Object.keys(field).forEach(function (k) { res.set(k, field[k]); });
      return res;
    }
    assertOpen();
    var key = String(field).toLowerCase();
    var v = Array.isArray(value) ? value.map(String) : String(value);
    if (key === "content-type" && typeof v === "string" && !/charset/i.test(v) && /^(text\/|application\/json)/i.test(v))
      v += "; charset=utf-8";
    res.headers[key] = v;
    return res;
  };
  res.setHeader = function (field, value) { res.set(field, value); return res; };
  res.get = res.getHeader = function (field) { return res.headers[String(field).toLowerCase()]; };
  res.removeHeader = function (field) { delete res.headers[String(field).toLowerCase()]; };
  res.append = function (field, value) {
    var key = String(field).toLowerCase();
    var prev = res.headers[key];
    res.headers[key] = prev === undefined ? value : [].concat(prev, value);
    return res;
  };
  res.type = res.contentType = function (type) {
    var t = String(type);
    return res.set("content-type", t.indexOf("/") === -1 ? MIME[t.replace(/^\./, "")] || "application/octet-stream" : t);
  };
  res.location = function (url) { return res.set("location", url); };
  res.vary = function () { return res; };
  res.links = function () { return res; };
  res.cookie = function (name, value, options) {
    options = options || {};
    var str = name + "=" + encodeURIComponent(typeof value === "object" ? "j:" + JSON.stringify(value) : String(value));
    if (options.maxAge !== undefined) str += "; Max-Age=" + Math.floor(options.maxAge / 1000);
    str += "; Path=" + (options.path || "/");
    if (options.expires) str += "; Expires=" + new Date(options.expires).toUTCString();
    if (options.httpOnly) str += "; HttpOnly";
    if (options.secure) str += "; Secure";
    if (options.sameSite) str += "; SameSite=" + (options.sameSite === true ? "Strict" : options.sameSite);
    return res.append("set-cookie", str);
  };
  res.clearCookie = function (name, options) {
    return res.cookie(name, "", Object.assign({}, options, { expires: new Date(1), maxAge: undefined }));
  };
  res.on = res.once = function (event, fn) {
    if (listeners[event]) listeners[event].push(fn);
    return res;
  };
  res.emit = function () { return false; };
  function finish(body) {
    assertOpen();
    var code = res.statusCode;
    if (code === 204 || code === 304) {
      delete res.headers["content-type"];
      body = "";
    }
    res.body = req.method === "HEAD" ? "" : body;
    if (!res.headers["content-length"] && code !== 204 && code !== 304)
      res.headers["content-length"] = String(utf8Encode(body).length);
    res.headersSent = res.finished = res.writableEnded = true;
    onFinish(res);
    listeners.finish.forEach(function (fn) {
      try { fn(); } catch (e) { console.error(e); }
    });
    return res;
  }
  res.json = function (value) {
    if (arguments.length > 1 && typeof arguments[1] === "number") { res.status(arguments[1]); }
    var body = JSON.stringify(value);
    if (!res.get("content-type")) res.set("content-type", "application/json");
    return finish(body === undefined ? "" : body);
  };
  res.send = function (body) {
    if (typeof body === "number" && arguments.length === 1)
      throw new TypeError("res.send(status) is not supported: use res.sendStatus(" + body + ") or res.status(" + body + ").send()");
    if (body === undefined || body === null) return finish("");
    if (body instanceof Buf) {
      if (!res.get("content-type")) res.set("content-type", "application/octet-stream");
      return finish(body.toString());
    }
    if (typeof body === "object") return res.json(body);
    if (typeof body === "boolean") return res.json(body);
    if (!res.get("content-type")) res.set("content-type", "text/html");
    return finish(String(body));
  };
  res.sendStatus = function (code) {
    res.status(code);
    res.type("txt");
    return finish(STATUS[code] || String(code));
  };
  res.end = function (body) { return finish(body === undefined || body === null ? "" : String(body)); };
  res.write = function () { throw new Error("Streaming responses aren't available in the simulator. Use res.send() or res.json()."); };
  res.redirect = function (a, b) {
    var code = typeof a === "number" ? a : 302;
    var url = typeof a === "number" ? b : a;
    res.status(code).set("location", url);
    res.type("txt");
    return finish(STATUS[code] + ". Redirecting to " + url);
  };
  res.format = function (handlers) {
    var fn = handlers.json || handlers["application/json"] || handlers["default"];
    if (fn) fn();
    return res;
  };
  res.sendFile = res.download = res.render = function () {
    throw new Error("Files and views aren't available in the simulator. Send JSON with res.json().");
  };
  return res;
}
function errorPage(message) {
  return "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>" +
    String(message).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") +
    "</pre>\n</body>\n</html>\n";
}
function finalHandler(req, res) {
  return function (err) {
    if (err) {
      var status = Number(err && (err.status || err.statusCode)) || 500;
      if (status < 400 || status > 599) status = 500;
      if (status >= 500 || !err.expose) console.error(err);
      if (res.headersSent) return;
      res.headers = {};
      res.statusCode = status;
      res.set("content-type", "text/html");
      res.set("x-content-type-options", "nosniff");
      res.end(errorPage(err.expose && err.message ? err.message : STATUS[status] || "Error"));
      return;
    }
    if (res.headersSent) return;
    res.statusCode = 404;
    res.set("content-type", "text/html");
    res.set("x-content-type-options", "nosniff");
    res.end(errorPage("Cannot " + req.method + " " + req.originalUrl.split("?")[0]));
  };
}

// --------------------------------------------------------- small packages
function cors(options) {
  options = options || {};
  return function corsMiddleware(req, res, next) {
    var origin = options.origin === undefined || options.origin === true || options.origin === "*"
      ? (options.origin === true ? req.get("origin") || "*" : "*")
      : Array.isArray(options.origin)
        ? (options.origin.indexOf(req.get("origin")) !== -1 ? req.get("origin") : null)
        : options.origin === false ? null : String(options.origin);
    if (origin) res.set("access-control-allow-origin", origin);
    if (options.credentials) res.set("access-control-allow-credentials", "true");
    if (req.method === "OPTIONS") {
      res.set("access-control-allow-methods", [].concat(options.methods || "GET,HEAD,PUT,PATCH,POST,DELETE").join(","));
      var allow = options.allowedHeaders || req.get("access-control-request-headers");
      if (allow) res.set("access-control-allow-headers", [].concat(allow).join(","));
      res.status(204);
      return res.end();
    }
    next();
  };
}
function morgan(format) {
  return function morganLogger(req, res, next) {
    var started = Date.now();
    var method = req.method;
    var url = req.originalUrl;
    res.on("finish", function () {
      var ms = Date.now() - started;
      var len = res.get("content-length") || "-";
      if (format === "tiny") console.log(method + " " + url + " " + res.statusCode + " " + len + " - " + ms + " ms");
      else if (format === "combined" || format === "common")
        console.log("127.0.0.1 - - [" + new Date().toUTCString() + "] \"" + method + " " + url + " HTTP/1.1\" " + res.statusCode + " " + len);
      else console.log(method + " " + url + " " + res.statusCode + " " + ms + " ms - " + len);
    });
    next();
  };
}
function helmet() {
  return function helmetMiddleware(req, res, next) {
    res.removeHeader("x-powered-by");
    res.set({
      "content-security-policy": "default-src 'self'",
      "cross-origin-opener-policy": "same-origin",
      "cross-origin-resource-policy": "same-origin",
      "referrer-policy": "no-referrer",
      "strict-transport-security": "max-age=31536000; includeSubDomains",
      "x-content-type-options": "nosniff",
      "x-dns-prefetch-control": "off",
      "x-download-options": "noopen",
      "x-frame-options": "SAMEORIGIN",
      "x-permitted-cross-domain-policies": "none",
      "x-xss-protection": "0",
    });
    next();
  };
}
function cookieParser() {
  return function cookieParserMiddleware(req, res, next) {
    req.cookies = parseCookies(req.get("cookie"));
    next();
  };
}
var pathModule = {
  sep: "/",
  join: function () { return normalize(Array.prototype.slice.call(arguments).join("/")); },
  resolve: function () { return normalize("/app/" + Array.prototype.slice.call(arguments).join("/")); },
  basename: function (p, ext) { var b = String(p).split("/").pop(); return ext && b.slice(-ext.length) === ext ? b.slice(0, -ext.length) : b; },
  dirname: function (p) { return dirname(String(p)); },
  extname: function (p) { var m = /(\.[^./]*)$/.exec(String(p).split("/").pop()); return m ? m[1] : ""; },
};
var utilModule = {
  format: function () { return format(arguments); },
  inspect: function (v) { return inspect(v); },
  promisify: function (fn) {
    return function () {
      var args = Array.prototype.slice.call(arguments);
      var self = this;
      return new Promise(function (resolve, reject) {
        fn.apply(self, args.concat(function (err, value) { if (err) reject(err); else resolve(value); }));
      });
    };
  },
  isDeepStrictEqual: function (a, b) { return JSON.stringify(a) === JSON.stringify(b); },
  types: {},
};

// ------------------------------------------------------------- modules
var bodyParser = { json: jsonParser, urlencoded: formParser, text: textParser, raw: textParser };
var BUILTINS = {
  express: express,
  cors: cors,
  morgan: morgan,
  helmet: helmet,
  "body-parser": bodyParser,
  "cookie-parser": cookieParser,
  bcrypt: bcryptModule,
  bcryptjs: bcryptModule,
  jsonwebtoken: jwtModule,
  crypto: cryptoModule,
  uuid: { v4: randomUUID, validate: function (s) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s)); } },
  dotenv: { config: function () { return { parsed: {} }; } },
  "dotenv/config": {},
  path: pathModule,
  util: utilModule,
  db: db,
};
var NO_ACCESS = { fs: 1, "fs/promises": 1, child_process: 1, net: 1, http: 1, https: 1, os: 1, cluster: 1, worker_threads: 1, vm: 1, dns: 1 };
function normalize(p) {
  var out = [];
  String(p).split("/").forEach(function (part) {
    if (!part || part === ".") return;
    if (part === "..") out.pop();
    else out.push(part);
  });
  return "/" + out.join("/");
}
function dirname(p) {
  var i = p.lastIndexOf("/");
  return i <= 0 ? "/" : p.slice(0, i);
}
var files = {};
var cache = {};
function notFound(name, hint) {
  var e = new Error("Cannot find module '" + name + "'" + (hint ? ". " + hint : ""));
  e.code = "MODULE_NOT_FOUND";
  return e;
}
function load(path) {
  if (cache[path]) return cache[path].exports;
  var module = { id: path, filename: path, exports: {}, loaded: false };
  cache[path] = module;
  var fn = host.load(path.slice(1));
  fn.call(module.exports, module.exports, makeRequire(dirname(path)), module, path, dirname(path));
  module.loaded = true;
  return module.exports;
}
function makeRequire(dir) {
  function require(name) {
    if (typeof name !== "string" || !name) throw new TypeError("The \"id\" argument must be a non-empty string.");
    if (name[0] === "." || name[0] === "/") {
      var target = normalize(name[0] === "/" ? name : dir + "/" + name);
      var candidates = [target, target + ".js", target + "/index.js"];
      for (var i = 0; i < candidates.length; i++)
        if (Object.prototype.hasOwnProperty.call(files, candidates[i])) return load(candidates[i]);
      // ./db is the exercise database unless the intern wrote their own db.js.
      if (/^\/db(\.js)?$/.test(target)) return db;
      throw notFound(name, "There is no file called " + target.slice(1) + (/\.js$/.test(target) ? "" : ".js") + ".");
    }
    var bare = name.replace(/^node:/, "");
    if (Object.prototype.hasOwnProperty.call(BUILTINS, bare)) return BUILTINS[bare];
    if (NO_ACCESS[bare])
      throw notFound(name, "The simulator has no " + bare + " module: store data in the database (require(\"./db\")).");
    throw notFound(name, "Packages available here: " + Object.keys(BUILTINS).filter(function (k) { return k !== "db" && k !== "dotenv/config"; }).join(", ") + ", and ./db for the database.");
  }
  require.resolve = function (name) { return name; };
  require.cache = cache;
  return require;
}

G.process = {
  env: {},
  argv: ["node", "/app/server.js"],
  platform: "linux",
  version: "v22.0.0",
  versions: { node: "22.0.0" },
  pid: 1,
  cwd: function () { return "/app"; },
  uptime: function () { return 1; },
  hrtime: Object.assign(function () { var t = Date.now(); return [Math.floor(t / 1000), (t % 1000) * 1e6]; }, { bigint: function () { return BigInt(Date.now()) * BigInt(1000000); } }),
  memoryUsage: function () { return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 }; },
  nextTick: function (fn) { var args = Array.prototype.slice.call(arguments, 1); Promise.resolve().then(function () { fn.apply(null, args); }); },
  on: function () { return G.process; },
  once: function () { return G.process; },
  exit: function (code) { throw new Error("process.exit(" + (code === undefined ? "" : code) + ") was called, which would stop the server."); },
};

// ------------------------------------------------- host entry points
var app = null;
var current = null;

/** Loads server.js; returns "" or an error message. */
G.__boot = function (filesJson, envJson) {
  JSON.parse(filesJson).forEach(function (name) { files["/" + name] = true; });
  G.process.env = Object.assign({ NODE_ENV: "development", PORT: "3000" }, JSON.parse(envJson));
  var exported = load("/server.js");
  if (exported && typeof exported.handle === "function") app = exported;
  else if (exported && exported.app && typeof exported.app.handle === "function") app = exported.app;
  else app = lastApp;
  if (!app) return "server.js must create an Express app: const app = express();";
  return "";
};

/** Starts handling one request. */
G.__dispatch = function (requestJson) {
  var req = createRequest(JSON.parse(requestJson));
  current = { done: false, res: null };
  var state = current;
  var res = createResponse(req, function (r) { state.done = true; state.res = r; });
  if (app.settings && app.settings["x-powered-by"]) res.headers["x-powered-by"] = "Express";
  try {
    app.handle(req, res, finalHandler(req, res));
  } catch (e) {
    finalHandler(req, res)(e);
  }
};

/**
 * 1: the response is ready; 2: a timer ran; 0: nothing left to run.
 * At startup only timers due now run (not a setInterval's later rounds).
 */
G.__tick = function (startup) {
  if (current && current.done) return 1;
  return runNextTimer(startup ? 0 : Infinity) ? 2 : 0;
};

G.__result = function () {
  var r = current && current.res;
  if (!r) return "";
  var headers = {};
  Object.keys(r.headers).forEach(function (k) {
    headers[k] = Array.isArray(r.headers[k]) ? r.headers[k].join(", ") : String(r.headers[k]);
  });
  return JSON.stringify({ status: r.statusCode, headers: headers, body: String(r.body) });
};
})();
`;

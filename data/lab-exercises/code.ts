import { brief, type LabExercise } from "./helpers";

// Coding exercises: web pages (checked in the browser) and APIs (tested on
// the server).

const at = (track: string, level: string, week: number, title: string) => ({ track, level, week, title });
const FE = "Front-End Development", BE = "Back-End Engineering";

// ── Web ─────────────────────────────────────────────────────────────────────
type WebFiles = { html: string; css?: string; js?: string };
const files = ({ html, css = "", js = "" }: WebFiles) => ({ "index.html": html, "styles.css": css, "script.js": js });

function web(place: ReturnType<typeof at>, text: string, starter: WebFiles, solution: WebFiles, checks: [string, string][]): LabExercise {
  return { ...place, kind: "WEB", brief: text, starterFiles: files(starter), solutionFiles: files(solution), checks: checks.map(([label, code]) => ({ label, code })) };
}

const menuHtml = `<header><h1>Mama Ngozi's Kitchen</h1></header>
<main>
  <section class="menu">
    <article class="dish"><h2>Jollof rice</h2><p>Smoky, with chicken.</p><p class="price">N3500</p></article>
    <article class="dish"><h2>Egusi soup</h2><p>With pounded yam.</p><p class="price">N4000</p></article>
    <article class="dish"><h2>Fried plantain</h2><p>Sweet and soft.</p><p class="price">N1500</p></article>
  </section>
</main>
`;
const landingHtml = `<header><p class="brand">Mama Ngozi's Kitchen</p></header>
<main>
  <section class="hero">
    <h1>Lunch that tastes like home</h1>
    <p>Fresh jollof, egusi and pounded yam in Garki, Abuja.</p>
    <a class="button" href="#order">Order lunch</a>
  </section>
  <section class="why"><article>Cooked every morning</article><article>Plates from N3500</article><article>Ready from noon</article></section>
  <section id="order"><h2>Order</h2><p>Call 080 0000 0000, Monday to Saturday.</p></section>
</main>
`;
const landingCss = `* { box-sizing: border-box; }
body { margin: 0; font-family: Georgia, serif; color: #2b1a10; background: #fff8ef; }
section { padding: 24px 16px; }
.button { display: inline-block; padding: 14px 24px; background: #b3421b; color: #fff; border-radius: 8px; text-decoration: none; }
.why { display: flex; flex-direction: column; gap: 12px; }
@media (min-width: 700px) { .why { flex-direction: row; } }
`;
const priceHtml = `<h1>Zuma Kicks</h1>
<label>Pairs <input id="pairs" type="number" value="1" min="1"></label>
<button id="work">Work out the price</button>
<p id="total"></p>
`;
const cartHtml = `<h1>Your bag</h1>
<form id="add"><input id="item" placeholder="Add a sneaker"><button>Add</button></form>
<ul id="bag"></ul>
<p id="count">0 items</p>
`;
const siteHtml = `<nav><a href="#home">Home</a><a href="#shop">Shop</a><a href="#contact">Contact</a></nav>
<main>
  <section id="home"><h1>Zuma Kicks</h1><p>Clean sneakers in Abuja.</p></section>
  <section id="shop"><h2>Shop</h2><article>Black</article><article>White</article><article>Green</article></section>
  <section id="contact"><h2>Contact</h2>
    <form id="form"><label>Name <input id="name"></label><label>Email <input id="email"></label><label>Message <textarea id="message"></textarea></label><button>Send</button></form>
    <p id="status"></p>
  </section>
</main>
`;

const SET = "const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };";
const SUBMIT = "const submit = (id) => document.getElementById(id).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));";

const WEB: LabExercise[] = [
  web(at(FE, "Beginner", 3, "Style the menu"),
    brief("Mama Ngozi's menu is plain black text. Make it look like food you'd want to eat.", [
      "Give the page its own background colour and font.",
      "Lay the dishes out side by side with Flexbox, with a gap.",
      "Give each dish padding and rounded corners, like a card.",
      "Make the prices stand out: bold, in their own colour.",
    ], "the landing page you finish in Week 4. This is its menu."),
    { html: menuHtml },
    { html: menuHtml, css: "body { background: #fff8ef; font-family: Georgia, serif; }\n.menu { display: flex; gap: 16px; flex-wrap: wrap; }\n.dish { padding: 16px; border-radius: 12px; background: #fff; }\n.price { font-weight: bold; color: #b3421b; }" },
    [
      ["The page has its own background colour", "const c = getComputedStyle(document.body).backgroundColor; return c !== 'rgba(0, 0, 0, 0)' && c !== 'rgb(255, 255, 255)';"],
      ["The page has its own font", "return !/^\"?Times/.test(getComputedStyle(document.body).fontFamily);"],
      ["The dishes sit in a Flexbox with a gap", "const s = getComputedStyle(document.querySelector('.menu')); return s.display === 'flex' && parseFloat(s.columnGap) > 0;"],
      ["Each dish has padding and rounded corners", "return [...document.querySelectorAll('.dish')].every((d) => { const s = getComputedStyle(d); return parseFloat(s.paddingTop) >= 8 && parseFloat(s.borderTopLeftRadius) > 0; });"],
      ["Prices are bold and have their own colour", "const p = getComputedStyle(document.querySelector('.price')); const b = getComputedStyle(document.body); return Number(p.fontWeight) >= 600 && p.color !== b.color;"],
    ]),
  web(at(FE, "Beginner", 4, "A landing page for any phone"),
    brief("Build Mama Ngozi's landing page from nothing. Most visitors will see it on a phone, so start there.", [
      "A header with the restaurant's name.",
      "A hero section with an h1, a sentence and a button-like link with the class button.",
      "A section with at least three reasons to come.",
      "An order section with a phone number. The button should lead to it.",
      "Style the phone first, then add a media query with min-width for bigger screens.",
    ], "your milestone: your own landing page that works on phones and laptops."),
    { html: "<!-- Build the landing page here. -->\n", css: "/* Phone first, then @media (min-width: ...) */\n" },
    { html: landingHtml, css: landingCss },
    [
      ["There is a header with a name", "const h = document.querySelector('header'); return !!h && h.textContent.trim().length > 3;"],
      ["One h1 with a real headline", "const h = document.querySelectorAll('h1'); return h.length === 1 && h[0].textContent.trim().length >= 8;"],
      ["A link with the class button that looks like one", "const b = document.querySelector('a.button'); if (!b) return false; const s = getComputedStyle(b); return parseFloat(s.paddingTop) >= 8 && s.backgroundColor !== 'rgba(0, 0, 0, 0)';"],
      ["The button leads to the order section", "const b = document.querySelector('a.button'); const id = (b?.getAttribute('href') || '').replace('#', ''); const t = id && document.getElementById(id); return !!t && /0\\d{2}/.test(t.textContent);"],
      ["At least three sections, one with three reasons", "return document.querySelectorAll('section').length >= 3 && [...document.querySelectorAll('section')].some((s) => s.querySelectorAll('article, li').length >= 3);"],
      ["A min-width media query for bigger screens", "return [...document.styleSheets].some((s) => [...s.cssRules].some((r) => r instanceof CSSMediaRule && /min-width/.test(r.conditionText)));"],
      ["Nothing is wider than the screen", "return document.documentElement.scrollWidth <= window.innerWidth + 1;"],
    ]),
  web(at(FE, "Novice", 1, "A price that works itself out"),
    brief("Zuma Kicks sells sneakers at N18000 a pair. Buy three or more and each pair costs N16000. Customers want to see the price.", [
      "Write a function called totalFor(pairs) that returns the total.",
      "When the button is clicked, show the total in #total, like N36000.",
      "If the number is less than 1 or isn't a number, show Enter at least 1 pair.",
    ], "the business site you deliver in Week 4. This is its price helper."),
    { html: priceHtml, js: "function totalFor(pairs) {\n  // Return the total price.\n}\n" },
    { html: priceHtml, js: "function totalFor(pairs) {\n  return pairs * (pairs >= 3 ? 16000 : 18000);\n}\ndocument.getElementById('work').addEventListener('click', () => {\n  const pairs = Number(document.getElementById('pairs').value);\n  document.getElementById('total').textContent = pairs >= 1 ? 'N' + totalFor(pairs) : 'Enter at least 1 pair';\n});" },
    [
      ["One pair costs N18000", "set('pairs', '1'); document.getElementById('work').click(); return /N\\s?18,?000/.test(document.getElementById('total').textContent);".replace(/^/, SET)],
      ["Two pairs cost N36000", "set('pairs', '2'); document.getElementById('work').click(); return /N\\s?36,?000/.test(document.getElementById('total').textContent);".replace(/^/, SET)],
      ["Three pairs get the lower price", "set('pairs', '3'); document.getElementById('work').click(); return /N\\s?48,?000/.test(document.getElementById('total').textContent);".replace(/^/, SET)],
      ["Zero pairs shows a message", "set('pairs', '0'); document.getElementById('work').click(); return /at least 1/i.test(document.getElementById('total').textContent);".replace(/^/, SET)],
    ]),
  web(at(FE, "Novice", 2, "A bag you can fill"),
    brief("Customers want to keep a list of the sneakers they like before they order.", [
      "When the form is sent, add the item to the list. Don't reload the page.",
      "Give each item a Remove button that takes it away.",
      "Keep #count right: 1 item, 2 items and so on.",
      "Ignore an empty item, and clear the box after adding.",
    ], "the business site. This becomes its shopping bag."),
    { html: cartHtml },
    { html: cartHtml, js: "const bag = document.getElementById('bag');\nfunction count() {\n  const n = bag.children.length;\n  document.getElementById('count').textContent = n + (n === 1 ? ' item' : ' items');\n}\ndocument.getElementById('add').addEventListener('submit', (event) => {\n  event.preventDefault();\n  const box = document.getElementById('item');\n  const text = box.value.trim();\n  if (!text) return;\n  const li = document.createElement('li');\n  li.textContent = text + ' ';\n  const remove = document.createElement('button');\n  remove.textContent = 'Remove';\n  remove.addEventListener('click', () => { li.remove(); count(); });\n  li.append(remove);\n  bag.append(li);\n  box.value = '';\n  count();\n});" },
    [
      ["Adding an item puts it in the list", `${SET}${SUBMIT}const n = document.querySelectorAll('#bag li').length; set('item', 'Black 42'); submit('add'); const l = document.querySelectorAll('#bag li'); return l.length === n + 1 && l[l.length - 1].textContent.includes('Black 42');`],
      ["The box is cleared after adding", `${SET}${SUBMIT}set('item', 'White 40'); submit('add'); return document.getElementById('item').value === '';`],
      ["An empty item is ignored", `${SET}${SUBMIT}const n = document.querySelectorAll('#bag li').length; set('item', '   '); submit('add'); return document.querySelectorAll('#bag li').length === n;`],
      ["Remove takes one item away", `${SET}${SUBMIT}set('item', 'Green 44'); submit('add'); const n = document.querySelectorAll('#bag li').length; document.querySelector('#bag li button').click(); return n > 0 && document.querySelectorAll('#bag li').length === n - 1;`],
      ["The count is right", `${SET}${SUBMIT}set('item', 'Red 41'); submit('add'); const n = document.querySelectorAll('#bag li').length; return n > 0 && document.getElementById('count').textContent.trim() === n + (n === 1 ? ' item' : ' items');`],
    ]),
  web(at(FE, "Novice", 3, "Ready to go online"),
    brief("Before Zuma Kicks goes live, it must be ready for Google, for WhatsApp previews and for people using a screen reader.", [
      "Give the page a clear title that mentions sneakers and Abuja.",
      "Add a meta description of 50 to 160 characters, and a viewport meta tag.",
      "Add Open Graph tags: og:title and og:image.",
      "Give every picture alt text, and every box in the form a label.",
      "Then put it online for this week's task, with GitHub Pages or Netlify.",
    ], "the business site. This week it gets its real address."),
    { html: "<h1>Zuma Kicks</h1>\n<img src=\"black.jpg\">\n<img src=\"white.jpg\">\n<form><input id=\"size\" placeholder=\"Size\"><button>Check</button></form>\n" },
    { html: "<title>Zuma Kicks: clean sneakers in Abuja</title>\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<meta name=\"description\" content=\"Clean, affordable sneakers in Abuja from N18000, delivered to you in one day.\">\n<meta property=\"og:title\" content=\"Zuma Kicks\">\n<meta property=\"og:image\" content=\"https://example.com/shoe.jpg\">\n<h1>Zuma Kicks</h1>\n<img src=\"black.jpg\" alt=\"Black sneakers on a step\">\n<img src=\"white.jpg\" alt=\"White sneakers held up\">\n<form><label>Size <input id=\"size\"></label><button>Check</button></form>\n" },
    [
      ["A title that mentions sneakers and Abuja", "const t = (document.querySelector('title')?.textContent || '').toLowerCase(); return t.includes('sneaker') && t.includes('abuja');"],
      ["A meta description of 50 to 160 characters", "const d = document.querySelector('meta[name=description]')?.content.trim().length || 0; return d >= 50 && d <= 160;"],
      ["A viewport tag for phones", "return [...document.querySelectorAll('meta[name=viewport]')].some((m) => /width=device-width/.test(m.content) && !!m.closest('html'));"],
      ["Open Graph title and image", "return ['og:title', 'og:image'].every((p) => (document.querySelector(`meta[property=\"${p}\"]`)?.content || '').length > 3);"],
      ["Every picture has alt text", "const i = [...document.images]; return i.length >= 2 && i.every((x) => (x.getAttribute('alt') || '').trim().length >= 5);"],
      ["Every box has a label", "const b = [...document.querySelectorAll('input, textarea, select')]; return b.length > 0 && b.every((x) => x.labels && x.labels.length > 0);"],
    ]),
  web(at(FE, "Novice", 4, "Deliver the business site"),
    brief("Capstone. Put it together: Zuma Kicks' full site, with a contact form that checks what people type.", [
      "A nav with at least three links that lead to sections on the page.",
      "A home section, a shop section with at least three items, and a contact section.",
      "Lay the shop out with Flexbox or Grid, and add a media query for phones.",
      "When the form is sent: if anything is empty or the email has no @, say Please check your details in #status. If all is well, say Thank you and the person's name.",
    ], "your milestone: a responsive, interactive business website. Put it live for this week's task."),
    { html: "<!-- Build the site. The form needs id=\"form\" with boxes id=\"name\", id=\"email\" and id=\"message\", and a <p id=\"status\">. -->\n" },
    { html: siteHtml, css: "#shop { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }\n@media (max-width: 600px) { #shop { grid-template-columns: 1fr; } }", js: "document.getElementById('form').addEventListener('submit', (event) => {\n  event.preventDefault();\n  const value = (id) => document.getElementById(id).value.trim();\n  const ok = value('name') && value('message') && value('email').includes('@');\n  document.getElementById('status').textContent = ok ? 'Thank you, ' + value('name') : 'Please check your details';\n});" },
    [
      ["A nav whose links lead to sections", "const l = [...document.querySelectorAll('nav a')]; return l.length >= 3 && l.every((a) => document.querySelector(a.getAttribute('href') || '#none-at-all'));"],
      ["At least three sections", "return document.querySelectorAll('section').length >= 3;"],
      ["A shop with at least three items, in Flexbox or Grid", "return [...document.querySelectorAll('section, section *')].some((e) => /flex|grid/.test(getComputedStyle(e).display) && e.querySelectorAll('article, li').length >= 3);"],
      ["A media query for phones", "return [...document.styleSheets].some((s) => [...s.cssRules].some((r) => r instanceof CSSMediaRule && /width/.test(r.conditionText)));"],
      ["Empty boxes are caught", `${SET}${SUBMIT}set('name', ''); set('email', ''); set('message', ''); submit('form'); return /check your details/i.test(document.getElementById('status').textContent);`],
      ["A bad email is caught", `${SET}${SUBMIT}set('name', 'Ada'); set('email', 'ada.example.com'); set('message', 'Hello'); submit('form'); return /check your details/i.test(document.getElementById('status').textContent);`],
      ["A good message is thanked by name", `${SET}${SUBMIT}set('name', 'Ada'); set('email', 'ada@example.com'); set('message', 'Hello'); submit('form'); return /thank you/i.test(document.getElementById('status').textContent) && /Ada/.test(document.getElementById('status').textContent);`],
    ]),
];

// ── APIs ────────────────────────────────────────────────────────────────────
type Expect = [path: string, op: string, value?: string];
const req = (method: string, path: string, expect: Expect[], body?: unknown, save: [string, string][] = [], headers = "") => ({
  type: "request", method, path,
  headers: [body === undefined ? "" : "Content-Type: application/json", headers].filter(Boolean).join("\n"),
  body: body === undefined ? "" : JSON.stringify(body),
  expect: expect.map(([p, op, value = ""]) => ({ path: p, op, value })),
  save: save.map(([name, p]) => ({ name, path: p })),
});
const check = (label: string, steps: unknown[], hidden = false, hint = "") => ({ label, steps, hidden, hint, points: 1, setupSql: "" });
const ok = (status: number, ...more: Expect[]): Expect[] => [["status", "equals", String(status)], ...more];

const HEAD = `const express = require("express");
const db = require("./db");

const app = express();
app.use(express.json());

`;
const TAIL = `
app.listen(3000, () => console.log("API running on port 3000"));
module.exports = app;
`;
const server = (code: string) => ({ "server.js": HEAD + code + TAIL });

function api(place: ReturnType<typeof at>, text: string, databaseSql: string, starter: string, solution: string, tests: unknown[]): LabExercise {
  return { ...place, kind: "BACKEND", brief: text, config: { databaseSql, env: [], tests }, starterFiles: server(starter), solutionFiles: server(solution) };
}

const menuSql = `CREATE TABLE menu (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price INTEGER NOT NULL, vegetarian INTEGER NOT NULL DEFAULT 0);
INSERT INTO menu (name, price, vegetarian) VALUES ('Jollof rice', 3500, 0), ('Egusi soup', 4000, 0), ('Fried plantain', 1500, 1), ('Moi moi', 1200, 1);`;
const salonSql = `CREATE TABLE services (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price INTEGER NOT NULL);
CREATE TABLE bookings (id INTEGER PRIMARY KEY AUTOINCREMENT, service_id INTEGER NOT NULL, customer TEXT NOT NULL, slot TEXT NOT NULL);
INSERT INTO services (name, price) VALUES ('Haircut', 3000), ('Beard trim', 1500), ('Hair dye', 8000);
INSERT INTO bookings (service_id, customer, slot) VALUES (1, 'Musa', '2026-12-01 10:00'), (1, 'Emeka', '2026-12-01 11:00'), (3, 'Tunde', '2026-12-02 09:00');`;
const usersSql = `CREATE TABLE customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL, pin TEXT NOT NULL);
INSERT INTO customers (name, phone, pin) VALUES ('Amina', '08030000001', '4821'), ('Bola', '08030000002', '9920'), ('Chike', '08030000003', '1177');`;

const BACKEND: LabExercise[] = [
  api(at(BE, "Beginner", 3, "Small programs that make decisions"),
    brief("Mama Ngozi's cashier does sums by hand and makes mistakes. Write three small programs that the till can call.", [
      "GET /api/vat?price=1000 returns { price, vat, total }. VAT is 7.5%.",
      "GET /api/grade?score=72 returns { grade }: A from 70, B from 60, C from 50, and F below.",
      "GET /api/total?prices=500,700,300 returns { count, total }.",
      "If a number is missing or isn't a number, answer 400 with an error.",
    ], "your first working API, which you finish in Week 4."),
    menuSql, "// TODO 1: GET /api/vat\n// TODO 2: GET /api/grade\n// TODO 3: GET /api/total\n",
    `app.get("/api/vat", (req, res) => {
  const price = Number(req.query.price);
  if (!req.query.price || Number.isNaN(price)) return res.status(400).json({ error: "price must be a number" });
  const vat = price * 0.075;
  res.json({ price, vat, total: price + vat });
});
app.get("/api/grade", (req, res) => {
  const score = Number(req.query.score);
  if (!req.query.score || Number.isNaN(score)) return res.status(400).json({ error: "score must be a number" });
  res.json({ grade: score >= 70 ? "A" : score >= 60 ? "B" : score >= 50 ? "C" : "F" });
});
app.get("/api/total", (req, res) => {
  const prices = String(req.query.prices || "").split(",").map(Number);
  if (!req.query.prices || prices.some(Number.isNaN)) return res.status(400).json({ error: "prices must be numbers" });
  res.json({ count: prices.length, total: prices.reduce((sum, price) => sum + price, 0) });
});
`,
    [
      check("VAT on N1000 is N75", [req("GET", "/api/vat?price=1000", ok(200, ["body.vat", "equals", "75"], ["body.total", "equals", "1075"]))]),
      check("A score of 72 is an A", [req("GET", "/api/grade?score=72", ok(200, ["body.grade", "equals", "A"]))]),
      check("The edges are right", [req("GET", "/api/grade?score=60", ok(200, ["body.grade", "equals", "B"])), req("GET", "/api/grade?score=49", ok(200, ["body.grade", "equals", "F"]))], true, "Check scores exactly on 50, 60 and 70."),
      check("Three prices are added", [req("GET", "/api/total?prices=500,700,300", ok(200, ["body.count", "equals", "3"], ["body.total", "equals", "1500"]))]),
      check("Words instead of numbers give 400", [req("GET", "/api/vat?price=abc", ok(400, ["body.error", "exists"])), req("GET", "/api/grade", ok(400))]),
    ]),
  api(at(BE, "Beginner", 4, "Your first real API"),
    brief("Delivery apps want Mama Ngozi's menu. Give them an API they can use.", [
      "GET /api/menu returns every dish, in order of id.",
      "GET /api/menu?max=2000 returns only dishes at or below that price.",
      "GET /api/menu/:id returns one dish, or 404 with an error.",
      "GET /api/menu/cheapest returns the cheapest dish.",
    ], "your milestone: your first working API that other people's apps could use."),
    menuSql, "// TODO 1: GET /api/menu (and ?max=)\n// TODO 2: GET /api/menu/cheapest\n// TODO 3: GET /api/menu/:id\n",
    `app.get("/api/menu", async (req, res) => {
  const max = Number(req.query.max || 1000000000);
  const { rows } = await db.query("SELECT * FROM menu WHERE price <= $1 ORDER BY id", [max]);
  res.json(rows);
});
app.get("/api/menu/cheapest", async (req, res) => {
  const { rows } = await db.query("SELECT * FROM menu ORDER BY price LIMIT 1");
  res.json(rows[0]);
});
app.get("/api/menu/:id", async (req, res) => {
  const { rows } = await db.query("SELECT * FROM menu WHERE id = $1", [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "Dish not found" });
  res.json(rows[0]);
});
`,
    [
      check("Lists every dish", [req("GET", "/api/menu", ok(200, ["body.length", "equals", "4"], ["body[0].name", "equals", "Jollof rice"]))]),
      check("?max=2000 gives two dishes", [req("GET", "/api/menu?max=2000", ok(200, ["body.length", "equals", "2"]))]),
      check("Gets one dish", [req("GET", "/api/menu/2", ok(200, ["body.name", "equals", "Egusi soup"]))]),
      check("A dish that doesn't exist gives 404", [req("GET", "/api/menu/99", ok(404, ["body.error", "exists"]))]),
      check("Finds the cheapest dish", [req("GET", "/api/menu/cheapest", ok(200, ["body.name", "equals", "Moi moi"]))], true, "Put /cheapest before /:id, or Express will treat it as an id."),
    ]),
  api(at(BE, "Novice", 1, "Create, read, update, delete"),
    brief("SmoothCuts, a barbing salon, needs to manage its services without calling you each time.", [
      "GET /api/services lists them. GET /api/services/:id gets one, or 404.",
      "POST /api/services adds one with a name and a price above 0: 201, or 400 if it's wrong.",
      "PUT /api/services/:id changes the name and price, or 404.",
      "DELETE /api/services/:id removes it: 204, or 404.",
    ], "the bookings API you deliver in Week 4. Services come first."),
    salonSql, "// Build the five endpoints.\n",
    `const bad = ({ name, price } = {}) => typeof name !== "string" || !name.trim() || !Number.isInteger(price) || price <= 0;
app.get("/api/services", async (req, res) => {
  const { rows } = await db.query("SELECT * FROM services ORDER BY id");
  res.json(rows);
});
app.get("/api/services/:id", async (req, res) => {
  const { rows } = await db.query("SELECT * FROM services WHERE id = $1", [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "Service not found" });
  res.json(rows[0]);
});
app.post("/api/services", async (req, res) => {
  if (bad(req.body)) return res.status(400).json({ error: "name and a price above 0 are required" });
  const { rows } = await db.query("INSERT INTO services (name, price) VALUES ($1, $2) RETURNING *", [req.body.name.trim(), req.body.price]);
  res.status(201).json(rows[0]);
});
app.put("/api/services/:id", async (req, res) => {
  if (bad(req.body)) return res.status(400).json({ error: "name and a price above 0 are required" });
  const { rows } = await db.query("UPDATE services SET name = $1, price = $2 WHERE id = $3 RETURNING *", [req.body.name.trim(), req.body.price, req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "Service not found" });
  res.json(rows[0]);
});
app.delete("/api/services/:id", async (req, res) => {
  const { rowCount } = await db.query("DELETE FROM services WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Service not found" });
  res.status(204).end();
});
`,
    [
      check("Lists and gets services", [req("GET", "/api/services", ok(200, ["body.length", "equals", "3"])), req("GET", "/api/services/2", ok(200, ["body.name", "equals", "Beard trim"]))]),
      check("Adds a service", [req("POST", "/api/services", ok(201, ["body.id", "exists"]), { name: "Kids cut", price: 2000 }, [["newId", "body.id"]]), req("GET", "/api/services/{{newId}}", ok(200, ["body.price", "equals", "2000"]))]),
      check("Changes a service", [req("PUT", "/api/services/1", ok(200, ["body.price", "equals", "3500"]), { name: "Haircut", price: 3500 })]),
      check("Removes a service", [req("DELETE", "/api/services/2", ok(204)), req("GET", "/api/services/2", ok(404))]),
      check("Refuses bad data", [req("POST", "/api/services", ok(400, ["body.error", "exists"]), { name: "", price: 2000 }), req("POST", "/api/services", ok(400), { name: "Free", price: 0 })], true, "Check for an empty name and a price of 0."),
      check("404 for a service that isn't there", [req("PUT", "/api/services/99", ok(404), { name: "Ghost", price: 100 }), req("DELETE", "/api/services/99", ok(404))], true, "Update and delete must answer 404 too."),
    ]),
  api(at(BE, "Novice", 2, "Ask the database exact questions"),
    brief("The salon owner asks questions all day. Answer each one with a single SQL query.", [
      "GET /api/reports/bookings lists every booking with customer, service (its name) and slot, in order of slot.",
      "GET /api/reports/income returns the total of all booked services as { total }.",
      "GET /api/reports/popular returns the most booked service as { name, count }.",
      "GET /api/reports/unbooked lists the names of services nobody has booked.",
    ], "the bookings API. Its owner will use these reports every week."),
    salonSql, "// Use JOIN, SUM, COUNT and GROUP BY.\n",
    `app.get("/api/reports/bookings", async (req, res) => {
  const { rows } = await db.query("SELECT b.customer, s.name AS service, b.slot FROM bookings b JOIN services s ON s.id = b.service_id ORDER BY b.slot");
  res.json(rows);
});
app.get("/api/reports/income", async (req, res) => {
  const { rows } = await db.query("SELECT SUM(s.price) AS total FROM bookings b JOIN services s ON s.id = b.service_id");
  res.json({ total: Number(rows[0].total || 0) });
});
app.get("/api/reports/popular", async (req, res) => {
  const { rows } = await db.query("SELECT s.name, COUNT(*) AS count FROM bookings b JOIN services s ON s.id = b.service_id GROUP BY s.id, s.name ORDER BY COUNT(*) DESC LIMIT 1");
  res.json({ name: rows[0].name, count: Number(rows[0].count) });
});
app.get("/api/reports/unbooked", async (req, res) => {
  const { rows } = await db.query("SELECT s.name FROM services s LEFT JOIN bookings b ON b.service_id = s.id WHERE b.id IS NULL ORDER BY s.name");
  res.json(rows.map((row) => row.name));
});
`,
    [
      check("Bookings with the service's name", [req("GET", "/api/reports/bookings", ok(200, ["body.length", "equals", "3"], ["body[0].customer", "equals", "Musa"], ["body[0].service", "equals", "Haircut"]))]),
      check("The total income", [req("GET", "/api/reports/income", ok(200, ["body.total", "equals", "14000"]))]),
      check("The most popular service", [req("GET", "/api/reports/popular", ok(200, ["body.name", "equals", "Haircut"], ["body.count", "equals", "2"]))]),
      check("Services nobody booked", [req("GET", "/api/reports/unbooked", ok(200, ["body.length", "equals", "1"], ["body[0]", "equals", "Beard trim"]))]),
      { ...check("The answers come from the data", [req("GET", "/api/reports/income", ok(200, ["body.total", "equals", "15500"]))], true, "Don't type the answers in: query for them."), setupSql: "INSERT INTO bookings (service_id, customer, slot) VALUES (2, 'Kola', '2026-12-03 12:00');" },
    ]),
  api(at(BE, "Novice", 3, "Save and fetch real bookings"),
    brief("Customers want to book online. Save their bookings so that they're still there tomorrow.", [
      "POST /api/bookings with serviceId, customer and slot saves one: 201. Answer 400 if something is missing, and 404 if the service doesn't exist.",
      "GET /api/bookings lists them in order of slot.",
      "GET /api/bookings?customer=Musa lists only that customer's.",
      "DELETE /api/bookings/:id cancels one: 204, or 404.",
    ], "the bookings API. Only the rules of the diary are left for Week 4."),
    salonSql, "// TODO: POST, GET and DELETE /api/bookings\n",
    `app.post("/api/bookings", async (req, res) => {
  const { serviceId, customer, slot } = req.body || {};
  if (!serviceId || !customer || !slot) return res.status(400).json({ error: "serviceId, customer and slot are required" });
  const service = await db.query("SELECT id FROM services WHERE id = $1", [serviceId]);
  if (!service.rows.length) return res.status(404).json({ error: "Service not found" });
  const { rows } = await db.query("INSERT INTO bookings (service_id, customer, slot) VALUES ($1, $2, $3) RETURNING *", [serviceId, customer, slot]);
  res.status(201).json(rows[0]);
});
app.get("/api/bookings", async (req, res) => {
  const { rows } = req.query.customer
    ? await db.query("SELECT * FROM bookings WHERE customer = $1 ORDER BY slot", [req.query.customer])
    : await db.query("SELECT * FROM bookings ORDER BY slot");
  res.json(rows);
});
app.delete("/api/bookings/:id", async (req, res) => {
  const { rowCount } = await db.query("DELETE FROM bookings WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Booking not found" });
  res.status(204).end();
});
`,
    [
      check("Saves a booking", [req("POST", "/api/bookings", ok(201, ["body.id", "exists"]), { serviceId: 2, customer: "Ada", slot: "2026-12-03 10:00" }), req("GET", "/api/bookings?customer=Ada", ok(200, ["body.length", "equals", "1"]))]),
      check("Lists bookings in order", [req("GET", "/api/bookings", ok(200, ["body.length", "equals", "3"], ["body[0].customer", "equals", "Musa"]))]),
      check("Cancels a booking", [req("DELETE", "/api/bookings/1", ok(204)), req("GET", "/api/bookings", ok(200, ["body.length", "equals", "2"]))]),
      check("Refuses a booking with no customer", [req("POST", "/api/bookings", ok(400, ["body.error", "exists"]), { serviceId: 1, slot: "2026-12-03 10:00" })]),
      check("404 for a service that isn't there", [req("POST", "/api/bookings", ok(404), { serviceId: 99, customer: "Ada", slot: "2026-12-03 10:00" })], true, "Look the service up before saving."),
      check("A name with a quote in it is safe", [req("GET", "/api/bookings?customer=O'Neil", ok(200, ["body.length", "equals", "0"]))], true, "Use $1 in your SQL, never join strings."),
    ]),
  api(at(BE, "Novice", 4, "Deliver the bookings API"),
    brief("Capstone. Deliver SmoothCuts' bookings API, ready for another developer to build an app on.", [
      "POST /api/bookings: 201, 400 if something is missing, 404 if the service doesn't exist, and 409 if that slot is already taken.",
      "GET /api/bookings lists each booking with customer, slot and service (its name).",
      "GET /api/bookings/:id gets one, or 404. DELETE /api/bookings/:id cancels it: 204, or 404.",
      "GET /api/docs returns { endpoints: [...] } with at least four endpoints, each with method, path and description.",
    ], "your milestone: a documented bookings API with a real database behind it."),
    salonSql, "// Build the whole API.\n",
    `const LIST = "SELECT b.id, b.customer, b.slot, s.name AS service FROM bookings b JOIN services s ON s.id = b.service_id";
app.get("/api/docs", (req, res) => {
  res.json({ endpoints: [
    { method: "GET", path: "/api/bookings", description: "List bookings" },
    { method: "GET", path: "/api/bookings/:id", description: "Get one booking" },
    { method: "POST", path: "/api/bookings", description: "Book a slot" },
    { method: "DELETE", path: "/api/bookings/:id", description: "Cancel a booking" },
  ] });
});
app.get("/api/bookings", async (req, res) => {
  const { rows } = await db.query(LIST + " ORDER BY b.slot");
  res.json(rows);
});
app.get("/api/bookings/:id", async (req, res) => {
  const { rows } = await db.query(LIST + " WHERE b.id = $1", [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "Booking not found" });
  res.json(rows[0]);
});
app.post("/api/bookings", async (req, res) => {
  const { serviceId, customer, slot } = req.body || {};
  if (!serviceId || !customer || !slot) return res.status(400).json({ error: "serviceId, customer and slot are required" });
  const service = await db.query("SELECT id FROM services WHERE id = $1", [serviceId]);
  if (!service.rows.length) return res.status(404).json({ error: "Service not found" });
  const taken = await db.query("SELECT id FROM bookings WHERE slot = $1", [slot]);
  if (taken.rows.length) return res.status(409).json({ error: "That slot is taken" });
  const { rows } = await db.query("INSERT INTO bookings (service_id, customer, slot) VALUES ($1, $2, $3) RETURNING *", [serviceId, customer, slot]);
  res.status(201).json(rows[0]);
});
app.delete("/api/bookings/:id", async (req, res) => {
  const { rowCount } = await db.query("DELETE FROM bookings WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Booking not found" });
  res.status(204).end();
});
`,
    [
      check("Lists bookings with the service's name", [req("GET", "/api/bookings", ok(200, ["body.length", "equals", "3"], ["body[0].service", "equals", "Haircut"]))]),
      check("Books a free slot", [req("POST", "/api/bookings", ok(201, ["body.id", "exists"]), { serviceId: 1, customer: "Ada", slot: "2026-12-05 10:00" }, [["newId", "body.id"]]), req("GET", "/api/bookings/{{newId}}", ok(200, ["body.customer", "equals", "Ada"]))]),
      check("A taken slot gives 409", [req("POST", "/api/bookings", ok(409, ["body.error", "exists"]), { serviceId: 2, customer: "Ada", slot: "2026-12-01 10:00" })]),
      check("Missing details and missing services are refused", [req("POST", "/api/bookings", ok(400), { customer: "Ada" }), req("POST", "/api/bookings", ok(404), { serviceId: 99, customer: "Ada", slot: "2026-12-06 10:00" })]),
      check("Cancels, and frees the slot", [req("DELETE", "/api/bookings/1", ok(204)), req("POST", "/api/bookings", ok(201), { serviceId: 2, customer: "Ada", slot: "2026-12-01 10:00" })], true, "After a booking is cancelled, its slot can be booked again."),
      check("Documented", [req("GET", "/api/docs", ok(200, ["body.endpoints[3].method", "exists"], ["body.endpoints[3].path", "exists"], ["body.endpoints[3].description", "exists"]))]),
    ]),
  api(at("Cybersecurity", "Novice", 3, "Close the holes in a live API"),
    brief("Kubwa Pharmacy's customer lookup was written in a hurry. Anyone can read everyone's PIN, and one odd search dumps the whole table. Find the weaknesses, then fix them.", [
      "GET /api/customers?phone= must be safe from SQL injection.",
      "Never send a PIN back, in any reply.",
      "With no phone number, answer 400. Don't return everyone.",
      "POST /api/login must check phone and PIN safely, and answer 401 with the error Phone or PIN is wrong, whichever one is wrong.",
    ], "the audit you write in Week 4. You'll report these holes as fixed."),
    usersSql,
    `// This code has security holes. Find and fix them.
app.get("/api/customers", async (req, res) => {
  const { rows } = await db.query("SELECT * FROM customers WHERE phone LIKE '%" + (req.query.phone || "") + "%'");
  res.json(rows);
});
app.post("/api/login", async (req, res) => {
  const { rows } = await db.query("SELECT * FROM customers WHERE phone = '" + req.body.phone + "'");
  if (!rows.length) return res.status(401).json({ error: "No such phone" });
  if (rows[0].pin !== req.body.pin) return res.status(401).json({ error: "Wrong PIN" });
  res.json(rows[0]);
});
`,
    `app.get("/api/customers", async (req, res) => {
  if (!req.query.phone) return res.status(400).json({ error: "phone is required" });
  const { rows } = await db.query("SELECT id, name, phone FROM customers WHERE phone = $1", [req.query.phone]);
  res.json(rows);
});
app.post("/api/login", async (req, res) => {
  const { phone, pin } = req.body || {};
  const { rows } = await db.query("SELECT id, name, phone, pin FROM customers WHERE phone = $1", [String(phone || "")]);
  if (!rows.length || rows[0].pin !== pin) return res.status(401).json({ error: "Phone or PIN is wrong" });
  res.json({ id: rows[0].id, name: rows[0].name, phone: rows[0].phone });
});
`,
    [
      check("Finds one customer by phone", [req("GET", "/api/customers?phone=08030000002", ok(200, ["body.length", "equals", "1"], ["body[0].name", "equals", "Bola"]))]),
      check("A PIN is never sent back", [req("GET", "/api/customers?phone=08030000002", ok(200, ["body[0].pin", "absent"])), req("POST", "/api/login", ok(200, ["body.name", "equals", "Amina"], ["body.pin", "absent"]), { phone: "08030000001", pin: "4821" })]),
      check("No phone number gives 400", [req("GET", "/api/customers", ok(400, ["body.error", "exists"]))]),
      check("SQL injection finds nothing", [req("GET", "/api/customers?phone=%27%20OR%20%271%27%3D%271", ok(200, ["body.length", "equals", "0"]))], true, "Use $1 in the query. Never join what people type into SQL."),
      check("Login can't be tricked", [req("POST", "/api/login", ok(401), { phone: "' OR '1'='1", pin: "4821" })], true, "The same rule applies to the login query."),
      check("Wrong phone and wrong PIN look the same", [
        req("POST", "/api/login", ok(401, ["body.error", "equals", "Phone or PIN is wrong"]), { phone: "00000000000", pin: "1" }),
        req("POST", "/api/login", ok(401, ["body.error", "equals", "Phone or PIN is wrong"]), { phone: "08030000001", pin: "0000" }),
      ], true, "Different messages tell an attacker which phones exist."),
    ]),
];

export const CODE: LabExercise[] = [...WEB, ...BACKEND];

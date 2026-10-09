// WordPress development exercises (pure; safe in the browser).
//
// Each intern gets a real WordPress site running in their browser
// (WordPress Playground: WordPress and PHP compiled to WebAssembly, loaded
// from playground.wordpress.net), set up the way the exercise says: a
// WordPress and PHP version, a theme, plugins, starter files and a PHP
// setup script. They build in the real dashboard and can write themes and
// plugins in a file editor. Checks inspect the site by running PHP inside
// it (or by loading a page), so they can test anything WordPress can tell
// you, from the site title to a custom plugin's shortcode.
//
// The site never touches our servers or database: it lives in the intern's
// browser (saved there between visits). Only check results, a summary of
// the site and the files they wrote are sent when they submit.

export type WpCheckType =
  | "option"
  | "page"
  | "post_count"
  | "plugin_active"
  | "theme_active"
  | "child_theme"
  | "menu"
  | "front_page"
  | "term"
  | "users"
  | "post_type"
  | "taxonomy"
  | "shortcode"
  | "block"
  | "file"
  | "page_html"
  | "php";

/** One field a check type needs, for the admin editor. */
type Field = { key: string; label: string; placeholder?: string; multiline?: boolean; optional?: boolean };

export const CHECK_TYPES: Record<WpCheckType, { label: string; fields: Field[] }> = {
  option: {
    label: "Site setting has a value",
    fields: [
      { key: "option", label: "Setting (option name)", placeholder: "blogname" },
      { key: "value", label: "Should contain (empty = just set)", placeholder: "Mama Put Kitchen", optional: true },
    ],
  },
  page: {
    label: "A page or post exists",
    fields: [
      { key: "title", label: "Title", placeholder: "About Us" },
      { key: "postType", label: "Post type", placeholder: "page", optional: true },
      { key: "contains", label: "Its content contains (optional)", placeholder: "jollof", optional: true },
    ],
  },
  post_count: {
    label: "At least N published items",
    fields: [
      { key: "postType", label: "Post type", placeholder: "post" },
      { key: "min", label: "At least", placeholder: "3" },
    ],
  },
  plugin_active: {
    label: "A plugin is active",
    fields: [{ key: "slug", label: "Plugin folder (slug)", placeholder: "contact-form-7" }],
  },
  theme_active: {
    label: "A theme is active",
    fields: [{ key: "slug", label: "Theme folder (slug)", placeholder: "twentytwentyfour" }],
  },
  child_theme: {
    label: "A child theme is active",
    fields: [{ key: "parent", label: "Parent theme (optional)", placeholder: "twentytwentyfour", optional: true }],
  },
  menu: {
    label: "A navigation menu",
    fields: [
      { key: "minItems", label: "At least N items", placeholder: "3" },
      { key: "includes", label: "Includes these (comma separated, optional)", placeholder: "Home, About, Contact", optional: true },
    ],
  },
  front_page: {
    label: "Homepage is a static page",
    fields: [{ key: "title", label: "Page title (optional)", placeholder: "Home", optional: true }],
  },
  term: {
    label: "A category or tag exists",
    fields: [
      { key: "name", label: "Name", placeholder: "Recipes" },
      { key: "taxonomy", label: "Taxonomy", placeholder: "category", optional: true },
    ],
  },
  users: {
    label: "Users with a role",
    fields: [
      { key: "role", label: "Role", placeholder: "editor" },
      { key: "min", label: "At least", placeholder: "1" },
    ],
  },
  post_type: {
    label: "A custom post type is registered",
    fields: [{ key: "name", label: "Post type", placeholder: "event" }],
  },
  taxonomy: {
    label: "A custom taxonomy is registered",
    fields: [{ key: "name", label: "Taxonomy", placeholder: "event_type" }],
  },
  shortcode: {
    label: "A shortcode works",
    fields: [
      { key: "tag", label: "Shortcode", placeholder: "opening_hours" },
      { key: "contains", label: "Its output contains (optional)", placeholder: "Monday", optional: true },
    ],
  },
  block: {
    label: "A block is registered",
    fields: [{ key: "name", label: "Block name", placeholder: "mama-put/menu-card" }],
  },
  file: {
    label: "A file exists in wp-content",
    fields: [
      { key: "path", label: "Path inside wp-content", placeholder: "themes/kitchen-child/style.css" },
      { key: "contains", label: "Contains (optional)", placeholder: "Template: twentytwentyfour", optional: true },
    ],
  },
  page_html: {
    label: "A page shows something",
    fields: [
      { key: "path", label: "Page address", placeholder: "/about-us/" },
      { key: "contains", label: "The page contains", placeholder: "Our story" },
    ],
  },
  php: {
    label: "Custom check (PHP)",
    fields: [
      {
        key: "code",
        label: "PHP that returns true to pass (WordPress is loaded)",
        placeholder: "return get_option('posts_per_page') == 6;",
        multiline: true,
      },
    ],
  },
};

export type WpCheck = {
  id: string;
  label: string;
  type: WpCheckType;
  params: Record<string, string>;
};

export type WpConfig = {
  wpVersion: string;
  phpVersion: string;
  /** Where the site opens, e.g. /wp-admin/. */
  landingPage: string;
  /** A wordpress.org theme to install and activate ("" = WordPress's default). */
  theme: string;
  /** wordpress.org plugins to install and activate. */
  plugins: string[];
  /** Files written into wp-content before the intern starts (path → contents). */
  files: Record<string, string>;
  /** PHP run once on a fresh site (WordPress loaded): starter content, settings. */
  setupPhp: string;
  checks: WpCheck[];
};

export type WpCheckResult = { label: string; passed: boolean; detail?: string };

/** What mentors see of the intern's site when they submit. */
export type WpSiteSummary = {
  title: string;
  tagline: string;
  theme: string;
  plugins: string[];
  pages: string[];
  posts: number;
  menus: Array<{ name: string; items: string[] }>;
};

export const PHP_VERSIONS = ["8.3", "8.2", "8.1", "8.0", "7.4"];
export const DOC_ROOT = "/wordpress";
export const WP_CONTENT = `${DOC_ROOT}/wp-content`;
const MAX_CHECKS = 40;
const MAX_FILES = 30;
const MAX_FILE_CHARS = 100_000;

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");
const slug = (value: unknown) => text(value, 100).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
const object = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

export function newCheckId() {
  return Math.random().toString(36).slice(2, 10);
}

/** A path inside wp-content that can't climb out of it. */
export function safeContentPath(path: string) {
  const parts = path.replace(/\\/g, "/").split("/").filter((part) => part && part !== ".");
  if (!parts.length || parts.some((part) => part === "..")) return null;
  const joined = parts.join("/");
  return /^[\w.@/-]+$/.test(joined) ? joined : null;
}

export function parseWpConfig(value: unknown): WpConfig {
  if (!value || typeof value !== "object") return DEFAULT_WP_CONFIG;
  const raw = object(value);
  const files: Record<string, string> = {};
  for (const [path, contents] of Object.entries(object(raw.files)).slice(0, MAX_FILES)) {
    const safe = safeContentPath(path);
    if (safe && typeof contents === "string") files[safe] = contents.slice(0, MAX_FILE_CHARS);
  }
  const wpVersion = text(raw.wpVersion, 10).trim();
  const phpVersion = text(raw.phpVersion, 5);
  return {
    wpVersion: /^(latest|\d+\.\d+(\.\d+)?)$/.test(wpVersion) ? wpVersion : "latest",
    phpVersion: PHP_VERSIONS.includes(phpVersion) ? phpVersion : "8.3",
    landingPage: text(raw.landingPage, 200).startsWith("/") ? text(raw.landingPage, 200) : "/wp-admin/",
    theme: slug(raw.theme),
    plugins: Array.isArray(raw.plugins) ? [...new Set(raw.plugins.map(slug).filter(Boolean))].slice(0, 15) : [],
    files,
    setupPhp: text(raw.setupPhp, 50_000),
    checks: (Array.isArray(raw.checks) ? raw.checks : []).slice(0, MAX_CHECKS).map((item) => {
      const check = object(item);
      const type = (Object.keys(CHECK_TYPES) as WpCheckType[]).includes(check.type as WpCheckType)
        ? (check.type as WpCheckType)
        : "option";
      const params = object(check.params);
      return {
        id: text(check.id, 20) || newCheckId(),
        label: text(check.label, 200).trim() || CHECK_TYPES[type].label,
        type,
        params: Object.fromEntries(
          CHECK_TYPES[type].fields.map((field) => [field.key, text(params[field.key], field.multiline ? 5000 : 300)]),
        ),
      };
    }),
  };
}

/** What makes an exercise unusable; empty when it's ready. */
export function wpConfigProblems(config: WpConfig) {
  const problems: string[] = [];
  if (!config.checks.length) problems.push("Add at least one check.");
  // Results are matched to checks by label.
  const labels = config.checks.map((check) => check.label.trim().toLowerCase());
  if (new Set(labels).size !== labels.length) problems.push("Give every check a different label.");
  for (const check of config.checks)
    for (const field of CHECK_TYPES[check.type].fields)
      if (!field.optional && !check.params[field.key]?.trim())
        problems.push(`“${check.label}” needs ${field.label.toLowerCase()}.`);
  return problems;
}

// ---------------------------------------------------------------------------
// The site
// ---------------------------------------------------------------------------

/** The Playground blueprint that builds the exercise's fresh site. */
export function blueprintFor(config: WpConfig, fresh: boolean) {
  const steps: Array<Record<string, unknown>> = [];
  if (fresh) {
    if (config.theme)
      steps.push({
        step: "installTheme",
        themeData: { resource: "wordpress.org/themes", slug: config.theme },
        options: { activate: true },
      });
    for (const plugin of config.plugins)
      steps.push({
        step: "installPlugin",
        pluginData: { resource: "wordpress.org/plugins", slug: plugin },
        options: { activate: true },
      });
    // Folders first (mkdir makes the whole path), then the files.
    const folders = new Set(
      Object.keys(config.files)
        .filter((path) => path.includes("/"))
        .map((path) => path.slice(0, path.lastIndexOf("/"))),
    );
    for (const folder of folders) steps.push({ step: "mkdir", path: `${WP_CONTENT}/${folder}` });
    for (const [path, contents] of Object.entries(config.files))
      steps.push({ step: "writeFile", path: `${WP_CONTENT}/${path}`, data: contents });
    if (config.setupPhp.trim())
      steps.push({
        step: "runPHP",
        code: `<?php require_once '${DOC_ROOT}/wp-load.php'; ${stripOpenTag(config.setupPhp)}`,
      });
  }
  return {
    preferredVersions: { php: config.phpVersion, wp: config.wpVersion },
    features: { networking: true },
    landingPage: config.landingPage,
    login: true,
    steps,
  };
}

function stripOpenTag(code: string) {
  return code.replace(/^\s*<\?php/, "");
}

/** A PHP single-quoted string. */
export function phpString(value: string) {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/** The body of one check: PHP returning [passed, detail]. */
function checkPhp(check: WpCheck): string | null {
  const p = check.params;
  const s = (key: string) => phpString((p[key] ?? "").trim());
  const n = (key: string) => Math.max(0, Math.floor(Number(p[key]) || 0));
  switch (check.type) {
    case "option":
      return `$v = get_option(${s("option")}); $v = is_scalar($v) ? (string) $v : wp_json_encode($v);
        $want = ${s("value")};
        return [$want === '' ? $v !== '' : stripos($v, $want) !== false, 'Currently: ' . ($v === '' ? '(empty)' : $v)];`;
    case "page":
      return `$found = get_posts(['post_type' => ${s("postType")} ?: 'page', 'title' => ${s("title")}, 'post_status' => 'publish', 'numberposts' => 1]);
        if (!$found) {
          foreach (get_posts(['post_type' => ${s("postType")} ?: 'page', 'post_status' => 'publish', 'numberposts' => 200]) as $post)
            if (strcasecmp(trim($post->post_title), ${s("title")}) === 0) { $found = [$post]; break; }
        }
        if (!$found) return [false, 'No published item with that title.'];
        $want = ${s("contains")};
        if ($want !== '' && stripos($found[0]->post_content, $want) === false) return [false, 'It exists, but its content doesn\\'t include that.'];
        return [true, 'Found.'];`;
    case "post_count":
      return `$c = wp_count_posts(${s("postType")}); $have = isset($c->publish) ? (int) $c->publish : 0;
        return [$have >= ${n("min")}, "Published: $have"];`;
    case "plugin_active":
      return `$slug = ${s("slug")}; $active = (array) get_option('active_plugins', []);
        foreach ($active as $file) if (strpos($file, $slug . '/') === 0 || $file === $slug . '.php') return [true, 'Active.'];
        return [false, 'Active plugins: ' . (implode(', ', array_map(fn($f) => dirname($f) === '.' ? $f : dirname($f), $active)) ?: 'none')];`;
    case "theme_active":
      return `return [get_stylesheet() === ${s("slug")}, 'Active theme: ' . get_stylesheet()];`;
    case "child_theme":
      return `$child = get_stylesheet() !== get_template(); $parent = ${s("parent")};
        if (!$child) return [false, 'The active theme (' . get_stylesheet() . ') isn\\'t a child theme.'];
        return [$parent === '' || get_template() === $parent, 'Child theme ' . get_stylesheet() . ' of ' . get_template()];`;
    case "menu":
      return `$best = 0; $names = [];
        $want = array_filter(array_map('trim', explode(',', ${s("includes")})));
        foreach (wp_get_nav_menus() as $menu) {
          $items = wp_get_nav_menu_items($menu->term_id) ?: [];
          $titles = array_map(fn($i) => strtolower(trim($i->title)), $items);
          $missing = array_filter($want, fn($w) => !in_array(strtolower($w), $titles, true));
          if (count($items) >= ${n("minItems")} && !$missing) return [true, $menu->name . ': ' . implode(', ', array_map(fn($i) => $i->title, $items))];
          $best = max($best, count($items)); $names[] = $menu->name;
        }
        // Block themes keep navigation in wp_navigation posts.
        foreach (get_posts(['post_type' => 'wp_navigation', 'numberposts' => 20, 'post_status' => 'publish']) as $nav) {
          preg_match_all('/"label":"([^"]*)"/', $nav->post_content, $m);
          $labels = array_map(fn($l) => strtolower(trim(json_decode('"' . $l . '"') ?? $l)), $m[1]);
          $missing = array_filter($want, fn($w) => !in_array(strtolower($w), $labels, true));
          if (count($labels) >= ${n("minItems")} && !$missing) return [true, 'Navigation: ' . implode(', ', $m[1])];
          $best = max($best, count($labels));
        }
        return [false, $names ? "Largest menu has $best items." : 'No menus yet.'];`;
    case "front_page":
      return `if (get_option('show_on_front') !== 'page') return [false, 'The homepage shows your latest posts.'];
        $title = get_the_title((int) get_option('page_on_front')); $want = ${s("title")};
        return [$want === '' || strcasecmp(trim($title), $want) === 0, "Homepage: $title"];`;
    case "term":
      return `$t = term_exists(${s("name")}, ${s("taxonomy")} ?: 'category'); return [(bool) $t, $t ? 'Found.' : 'Not found.'];`;
    case "users":
      return `$c = count(get_users(['role' => ${s("role")}, 'fields' => 'ID'])); return [$c >= ${n("min")}, "Users with that role: $c"];`;
    case "post_type":
      return `return [post_type_exists(${s("name")}), post_type_exists(${s("name")}) ? 'Registered.' : 'Not registered.'];`;
    case "taxonomy":
      return `return [taxonomy_exists(${s("name")}), taxonomy_exists(${s("name")}) ? 'Registered.' : 'Not registered.'];`;
    case "shortcode":
      return `$tag = ${s("tag")}; if (!shortcode_exists($tag)) return [false, "No [$tag] shortcode is registered."];
        $out = do_shortcode("[$tag]"); $want = ${s("contains")};
        return [$want === '' || stripos($out, $want) !== false, 'Output: ' . substr(wp_strip_all_tags($out), 0, 160)];`;
    case "block":
      return `$ok = WP_Block_Type_Registry::get_instance()->is_registered(${s("name")}); return [$ok, $ok ? 'Registered.' : 'Not registered.'];`;
    case "file": {
      const path = safeContentPath(p.path ?? "");
      if (!path) return `return [false, 'The check has an invalid path.'];`;
      return `$f = WP_CONTENT_DIR . '/' . ${phpString(path)};
        if (!file_exists($f)) return [false, 'Not found.'];
        $want = ${s("contains")};
        return [$want === '' || stripos(file_get_contents($f), $want) !== false, $want === '' ? 'Found.' : 'Found; checked its contents.'];`;
    }
    case "php":
      return `$fn = function () { ${stripOpenTag(p.code ?? "")} };
        $r = $fn(); return [(bool) $r, $r ? '' : 'Returned false.'];`;
    case "page_html":
      return null; // Loaded as a page in the browser instead.
  }
}

/** One PHP script that runs every PHP check and prints the results as JSON. */
export function checksScript(checks: WpCheck[]) {
  const body = checks
    .map((check) => {
      const php = checkPhp(check);
      return php === null
        ? ""
        : `grouh_check(${phpString(check.id)}, function () { ${php} });`;
    })
    .join("\n");
  return `<?php
require_once '${DOC_ROOT}/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';
$grouh_results = [];
function grouh_check($id, $fn) {
  global $grouh_results;
  try {
    $r = $fn();
    $grouh_results[$id] = is_array($r) ? [(bool) $r[0], (string) ($r[1] ?? '')] : [(bool) $r, ''];
  } catch (\\Throwable $e) {
    $grouh_results[$id] = [false, 'Error: ' . $e->getMessage()];
  }
}
${body}
echo "\\n__GROUH__" . wp_json_encode($grouh_results);
`;
}

/** Reads the checks script's output (anything printed before it is ignored). */
export function parseChecksOutput(output: string, checks: WpCheck[]): WpCheckResult[] {
  const marker = output.lastIndexOf("__GROUH__");
  let data: Record<string, [boolean, string]> = {};
  if (marker !== -1)
    try {
      data = JSON.parse(output.slice(marker + "__GROUH__".length));
    } catch {
      data = {};
    }
  return checks
    .filter((check) => check.type !== "page_html")
    .map((check) => {
      const result = data[check.id];
      return result
        ? { label: check.label, passed: result[0] === true, detail: result[1] || undefined }
        : { label: check.label, passed: false, detail: "This check couldn't run. Is there a PHP error on the site?" };
    });
}

/** A PHP script that describes the site for mentors. */
export const SUMMARY_SCRIPT = `<?php
require_once '${DOC_ROOT}/wp-load.php';
$menus = [];
foreach (wp_get_nav_menus() as $menu)
  $menus[] = ['name' => $menu->name, 'items' => array_map(fn($i) => $i->title, wp_get_nav_menu_items($menu->term_id) ?: [])];
echo "\\n__GROUH__" . wp_json_encode([
  'title' => get_option('blogname'),
  'tagline' => get_option('blogdescription'),
  'theme' => get_stylesheet() . (get_stylesheet() !== get_template() ? ' (child of ' . get_template() . ')' : ''),
  'plugins' => array_values(array_map(fn($f) => dirname($f) === '.' ? $f : dirname($f), (array) get_option('active_plugins', []))),
  'pages' => array_map(fn($p) => $p->post_title, get_posts(['post_type' => 'page', 'numberposts' => 50, 'post_status' => 'publish'])),
  'posts' => (int) wp_count_posts('post')->publish,
  'menus' => $menus,
]);
`;

export function parseSummary(output: string): WpSiteSummary | null {
  const marker = output.lastIndexOf("__GROUH__");
  if (marker === -1) return null;
  try {
    return normalizeSummary(JSON.parse(output.slice(marker + "__GROUH__".length)));
  } catch {
    return null;
  }
}

const list = (value: unknown, max: number) => (Array.isArray(value) ? value.slice(0, max) : []);

/** A site summary from anywhere (the site itself, or a submission). */
export function normalizeSummary(value: unknown): WpSiteSummary | null {
  if (!value || typeof value !== "object") return null;
  const raw = object(value);
  return {
    title: String(raw.title ?? "").slice(0, 200),
    tagline: String(raw.tagline ?? "").slice(0, 300),
    theme: String(raw.theme ?? "").slice(0, 200),
    plugins: list(raw.plugins, 50).map((p) => String(p).slice(0, 100)),
    pages: list(raw.pages, 50).map((p) => String(p).slice(0, 200)),
    posts: Number(raw.posts) || 0,
    menus: list(raw.menus, 10).map((m) => ({
      name: String(object(m).name ?? "").slice(0, 100),
      items: list(object(m).items, 30).map((i) => String(i).slice(0, 100)),
    })),
  };
}

/** What's kept of a submission: the site summary and the intern's own files. */
export type WpWork = { summary: WpSiteSummary | null; files: Record<string, string> };

const MAX_WORK_FILES = 10;
const MAX_WORK_FILE_CHARS = 30_000;

export function parseWpWork(value: unknown): WpWork {
  const raw = object(value);
  const files: Record<string, string> = {};
  for (const [path, contents] of Object.entries(object(raw.files)).slice(0, MAX_WORK_FILES)) {
    const safe = safeContentPath(path);
    if (safe && typeof contents === "string") files[safe] = contents.slice(0, MAX_WORK_FILE_CHARS);
  }
  return { summary: normalizeSummary(raw.summary), files };
}

/** Check results as sent from the intern's browser, tidied. */
export function parseWpResults(value: unknown): WpCheckResult[] {
  return list(value, MAX_CHECKS)
    .map(object)
    .filter((item) => typeof item.label === "string" && typeof item.passed === "boolean")
    .map((item) => ({
      label: String(item.label).slice(0, 200),
      passed: item.passed as boolean,
      ...(typeof item.detail === "string" ? { detail: item.detail.slice(0, 300) } : {}),
    }));
}

/** The intern's site, written out for a mentor. */
export function describeWpWork(work: WpWork) {
  const s = work.summary;
  const site = s
    ? [
        `Site title: ${s.title || "(none)"}${s.tagline ? ` · Tagline: ${s.tagline}` : ""}`,
        `Theme: ${s.theme || "(unknown)"}${s.plugins.length ? ` · Plugins: ${s.plugins.join(", ")}` : ""}`,
        `Pages: ${s.pages.length ? s.pages.join(", ") : "none"} · Posts: ${s.posts}`,
        ...s.menus.map((m) => `Menu “${m.name}”: ${m.items.join(", ") || "(empty)"}`),
      ].join("\n")
    : "(The site summary couldn't be read.)";
  const files = Object.entries(work.files)
    .map(([path, contents]) => `\n--- wp-content/${path} ---\n${contents}`)
    .join("\n");
  return `${site}${files ? `\n${files}` : ""}`;
}

/** Whether a page's HTML passes a page_html check. */
export function pageHtmlPasses(html: string, contains: string) {
  const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  return plain.toLowerCase().includes(contains.trim().toLowerCase());
}

/** What interns may see: the setup and the checks (labels and what they test). */
export function publicWpConfig(config: WpConfig) {
  return config;
}

// ---------------------------------------------------------------------------
// Example exercise
// ---------------------------------------------------------------------------

const check = (label: string, type: WpCheckType, params: Record<string, string>): WpCheck => ({
  id: newCheckId(),
  label,
  type,
  params,
});

export const DEFAULT_WP_CONFIG: WpConfig = {
  wpVersion: "latest",
  phpVersion: "8.3",
  landingPage: "/wp-admin/",
  theme: "",
  plugins: [],
  files: {},
  setupPhp: `// Runs once on a fresh site, with WordPress loaded.
update_option('blogname', 'My WordPress Site');
wp_delete_post(1, true); // the "Hello world!" post
wp_delete_post(2, true); // the sample page`,
  checks: [
    check("Site title is “Mama Put Kitchen”", "option", { option: "blogname", value: "Mama Put Kitchen" }),
    check("Tagline is set", "option", { option: "blogdescription", value: "" }),
    check("An “About Us” page", "page", { title: "About Us", postType: "page", contains: "" }),
    check("A “Menu” page that mentions jollof", "page", { title: "Menu", postType: "page", contains: "jollof" }),
    check("A “Contact” page", "page", { title: "Contact", postType: "page", contains: "" }),
    check("The homepage is a static “Home” page", "front_page", { title: "Home" }),
    check("A navigation menu with Home, About Us, Menu and Contact", "menu", {
      minItems: "4",
      includes: "Home, About Us, Menu, Contact",
    }),
    check("Post-name permalinks (e.g. /about-us/)", "option", { option: "permalink_structure", value: "%postname%" }),
    check("A custom plugin adds an [opening_hours] shortcode showing Monday", "shortcode", {
      tag: "opening_hours",
      contains: "Monday",
    }),
    check("The About Us page loads at /about-us/", "page_html", { path: "/about-us/", contains: "About Us" }),
  ],
};

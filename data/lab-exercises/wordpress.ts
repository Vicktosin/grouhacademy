import { brief, type LabExercise } from "./helpers";

// WordPress exercises, done on a real WordPress site in the browser.

type Check = [label: string, type: string, params: Record<string, string>];

const base = (name: string, tagline: string, extra = "") => `update_option('blogname', '${name}');
update_option('blogdescription', '${tagline}');
update_option('permalink_structure', '/%postname%/');
wp_delete_post(1, true);
wp_delete_post(2, true);
${extra}
flush_rewrite_rules();`;

const page = (title: string, content = "") => `wp_insert_post(['post_title' => '${title}', 'post_type' => 'page', 'post_status' => 'publish', 'post_content' => '${content}']);`;
const farm = base("Abuja Fresh Farms", "Fresh vegetables and eggs, delivered in Abuja", [page("Home", "Welcome to Abuja Fresh Farms."), page("About Us", "We grow vegetables in Abuja."), page("Contact", "Call us.")].join("\n"));
const builders = (pages: string[]) => base("Kola and Sons", "Builders in Abuja", pages.map((title) => page(title)).join("\n"));

function wp(level: string, week: number, title: string, text: string, setupPhp: string, checks: Check[]): LabExercise {
  return {
    track: "WordPress Development",
    level,
    week,
    title,
    kind: "WORDPRESS",
    brief: text,
    config: {
      wpVersion: "latest",
      phpVersion: "8.3",
      landingPage: "/wp-admin/",
      theme: "",
      plugins: [],
      files: {},
      setupPhp,
      checks: checks.map(([label, type, params], index) => ({ id: `c${index + 1}`, label, type, params })),
    },
  };
}

export const WORDPRESS: LabExercise[] = [
  wp("Beginner", 3, "Pages, pictures and a menu",
    brief("Abuja Fresh Farms has a site, but visitors get lost. Fill it and give it a menu that makes sense.", [
      "Create a Shop page that lists at least three products with prices.",
      "Upload at least two pictures to the Media Library.",
      "Write real words on Contact, including a phone number that starts with 080.",
      "Build a menu with Home, Shop, About Us and Contact, in that order.",
    ], "the small website you finish in Week 4."),
    farm,
    [
      ["A Shop page with prices", "page", { title: "Shop", postType: "page", contains: "N" }],
      ["The Shop page lists at least three products", "php", { code: "$p = get_page_by_path('shop'); if (!$p) return false; $t = $p->post_content; return preg_match_all('/N\\s?[0-9][0-9,]{2,}/', $t) >= 3;" }],
      ["At least two pictures in the Media Library", "php", { code: "return count(get_posts(['post_type' => 'attachment', 'post_mime_type' => 'image', 'post_status' => 'inherit', 'numberposts' => -1])) >= 2;" }],
      ["Contact has a phone number", "page", { title: "Contact", postType: "page", contains: "080" }],
      ["The menu has Home, Shop, About Us and Contact", "menu", { minItems: "4", includes: "Home, Shop, About Us, Contact" }],
    ]),
  wp("Beginner", 4, "Give the farm its own look",
    brief("The site works, but it looks like everyone else's. Finish it so that the owner is proud to share it.", [
      "Set the tagline so that it says what the farm does in Abuja.",
      "Choose Home as the homepage.",
      "Change the look in the Site Editor: colours, fonts or the header, and save it.",
      "Write at least 60 words on Home that welcome a customer.",
      "Make sure that the menu includes Home and Contact.",
    ], "your milestone: a small website you built, filled and styled yourself."),
    farm,
    [
      ["The tagline mentions Abuja", "option", { option: "blogdescription", value: "Abuja" }],
      ["Home is the homepage", "front_page", { title: "Home" }],
      ["Home has at least 60 words", "php", { code: "$p = get_page_by_path('home'); return $p && str_word_count(wp_strip_all_tags($p->post_content)) >= 60;" }],
      ["You saved changes to the look", "php", { code: "foreach (['wp_global_styles', 'wp_template', 'wp_template_part'] as $t) { foreach (get_posts(['post_type' => $t, 'post_status' => 'any', 'numberposts' => -1]) as $p) { if ($t !== 'wp_global_styles' || strlen($p->post_content) > 80) return true; } } return false;" }],
      ["The menu has Home and Contact", "menu", { minItems: "2", includes: "Home, Contact" }],
    ]),
  wp("Novice", 1, "A home page that gets calls",
    brief("Kola and Sons, builders in Abuja, want a home page that makes people call.", [
      "Use blocks to build Home: a heading, a picture or cover, at least one button and at least two columns.",
      "Say what they build, where, and why to trust them, in at least 80 words.",
      "Make Home the homepage.",
    ], "the complete business site you hand over in Week 4."),
    builders(["Home"]),
    [
      ["Home is the homepage", "front_page", { title: "Home" }],
      ["Home has a heading block", "php", { code: "$p = get_page_by_path('home'); return $p && has_block('core/heading', $p);" }],
      ["Home has a picture or cover block", "php", { code: "$p = get_page_by_path('home'); return $p && (has_block('core/image', $p) || has_block('core/cover', $p) || has_block('core/media-text', $p));" }],
      ["Home has a button", "php", { code: "$p = get_page_by_path('home'); return $p && has_block('core/button', $p);" }],
      ["Home has columns", "php", { code: "$p = get_page_by_path('home'); return $p && has_block('core/columns', $p);" }],
      ["Home has at least 80 words and mentions Abuja", "php", { code: "$p = get_page_by_path('home'); if (!$p) return false; $t = wp_strip_all_tags($p->post_content); return str_word_count($t) >= 80 && stripos($t, 'Abuja') !== false;" }],
    ]),
  wp("Novice", 2, "The plugins a business needs",
    brief("Add only what Kola and Sons need: a form, SEO, a backup tool and login protection. Every extra plugin is one more thing to break.", [
      "Install and activate Contact Form 7, Yoast SEO, UpdraftPlus and Limit Login Attempts Reloaded.",
      "Put a contact form on the Contact page.",
      "Keep it to eight active plugins at most.",
    ], "the business site. It can now be found, contacted, protected and restored."),
    builders(["Home", "Contact"]),
    [
      ["Contact Form 7 is active", "plugin_active", { slug: "contact-form-7" }],
      ["Yoast SEO is active", "plugin_active", { slug: "wordpress-seo" }],
      ["UpdraftPlus is active", "plugin_active", { slug: "updraftplus" }],
      ["Limit Login Attempts Reloaded is active", "plugin_active", { slug: "limit-login-attempts-reloaded" }],
      ["The Contact page has a form", "page", { title: "Contact", postType: "page", contains: "contact-form-7" }],
      ["No more than eight active plugins", "php", { code: "$n = count((array) get_option('active_plugins')); return $n >= 1 && $n <= 8;" }],
    ]),
  wp("Novice", 3, "The pages every business needs",
    brief("Build the rest of the Kola and Sons site, so that a visitor can decide without phoning first.", [
      "Write Home, About, Services and Contact with real words, at least 50 each.",
      "List at least three services on Services, each with its own heading.",
      "Build a menu with all four.",
    ], "the business site. After this, only the finishing and the handover are left."),
    builders([]),
    [
      ["Home has real words", "php", { code: "$p = get_page_by_path('home'); return $p && str_word_count(wp_strip_all_tags($p->post_content)) >= 50;" }],
      ["About has real words", "php", { code: "$p = get_page_by_path('about'); return $p && str_word_count(wp_strip_all_tags($p->post_content)) >= 50;" }],
      ["Services has real words and three headings", "php", { code: "$p = get_page_by_path('services'); if (!$p) return false; return str_word_count(wp_strip_all_tags($p->post_content)) >= 50 && substr_count($p->post_content, '<!-- wp:heading') >= 3;" }],
      ["Contact has real words", "php", { code: "$p = get_page_by_path('contact'); return $p && str_word_count(wp_strip_all_tags($p->post_content)) >= 50;" }],
      ["The menu has all four pages", "menu", { minItems: "4", includes: "Home, About, Services, Contact" }],
    ]),
  wp("Novice", 4, "Finish and hand over the site",
    brief("Capstone. Deliver Kola and Sons' site so well that the owner can run it without you.", [
      "Home, About, Services and Contact, with Home as the homepage and all four in the menu.",
      "At least two blog posts in a category called Projects.",
      "Give the owner an Editor account.",
      "Write a page called Owner Guide, at least 120 words, on how to add a post, change a page and take a backup. Keep it private or a draft.",
    ], "your milestone: a complete small-business website, handed over with a guide."),
    builders([]),
    [
      ["All four pages exist", "php", { code: "foreach (['home', 'about', 'services', 'contact'] as $s) { $p = get_page_by_path($s); if (!$p || $p->post_status !== 'publish' || str_word_count(wp_strip_all_tags($p->post_content)) < 40) return false; } return true;" }],
      ["Home is the homepage", "front_page", { title: "Home" }],
      ["The menu has all four pages", "menu", { minItems: "4", includes: "Home, About, Services, Contact" }],
      ["A Projects category", "term", { name: "Projects", taxonomy: "category" }],
      ["At least two posts in Projects", "php", { code: "$c = get_term_by('name', 'Projects', 'category'); return $c && count(get_posts(['category' => $c->term_id, 'numberposts' => -1])) >= 2;" }],
      ["The owner has an Editor account", "users", { role: "editor", min: "1" }],
      ["A private Owner Guide of at least 120 words", "php", { code: "foreach (get_posts(['post_type' => 'page', 'post_status' => ['private', 'draft'], 'numberposts' => -1]) as $p) { if ($p->post_title === 'Owner Guide' && str_word_count(wp_strip_all_tags($p->post_content)) >= 120) return true; } return false;" }],
    ]),
];

import { brief, type LabExercise } from "./helpers";

// Exercises done in the social media, ads and automation simulators.

const at = (track: string, level: string, week: number, title: string) => ({ track, level, week, title });
const SMM = "Social Media Marketing", DM = "Digital Marketing", AUTO = "AI Automation";

// ── Social planner ──────────────────────────────────────────────────────────
const zuma = {
  brand: { name: "Zuma Kicks", description: "A small Abuja shop selling clean, affordable sneakers. Orders on WhatsApp, delivered in Abuja in one day.", voice: "Friendly, young and confident. Short sentences. No shouting." },
  product: { name: "Everyday sneakers from N18000", description: "Comfortable sneakers in black, white and green, sizes 38 to 46." },
  audience: { type: "STUDENTS", description: "Abuja students and young workers aged 18 to 30 who like to look good on a budget." },
  benchmarks: { reachRate: 0.18, engagementRate: 4, clickRate: 0.6 },
};
const tasty = {
  brand: { name: "Tasty Pot", description: "A home caterer in Kubwa, Abuja. Party trays, ordered two days ahead, with free delivery in Kubwa.", voice: "Warm and cheerful, like a good aunty. Never pushy." },
  product: { name: "Party tray from N25000", description: "Jollof, chicken and small chops for ten people." },
  audience: { type: "PARENTS", description: "Families and offices in Abuja planning small parties." },
  benchmarks: { reachRate: 0.16, engagementRate: 3.5, clickRate: 0.5 },
};

const social: LabExercise[] = [
  {
    ...at(SMM, "Beginner", 4, "Run a week for Zuma Kicks"),
    kind: "SOCIAL",
    brief: brief("This is the week everything comes together. Zuma Kicks gives you its pages for seven days.", [
      "Plan 5 to 7 posts. Use the three you wrote last week.",
      "Choose days and times when students are online.",
      "Mix your posts: don't sell in every one.",
      "Run the week, read the results, then improve it.",
      "Answer the comments.",
    ], "your milestone: a ready-to-post week of content for a real small business, with results to show for it."),
    config: { ...zuma, followers: 900, platforms: ["FEED", "SHORT_VIDEO", "STATUS"], goals: [{ metric: "REACH", value: 700 }, { metric: "ENGAGEMENT_RATE", value: 3.5 }, { metric: "COMMUNITY", value: 60 }], minPosts: 5, maxPosts: 7, commentsPerRun: 4, maxRuns: 5 },
  },
  {
    ...at(SMM, "Novice", 1, "Four pillars, one voice"),
    kind: "SOCIAL",
    brief: brief("Tasty Pot posts whatever comes to mind. Give it four content pillars and one warm voice.", [
      "Plan 7 to 10 posts across at least four pillars.",
      "Keep every caption in the same voice.",
      "Aim for posts people save and share, not just like.",
    ], "the two-week plan. These pillars carry it from start to finish."),
    config: { ...tasty, followers: 1800, platforms: ["FEED", "SHORT_VIDEO", "STATUS"], goals: [{ metric: "REACH", value: 1400 }, { metric: "ENGAGEMENT_RATE", value: 3.6 }, { metric: "SAVES_SHARES", value: 12 }], minPosts: 7, maxPosts: 10, commentsPerRun: 4, maxRuns: 4 },
  },
  {
    ...at(SMM, "Novice", 3, "Look after the community"),
    kind: "SOCIAL",
    brief: brief("Tasty Pot's comments are full: questions, praise, a late delivery and a troll. People judge a business by how it answers.", [
      "Plan 5 to 8 posts that invite people to talk.",
      "Reply to every comment that deserves one.",
      "Help the customer, protect the brand, and never argue.",
    ], "the two-week plan. Good replies are what turn followers into customers."),
    config: { ...tasty, followers: 2400, platforms: ["FEED", "SHORT_VIDEO", "STATUS"], goals: [{ metric: "COMMUNITY", value: 70 }, { metric: "ENGAGEMENT_RATE", value: 3.4 }], minPosts: 5, maxPosts: 8, commentsPerRun: 8, maxRuns: 4 },
  },
  {
    ...at(SMM, "Novice", 4, "Deliver the two-week plan"),
    kind: "SOCIAL",
    brief: brief("Capstone. Tasty Pot wants its busiest week of the two to bring followers and orders, with no money for ads.", [
      "Plan 8 to 12 posts with your pillars and your reel.",
      "Balance posts that build trust with posts that sell.",
      "Run it, improve it, and answer the comments.",
      "Keep the numbers: they go in your report.",
    ], "your milestone: a two-week plan, run and reported on, that you can show to the next business."),
    config: { ...tasty, followers: 3000, platforms: ["FEED", "SHORT_VIDEO", "STATUS"], goals: [{ metric: "REACH", value: 2800 }, { metric: "FOLLOWERS", value: 12 }, { metric: "CLICKS", value: 10 }, { metric: "COMMUNITY", value: 70 }], minPosts: 8, maxPosts: 12, commentsPerRun: 6, maxRuns: 4 },
  },
];

// ── Ads ─────────────────────────────────────────────────────────────────────
const green = {
  business: { name: "GreenVolt Solar", description: "Installs home solar in Kaduna in two days, with a two-year warranty and payment over six months. People book a free visit on WhatsApp or by phone." },
  product: { name: "Starter solar system", description: "Runs lights, fans, a television, phones and a small freezer.", price: 450000 },
  conversionEvent: "LEADS",
  specialCategory: "NONE",
  hasApp: false,
  idealAudience: { locations: ["kaduna"], ageMin: 30, ageMax: 60, gender: "ALL", interests: ["Home decor", "Small business", "Real estate"] },
  benchmarks: { cpm: 800, ctr: 1.0, cvr: 5 },
};

const ads: LabExercise[] = [
  {
    ...at(DM, "Novice", 3, "Reach people ready to buy"),
    kind: "ADS",
    brief: brief("GreenVolt Solar wants to appear when people in Kaduna are looking for solar, and to get booked visits.", [
      "Build a campaign for leads, not likes.",
      "Choose the Search placement, and say why in your notes.",
      "Write at least two ads that answer what people search for.",
      "Run it, read the numbers, and improve it.",
    ], "the 30-day plan. Paid search becomes its third channel, with real numbers behind it."),
    config: { ...green, goals: [{ metric: "CONVERSIONS", value: 12 }, { metric: "CTR", value: 0.9 }], maxRuns: 6, maxTotalBudget: 60000 },
  },
  {
    ...at(DM, "Novice", 4, "Run the first month's campaign"),
    kind: "ADS",
    brief: brief("Capstone. GreenVolt approves your plan and gives you its ad budget. Spend it well.", [
      "Use at least two ad sets for two kinds of buyer.",
      "Keep the cost of a booked visit under the target.",
      "Improve it between runs: stop what fails and feed what works.",
      "Keep the results: they go in your 30-day plan.",
    ], "your milestone: a 30-day marketing plan a business could start tomorrow, tested before a naira is spent."),
    config: { ...green, goals: [{ metric: "CONVERSIONS", value: 30 }, { metric: "COST_PER_CONVERSION", value: 4000 }], maxRuns: 6, maxTotalBudget: 120000 },
  },
];

// ── Automations ─────────────────────────────────────────────────────────────
type Cond = [field: string, op: string, value: string];
let nextId = 0;
const id = (prefix: string) => `${prefix}${++nextId}`;
const act = (action: string, target: string, text: string, subject = "") => ({ id: id("a"), type: "ACTION", action, target, subject, text });
const when = (rules: Cond[], then: unknown[], otherwise: unknown[] = [], match = "ALL") => ({ id: id("i"), type: "IF", match, rules: rules.map(([field, op, value]) => ({ field, op, value })), then, else: otherwise });
const ai = (input: string, categories: string[], output: string) => ({ id: id("s"), type: "AI", input, categories: categories.join("\n"), output });
const field = (key: string, label: string, type = "text") => ({ key, label, type });
const rec = (recId: string, label: string, data: Record<string, string>, hidden = false) => ({ id: recId, label, hidden, data });

function automation(
  place: ReturnType<typeof at>,
  text: string,
  setup: {
    business: string; trigger: string; fields: ReturnType<typeof field>[]; records: ReturnType<typeof rec>[]; steps: unknown[];
    channels?: string[]; sheets?: string[]; stages?: string[]; team?: string[]; labels?: Record<string, string>;
  },
): LabExercise {
  const { business, trigger, fields, records, steps, channels = ["#general"], sheets = [], stages = ["New"], team = ["Owner"], labels } = setup;
  return {
    ...place,
    kind: "AUTOMATION",
    brief: text,
    labels,
    config: { business: { name: business, description: text }, trigger, fields, records, channels, sheets, stages, team, solution: { trigger, steps }, expected: null, maxSteps: 20, maxRuns: 30 },
  };
}

const formFields = [field("name", "Name"), field("email", "Email", "email"), field("type", "Type"), field("message", "Message")];
const orderFields = [field("name", "Name"), field("phone", "Phone", "phone"), field("item", "Item"), field("paid", "Paid"), field("area", "Area")];
const leadFields = [field("name", "Name"), field("email", "Email", "email"), field("phone", "Phone", "phone"), field("area", "Area"), field("budget", "Budget", "number")];
const mailFields = [field("name", "Name"), field("email", "Email", "email"), field("message", "Message")];

const automations: LabExercise[] = [
  automation(at(AUTO, "Beginner", 3, "Sort and answer the form"),
    brief("Crust & Crumb's form brings orders, complaints and questions, all in one pile. Nothing should wait for someone to read it.", [
      "Save every message in the Messages sheet with {{name}}, {{type}} and {{message}}.",
      "If type is Complaint: post in #support with {{name}} and {{message}}, and email {{email}} an apology that mentions {{name}}.",
      "If it isn't: email {{email}} a thank-you that mentions {{name}}. No #support post.",
    ], "the automation that saves the bakery time every week. You finish it in Week 4."),
    {
      business: "Crust & Crumb Bakery", trigger: "FORM", fields: formFields, channels: ["#support", "#orders"], sheets: ["Messages", "Orders"],
      records: [
        rec("r1", "Order", { name: "Ngozi Eze", email: "ngozi@example.com", type: "Order", message: "Two dozen meat pies for Friday" }),
        rec("r2", "Complaint", { name: "Sani Bala", email: "sani@example.com", type: "Complaint", message: "My cake had the wrong name" }),
        rec("r3", "Question", { name: "Ruth Okon", email: "ruth@example.com", type: "Question", message: "Do you open on Sunday?" }),
        rec("h1", "Hidden: complaint", { name: "Yemi Ade", email: "yemi@example.com", type: "Complaint", message: "The delivery came late" }, true),
        rec("h2", "Hidden: order", { name: "Fatima Lawal", email: "fatima@example.com", type: "Order", message: "One chocolate cake" }, true),
      ],
      steps: [
        act("SHEET", "Messages", "{{name}} {{type}} {{message}}"),
        when([["type", "EQUALS", "Complaint"]],
          [act("CHAT", "#support", "{{name}}: {{message}}"), act("EMAIL", "{{email}}", "Dear {{name}}, we are sorry. We will call you today.", "We are sorry")],
          [act("EMAIL", "{{email}}", "Hello {{name}}, thank you for your message.", "Thank you")]),
      ],
    }),
  automation(at(AUTO, "Beginner", 4, "Automate the bakery's whole order process"),
    brief("You mapped how the bakery handles an order. Here's the map: an order comes in. It is saved. If it is paid, the baker starts and the customer is told. If not, the owner must chase it. Build it.", [
      "Save every order in the Orders sheet with {{name}}, {{phone}} and {{item}}.",
      "If paid is yes: create a task for \"Tobi (Baker)\" with {{item}}, and text {{phone}} a message with {{name}} and {{item}}.",
      "If paid is no: create a task for \"Kemi (Owner)\" with {{name}} and {{phone}}.",
      "If area contains Kubwa: also post in #delivery with {{name}} and {{area}}.",
    ], "your milestone: a working automation that saves a small business real time every week."),
    {
      business: "Crust & Crumb Bakery", trigger: "ORDER", fields: orderFields, channels: ["#delivery", "#orders"], sheets: ["Orders"], team: ["Tobi (Baker)", "Kemi (Owner)"],
      records: [
        rec("r1", "Paid, Wuse", { name: "Ngozi Eze", phone: "08031230000", item: "Birthday cake", paid: "yes", area: "Wuse 2" }),
        rec("r2", "Not paid", { name: "Sani Bala", phone: "08061230000", item: "Meat pies", paid: "no", area: "Garki" }),
        rec("r3", "Paid, Kubwa", { name: "Ruth Okon", phone: "07031230000", item: "Small chops", paid: "yes", area: "Kubwa Phase 4" }),
        rec("h1", "Hidden: not paid, Kubwa", { name: "Yemi Ade", phone: "09031230000", item: "Bread", paid: "no", area: "Kubwa" }, true),
        rec("h2", "Hidden: paid", { name: "Fatima Lawal", phone: "08091230000", item: "Cupcakes", paid: "yes", area: "Asokoro" }, true),
      ],
      steps: [
        act("SHEET", "Orders", "{{name}} {{phone}} {{item}}"),
        when([["paid", "EQUALS", "yes"]],
          [act("TASK", "Tobi (Baker)", "Bake {{item}}"), act("SMS", "{{phone}}", "Hello {{name}}, we have started your {{item}}.")],
          [act("TASK", "Kemi (Owner)", "Call {{name}} on {{phone}} about payment")]),
        when([["area", "CONTAINS", "Kubwa"]], [act("CHAT", "#delivery", "{{name}} in {{area}}")]),
      ],
    }),
  automation(at(AUTO, "Novice", 1, "Different paths for different buyers"),
    brief("Zenith Homes sells houses in Abuja. A buyer with N50 million and a buyer with N2 million get the same slow reply. Fix that.", [
      "Add every lead to the Leads sheet with {{name}}, {{area}} and {{budget}}.",
      "Budget of 50000000 or more: add to the CRM as \"Hot lead\" with {{name}}, and create a task for \"Bisi (Sales)\" with {{name}} and {{phone}}.",
      "Budget from 10000000 to below 50000000: add to the CRM as \"Warm lead\" with {{name}}, and email {{email}} with {{name}} and {{area}}.",
      "Below that: only email {{email}} a thank-you with {{name}}.",
    ], "the lead system you deliver in Week 4. This is the part that decides who gets called first."),
    {
      business: "Zenith Homes", trigger: "FORM", fields: leadFields, channels: ["#sales"], sheets: ["Leads"], stages: ["Hot lead", "Warm lead", "Customer"], team: ["Bisi (Sales)"],
      records: [
        rec("r1", "Hot", { name: "Chidi Nwosu", email: "chidi@example.com", phone: "08030000001", area: "Maitama", budget: "85000000" }),
        rec("r2", "Warm", { name: "Aisha Bello", email: "aisha@example.com", phone: "08030000002", area: "Lugbe", budget: "20000000" }),
        rec("r3", "Low", { name: "Dayo Ojo", email: "dayo@example.com", phone: "08030000003", area: "Nyanya", budget: "3000000" }),
        rec("r4", "Exactly hot", { name: "Ini Essien", email: "ini@example.com", phone: "08030000004", area: "Wuse", budget: "50000000" }),
        rec("h1", "Hidden: exactly warm", { name: "Uche Obi", email: "uche@example.com", phone: "08030000005", area: "Gwarinpa", budget: "10000000" }, true),
        rec("h2", "Hidden: low", { name: "Zainab Musa", email: "zainab@example.com", phone: "08030000006", area: "Karu", budget: "9999999" }, true),
      ],
      steps: [
        act("SHEET", "Leads", "{{name}} {{area}} {{budget}}"),
        when([["budget", "GTE", "50000000"]],
          [act("CRM", "Hot lead", "{{name}}"), act("TASK", "Bisi (Sales)", "Call {{name}} on {{phone}}")],
          [when([["budget", "GTE", "10000000"]],
            [act("CRM", "Warm lead", "{{name}}"), act("EMAIL", "{{email}}", "Hello {{name}}, here are homes in {{area}}.", "Homes for you")],
            [act("EMAIL", "{{email}}", "Hello {{name}}, thank you for writing.", "Thank you")])]),
      ],
    }),
  automation(at(AUTO, "Novice", 2, "Let AI read the inbox"),
    brief("Zenith Homes gets hundreds of emails. Someone reads them all just to decide who should answer.", [
      "Use an AI step on {{message}} to sort each email into Viewing, Payment or Complaint.",
      "Viewing: create a task for \"Bisi (Sales)\" with {{name}}.",
      "Payment: create a task for \"Ada (Accounts)\" with {{name}}.",
      "Complaint: post in #urgent with {{name}} and {{message}}, and email {{email}} an apology with {{name}}.",
    ], "the lead system. Now it understands what people write."),
    {
      business: "Zenith Homes", trigger: "EMAIL", fields: mailFields, channels: ["#urgent"], team: ["Bisi (Sales)", "Ada (Accounts)"],
      labels: { r1: "Viewing", r2: "Payment", r3: "Complaint", h1: "Viewing", h2: "Complaint" },
      records: [
        rec("r1", "Wants to see a house", { name: "Chidi Nwosu", email: "chidi@example.com", message: "Can I come and see the house in Maitama on Saturday?" }),
        rec("r2", "Asks about a payment", { name: "Aisha Bello", email: "aisha@example.com", message: "I transferred the deposit yesterday. Please send my receipt." }),
        rec("r3", "Unhappy", { name: "Dayo Ojo", email: "dayo@example.com", message: "I am very unhappy. Your agent did not show up and wasted my whole day." }),
        rec("h1", "Hidden: visit", { name: "Uche Obi", email: "uche@example.com", message: "When can we visit the two-bedroom flat for a viewing?" }, true),
        rec("h2", "Hidden: complaint", { name: "Zainab Musa", email: "zainab@example.com", message: "This is a complaint. The roof you repaired is still leaking and nobody answers." }, true),
      ],
      steps: [
        ai("{{message}}", ["Viewing: wants to visit or see a house", "Payment: money, transfer, deposit, receipt or invoice", "Complaint: unhappy, complaint or something went wrong"], "topic"),
        when([["topic", "EQUALS", "Viewing"]], [act("TASK", "Bisi (Sales)", "Arrange a viewing for {{name}}")]),
        when([["topic", "EQUALS", "Payment"]], [act("TASK", "Ada (Accounts)", "Check payment for {{name}}")]),
        when([["topic", "EQUALS", "Complaint"]], [act("CHAT", "#urgent", "{{name}}: {{message}}"), act("EMAIL", "{{email}}", "Dear {{name}}, we are sorry. A manager will call you.", "We are sorry")]),
      ],
    }),
  automation(at(AUTO, "Novice", 3, "A bot that answers the right thing"),
    brief("People message Zenith Homes at midnight with the same questions. Build the bot, and make it hand over when it should.", [
      "Use an AI step on {{message}} to sort it into Hours, Documents or Other.",
      "Hours: text {{phone}} that the office opens 9am to 5pm, with {{name}}.",
      "Documents: text {{phone}} the list of documents, with {{name}}.",
      "Other: create a task for \"Bisi (Sales)\" with {{name}} and {{message}}. The bot must never guess.",
    ], "the lead system. It can now talk to people while the team sleeps."),
    {
      business: "Zenith Homes", trigger: "CHAT_MESSAGE", fields: [field("name", "Name"), field("phone", "Phone", "phone"), field("message", "Message")], team: ["Bisi (Sales)"],
      labels: { r1: "Hours", r2: "Documents", r3: "Other", h1: "Hours", h2: "Other" },
      records: [
        rec("r1", "Opening time", { name: "Chidi", phone: "08030000001", message: "What time do you open and close?" }),
        rec("r2", "Papers", { name: "Aisha", phone: "08030000002", message: "Which documents do I need to buy a house?" }),
        rec("r3", "Something else", { name: "Dayo", phone: "08030000003", message: "Can I pay with a car instead of money?" }),
        rec("h1", "Hidden: hours", { name: "Uche", phone: "08030000005", message: "Are you open by 8am? What are your opening hours?" }, true),
        rec("h2", "Hidden: other", { name: "Zainab", phone: "08030000006", message: "My brother wants a job with you" }, true),
      ],
      steps: [
        ai("{{message}}", ["Hours: opening hours, open, close or what time", "Documents: documents, papers or forms needed to buy", "Other: anything else"], "topic"),
        when([["topic", "EQUALS", "Hours"]], [act("SMS", "{{phone}}", "Hello {{name}}, we open 9am to 5pm, Monday to Friday.")],
          [when([["topic", "EQUALS", "Documents"]], [act("SMS", "{{phone}}", "Hello {{name}}, please bring your ID, proof of address and two photos.")],
            [act("TASK", "Bisi (Sales)", "Answer {{name}}: {{message}}")])]),
      ],
    }),
  automation(at(AUTO, "Novice", 4, "Lead capture to follow-up"),
    brief("Capstone. Build Zenith Homes' whole lead system, so that no buyer is ever forgotten.", [
      "Add every lead to the Leads sheet with {{name}}, {{phone}}, {{area}} and {{budget}}.",
      "If phone is empty: email {{email}} to ask for it, with {{name}}. Do nothing else.",
      "If budget is 50000000 or more: CRM \"Hot lead\" with {{name}}, task for \"Bisi (Sales)\" with {{name}} and {{phone}}, and post in #sales with {{name}} and {{budget}}.",
      "Otherwise: CRM \"New lead\" with {{name}}, and text {{phone}} with {{name}} and {{area}}.",
    ], "your milestone: a lead system that captures, sorts and follows up by itself. Document it for this week's task."),
    {
      business: "Zenith Homes", trigger: "FORM", fields: leadFields, channels: ["#sales"], sheets: ["Leads"], stages: ["New lead", "Hot lead"], team: ["Bisi (Sales)"],
      records: [
        rec("r1", "Hot", { name: "Chidi Nwosu", email: "chidi@example.com", phone: "08030000001", area: "Maitama", budget: "85000000" }),
        rec("r2", "New", { name: "Aisha Bello", email: "aisha@example.com", phone: "08030000002", area: "Lugbe", budget: "20000000" }),
        rec("r3", "No phone", { name: "Dayo Ojo", email: "dayo@example.com", phone: "", area: "Nyanya", budget: "60000000" }),
        rec("h1", "Hidden: exactly hot", { name: "Uche Obi", email: "uche@example.com", phone: "08030000005", area: "Gwarinpa", budget: "50000000" }, true),
        rec("h2", "Hidden: no phone", { name: "Zainab Musa", email: "zainab@example.com", phone: "", area: "Karu", budget: "5000000" }, true),
      ],
      steps: [
        act("SHEET", "Leads", "{{name}} {{phone}} {{area}} {{budget}}"),
        when([["phone", "EMPTY", ""]],
          [act("EMAIL", "{{email}}", "Hello {{name}}, please send your phone number.", "Your phone number")],
          [when([["budget", "GTE", "50000000"]],
            [act("CRM", "Hot lead", "{{name}}"), act("TASK", "Bisi (Sales)", "Call {{name}} on {{phone}}"), act("CHAT", "#sales", "{{name}} {{budget}}")],
            [act("CRM", "New lead", "{{name}}"), act("SMS", "{{phone}}", "Hello {{name}}, we have homes in {{area}}.")])]),
      ],
    }),
];

export const SIMULATED: LabExercise[] = [...social, ...ads, ...automations];

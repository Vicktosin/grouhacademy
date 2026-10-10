// Work Life: four weekend workdays at Brightwave Digital, a made-up Lagos
// agency with a department for each internship track. Every track follows
// the same story (first day, client discovery and a team disagreement,
// building the project with a change from the client, delivery and a
// review); each department fills it with its own people, client, project,
// disagreement and objection. Meetings are written out line by line, with
// the intern's turns marked, so they cost nothing to run: only the
// intern's finished work is marked by AI (lib/work-life/grade).
//
// Safe to import anywhere: plain data and functions.

export type PersonId = "ceo" | "manager" | "supporter" | "challenger" | "client";

export type Person = {
  id: PersonId;
  name: string;
  role: string;
  email: string;
  /** For the meeting voices: a higher or lower voice, and its pace. */
  voice: "female" | "male";
};

type Department = {
  /** Matched against the track's name, in lower case. */
  match: string[];
  department: string;
  manager: [name: string, voice: Person["voice"]];
  supporter: [name: string, role: string, voice: Person["voice"]];
  challenger: [name: string, role: string, voice: Person["voice"]];
  client: { name: string; role: string; company: string; business: string; voice: Person["voice"]; domain: string };
  /** What the team is delivering, as a noun phrase. */
  project: string;
  /** The Practice Lab tool the build happens in. */
  labTool: string;
  /** What the client says in discovery, one answer per question. */
  discovery: [string, string, string, string];
  /** The challenger's view in the team meeting, and their reason. */
  conflict: { position: string; reason: string };
  /** The client's change request while the work is being built. */
  change: { subject: string; body: string };
  /** The client's concern when the work is presented. */
  objection: string;
};

const COMPANY = {
  name: "Brightwave Digital",
  domain: "brightwave.ng",
  about:
    "a digital agency in Lekki, Lagos, that builds marketing, content, automation and web projects for Nigerian businesses",
};

const CEO: Person = {
  id: "ceo",
  name: "Folake Adeyemi",
  role: "CEO",
  email: "folake@brightwave.ng",
  voice: "female",
};

const DEPARTMENTS: Department[] = [
  {
    match: ["digital marketing"],
    department: "Growth Marketing",
    manager: ["Chinedu Okafor", "male"],
    supporter: ["Amaka Eze", "Designer", "female"],
    challenger: ["Tunde Bakare", "Media Buyer", "male"],
    client: {
      name: "Ngozi Ibe",
      role: "Head of Marketing",
      company: "Fresh Basket",
      business: "an online grocery delivery service in Lagos",
      voice: "female",
      domain: "freshbasket.ng",
    },
    project: "a lead generation campaign for Fresh Basket's new weekly food box",
    labTool: "Ads Studio",
    discovery: [
      "We're launching a weekly food box for busy families in Lekki, Ikeja and Yaba, and we want people to sign up for a free first box.",
      "Our budget for the first month is about four hundred thousand naira. We'd like at least three hundred sign-ups, and the cost per sign-up matters a lot to us.",
      "Most of our current customers are working mothers between twenty-eight and forty-five, and many of them order through WhatsApp.",
      "We need the campaign running in two weeks, and I'll report the results to our CEO every Friday.",
    ],
    conflict: {
      position: "We should put the whole budget into one big awareness campaign and go wide.",
      reason: "Testing small ad sets wastes money and time.",
    },
    change: {
      subject: "Change to the food box campaign",
      body: "Our management has cut this month's budget to three hundred thousand naira, and they want WhatsApp to be where people sign up, not the website. Please let me know how this affects the plan.",
    },
    objection: "Your cost per sign-up looks higher than what another agency promised us. Why should we trust these numbers?",
  },
  {
    match: ["social media"],
    department: "Social Media",
    manager: ["Bisi Adewale", "female"],
    supporter: ["Kelechi Nwosu", "Content Creator", "male"],
    challenger: ["Ifeoma Obi", "Community Manager", "female"],
    client: {
      name: "Halima Musa",
      role: "Founder",
      company: "Kemi's Kitchen",
      business: "a small chain of three restaurants in Lagos",
      voice: "female",
      domain: "kemiskitchen.ng",
    },
    project: "a four-week Instagram and TikTok plan to grow Kemi's Kitchen's followers and orders",
    labTool: "Social Studio",
    discovery: [
      "We post when we remember, mostly food photos, and our engagement has dropped a lot this year.",
      "I want more people ordering for delivery, not just likes. Weekday lunch orders are our weakest.",
      "Our customers are young professionals and students around Yaba and Surulere. They love our jollof and our small chops.",
      "I can give you one staff member for filming on Tuesdays, and I'd like to approve posts before they go out.",
    ],
    conflict: {
      position: "We should jump on every trending sound and post twice a day, whatever it is.",
      reason: "Trends get reach, and reach is all that matters right now.",
    },
    change: {
      subject: "Giveaway idea for this month",
      body: "My partner wants us to run a big giveaway this month to get followers quickly. Can you add it to the plan, and tell me what you think?",
    },
    objection: "Why should I pay for this when I could just pay a few influencers to post about us?",
  },
  {
    match: ["content creation", "ai for content"],
    department: "Content Studio",
    manager: ["Uche Nnamdi", "male"],
    supporter: ["Funke Alabi", "Editor", "female"],
    challenger: ["Segun Ojo", "Content Writer", "male"],
    client: {
      name: "Daniel Okoro",
      role: "Programme Director",
      company: "TechBridge Academy",
      business: "an online school that teaches data skills to young Nigerians",
      voice: "male",
      domain: "techbridge.ng",
    },
    project: "an AI-assisted content pack (blog post, social posts and newsletter) for TechBridge's new data analysis course",
    labTool: "AI Content",
    discovery: [
      "We're launching a new data analysis course next month, and we need content that explains why it matters for jobs in Nigeria.",
      "Our audience is graduates and early-career workers. They're on LinkedIn and Instagram, and they read our weekly newsletter.",
      "Our tone is friendly but professional. We don't want anything that sounds like a robot wrote it.",
      "We need a blog post, five social posts and one newsletter within two weeks, and our team will review everything.",
    ],
    conflict: {
      position: "We should publish the AI drafts as they are to save time.",
      reason: "The tools are good enough now, and editing everything slows us down.",
    },
    change: {
      subject: "Tone of the course content",
      body: "Our board read the first drafts and wants a more formal tone for LinkedIn, but the Instagram posts can stay friendly. Can you adjust the plan?",
    },
    objection: "Isn't this just ChatGPT? Will search engines or our readers punish us for AI content?",
  },
  {
    match: ["automation"],
    department: "Automation",
    manager: ["Ibrahim Sani", "male"],
    supporter: ["Chioma Udeh", "Automation Engineer", "female"],
    challenger: ["Kunle Ajayi", "Operations Analyst", "male"],
    client: {
      name: "Esther Johnson",
      role: "Operations Manager",
      company: "QuickFix Logistics",
      business: "a same-day delivery company serving shops in Lagos",
      voice: "female",
      domain: "quickfix.ng",
    },
    project: "an automation that takes delivery requests from a form, records them, and keeps customers updated",
    labTool: "Automation",
    discovery: [
      "Shops send us delivery requests on WhatsApp and by phone, and our dispatchers copy everything into a spreadsheet by hand.",
      "We handle about a hundred and fifty requests a day, and mistakes in addresses cost us money every week.",
      "Customers keep calling to ask where their package is, which takes up our team's whole afternoon.",
      "We use Google Sheets and Gmail already, and we'd like something running in three weeks without hiring developers.",
    ],
    conflict: {
      position: "We should automate everything at once, payments and dispatch included.",
      reason: "Doing it in small pieces will take forever and the client wants results.",
    },
    change: {
      subject: "Adding a manager approval step",
      body: "Our CEO wants any delivery above fifty thousand naira in value to be approved by a manager before it's dispatched. Can the automation handle that?",
    },
    objection: "What happens when the automation breaks on a busy day? We can't afford to lose orders.",
  },
  {
    match: ["front-end", "front end", "frontend"],
    department: "Web",
    manager: ["Adaeze Okeke", "female"],
    supporter: ["Yusuf Bello", "UI Designer", "male"],
    challenger: ["Emeka Nwankwo", "Developer", "male"],
    client: {
      name: "Tola Bankole",
      role: "Owner",
      company: "Lagos Lens Studio",
      business: "a photography studio in Ikeja",
      voice: "male",
      domain: "lagoslens.ng",
    },
    project: "a responsive website for Lagos Lens Studio where customers can see packages and book a session",
    labTool: "Web workspace",
    discovery: [
      "Most of our customers find us on Instagram, but we don't have a proper website, just a link to WhatsApp.",
      "People mostly visit on their phones, and many are on slow data, so the site has to be light.",
      "We offer three packages: portraits, events and product photography, each with a starting price.",
      "We'd like customers to send a booking request with a date and package, and we'll confirm on WhatsApp.",
    ],
    conflict: {
      position: "We should use a big animation library and build the desktop version first.",
      reason: "Clients are impressed by animations, and we can fix mobile later.",
    },
    change: {
      subject: "Adding a gallery to the website",
      body: "I forgot to say: we need a gallery of our best work on the homepage. Can you add it without making the site slow?",
    },
    objection: "My cousin says I could just use a free template. Why is a custom site worth it?",
  },
  {
    match: ["back-end", "back end", "backend"],
    department: "Platform Engineering",
    manager: ["Oluwaseun Adebayo", "male"],
    supporter: ["Zainab Lawal", "Backend Engineer", "female"],
    challenger: ["Victor Eze", "Senior Developer", "male"],
    client: {
      name: "Peter Ogundipe",
      role: "Product Lead",
      company: "PayLite",
      business: "a payments startup for small shops",
      voice: "male",
      domain: "paylite.ng",
    },
    project: "an orders API for PayLite's merchant app, with sign-in and order tracking",
    labTool: "Backend API",
    discovery: [
      "Our merchants need to create orders, update their status and see their order history in our mobile app.",
      "We expect about two thousand merchants at launch, and each one may create a hundred orders a day.",
      "Security matters a lot to us: merchants must only ever see their own orders.",
      "Our mobile team needs the API documented in three weeks so they can start building.",
    ],
    conflict: {
      position: "We should skip writing tests so we can hit the deadline.",
      reason: "Tests can come later; the mobile team is waiting.",
    },
    change: {
      subject: "Order status history",
      body: "Our merchants want to see every status an order went through and when, not just the current one. Can the API include that?",
    },
    objection: "How do we know this API is secure enough for a payments company?",
  },
  {
    match: ["wordpress"],
    department: "WordPress Studio",
    manager: ["Grace Udo", "female"],
    supporter: ["Samuel Etim", "WordPress Developer", "male"],
    challenger: ["Rukayat Bello", "Web Designer", "female"],
    client: {
      name: "Ada Nwachukwu",
      role: "Owner",
      company: "Ada's Bakery",
      business: "a bakery in Surulere that sells cakes and pastries",
      voice: "female",
      domain: "adasbakery.ng",
    },
    project: "an online store for Ada's Bakery where customers can order cakes and pay with Paystack",
    labTool: "WordPress lab",
    discovery: [
      "We take all our orders on Instagram and WhatsApp, and we lose track of some of them every week.",
      "We sell about twenty products, mostly cakes, with different sizes and flavours.",
      "We want customers to pay online before we start baking, and Paystack is what we know.",
      "I'm not technical, so I need to be able to add new cakes and change prices myself.",
    ],
    conflict: {
      position: "We should buy a premium theme and install every plugin that might be useful.",
      reason: "More features make the site look professional.",
    },
    change: {
      subject: "Delivery areas and prices",
      body: "We only deliver to some areas of Lagos, and delivery to the Island costs more. Can customers choose their area and see the right delivery fee?",
    },
    objection: "Who looks after the website when something breaks, and how much will that cost me every month?",
  },
];

/** For any other track: a general projects team. */
const GENERAL: Department = {
  match: [],
  department: "Projects",
  manager: ["Chinedu Okafor", "male"],
  supporter: ["Amaka Eze", "Project Coordinator", "female"],
  challenger: ["Tunde Bakare", "Team Lead", "male"],
  client: {
    name: "Ngozi Ibe",
    role: "Operations Lead",
    company: "Fresh Basket",
    business: "an online grocery delivery service in Lagos",
    voice: "female",
    domain: "freshbasket.ng",
  },
  project: "a project that helps Fresh Basket win more customers",
  labTool: "Practice Lab",
  discovery: [
    "We're growing quickly and need help reaching more customers and working more efficiently.",
    "Our budget for this project is limited, so we need to see results within a month.",
    "Our customers are busy families in Lagos who order on their phones.",
    "We'd like a plan in two weeks and regular updates after that.",
  ],
  conflict: {
    position: "We should do everything the client mentioned at once.",
    reason: "That way they'll see we're working hard.",
  },
  change: {
    subject: "Change of priorities",
    body: "Our management has changed this month's priorities and cut the budget slightly. Please let me know how this affects the plan.",
  },
  objection: "How do we know this will be worth the money?",
};

export type Cast = Record<PersonId, Person> & {
  company: typeof COMPANY;
  department: string;
  clientCompany: string;
  clientBusiness: string;
  project: string;
  labTool: string;
};

function departmentFor(trackName: string): Department {
  const name = trackName.toLowerCase();
  return DEPARTMENTS.find((dept) => dept.match.some((word) => name.includes(word))) ?? GENERAL;
}

const emailFor = (name: string, domain: string) => `${name.split(" ")[0].toLowerCase()}@${domain}`;

/** Everyone the intern works with, for their track. */
export function castFor(trackName: string): Cast {
  const dept = departmentFor(trackName);
  return {
    company: COMPANY,
    department: dept.department,
    clientCompany: dept.client.company,
    clientBusiness: dept.client.business,
    project: dept.project,
    labTool: dept.labTool,
    ceo: CEO,
    manager: {
      id: "manager",
      name: dept.manager[0],
      role: `${dept.department} Manager`,
      email: emailFor(dept.manager[0], COMPANY.domain),
      voice: dept.manager[1],
    },
    supporter: {
      id: "supporter",
      name: dept.supporter[0],
      role: dept.supporter[1],
      email: emailFor(dept.supporter[0], COMPANY.domain),
      voice: dept.supporter[2],
    },
    challenger: {
      id: "challenger",
      name: dept.challenger[0],
      role: dept.challenger[1],
      email: emailFor(dept.challenger[0], COMPANY.domain),
      voice: dept.challenger[2],
    },
    client: {
      id: "client",
      name: dept.client.name,
      role: `${dept.client.role}, ${dept.client.company}`,
      email: emailFor(dept.client.name, dept.client.domain),
      voice: dept.client.voice,
    },
  };
}

// ---------------------------------------------------------------- steps

/** A line someone says in a meeting, or a turn where the intern speaks. */
export type MeetingLine = { speaker: PersonId; text: string } | { you: string };

export type Step =
  | { id: string; kind: "inbox"; title: string; from: PersonId; subject: string; body: string }
  | {
      id: string;
      kind: "meeting";
      title: string;
      agenda: string;
      participants: PersonId[];
      lines: MeetingLine[];
      rubric: string;
    }
  | {
      id: string;
      kind: "email";
      title: string;
      task: string;
      to: PersonId[];
      cc: PersonId[];
      rubric: string;
    }
  | { id: string; kind: "report"; title: string; task: string; fields: [string, string, string]; rubric: string }
  | { id: string; kind: "work"; title: string; task: string; rubric: string };

export type Workday = { day: number; title: string; summary: string; steps: Step[] };

export const WORKDAYS = 4;

const COB_FIELDS: [string, string, string] = [
  "What I completed today",
  "What's in progress or blocking me",
  "What I'll do next",
];

/** The four workdays for a track, with the intern's first name in the lines. */
export function workdaysFor(trackName: string, you: string): Workday[] {
  const dept = departmentFor(trackName);
  const cast = castFor(trackName);
  const m = cast.manager.name.split(" ")[0];
  const s = cast.supporter.name.split(" ")[0];
  const c = cast.challenger.name.split(" ")[0];
  const k = cast.client.name.split(" ")[0];
  const ceo = cast.ceo.name.split(" ")[0];
  const firm = COMPANY.name;
  const clientCo = cast.clientCompany;

  return [
    {
      day: 1,
      title: `First day at ${firm}`,
      summary: "Meet your manager and team, read your onboarding pack, and send your first report.",
      steps: [
        {
          id: "d1-welcome",
          kind: "inbox",
          title: "Read the welcome email",
          from: "manager",
          subject: `Welcome to ${firm}, ${you}`,
          body: `Hi ${you},

Welcome to the ${cast.department} team at ${firm}. We're ${COMPANY.about}.

You'll be working with me, ${cast.supporter.name} (${cast.supporter.role}) and ${cast.challenger.name} (${cast.challenger.role}). Our CEO is ${cast.ceo.name}.

This month our main client is ${clientCo}, ${cast.clientBusiness}. We'll be delivering ${cast.project}.

How we work:
- Reply to emails the same day, even if it's just to say you're on it.
- Copy me on every email to a client, and copy ${ceo} on anything important.
- Send me a close of business (COB) report before you sign off each workday.

We have a quick team stand-up shortly. See you there.

${cast.manager.name}
${cast.manager.role}`,
        },
        {
          id: "d1-standup",
          kind: "meeting",
          title: "Team stand-up",
          agenda: "Introductions and today's plan",
          participants: ["manager", "supporter", "challenger"],
          lines: [
            { speaker: "manager", text: `Good morning everyone. Before we start, let's welcome ${you}, who joins our team today.` },
            { speaker: "supporter", text: `Welcome, ${you}! I'm ${s}, the team's ${cast.supporter.role.toLowerCase()}. Feel free to ask me anything.` },
            { speaker: "challenger", text: `Hi ${you}. I'm ${c}, ${cast.challenger.role.toLowerCase()}. We move fast here, so you'll learn quickly.` },
            { speaker: "manager", text: `${you}, please introduce yourself to the team.` },
            { you: "Introduce yourself: who you are, what you're learning, and what you'd like to get out of working here." },
            { speaker: "manager", text: `Thanks, ${you}. Today, please read the onboarding email, reply to me with one question about the team or the client, and send your COB report before you sign off.` },
            { you: "Ask the team one question, or say how you'll approach today." },
            { speaker: "manager", text: "Great. Let's have a good day, everyone." },
          ],
          rubric:
            "A clear, confident introduction (name, what they're learning, what they want from the role); polite, professional tone; a sensible question or plan for the day.",
        },
        {
          id: "d1-reply",
          kind: "email",
          title: `Reply to ${m}`,
          task: `Reply to ${m}'s welcome email. Thank them, confirm you've read the onboarding pack, and ask one clear question about the team or the client.`,
          to: ["manager"],
          cc: [],
          rubric:
            "Addressed to the manager; a clear subject; thanks them; confirms the onboarding pack was read; asks one specific, useful question; polite and concise; signed off with the intern's name.",
        },
        {
          id: "d1-cob",
          kind: "report",
          title: "Close of business report",
          task: `Send ${m} your COB report for today.`,
          fields: COB_FIELDS,
          rubric: "Specific about what was done; honest about anything unfinished; a clear next step; concise and professional.",
        },
      ],
    },
    {
      day: 2,
      title: `Meeting ${clientCo}`,
      summary: "Lead a discovery call with the client, handle a disagreement in the team meeting, and follow up in writing.",
      steps: [
        {
          id: "d2-brief",
          kind: "inbox",
          title: "Read the client briefing",
          from: "manager",
          subject: `Discovery call with ${clientCo} today`,
          body: `Hi ${you},

Last week we sent ${clientCo} a proposal for ${cast.project}. They liked it, and ${cast.client.name}, their ${dept.client.role}, has agreed to a discovery call today.

I'd like you to lead the call. Your goal is to understand what they need before we start: their goals, their customers, their budget, their timeline, and how they'll measure success.

After the call we'll debrief as a team, then please send ${k} a follow-up email. Copy me and ${ceo}.

${m}`,
        },
        {
          id: "d2-discovery",
          kind: "meeting",
          title: `Discovery call with ${clientCo}`,
          agenda: "Understand the client's goals, customers, budget, timeline and measures of success",
          participants: ["manager", "client"],
          lines: [
            { speaker: "manager", text: `Good morning, ${k}. Thank you for making time. This is ${you} from our team, who will lead today's call.` },
            { you: `Greet ${k}, introduce yourself, and set the agenda for the call.` },
            { speaker: "client", text: `Thank you. We read your proposal and we're excited. Let me tell you where we are. ${dept.discovery[0]}` },
            { you: "Ask your first discovery question: about goals, customers, budget, timeline, or how success will be measured." },
            { speaker: "client", text: `Good question. ${dept.discovery[1]}` },
            { you: "Ask another discovery question." },
            { speaker: "client", text: dept.discovery[2] },
            { you: "Ask one more question, or check that you've understood correctly." },
            { speaker: "client", text: dept.discovery[3] },
            { you: "Summarise what you heard and agree the next steps with the client." },
            { speaker: "client", text: "That's a good summary. I look forward to your email." },
            { speaker: "manager", text: `Thank you, ${k}. We'll be in touch today. ${you}, let's debrief with the team shortly.` },
          ],
          rubric:
            "Professional greeting and a clear agenda; open, relevant discovery questions (goals, audience, budget, timeline, success measures); listens and builds on answers; an accurate summary; agreed next steps.",
        },
        {
          id: "d2-debrief",
          kind: "meeting",
          title: "Team meeting: client debrief",
          agenda: "Share what we learnt from the client and agree our approach",
          participants: ["manager", "supporter", "challenger"],
          lines: [
            { speaker: "manager", text: `Thanks for joining, everyone. ${you} led the call with ${clientCo}. ${you}, please share what we learnt and how you'd approach the work.` },
            { you: "Share the key points from the discovery call and the approach you'd suggest." },
            { speaker: "challenger", text: `I don't agree. ${dept.conflict.position} ${dept.conflict.reason}` },
            { you: `Respond to ${c}. Stay calm, acknowledge their point, and explain your view with reasons.` },
            { speaker: "supporter", text: `I can see both sides. ${you}, how would we know which approach is working?` },
            { you: `Answer ${s}'s question.` },
            { speaker: "challenger", text: "Fine. I still have doubts, but I'm willing to try it if we can show results." },
            { you: "Propose how the team should decide, and agree who does what next." },
            { speaker: "manager", text: `Good discussion, everyone. ${you}, please send the follow-up email to ${k} today, and copy me and ${ceo}.` },
          ],
          rubric:
            "Shares the client's needs clearly and accurately; responds to the disagreement calmly and respectfully, acknowledging the other view; backs their view with reasons or a way to test it; helps the team reach an agreement and clear next steps.",
        },
        {
          id: "d2-followup",
          kind: "email",
          title: `Follow-up email to ${k}`,
          task: `Send ${k} a follow-up email after the discovery call: thank them, summarise what you heard, and set out the next steps and timeline. Copy ${m} and ${ceo}.`,
          to: ["client"],
          cc: ["manager", "ceo"],
          rubric:
            "To the client with the manager and CEO in Cc; a clear subject; thanks the client; an accurate summary of goals, audience, budget and timeline from the call; clear next steps with dates; professional and concise.",
        },
        {
          id: "d2-cob",
          kind: "report",
          title: "Close of business report",
          task: `Send ${m} your COB report for today.`,
          fields: COB_FIELDS,
          rubric: "Mentions the call, the team meeting and the email; honest about open questions; a clear next step; concise.",
        },
      ],
    },
    {
      day: 3,
      title: "Building the project",
      summary: `Build the work in the Practice Lab, and handle a change from ${clientCo}.`,
      steps: [
        {
          id: "d3-brief",
          kind: "inbox",
          title: "Read the build brief",
          from: "manager",
          subject: `Let's build: ${cast.project}`,
          body: `Hi ${you},

Thanks for the follow-up to ${k}. ${clientCo} has approved the plan, so today we build.

Please do the work in the Practice Lab (${cast.labTool}), using what we learnt in the discovery call. When you're done, send me a short summary of what you built and why, with a link or the details I need to review it.

${s} is happy to help if you get stuck. ${c} will review the work too.

${m}`,
        },
        {
          id: "d3-build",
          kind: "work",
          title: "Build the project",
          task: `Do the work in the Practice Lab (${cast.labTool}), then send ${m} a summary of what you built, why, and how it meets ${clientCo}'s needs. Add a link if you have one.`,
          rubric:
            "Describes concrete work that matches the client's needs from discovery; explains the reasoning; mentions how success will be measured; clear enough for a manager to review.",
        },
        {
          id: "d3-change",
          kind: "inbox",
          title: `Read ${k}'s email`,
          from: "client",
          subject: dept.change.subject,
          body: `Hi ${you},

${dept.change.body}

Thanks,
${cast.client.name}
${cast.client.role}`,
        },
        {
          id: "d3-change-reply",
          kind: "email",
          title: `Reply to ${k}'s change`,
          task: `Reply to ${k}. Acknowledge the change, explain how it affects the work (time, budget or results), and say what you'll do. Copy ${m}.`,
          to: ["client"],
          cc: ["manager"],
          rubric:
            "Replies to the client with the manager in Cc; acknowledges the request positively; explains the effect on time, budget or results honestly; proposes a clear way forward; doesn't overpromise.",
        },
        {
          id: "d3-cob",
          kind: "report",
          title: "Close of business report",
          task: `Send ${m} your COB report for today.`,
          fields: COB_FIELDS,
          rubric: "Specific about the build and the client's change; flags risks early; a clear next step.",
        },
      ],
    },
    {
      day: 4,
      title: "Delivery day",
      summary: "Present the work to the client, handle their concern, follow up, and have your review.",
      steps: [
        {
          id: "d4-presentation",
          kind: "meeting",
          title: `Presentation to ${clientCo}`,
          agenda: "Present the work, answer questions, agree next steps",
          participants: ["manager", "client", "ceo"],
          lines: [
            { speaker: "manager", text: `Good morning, ${k}. Our CEO, ${ceo}, has joined us today. ${you} will take you through the work.` },
            { speaker: "ceo", text: `Good morning, everyone. I'm looking forward to this.` },
            { you: `Present the work to ${k}: what you built, how it meets their goals, and what results to expect.` },
            { speaker: "client", text: `Thank you. I have one concern. ${dept.objection}` },
            { you: `Answer ${k}'s concern honestly and confidently.` },
            { speaker: "client", text: "That helps. So what happens next?" },
            { you: "Agree the next steps and close the meeting." },
            { speaker: "ceo", text: `Thank you, ${you}. Nicely done.` },
          ],
          rubric:
            "A clear, structured presentation tied to the client's goals; answers the objection with facts and empathy, without getting defensive; agrees specific next steps; professional close.",
        },
        {
          id: "d4-thanks",
          kind: "email",
          title: `Thank-you email to ${k}`,
          task: `Email ${k} after the presentation: thank them, recap what was agreed, answer their concern in writing, and confirm next steps. Copy ${m} and ${ceo}.`,
          to: ["client"],
          cc: ["manager", "ceo"],
          rubric:
            "To the client with the manager and CEO in Cc; thanks them; recaps the agreement; addresses the concern in writing; confirms next steps and dates; warm and professional.",
        },
        {
          id: "d4-review",
          kind: "meeting",
          title: `Performance review with ${m}`,
          agenda: "Your month at Brightwave: what went well and what's next",
          participants: ["manager"],
          lines: [
            { speaker: "manager", text: `Thanks for your work these past weeks, ${you}. Let's do your review. What do you think went well?` },
            { you: "Say what went well, with examples." },
            { speaker: "manager", text: "Good. What would you do differently next time?" },
            { you: "Say what you'd do differently, honestly." },
            { speaker: "manager", text: "Thank you for being honest. Last question: what skills will you work on next?" },
            { you: "Say what you'll work on next and how." },
            { speaker: "manager", text: `It's been good working with you, ${you}. Please send me your end of placement report.` },
          ],
          rubric:
            "Reflects honestly with specific examples; accepts areas to improve without excuses; a concrete plan for growth; professional and positive.",
        },
        {
          id: "d4-final",
          kind: "report",
          title: "End of placement report",
          task: `Send ${m} your end of placement report.`,
          fields: ["What I delivered", "What I learnt", "What I'll improve"],
          rubric: "Concrete deliverables; real lessons, not generic ones; a clear improvement plan.",
        },
      ],
    },
  ];
}

// ------------------------------------------------------------- schedule

const LAGOS_OFFSET_MS = 60 * 60 * 1000; // UTC+1 all year
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Work Life started on the weekend of 17 October 2026: cohorts already
 * running then count their workdays from that weekend, not from their own
 * first weekend (which had passed).
 */
export const WORK_LIFE_LAUNCH = new Date("2026-10-12T00:00:00+01:00");

/**
 * When workday `day` opens and is due: the Saturday 00:00 (Lagos) of the
 * cohort's `day`-th weekend (counting from launch for cohorts that began
 * before it), open until the end of that Sunday.
 */
export function workdayWindow(cohortStart: Date, day: number) {
  const from = cohortStart < WORK_LIFE_LAUNCH ? WORK_LIFE_LAUNCH : cohortStart;
  const local = new Date(from.getTime() + LAGOS_OFFSET_MS);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const toSaturday = (6 - new Date(midnight).getUTCDay() + 7) % 7;
  const opensAt = new Date(midnight + (toSaturday + 7 * (day - 1)) * DAY_MS - LAGOS_OFFSET_MS);
  return { opensAt, dueAt: new Date(opensAt.getTime() + 2 * DAY_MS) };
}

// Career Navigator (/career-navigator): the questions, the skills it can
// recommend and the scoring. No imports, so the page, the browser and the
// tests can all use it.
//
// Each answer adds points to a few skills and to one strength. A skill's
// total is compared with what random answers would give it, so a skill that
// appears in more answers isn't favoured.

export const SKILL_IDS = [
  "automation",
  "back",
  "cyber",
  "front",
  "wordpress",
  "content",
  "social",
  "marketing",
  "assistant",
] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export type Trait = "logic" | "creative" | "people" | "order" | "curious" | "builder";

export const TRAITS: Record<Trait, { name: string; text: string }> = {
  logic: { name: "Problem solver", text: "You like working out how things should fit together." },
  creative: { name: "Creative thinker", text: "You see fresh ways to show and say things." },
  people: { name: "People person", text: "You connect with people and bring them along." },
  order: { name: "Organiser", text: "You keep things on track, and people rely on you." },
  curious: { name: "Investigator", text: "You look closer and ask why until it makes sense." },
  builder: { name: "Builder", text: "You like making things that people can actually use." },
};

type Skill = {
  name: string;
  /** Short label for the compass. */
  short: string;
  /** Recognises the Sabirole track, whatever its exact name. */
  match: RegExp;
  what: string;
  day: string;
  firstStep: string;
};

export const SKILLS: Record<SkillId, Skill> = {
  automation: {
    name: "AI Automation",
    short: "Automation",
    match: /ai automation/i,
    what: "Connecting apps and AI so that repeated work does itself.",
    day: "Setting up a flow that reads customer messages, sorts them and replies to the simple ones.",
    firstStep: "Write down one task you repeat every week, then list its steps. That list is your first automation.",
  },
  back: {
    name: "Back-End Engineering",
    short: "Back-end",
    match: /back-?\s?end/i,
    what: "Building the part of an app you don't see: data, accounts and logic.",
    day: "Writing the code that saves an order, checks a payment and sends a receipt.",
    firstStep: "Pick an app you use and list what it has to remember about you. You've just sketched a database.",
  },
  cyber: {
    name: "Cybersecurity",
    short: "Security",
    match: /cyber/i,
    what: "Protecting people and companies from scams, leaks and attacks.",
    day: "Checking a company's accounts for weak spots and showing the team how to close them.",
    firstStep: "Turn on two-step verification for your own email and WhatsApp, and find out what it protects you from.",
  },
  front: {
    name: "Front-End Development",
    short: "Front-end",
    match: /front-?\s?end/i,
    what: "Building the screens people see and tap on websites and apps.",
    day: "Turning a design into a page that works on every phone.",
    firstStep: "On a computer, right-click any web page and choose Inspect. Change some text and watch the page change.",
  },
  wordpress: {
    name: "WordPress Development",
    short: "WordPress",
    match: /wordpress/i,
    what: "Building real business websites and shops quickly, with little code.",
    day: "Launching a small shop's website, with its products, pages and contact form.",
    firstStep: "Find a local business with no website and sketch the four pages it needs.",
  },
  content: {
    name: "AI for Content Creation",
    short: "AI content",
    match: /content creation/i,
    what: "Using AI tools to make writing, images and video people want to see.",
    day: "Planning a brand's week of posts, then making the scripts and visuals with AI.",
    firstStep: "Ask an AI tool for a caption, then rewrite it until it sounds like a real person.",
  },
  social: {
    name: "Social Media Marketing",
    short: "Social",
    match: /social media/i,
    what: "Growing brands on social platforms through posts and conversations.",
    day: "Posting for a brand, replying to its community and learning what people liked.",
    firstStep: "Choose a brand you follow and write down why its best three posts worked.",
  },
  marketing: {
    name: "Digital Marketing",
    short: "Marketing",
    match: /digital marketing/i,
    what: "Helping businesses find customers online and proving what works.",
    day: "Running an ad, reading its numbers and improving it.",
    firstStep: "Look at the next ad you see and ask: who is it for, and what does it want them to do?",
  },
  assistant: {
    name: "Virtual Assistance",
    short: "Assistant",
    match: /virtual assist/i,
    what: "Helping busy people run their work from anywhere: inbox, calendar and clients.",
    day: "Sorting a founder's inbox, booking meetings and following up with clients.",
    firstStep: "Plan one friend's week in a free online calendar, and see how much time it saves them.",
  },
};

export type Option = { text: string; trait: Trait; skills: Partial<Record<SkillId, number>> };
export type Question = { text: string; options: Option[] };

export const QUESTIONS: Question[] = [
  {
    text: "A friend's small business isn't selling. What do you do first?",
    options: [
      { text: "Make a short video that shows it off", trait: "creative", skills: { content: 2, social: 2 } },
      { text: "Find out who buys from them, and why", trait: "curious", skills: { marketing: 3, automation: 1 } },
      { text: "Build them a simple website", trait: "builder", skills: { wordpress: 3, front: 1 } },
      { text: "Take over the messages and orders", trait: "people", skills: { assistant: 3, social: 1 } },
    ],
  },
  {
    text: "It's a free Saturday. Which sounds best?",
    options: [
      { text: "Finding out how something works inside", trait: "curious", skills: { cyber: 2, back: 2 } },
      { text: "Designing or decorating something", trait: "creative", skills: { front: 2, content: 1, wordpress: 1 } },
      { text: "Planning an outing for everyone", trait: "order", skills: { assistant: 3, marketing: 1 } },
      { text: "Posting, chatting and catching up online", trait: "people", skills: { social: 3 } },
    ],
  },
  {
    text: "Your group has a project. Which part do you take?",
    options: [
      { text: "The hard part nobody has worked out", trait: "logic", skills: { back: 3, automation: 2 } },
      { text: "Making it look and feel right", trait: "creative", skills: { front: 3, content: 1 } },
      { text: "Keeping everyone on time", trait: "order", skills: { assistant: 3, wordpress: 1 } },
      { text: "Presenting it and winning people over", trait: "people", skills: { marketing: 2, social: 2 } },
    ],
  },
  {
    text: "You have to do the same boring task every day. You…",
    options: [
      { text: "Find a way to make it do itself", trait: "logic", skills: { automation: 4, back: 1 } },
      { text: "Make a checklist so nothing is missed", trait: "order", skills: { assistant: 2, cyber: 2 } },
      { text: "Turn it into something fun to watch", trait: "creative", skills: { content: 3, social: 1 } },
      { text: "Check whether it's worth doing at all", trait: "curious", skills: { marketing: 3, cyber: 1 } },
    ],
  },
  {
    text: "Which compliment would make your day?",
    options: [
      { text: "“You notice what everyone else misses.”", trait: "curious", skills: { cyber: 3, front: 1 } },
      { text: "“Your ideas are always fresh.”", trait: "creative", skills: { content: 3, social: 1 } },
      { text: "“I can always rely on you.”", trait: "order", skills: { assistant: 3, wordpress: 1 } },
      { text: "“You can fix anything.”", trait: "builder", skills: { back: 2, automation: 2, wordpress: 1 } },
    ],
  },
  {
    text: "A message says you've won ₦500,000. What's your first thought?",
    options: [
      { text: "How does this scam work?", trait: "curious", skills: { cyber: 4 } },
      { text: "I should warn people in a post", trait: "people", skills: { social: 3, content: 1 } },
      { text: "Why would these words make someone click?", trait: "logic", skills: { marketing: 3, content: 1 } },
      { text: "Delete it. Back to what I was doing", trait: "order", skills: { assistant: 1, wordpress: 2, back: 1 } },
    ],
  },
  {
    text: "Which would you be proudest to show off?",
    options: [
      { text: "A website a business uses every day", trait: "builder", skills: { wordpress: 3, front: 2 } },
      { text: "A post that thousands of people shared", trait: "creative", skills: { social: 3, content: 1 } },
      { text: "A system quietly running behind an app", trait: "logic", skills: { back: 4, automation: 1 } },
      { text: "A business whose sales doubled", trait: "people", skills: { marketing: 4 } },
    ],
  },
  {
    text: "How do you feel about writing code?",
    options: [
      { text: "I'd love to understand it deeply", trait: "logic", skills: { back: 3, front: 2, cyber: 1 } },
      { text: "A little, if I can see the result", trait: "builder", skills: { wordpress: 3, front: 2 } },
      { text: "I'd rather use tools that skip the code", trait: "curious", skills: { automation: 3, content: 1 } },
      { text: "I'd rather work with people and words", trait: "people", skills: { social: 2, assistant: 2, marketing: 1 } },
    ],
  },
  {
    text: "Pick one tool to master.",
    options: [
      { text: "AI that writes, draws and edits video", trait: "creative", skills: { content: 4 } },
      { text: "AI that links apps and works while you sleep", trait: "logic", skills: { automation: 4 } },
      { text: "A dashboard that shows what customers do", trait: "curious", skills: { marketing: 3, cyber: 1 } },
      { text: "The calendar and inbox behind a business", trait: "order", skills: { assistant: 4 } },
    ],
  },
  {
    text: "Something stops working late at night. You…",
    options: [
      { text: "Hunt for the exact cause", trait: "logic", skills: { back: 3, cyber: 2 } },
      { text: "Rebuild it so it's cleaner", trait: "builder", skills: { front: 2, wordpress: 2 } },
      { text: "Set up an alert so it can't surprise you again", trait: "order", skills: { automation: 3, cyber: 2 } },
      { text: "Reassure the people affected", trait: "people", skills: { assistant: 2, social: 2 } },
    ],
  },
  {
    text: "What does a good workday look like?",
    options: [
      { text: "Quiet, with one thing to focus on", trait: "logic", skills: { back: 2, front: 2, cyber: 1 } },
      { text: "New ideas every hour", trait: "creative", skills: { content: 3, social: 1 } },
      { text: "A clear list, all ticked off", trait: "order", skills: { assistant: 2, wordpress: 2 } },
      { text: "A number to beat, and I beat it", trait: "curious", skills: { marketing: 3, automation: 1 } },
    ],
  },
  {
    text: "Five years from now, you'd like to be known for…",
    options: [
      { text: "Building products people use", trait: "builder", skills: { front: 3, back: 1, wordpress: 1 } },
      { text: "Keeping people and companies safe", trait: "curious", skills: { cyber: 4 } },
      { text: "Making brands people talk about", trait: "people", skills: { social: 2, marketing: 1, content: 2 } },
      { text: "Making businesses run smoothly", trait: "order", skills: { automation: 3, assistant: 2 } },
    ],
  },
];

/** What random answers to the first `count` questions give a skill, and how much it varies. */
function expected(id: SkillId, count: number) {
  let mean = 0;
  let variance = 0;
  for (const { options } of QUESTIONS.slice(0, count)) {
    const points = options.map((option) => option.skills[id] ?? 0);
    const average = points.reduce((sum, value) => sum + value, 0) / points.length;
    mean += average;
    variance += points.reduce((sum, value) => sum + (value - average) ** 2, 0) / points.length;
  }
  return { mean, spread: Math.sqrt(variance) || 1 };
}

export type RankedSkill = { id: SkillId; score: number };

/** Every skill, best first. `answers` holds the option chosen per question. */
export function rankSkills(answers: number[]): RankedSkill[] {
  return SKILL_IDS.map((id) => {
    const total = answers.reduce((sum, choice, index) => sum + (QUESTIONS[index]?.options[choice]?.skills[id] ?? 0), 0);
    const { mean, spread } = expected(id, answers.length);
    return { id, score: (total - mean) / spread };
  }).sort((a, b) => b.score - a.score);
}

/** The person's strongest traits, strongest first. */
export function topTraits(answers: number[], count = 3): Trait[] {
  const totals = new Map<Trait, number>();
  answers.forEach((choice, index) => {
    const trait = QUESTIONS[index]?.options[choice]?.trait;
    if (trait) totals.set(trait, (totals.get(trait) ?? 0) + 1);
  });
  return [...totals].sort((a, b) => b[1] - a[1]).slice(0, count).map(([trait]) => trait);
}

/** The person's own answers that pointed most strongly to a skill. */
export function reasonsFor(id: SkillId, answers: number[], count = 3): { question: string; answer: string }[] {
  return answers
    .map((choice, index) => {
      const option = QUESTIONS[index].options[choice];
      return { question: QUESTIONS[index].text, answer: option.text, points: option.skills[id] ?? 0 };
    })
    .filter((item) => item.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, count)
    .map(({ question, answer }) => ({ question, answer }));
}

/** A skill's place on the compass, in degrees clockwise from the top. */
export function bearing(id: SkillId) {
  return (SKILL_IDS.indexOf(id) * 360) / SKILL_IDS.length;
}

export type NavigatorOffer = { slug: string; price: number };

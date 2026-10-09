// What interns are told about the internship and each part of the app: the
// first-visit welcome, the guided tour of the menu, the "How this page
// works" box on each page and the Help page all read from here, so they
// always agree. Plain words; never call learning material "courses".

export type GuideSection =
  | "dashboard"
  | "tasks"
  | "resources"
  | "lab"
  | "discussion"
  | "mentor"
  | "interview"
  | "grades"
  | "certificate"
  | "profile";

export type GuideEntry = {
  label: string;
  href: string;
  /** One or two sentences for the tour. */
  summary: string;
  /** "How this page works", step by step. */
  steps: string[];
};

/** The welcome slides: what the internship is, before anything else. */
export const WELCOME_SLIDES: Array<{ title: string; body: string[] }> = [
  {
    title: "Welcome to your internship",
    body: [
      "This is not a class. It's a hands-on internship: you'll work like a junior member of a real team.",
      "Throughout your cohort you get real tasks with deadlines. You do the work, submit it here, and a mentor reviews it.",
      "Your first task is a group task, so you learn to work as a team. Start by meeting your group in Group Discussion.",
    ],
  },
  {
    title: "How it works",
    body: [
      "1. Learn what you need from Resources (guides, videos and notes for your track).",
      "2. Do your tasks and submit them before the deadline. Some you do alone, some with your group: for group tasks, your group leader submits once and ticks everyone who took part.",
      "3. Mentors review your work and grade it. If it needs changes, fix it and submit again.",
      "4. Practise skills any time in the Practice Lab.",
    ],
  },
  {
    title: "How you finish",
    body: [
      "Pass enough of your tasks by the end of your cohort and you earn your certificate.",
      "Then you can move up to the next level (Entry → Intermediate → Senior).",
      "Tip: check your dashboard every day. It shows what's due next.",
    ],
  },
];

export const GUIDE: Record<GuideSection, GuideEntry> = {
  dashboard: {
    label: "Dashboard",
    href: "/internship/dashboard",
    summary: "Your home page. It shows your progress, your next task and its deadline, and news from the team.",
    steps: [
      "The green box shows your current task and when it's due. Start there.",
      "The numbers show tasks you've passed, tasks still pending and your average grade.",
      "Check announcements here for news from the team.",
    ],
  },
  tasks: {
    label: "Task",
    href: "/internship/dashboard/tasks",
    summary: "Your work. Every task has a deadline; open one to read what to do and submit your work.",
    steps: [
      "Open a task to read the brief: what to do, the deadline and how many points it's worth.",
      "Individual tasks: you submit them yourself.",
      "Group tasks: work on it together; your group leader submits once and ticks who took part. Only members ticked get credit, so take part and check your name is ticked.",
      "Submit before the deadline. Some tasks are done in the Practice Lab and graded automatically.",
      "After review you'll see your score and feedback. If it needs changes, improve your work and submit again.",
    ],
  },
  resources: {
    label: "Resources",
    href: "/internship/dashboard/resources",
    summary: "Learning material for your track and level: guides, videos and notes to help you do your tasks.",
    steps: [
      "Pick a resource and work through it at your own pace.",
      "Use them when a task needs a skill you don't have yet.",
      "Recommended ones also appear on your dashboard.",
    ],
  },
  lab: {
    label: "Practice Lab",
    href: "/internship/dashboard/lab",
    summary: "Hands-on practice: coding, ad campaigns, social media, automations and more, checked instantly.",
    steps: [
      "Open an exercise and read the brief at the top.",
      "Do the work in the workspace below. Your work saves automatically.",
      "Run it or check it as often as you like to see what passes.",
      "Submit when you're happy. If it's linked to a task, submitting grades that task.",
    ],
  },
  discussion: {
    label: "Group Discussion",
    href: "/internship/dashboard/discussion",
    summary: "Chat with your group, plan group tasks and schedule meetings. Your first task is a group task, so start here.",
    steps: [
      "Introduce yourself to your group here: your first task is a group task.",
      "Agree who does what, and share your progress before the deadline.",
      "Use Schedule Meeting to set a time to meet online.",
      "Group leaders: when you submit, tick everyone who took part. Only members ticked get credit.",
    ],
  },
  mentor: {
    label: "Mentor",
    href: "/internship/dashboard/mentor",
    summary: "Message your personal mentor for help and advice (Premium).",
    steps: [
      "Ask your mentor about tasks you're stuck on, your progress or your career.",
      "Be specific: say which task and what you've tried.",
      "This is a Premium feature; upgrade from the Upgrade button in the menu.",
    ],
  },
  interview: {
    label: "Interview",
    href: "/internship/dashboard/interview",
    summary: "Practise job interviews with our AI interviewer and get a score and tips (Premium).",
    steps: [
      "Choose a video call or a voice-only call.",
      "Answer the questions as you would in a real interview.",
      "Your score and tips appear here a few minutes after you finish.",
    ],
  },
  grades: {
    label: "Grades",
    href: "/internship/dashboard/grades",
    summary: "All your submitted work with scores and feedback from your mentors.",
    steps: [
      "See every task you've submitted and whether it was accepted.",
      "Read the feedback: it tells you what to improve.",
      "Your average score and tasks completed are shown at the top.",
    ],
  },
  certificate: {
    label: "Certificate",
    href: "/internship/dashboard/certificate",
    summary: "Your certificate appears here when you finish: pass enough tasks by the end of your cohort.",
    steps: [
      "It unlocks when your cohort ends, if you've passed enough tasks.",
      "Download it as a PDF to share or print. Employers can check it's real.",
      "Then you can move up to the next level from your dashboard.",
    ],
  },
  profile: {
    label: "Profile",
    href: "/internship/dashboard/profile",
    summary: "Your details and photo. Keep them up to date so your mentor and group know who you are.",
    steps: [
      "Add a photo and check your name is spelled correctly: it's printed on your certificate.",
      "Keep your phone number current so your group can reach you.",
    ],
  },
};

/** The order of the guided tour. */
export const TOUR_ORDER: GuideSection[] = [
  "dashboard",
  "tasks",
  "resources",
  "lab",
  "discussion",
  "grades",
  "certificate",
  "mentor",
  "interview",
  "profile",
];

/** Common questions for the Help page. */
export const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Is this a class? When are the lectures?",
    a: "There are no lectures. It's a hands-on internship: you learn by doing real tasks. Resources give you the knowledge, tasks are where you apply it, and mentors review your work.",
  },
  {
    q: "What should I do first?",
    a: "Say hello to your group in Group Discussion: your first task is a group task. Then open the task under Task, read the brief and deadline together, agree who does what, and use Resources to learn what you need.",
  },
  {
    q: "How do I submit a task?",
    a: "Go to Task, open the task and use the submit section. For group tasks, only your group leader submits, once for the group, and ticks everyone who took part. Some tasks link to a Practice Lab exercise: submit it there.",
  },
  {
    q: "I worked on a group task but got no credit. Why?",
    a: "Only members your group leader ticked when submitting get credit. Ask your leader to correct it, and if it's already been reviewed, contact the team.",
  },
  {
    q: "My task was rejected. What now?",
    a: "Read the feedback in Grades or on the task, fix what it says, and submit again before the deadline.",
  },
  {
    q: "How do I get my certificate?",
    a: "Pass enough of your tasks by the end of your cohort. It then appears under Certificate, and you can move up to the next level.",
  },
  {
    q: "Who do I ask for help?",
    a: "Your group in Group Discussion, your mentor (Premium), or the team through the contact options on the website.",
  },
];

/** Pages whose visit ticks a getting-started step. */
export const STARTER_STEPS: Array<{ key: string; label: string; href: string; section?: GuideSection }> = [
  { key: "welcome", label: "Learn how the internship works", href: "/internship/dashboard/help" },
  { key: "discussion", label: "Meet your group: your first task is a group task", href: "/internship/dashboard/discussion", section: "discussion" },
  { key: "tasks", label: "Open your tasks and read the current one", href: "/internship/dashboard/tasks", section: "tasks" },
  { key: "resources", label: "Look through your Resources", href: "/internship/dashboard/resources", section: "resources" },
  { key: "lab", label: "Try an exercise in the Practice Lab", href: "/internship/dashboard/lab", section: "lab" },
];

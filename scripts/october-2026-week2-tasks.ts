// The Week 2 tasks for the October 2026 cohorts (scripts/october-2026-week2-reset.ts),
// as written by the academy, with each track's details filled in.
//
// Changed from the original text to match the app: the submit button is
// "Submit task"; the group chat is "Group Discussion"; the Grouh LinkedIn
// link wasn't provided, so its line is left out (the other ways to find the
// page are renumbered). "Week 2 Task 2: Get Hired in Office Life" isn't here:
// it needs Office Life tasks to submit themselves, which wasn't live yet.

const COMPANY = "Grouh";

const TRACKS: Record<string, { headline: string; skills: string; device: string }> = {
  "Social Media Marketing": {
    headline: "Social Media Marketing Intern at Grouh | Learning content, community and paid social",
    skills: "Social Media Marketing, Content Creation, Canva",
    device: "A phone is enough for this task.",
  },
  "Digital Marketing": {
    headline: "Digital Marketing Intern at Grouh | Learning SEO, ads and analytics",
    skills: "Digital Marketing, Search Engine Optimization (SEO), Google Analytics",
    device: "A phone is enough for this task.",
  },
  "AI for Content Creation": {
    headline: "AI Content Creation Intern at Grouh | Learning to create content with AI tools",
    skills: "Content Creation, Prompt Engineering, Copywriting",
    device: "A phone is enough for this task.",
  },
  "AI Automation": {
    headline: "AI Automation Intern at Grouh | Learning to automate business processes",
    skills: "Workflow Automation, Zapier, n8n",
    device: "A phone is enough for this task. From next week, you will need a laptop for the Practice Lab.",
  },
  "Front-End Development": {
    headline: "Front-End Development Intern at Grouh | Learning HTML, CSS and JavaScript",
    skills: "HTML, CSS, JavaScript",
    device: "A phone is enough for this task. From next week, you will need a laptop for the Practice Lab.",
  },
  "Back-End Engineering": {
    headline: "Back-End Engineering Intern at Grouh | Learning APIs, databases and Node.js",
    skills: "Back-End Development, Node.js, SQL",
    device: "A phone is enough for this task. From next week, you will need a laptop for the Practice Lab.",
  },
  "WordPress Development": {
    headline: "WordPress Development Intern at Grouh | Learning to build websites with WordPress",
    skills: "WordPress, Website Development, Elementor",
    device: "A phone is enough for this task. From next week, you will need a laptop for the Practice Lab.",
  },
};

function task1(track: string, details: (typeof TRACKS)[string]) {
  return `WHAT THIS TASK IS ABOUT
You are now an intern at ${COMPANY}. Employers, clients and other professionals look you up on LinkedIn before they work with you. In this task, you will create (or update) your LinkedIn profile so it shows that you are a ${track} intern at ${COMPANY}.

WHO DOES THIS TASK
Everyone. This is an individual task. Each person does their own.

WHERE YOU DO IT
Outside the Grouh Academy app, on LinkedIn (the LinkedIn app on your phone, or linkedin.com in your browser). You submit your work here in the Grouh Academy app.

DEVICE
A phone is enough for this task.

TIME NEEDED
About 30 to 60 minutes.

STEP 1: CREATE OR OPEN YOUR LINKEDIN ACCOUNT
1. If you do not have a LinkedIn account, download the LinkedIn app or go to linkedin.com and sign up with your email address. Use your real full name.
2. If you already have an account, log in.

STEP 2: ADD A PROFESSIONAL PHOTO
1. Use a clear, recent photo of your face, with good lighting and a plain background.
2. Look at the camera and dress as you would for work.
3. Do not use a group photo, a cartoon or a photo with sunglasses.

STEP 3: WRITE YOUR HEADLINE
Your headline is the short line under your name. Edit it to say:
${details.headline}
You can adjust the words a little, but it must say that you are a ${track} intern at ${COMPANY}.

STEP 4: WRITE YOUR "ABOUT" SECTION
Write 3 to 5 sentences about yourself, in your own words. Include:
1. Who you are and what you studied or have done so far
2. That you are currently a ${track} intern at ${COMPANY}
3. What you are learning and what you want to achieve in this field
Write it yourself. Do not copy it from someone else or from an AI tool.

STEP 5: FIND AND FOLLOW THE GROUH PAGE
Grouh has a company page on LinkedIn. You will attach your internship to it in the next step, so find it first:
1. In the LinkedIn search bar, type Grouh (spelt G-R-O-U-H) and open the Grouh company page.
2. The link is also shared in the Grouh Academy WhatsApp community.
3. Press Follow on the page.

STEP 6: ADD YOUR INTERNSHIP AS EXPERIENCE
Go to the Experience section of your profile and add a new position with these details:
- Title: ${track} Intern
- Employment type: Internship
- Company: Grouh. Type G-R-O-U-H in the company box and select the Grouh page from the list that appears, so the Grouh logo shows on your profile. Do not just type the name without selecting the page.
- Location: Abuja, Nigeria (or your city), and choose Remote if you work online
- Start date: October 2026
- Tick the box that says you are currently working in this role
- Description: one or two sentences on what you are learning, for example "Learning ${track} through practical tasks, team projects and real-world simulations."
Save it.

STEP 7: ADD 3 SKILLS
Go to the Skills section and add these three skills:
${details.skills}

STEP 8: MAKE SURE YOUR PROFILE CAN BE SEEN
Your profile must be public so your mentor can open it. In LinkedIn's settings, check that your public profile is visible to everyone.

STEP 9: COPY YOUR PROFILE LINK
On your profile, tap the three dots (...) or the share option, and copy the link to your profile. It looks like this: linkedin.com/in/your-name

HOW TO SUBMIT
In this task, paste the following into the submission box:
1. Your LinkedIn profile link
2. Your headline, copied exactly as it appears on your profile
Then press Submit task.

HOW YOUR WORK WILL BE CHECKED
Your mentor will open your link and check that:
1. The link works and the profile is public
2. You have a clear professional photo
3. Your headline says you are a ${track} intern at ${COMPANY}
4. Your About section is written in your own words
5. Your Experience shows ${track} Intern at Grouh, Internship, from October 2026, current role, linked to the Grouh company page (the Grouh logo shows)
6. You have added the 3 skills
7. You follow the Grouh page
If something is missing, your mentor will send it back with feedback, and you can fix it and submit again.

DEADLINE
Tuesday 20 October 2026, 11:59 pm (WAT).

BONUS (OPTIONAL)
Share your LinkedIn link in Group Discussion in the app and connect with your groupmates on LinkedIn.`;
}

function task3(track: string, details: (typeof TRACKS)[string]) {
  return `WHAT THIS TASK IS ABOUT
Before you start the practical work, you need to understand what ${track} is, what people in this field do, and why businesses need them. In this task, you will watch the introduction videos for your track and write a note about what you learned.

WHO DOES THIS TASK
Everyone. This is an individual task. Each person writes their own note.

WHERE YOU DO IT
Inside the Grouh Academy app, in the Resources section. You submit your note here in this task.

DEVICE
${details.device}

TIME NEEDED
About 1 to 2 hours (watching and writing).

STEP 1: OPEN THE RESOURCES
1. In the Grouh Academy app, open Resources from the menu.
2. Find the resource called "Week 2 – Introduction to ${track}" and open it.
3. The videos are being added this week. If you cannot see the resource yet, check again later. You will be told when it is ready. Start with Task 1 and Task 2 in the meantime.

STEP 2: WATCH ALL THE VIDEOS
1. Watch every video in that resource, from start to finish.
2. Take notes while you watch. Write down new words, ideas that surprise you, and questions you have.
3. Mark each lesson as complete when you finish it.

STEP 3: WRITE YOUR NOTE
Write a note of 300 to 500 words, in your own words, answering these questions:
1. In simple words, what is ${track}?
2. What does a person who works in ${track} do on a normal working day?
3. Why do businesses need people with ${track} skills? Give one example of a Nigerian business or app that uses these skills.
4. What surprised you the most in the videos?
5. What are you most excited to learn in this internship?
6. What are you still confused about? (It is fine to be confused. Your mentor will use this to help you.)

RULES
- Write it yourself, in your own words. Do not copy from the videos or from websites.
- Do not use ChatGPT or any other AI tool to write your note. Notes written by AI will be rejected.
- Short, honest answers are better than long, copied ones.

HOW TO SUBMIT
Paste your note into the submission box in this task, then press Submit task.

HOW YOUR WORK WILL BE CHECKED
Your mentor will check that:
1. You answered all 6 questions
2. Your note is between 300 and 500 words
3. Your answers show that you watched the videos
4. It is written in your own words
If something is missing, your mentor will send it back with feedback, and you can fix it and submit again.

DEADLINE
Tuesday 20 October 2026, 11:59 pm (WAT).`;
}

/** The Week 2 tasks for a track (by its name in the database). */
export function WEEK2_TASKS(track: string) {
  const details = TRACKS[track];
  if (!details) throw new Error(`No Week 2 task details for the track "${track}".`);
  return [
    { title: "Week 2 Task 1: Build Your Professional LinkedIn Profile", description: task1(track, details), officeLifeDay: null, matches: /week 2 task 1|linkedin/i },
    { title: `Week 2 Task 3: Introduction to ${track}`, description: task3(track, details), officeLifeDay: null, matches: /week 2 task 3|introduction to/i },
  ];
}

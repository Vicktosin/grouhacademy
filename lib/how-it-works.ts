// "How it works" guides for Office Life and the Practice Lab
// (components/onboarding/HowItWorksGuide). Written for complete beginners, from
// the real screens: every button and tab name here is the one interns see.

export type HowItWorksGuide = {
  /** Remembered in this browser once closed (lib/intern-onboarding). */
  key: "office-life" | "practice-lab";
  title: string;
  intro: string;
  sections: Array<{ heading: string; steps: string[] }>;
};

export const OFFICE_LIFE_GUIDE: HowItWorksGuide = {
  key: "office-life",
  title: "How Office Life works",
  intro:
    "Office Life is practice for a real job. You work at a pretend company, with a manager, colleagues and a client. You read emails, write replies, join meetings and send reports, just like at work.",
  sections: [
    {
      heading: "Your workdays",
      steps: [
        "Open Office Life from the menu. You see your workdays, one card for each.",
        "Each workday opens and closes at set times. The card shows \"Opens\" and \"Due\" (Lagos time).",
        "Before it opens, the button says \"Not open yet\". After it closes, it says \"Window closed\" and you can no longer do it.",
        "When a workday is open, press \"Start this workday\".",
      ],
    },
    {
      heading: "Clock in",
      steps: [
        "Press \"Clock in and start work\". Just like a real job, you clock in before you start.",
        "On the left you see \"Today\": the list of steps for the day.",
        "The step marked \"Now\" is the one to do next.",
      ],
    },
    {
      heading: "Steps go in order",
      steps: [
        "Each step unlocks after you finish the one before it. Locked steps show a padlock.",
        "You cannot go back and redo a finished step. Read everything carefully before you send.",
        "You can stop and come back later before the due time. Press \"Continue\" on the workday card to carry on.",
      ],
    },
    {
      heading: "Mail: read and write emails",
      steps: [
        "Open the Mail tab. New emails arrive in your Inbox.",
        "When an email is waiting for your answer, a red dot shows on the tab. Read \"Your task\" so you know what to write.",
        "Press \"Write an email\" or \"Reply\". Choose who it goes to, add a subject and write your email.",
        "Press \"Send\". Emails stay inside Office Life. Nobody outside receives them.",
      ],
    },
    {
      heading: "Meet: meetings and interviews",
      steps: [
        "Open the Meet tab, then press \"Join now\".",
        "Listen to (or read) what people say. When it is \"Your turn\", answer.",
        "To speak, press \"Speak\", talk, then press \"Stop speaking\". To type instead, write your answer in the box.",
        "Press \"I'm done\" when you have finished each answer.",
        "At the end, press \"Leave the meeting\" to save the meeting.",
      ],
    },
    {
      heading: "Reports",
      steps: [
        "Open the Reports tab and fill in each box of the report.",
        "Some steps ask you to describe work you did, with a link. If a step needs a Practice Lab exercise, submit that exercise first, then come back.",
        "Press \"Send to\" your manager to hand it in.",
      ],
    },
    {
      heading: "Scores and feedback",
      steps: [
        "After each email, meeting or report, you get a score out of 100.",
        "Read the feedback: \"What worked\" and \"To do better\". Only you see it.",
        "When every step is done, you see \"Workday complete\" and your score for the whole day.",
        "\"Workplace readiness\" at the top is the average of your workday scores.",
      ],
    },
    {
      heading: "Tasks linked to a workday",
      steps: [
        "Some tasks are done in Office Life. Their task card has a button that opens the workday.",
        "When you finish the last step of that workday, the task is submitted for you automatically. There is nothing to type in the task.",
        "Your Office Life score is there to help you learn. It does not change your task result.",
      ],
    },
  ],
};

export const PRACTICE_LAB_GUIDE: HowItWorksGuide = {
  key: "practice-lab",
  title: "How the Practice Lab works",
  intro:
    "The Practice Lab is where you practise real skills in a safe simulator. Nothing here is real: no real ads are paid for, no real posts go online, and no real website is changed. You can try, make mistakes and try again.",
  sections: [
    {
      heading: "Before you start",
      steps: [
        "Use a laptop if you can. The exercises have editors and previews that are hard to use on a small phone screen.",
        "Open Practice Lab from the menu. You see the exercises for your track.",
        "Press an exercise to open it.",
      ],
    },
    {
      heading: "Do the exercise",
      steps: [
        "Read the brief at the top first. It tells you what to make and what will be checked.",
        "If the exercise is for a task, you also see \"For your task\" and the pass mark you need.",
        "Do the work in the workspace below the brief.",
        "Your work saves automatically. Look for \"All changes saved\" at the top. If it says \"Not saved, check your connection\", check your internet.",
      ],
    },
    {
      heading: "Check your work",
      steps: [
        "Run the checks or tests as often as you like (the button name for each kind of exercise is below).",
        "Each result shows what passed and what did not. Fix what did not pass and try again.",
        "Checking your work does not hand it in.",
      ],
    },
    {
      heading: "Submit",
      steps: [
        "When you are happy, press \"Submit\" (or \"Submit to task\" if the exercise is for a task).",
        "If the exercise is linked to a task, submitting marks that task straight away, using the pass mark.",
        "You can submit again later to do better, unless the task has already passed or a mentor is reviewing it.",
      ],
    },
    {
      heading: "HTML, CSS & JavaScript",
      steps: [
        "Edit the files in the tabs: index.html, styles.css and script.js.",
        "The \"Preview\" shows your page as you type.",
        "Press \"Run checks\" to test your page against the exercise's checks.",
      ],
    },
    {
      heading: "React",
      steps: [
        "Edit App.jsx and styles.css. The \"Preview\" shows your app.",
        "Press \"Run checks\" to test it.",
      ],
    },
    {
      heading: "Ad campaign (Ads Studio)",
      steps: [
        "A practice ads manager. Set up a campaign, its ad sets (audience, placements, budget and schedule) and its ads.",
        "Read \"Goals for this campaign\" first.",
        "Choose how many days to run it, then press \"Publish\". The simulator shows the results and how many goals you met. No real money is spent.",
      ],
    },
    {
      heading: "Social media",
      steps: [
        "Plan a week of posts for the brand.",
        "Press \"Run the week\" to see how the posts do.",
        "Read the follower comments and press \"Send replies\" after you answer them.",
      ],
    },
    {
      heading: "AI automation",
      steps: [
        "Build a workflow in the workflow builder, using the brief and the sample data.",
        "Press \"Test on sample data\" to see the path each record takes through your workflow.",
        "When you submit, your workflow is also tested on hidden records, so make it work for any record, not only the samples.",
      ],
    },
    {
      heading: "Backend API",
      steps: [
        "Write the server code in the editor. A practice server runs in your browser and restarts when your code changes.",
        "Use the API client to send requests to your server, and look at the database and the server logs.",
        "Press \"Run tests\" to run the exercise's API tests.",
      ],
    },
    {
      heading: "WordPress",
      steps: [
        "A real WordPress site runs inside your browser. Wait for \"Starting your WordPress site…\" to finish.",
        "Build the site, and edit theme and plugin files if the brief asks you to.",
        "Your site is saved in this browser on this device. Use the same device and browser to continue.",
        "Press \"Check my site\" to run the exercise's checks.",
      ],
    },
    {
      heading: "AI content",
      steps: [
        "There are three kinds: \"Prompt Lab\", \"Content Brief Studio\" and \"Fact-check and edit\".",
        "In Prompt Lab, write your prompts and press \"Run my prompts\" to see what the AI writes.",
        "In Content Brief Studio, write each piece the client wants and press \"Get it marked\".",
        "In Fact-check and edit, correct the draft and press \"Check my edit\".",
        "You have a limited number of runs. The number left shows next to the button.",
        "Your work is marked by rules and an AI judge.",
      ],
    },
  ],
};

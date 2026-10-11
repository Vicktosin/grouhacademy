import { z } from "zod";
import { castFor, type Cast, type MeetingLine, type PersonId, type Step, type Workday } from "@/lib/office-life/story";
import { isValidSchedulePoint, type SchedulePoint } from "@/lib/task-schedule";

const personId = z.enum(["ceo", "manager", "supporter", "challenger", "client"]);
const text = (max: number) => z.string().trim().min(1).max(max);

const lineSchema = z.union([
  z.object({ speaker: personId, text: text(4000) }),
  z.object({ you: text(1000) }),
]);

const stepSchema = z.discriminatedUnion("kind", [
  z.object({ id: text(80), kind: z.literal("inbox"), title: text(200), from: personId, subject: text(200), body: text(4000) }),
  z.object({ id: text(80), kind: z.literal("meeting"), title: text(200), agenda: text(1000), meetingType: z.enum(["meeting", "interview"]).optional(), participants: z.array(personId).min(1).max(5), lines: z.array(lineSchema).min(1).max(100), rubric: text(3000) }),
  z.object({ id: text(80), kind: z.literal("email"), title: text(200), task: text(2000), to: z.array(personId).min(1).max(5), cc: z.array(personId).max(5), rubric: text(3000) }),
  z.object({ id: text(80), kind: z.literal("report"), title: text(200), task: text(2000), fields: z.array(text(200)).min(1).max(10), rubric: text(3000) }),
  z.object({ id: text(80), kind: z.literal("work"), title: text(200), task: text(2000), rubric: text(3000), labScenarioId: z.string().max(100).nullable().optional() }),
]);

const workdaySchema = z.object({
  day: z.number().int().min(1).max(30),
  title: text(200),
  summary: text(2000),
  opensWeek: z.number().int().min(1).max(52),
  opensDay: z.number().int().min(1).max(7),
  opensTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  dueWeek: z.number().int().min(1).max(52),
  dueDay: z.number().int().min(1).max(7),
  dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  steps: z.array(stepSchema).min(1).max(30),
});

const contentSchema = z.object({
  contentVersion: z.literal(2),
  company: z.object({ name: text(160), domain: text(160), about: text(1000) }),
  department: text(160),
  clientCompany: text(160),
  clientBusiness: text(500),
  project: text(500),
  labTool: text(160),
  cast: z.record(personId, z.object({
    id: personId,
    name: text(160),
    role: text(160),
    email: z.string().trim().email().max(200),
    voice: z.enum(["female", "male"]),
  })),
  workdays: z.array(workdaySchema).min(1).max(30),
});

export type OfficeLifeContent = {
  contentVersion: 2;
  company: Cast["company"];
  department: string;
  clientCompany: string;
  clientBusiness: string;
  project: string;
  labTool: string;
  cast: Record<PersonId, Cast[PersonId]>;
  workdays: Workday[];
};

const LEVELS: Record<string, { rolePrefix: string; complexity: string }> = {
  Beginner: { rolePrefix: "Junior", complexity: "guided" },
  Novice: { rolePrefix: "Associate", complexity: "supported" },
  Intermediate: { rolePrefix: "Project", complexity: "independent" },
  Advanced: { rolePrefix: "Senior", complexity: "complex" },
  Professional: { rolePrefix: "Lead", complexity: "professional" },
};

const WEEK_PLANS: Record<string, Array<{ title: string; goal: string }>> = {
  Beginner: [
    { title: "Getting hired", goal: "Find an opening, apply, interview and accept an offer." },
    { title: "Joining the workplace", goal: "Respond to your welcome, attend onboarding and learn the team routines." },
    { title: "Understanding the client", goal: "Review a client brief, ask useful questions and share accurate notes." },
    { title: "Completing your first task", goal: "Complete a guided deliverable, receive feedback and make corrections." },
  ],
  Novice: [
    { title: "Planning your work", goal: "Contribute an idea, confirm responsibilities and report progress." },
    { title: "Working with clients", goal: "Clarify requirements, document decisions and follow up professionally." },
    { title: "Managing tasks and feedback", goal: "Deliver assigned work, use teammate feedback and update your manager." },
    { title: "Reviewing project progress", goal: "Present progress, capture client feedback and agree next steps." },
  ],
  Intermediate: [
    { title: "Owning a project deliverable", goal: "Recommend an approach, agree deliverables and own a project task." },
    { title: "Presenting your work", goal: "Present recommendations, answer client questions and record requested changes." },
    { title: "Solving workplace problems", goal: "Navigate disagreement and help the team agree on a practical resolution." },
    { title: "Managing setbacks", goal: "Respond to delay, update the work and communicate a recovery plan." },
  ],
  Advanced: [
    { title: "Leading project planning", goal: "Lead planning, coordinate responsibilities, surface risks and deliver complex work." },
    { title: "Managing client expectations", goal: "Present work, handle objections, optimize the deliverable and set realistic next steps." },
    { title: "Coordinating teams", goal: "Resolve competing priorities, negotiate deadlines and escalate risks appropriately." },
    { title: "Client success review", goal: "Lead a client success review, present results and recommend improvements." },
  ],
  Professional: [
    { title: "Managing a complete project", goal: "Lead kickoff, clarify objectives, assign responsibilities and execute the project." },
    { title: "Presenting and defending your work", goal: "Demonstrate the deliverable, defend recommendations and agree next steps." },
    { title: "Managing a critical incident", goal: "Lead a crisis response, coordinate the team and communicate the recovery plan." },
    { title: "Final professional review", goal: "Lead the final review, present results and lessons, and submit a professional report." },
  ],
};

function roleForTrack(track: string, level: string) {
  const lower = track.toLowerCase();
  const discipline = lower.includes("marketing") ? "Marketing" : lower.includes("content") ? "Content" : lower.includes("automation") ? "Automation" : lower.includes("design") ? "Product Design" : lower.includes("wordpress") ? "WordPress" : lower.includes("back-end") ? "Backend Engineering" : lower.includes("front-end") ? "Frontend Development" : "Digital Projects";
  return `${LEVELS[level]?.rolePrefix ?? "Associate"} ${discipline} ${level === "Professional" ? "Lead" : "Specialist"}`;
}

function interviewScript(track: string, level: string, role: string): Workday["steps"][number] {
  const cast = castFor(track);
  const focus = {
    Beginner: ["Tell us what interests you about this role.", "Describe a time you learned a new skill.", "How do you ask for help when instructions are unclear?"],
    Novice: ["Walk us through a relevant task you have completed.", "How do you organize work when you have several deadlines?", "Tell us how you used feedback to improve a deliverable."],
    Intermediate: ["How would you plan and deliver a project task from brief to handoff?", "Tell us about a routine problem you solved and how you chose your approach.", "How would you explain a recommendation to a client?"],
    Advanced: ["How do you plan a complex deliverable and identify risks early?", "Tell us how you handled a client objection while protecting project scope.", "How do you coordinate priorities across a team?"],
    Professional: ["Describe a project you led from kickoff through measurable outcomes.", "How do you make and communicate a decision during a critical incident?", "How do you balance client outcomes, team capacity and business constraints?"],
  }[level] ?? [];
  const lines = [
    { speaker: "client" as const, text: `Welcome. We are interviewing for the ${role} position on the ${cast.department} team. This role supports ${cast.project}.` },
    { you: `Introduce yourself and explain why you are interested in the ${role} role.` },
    { speaker: "manager" as const, text: `Thank you. I will ask a few questions about how you approach the work and collaborate with the team.` },
    ...focus.flatMap((question) => [
      { speaker: "client" as const, text: question },
      { you: `Answer the interview question: ${question}` },
    ]),
    { speaker: "manager" as const, text: `What questions do you have for us about the ${cast.department} team or the role?` },
    { you: "Ask one thoughtful question about the role, team, client or expectations." },
    { speaker: "client" as const, text: "Thank you for your time. We will follow up with our decision by email." },
  ];
  return {
    id: "w1-interview",
    kind: "meeting",
    meetingType: "interview",
    title: `Interview: ${role}`,
    agenda: `A structured interview for the ${role} role, focused on ${LEVELS[level]?.complexity ?? "supported"} workplace skills.`,
    participants: ["manager", "client"],
    lines,
    rubric: `${level}-level interview: relevant examples, clear and professional communication, role-appropriate judgment, and thoughtful questions. Role focus: ${cast.project}.`,
  };
}

function weeklyActivities(track: string, level: string, you: string): Workday[] {
  const cast = castFor(track);
  const manager = cast.manager.name.split(" ")[0];
  const client = cast.client.name.split(" ")[0];
  const clientCo = cast.clientCompany;
  const role = roleForTrack(track, level);
  const plans = WEEK_PLANS[level] ?? WEEK_PLANS.Beginner;
  const inbox = (id: string, title: string, from: PersonId, subject: string, body: string): Step => ({ id, kind: "inbox", title, from, subject, body });
  const email = (id: string, title: string, task: string, to: PersonId[], rubric: string, cc: PersonId[] = []): Step => ({ id, kind: "email", title, task, to, cc, rubric });
  const work = (id: string, title: string, task: string, rubric: string, labScenarioId: string | null = null): Step => ({ id, kind: "work", title, task, rubric, labScenarioId });
  const report = (id: string, title: string, task: string): Step => ({ id, kind: "report", title, task, fields: ["What I completed", "Progress or blockers", "Next actions"], rubric: "Specific, accurate, concise and clear about ownership and next steps." });
  const meeting = (id: string, title: string, agenda: string, participants: PersonId[], lines: MeetingLine[], rubric: string): Step => ({ id, kind: "meeting", title, agenda, participants, lines, rubric });
  const managerLine = (text: string): MeetingLine => ({ speaker: "manager", text });
  const clientLine = (text: string): MeetingLine => ({ speaker: "client", text });
  const youLine = (you: string): MeetingLine => ({ you });
  const planProject = `the ${cast.project} for ${clientCo}`;
  const steps: Step[][] = [
    [
      inbox("w1-opening", `Job opening: ${role}`, "client", `${role} opening at ${cast.company.name}`, `Hi ${you},\n\n${cast.company.name} is hiring a ${role} for the ${cast.department} team. The role supports ${planProject}.\n\nWe are looking for someone who can demonstrate ${LEVELS[level]?.complexity ?? "supported"} skills in ${track}. Please email your CV and a short application note to ${cast.client.name}.\n\nRegards,\nTalent team`),
      email("w1-application", "Submit your CV and application", `Apply for the ${role} opening. Write a concise application email that connects your experience to ${track}, and include a shareable CV link in the email body.`, ["client"], "Includes a working CV link, relevant evidence for this level and track, a clear subject, professional tone and concise sign-off."),
      inbox("w1-invitation", "Interview invitation", "client", `Interview invitation: ${role}`, `Hi ${you},\n\nThank you for applying for the ${role} position. We would like to invite you to an interview with ${cast.manager.name} and ${cast.client.name}. The interview will cover your approach to ${cast.project}.\n\nPlease confirm by email.\n\nRegards,\nTalent team`),
      email("w1-confirm", "Respond to the interview invitation", `Confirm your interview for the ${role}. Thank the interviewer, confirm your availability and ask any practical question you need answered.`, ["client"], "Clearly confirms the interview, uses a professional tone and asks only relevant logistical questions."),
      interviewScript(track, level, role),
      inbox("w1-offer", "Review your offer letter", "client", `Offer letter: ${role}`, `Hi ${you},\n\nWe are pleased to offer you the ${role} position in the ${cast.department} team. Your first assignment will support ${planProject}. Your manager will be ${cast.manager.name}.\n\nPlease reply to accept and confirm your start.\n\nRegards,\nTalent team`),
      email("w1-accept", "Accept the offer", `Reply to accept the ${role} offer. Thank the team and confirm your start and reporting contact.`, ["client"], "Explicitly accepts the offer, confirms the next step and maintains a professional tone."),
    ],
    [
      inbox("w2-welcome", "Respond to your welcome email", "manager", `Welcome to ${cast.company.name}, ${you}`, `Hi ${you},\n\nWelcome to ${cast.department}. You will work with me and the wider team on ${planProject}. We value clear communication, asking early when blocked, and reliable updates. Please reply to confirm you have received this message.\n\n${cast.manager.name}`),
      email("w2-welcome-reply", "Reply to your manager", "Confirm you received the welcome email and ask one useful question about your role or team routine.", ["manager"], "Acknowledges the message, asks a relevant question and uses a professional tone."),
      meeting("w2-onboarding", "Onboarding session", "Learn workplace routines, responsibilities and support channels", ["manager", "supporter"], [managerLine(`Welcome to ${cast.department}, ${you}. I will explain how our team works and how we will support you.`), youLine("Introduce yourself and share what you want to learn in this role."), { speaker: "supporter", text: `I support the team on ${cast.project}. What helps you learn a new process?` }, youLine("Explain how you learn a new process and how you check your understanding."), managerLine("How will you let us know if a task is unclear or delayed?"), youLine("Describe when and how you would raise a question or blocker."), managerLine("Great. We will start with a team stand-up so everyone can meet you.")], "Shows willingness to learn, asks for clarification appropriately and understands when to communicate blockers."),
      meeting("w2-standup", "Team stand-up", "Introduce yourself and share a concise update", ["manager", "supporter", "challenger"], [managerLine(`${you}, please introduce yourself and tell us what you are working on this week.`), youLine("Introduce yourself, your track and one goal for the week."), { speaker: "supporter", text: "What support would help you get started?" }, youLine("Name one useful support request or say how you will get started."), managerLine("Thanks. Please send me a short close-of-business report before you sign off.")], "Communicates clearly and concisely, identifies a sensible support need and understands the team's update routine."),
      report("w2-cob", "Close-of-business report", "Summarize onboarding, what you learned and your next actions."),
    ],
    [
      inbox("w3-brief", "Review the client brief", "manager", `Client brief: ${clientCo}`, `Hi ${you},\n\nPlease review the brief for ${planProject}. The client needs a solution that fits their audience, constraints and measures of success. Prepare questions before the discovery meeting. Record facts separately from assumptions.\n\n${cast.manager.name}`),
      work("w3-questions", "Prepare discovery questions", `Prepare questions about ${clientCo}'s goals, audience, constraints, timeline and measures for ${cast.project}.`, "Questions are open, relevant, prioritized and tied to facts in the brief."),
      meeting("w3-discovery", `Client discovery: ${clientCo}`, "Clarify goals, audience, constraints, timeline and success measures", ["manager", "client"], [managerLine(`Thank you for joining, ${client}. ${you} has reviewed the brief and will lead our questions.`), youLine(`Welcome ${client} and set an agenda for understanding the ${cast.project} brief.`), clientLine(`${cast.clientBusiness} needs ${cast.project}. Our main concern is making the work useful and measurable.`), youLine("Ask a question that clarifies the client's primary goal and how success will be measured."), clientLine("Our timing and resources are limited, so we need a practical approach and clear milestones."), youLine("Ask about constraints, audience or timeline, then reflect back what you heard."), managerLine("Please summarize the key requirements and confirm what happens next."), youLine("Summarize the client's requirements and agree the next action."), clientLine("That captures it. Please send the summary so we can confirm the details.")], "Asks relevant questions, distinguishes requirements from assumptions, summarizes accurately and confirms next actions."),
      report("w3-notes", "Record discovery notes", "Record the client's goals, requirements, constraints, open questions and agreed actions."),
      email("w3-summary", "Email the meeting summary", `Send ${manager} a concise summary of the discovery meeting with ${clientCo}, including decisions, open questions and owners.`, ["manager"], "Accurate, organized notes that separate decisions, open questions and assigned actions."),
    ],
    [
      inbox("w4-assignment", "Receive your first assignment", "manager", `Assignment: ${cast.project}`, `Hi ${you},\n\nYour first assignment is to complete a ${LEVELS[level]?.complexity ?? "guided"} deliverable for ${clientCo} in the ${cast.labTool}. Use the approved brief and ask before changing requirements. Send me the result for feedback.\n\n${cast.manager.name}`),
      email("w4-clarify", "Clarify the assignment", "Ask your manager one or two focused questions about scope, acceptance criteria or priority before you begin.", ["manager"], "Questions are specific, timely and directly help clarify the deliverable."),
      work("w4-first-build", "Complete the assigned Practice Lab work", `Complete the assigned ${cast.project} deliverable in ${cast.labTool}. Follow the approved client brief and include a link or clear description of your work.`, `Completes a ${LEVELS[level]?.complexity ?? "guided"} deliverable against the brief, checks the result and explains key decisions.`),
      meeting("w4-feedback", "Supervisor feedback meeting", "Review the deliverable and agree the corrections", ["manager", "supporter"], [managerLine(`${you}, thank you for sharing the work. I will explain what meets the brief and what needs revision.`), youLine("Summarize what you completed and explain one decision you made."), { speaker: "supporter", text: "I noticed one area that could be clearer. How would you improve it?" }, youLine("Acknowledge the feedback and describe how you will address it."), managerLine("Please make the agreed corrections in the Practice Lab and send the revised work for review.")], "Receives feedback constructively, explains decisions clearly and turns feedback into specific correction actions."),
      work("w4-corrections", "Make the required corrections", "Revise the deliverable in the linked Practice Lab activity using the supervisor's agreed feedback, then explain the corrections made.", "Addresses the agreed feedback and checks the revised deliverable against the brief."),
      report("w4-submit", "Submit your first-task report", "Summarize the deliverable, feedback received, corrections completed and any remaining questions."),
    ],
  ];
  if (level !== "Beginner") {
    steps[0] = [
      inbox("w1-plan-brief", "Project planning brief", "manager", `Planning: ${cast.project}`, `Hi ${you},\n\nWe are starting ${planProject}. Review the objectives and come to the planning meeting ready to contribute at the ${level} level.\n\n${cast.manager.name}`),
      meeting("w1-planning", level === "Professional" ? "Lead the project kickoff" : level === "Advanced" ? "Lead project planning" : level === "Intermediate" ? "Project strategy meeting" : "Team strategy meeting", `Plan ${cast.project}, agree responsibilities and define the ${level}-appropriate deliverable`, ["manager", "supporter", "challenger"], [managerLine(`${you}, please share your initial approach to ${cast.project}.`), youLine(`Recommend an approach to ${planProject} that fits the ${level} level.`), { speaker: "challenger", text: "What could put this plan at risk, and how should we respond?" }, youLine("Identify a likely risk and propose a practical response."), managerLine("Let's confirm the owners, success measure and deadline."), youLine("Confirm your responsibility, expected result and next checkpoint.")], `${level} planning: demonstrates role-appropriate ownership, clear reasoning, risk awareness and reliable coordination.`),
      email("w1-deadlines", "Confirm responsibilities and deadlines", "Email your manager to confirm your assigned deliverable, deadline and success measure.", ["manager"], "Confirms ownership, deadline, acceptance measure and any dependencies in a concise professional message."),
      work("w1-project-task", "Start your project deliverable", `Begin your ${LEVELS[level]?.complexity} assignment for ${cast.project} in ${cast.labTool}. Record what you completed and any dependencies.`, `Shows an appropriate ${level}-level approach to ${cast.project}, with clear progress and sound reasoning.`),
      report("w1-progress", "Project progress update", "Report your responsibility, confirmed deadline, initial progress and next action."),
    ];

    steps[1] = [
      inbox("w2-client-followup", "Client follow-up brief", "manager", `Follow up with ${clientCo}`, `Hi ${you},\n\nPlease follow up with ${client} about the outstanding requirements for ${cast.project}. Clarify open points, record decisions and send a professional follow-up.\n\n${cast.manager.name}`),
      meeting("w2-client-call", `Client follow-up: ${clientCo}`, "Clarify outstanding requirements and document agreed actions", ["manager", "client"], [managerLine(`${client}, ${you} will lead this follow-up on ${cast.project}.`), youLine("Welcome the client and confirm the open points you plan to cover."), clientLine("We still need clarity on the expected result, the delivery timing and how we will review it."), youLine("Ask a focused question about the most important outstanding requirement."), clientLine("The delivery date is important, but we can agree priorities if you explain the trade-offs."), youLine("Clarify the trade-off, summarize the decision and confirm who owns each action."), managerLine("Please send the agreed actions and owners in a follow-up email.")], `Handles a client conversation at ${level} level: listens carefully, clarifies requirements and records clear owners and actions.`),
      report("w2-client-actions", "Record agreed client actions", "Document outstanding requirements, decisions, action owners and dates."),
      email("w2-followup-email", "Send the client follow-up email", `Email ${client} and copy your manager with the agreed requirements, decisions, owners and dates.`, ["client"], "Accurate follow-up with clear decisions, action owners and dates.", ["manager"]),
      report("w2-progress", "Update your manager", "Summarize the client follow-up, resolved requirements and remaining risks."),
    ];

    if (level === "Novice") {
      steps[2] = [
        meeting("w3-other-team-standup", "Another team's stand-up", "Share progress and offer a useful contribution", ["manager", "supporter", "challenger"], [managerLine("Welcome. Please share your current progress and one thing the team should know."), youLine("Give a concise progress update and identify any dependency."), { speaker: "supporter", text: "What could you contribute to help another teammate move forward?" }, youLine("Offer one practical contribution and agree when you can complete it."), managerLine("Thank you. Please capture your feedback and update me after the deliverable.")], "Contributes constructively, communicates a realistic commitment and follows through."),
        work("w3-deliverable", "Complete your assigned deliverable", `Complete the assigned ${cast.project} task in ${cast.labTool} and summarize how it meets the agreed brief.`, `Completes assigned work to the ${level} standard and describes the result clearly.`),
        meeting("w3-teammate-feedback", "Teammate feedback", "Review feedback and agree corrections", ["manager", "supporter"], [managerLine("Let's review the deliverable and the feedback from the team."), { speaker: "supporter", text: "The result is on track. One part could be clearer for the client." }, youLine("Acknowledge the feedback and explain how you will improve the deliverable."), managerLine("Please make the corrections in the Practice Lab and update me when done.")], "Uses feedback to make a specific improvement and communicates progress to the manager."),
        work("w3-corrections", "Make teammate-requested corrections", "Update the linked Practice Lab deliverable in response to teammate feedback.", "Makes the agreed corrections and checks the updated work before reporting back."),
        email("w3-manager-update", "Update your manager", "Send a concise update on the deliverable, feedback and corrections completed.", ["manager"], "Accurate status, feedback summary and next step."),
      ];
    } else if (level === "Intermediate") {
      steps[2] = [
        meeting("w3-other-team-standup", "Another team's stand-up", "Coordinate a dependency and share a concise update", ["manager", "supporter", "challenger"], [managerLine("Please share your update and any dependency affecting the project."), youLine("Explain your progress and identify a dependency on another team."), { speaker: "challenger", text: "That dependency competes with our team's deadline. What do you recommend?" }, youLine("Propose a practical resolution and state what needs agreement."), managerLine("Let's confirm the owner and document the decision.")], "Coordinates dependencies, weighs trade-offs and proposes a clear resolution."),
        meeting("w3-disagreement", "Workplace disagreement", "Resolve a simulated disagreement about approach and priorities", ["manager", "supporter", "challenger"], [managerLine("The team has two different views on how to meet the client goal. Please help us reach a decision."), { speaker: "challenger", text: "We should prioritize speed, even if we reduce the review steps." }, youLine("Acknowledge the concern and explain the trade-offs in your preferred approach."), { speaker: "supporter", text: "How can we test the options without delaying the project?" }, youLine("Propose a test, decision owner and time to review the result."), managerLine("Good. Please document the decision and agreed actions.")], "Disagrees respectfully, uses evidence and guides the group toward a testable decision."),
        report("w3-resolution", "Document the resolution", "Record the disagreement, options considered, decision, owner and follow-up date."),
      ];
    } else if (level === "Advanced") {
      steps[2] = [
        meeting("w3-priority-conflict", "Cross-department priorities", "Negotiate competing priorities and deadline commitments", ["manager", "supporter", "challenger"], [managerLine("Two departments need the same delivery capacity. Lead us through a workable plan."), youLine("Clarify the competing needs and explain the impact on this client project."), { speaker: "challenger", text: "My department cannot move its deadline. What can your team change?" }, youLine("Negotiate a realistic compromise and explain its risks."), { speaker: "supporter", text: "What should we escalate if the teams cannot agree?" }, youLine("Set an escalation threshold, owner and decision deadline."), managerLine("Summarize the agreed priorities and risks for both teams.")], "Negotiates constructively, makes dependencies visible and escalates unresolved risks with a clear recommendation."),
        work("w3-revise-deliverable", "Complete the relevant project revision", `Revise the ${cast.project} deliverable in ${cast.labTool} where needed to reflect the agreed priorities.`, "Updates the relevant work, records the impact and coordinates any dependencies."),
        email("w3-escalation", "Escalate unresolved risks", "Send your manager a concise escalation with impact, options and your recommendation if any risk remains unresolved.", ["manager"], "Escalates only unresolved material risk and includes impact, options, recommendation and decision deadline."),
      ];
    } else {
      steps[2] = [
        inbox("w3-incident", "Critical project incident", "client", `Urgent: issue affecting ${cast.project}`, `Hi ${you},\n\nAn unexpected issue is affecting ${cast.project}. Please coordinate a response, identify the impact, and tell us when we will receive the next update.\n\n${client}`),
        meeting("w3-incident-response", "Critical incident response", "Lead the response, coordinate owners and agree the recovery plan", ["manager", "supporter", "challenger", "client"], [managerLine(`${you}, lead us through the response. Start with verified facts and immediate impact.`), youLine("State what is known, what is not yet known and who is affected."), clientLine("What will you do first, and when should we expect an update?"), youLine("Prioritize containment, assign owners and set the next client update time."), { speaker: "challenger", text: "A full fix may take longer than the client's preferred deadline." }, youLine("Explain the recovery options and recommend the safest realistic plan."), managerLine("Confirm the decision, escalation owner and communication cadence.")], "Leads calmly under pressure, separates facts from assumptions, assigns owners and communicates a realistic recovery plan."),
        work("w3-incident-fix", "Resolve the project issue", `Resolve the relevant ${cast.project} issue in ${cast.labTool} and document verification evidence.`, "Addresses the confirmed issue, verifies the result and documents remaining risk."),
        email("w3-recovery-plan", "Communicate the recovery plan", `Update ${client} with the agreed recovery actions, owners, next checkpoint and any confirmed impact.`, ["client"], "Clear, timely and factual recovery communication with owners and a specific next update.", ["manager"]),
      ];
    }

    if (level === "Novice") {
      steps[3] = [
        meeting("w4-progress-review", "Client progress review", "Present progress and capture client feedback", ["manager", "client"], [managerLine(`${you}, please present the progress made on ${cast.project}.`), youLine("Present completed work, progress against the goal and one open item."), clientLine("Thank you. I would like the next update to explain how this supports our original goal."), youLine("Record the feedback and confirm what you will include in the next update."), managerLine("We will have an internal review and agree the next actions.")], "Presents accurate progress, listens to client feedback and confirms follow-up actions."),
        meeting("w4-internal-review", "Internal project review", "Review client feedback and agree owners for next steps", ["manager", "supporter"], [managerLine("What did we learn from the client review, and what should happen next?"), youLine("Summarize the feedback and recommend practical next steps."), { speaker: "supporter", text: "Which action should happen first, and who needs to own it?" }, youLine("Prioritize an action and confirm its owner and timing.")], "Turns review feedback into prioritized actions with clear ownership."),
        report("w4-next-steps", "Submit agreed next steps", "Record the client feedback, agreed actions, owners and dates."),
      ];
    } else if (level === "Intermediate") {
      steps[3] = [
        inbox("w4-delay", "Respond to a delayed deliverable", "manager", `Schedule change: ${cast.project}`, `Hi ${you},\n\nA dependency for ${cast.project} has been delayed. Review the impact, identify options and prepare a recovery recommendation before we meet.\n\n${cast.manager.name}`),
        meeting("w4-problem-solving", "Project recovery meeting", "Assess impact, agree a recovery plan and communicate it to the client", ["manager", "supporter", "challenger"], [managerLine("Explain the impact of the delay and the options available."), youLine("Separate confirmed impact from assumptions and present recovery options."), { speaker: "challenger", text: "The original date is no longer realistic. What can we protect?" }, youLine("Recommend what to protect, what to replan and what needs approval."), managerLine("Please update the project work and communicate our approved plan to the client.")], "Assesses setbacks, makes realistic trade-offs and communicates an approved recovery plan."),
        work("w4-recovery-work", "Update the Practice Lab deliverable", `Revise ${cast.project} in ${cast.labTool} against the revised requirements and record what changed.`, "The revised deliverable reflects the approved requirements and is checked before handoff."),
        email("w4-recovery-client", "Communicate the approved recovery plan", `Tell ${client} what changed, the approved recovery actions and when they will receive the next update.`, ["client"], "Transparent, accurate communication that avoids overpromising and gives a clear next update."),
        report("w4-recovery-report", "Report the recovery outcome", "Summarize the setback, approved plan, work updated and remaining risks."),
      ];
    } else if (level === "Advanced") {
      steps[3] = [
        work("w4-success-evidence", "Prepare client success evidence", `Prepare the ${cast.project} work and results in ${cast.labTool} for the client success review.`, "Presents verified work and results, connects them to client goals and identifies remaining issues."),
        meeting("w4-client-success", "Client success review", "Present completed work and results, discuss issues and recommend improvements", ["manager", "client", "ceo"], [managerLine(`${you}, please lead the client success review and present the evidence.`), youLine("Present the work completed, results against the success measures and any limits."), clientLine("What remains unresolved, and what improvement would you recommend next?"), youLine("Discuss outstanding issues and recommend a prioritized improvement."), managerLine("Close by confirming decisions, owners and the next review point.")], "Leads an evidence-based review, addresses issues transparently and makes actionable recommendations."),
        report("w4-success-actions", "Record client success actions", "Capture results presented, outstanding issues, recommendations and owners."),
      ];
    } else {
      steps[3] = [
        work("w4-final-project", "Complete and submit the final project", `Complete the final ${cast.project} project in ${cast.labTool}, verify the deliverable and document the results.`, "Delivers a professional-quality project with verification evidence, clear outcomes and accountable handoff."),
        meeting("w4-final-client", "Final client review", "Lead the final review, demonstrate results and agree close-out actions", ["manager", "client", "ceo"], [managerLine(`${you}, lead the final client review. Please state the objectives and show the completed result.`), youLine("Present the delivered work, demonstrate evidence and connect results to client objectives."), clientLine("What should our team know about the limits and what you recommend next?"), youLine("Explain the limitations honestly and recommend practical next steps."), managerLine("Thank you. Please summarize lessons learned for management.")], "Demonstrates independent professional ownership, evidence-led communication, candor and sound recommendations."),
        meeting("w4-management-review", "Management lessons-learned review", "Present outcomes and professional lessons to management", ["manager", "ceo"], [managerLine("Summarize the outcome, your most important decision and what you learned."), youLine("Present results, lessons learned and one improvement you would make next time."), { speaker: "ceo", text: "What professional capability will you develop next, and how will you measure progress?" }, youLine("Describe a specific development goal and a way to measure it.")], "Reflects on measurable outcomes, owns decisions and defines a credible continued-development plan."),
        report("w4-final-report", "Final professional report", "Submit results, lessons learned, outstanding issues and your professional development plan."),
      ];
    }
  }
  return plans.map((plan, index) => ({
    day: index + 1,
    title: plan.title,
    summary: plan.goal,
    opensWeek: index + 1,
    opensDay: 1,
    opensTime: "09:00",
    dueWeek: index + 1,
    dueDay: 7,
    dueTime: "23:59",
    steps: steps[index],
  }));
}

export function defaultOfficeLifeContent(track: string, level = "Beginner"): OfficeLifeContent {
  const cast = castFor(track);
  return {
    contentVersion: 2,
    company: cast.company,
    department: cast.department,
    clientCompany: cast.clientCompany,
    clientBusiness: cast.clientBusiness,
    project: cast.project,
    labTool: cast.labTool,
    cast: Object.fromEntries((["ceo", "manager", "supporter", "challenger", "client"] as PersonId[]).map((id) => [id, cast[id]])) as Record<PersonId, Cast[PersonId]>,
    workdays: weeklyActivities(track, level, "{{intern}}"),
  };
}

export function parseOfficeLifeContent(value: unknown): OfficeLifeContent | null {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : null;
  if (source?.contentVersion !== 2) return null;
  const workdays = Array.isArray(source?.workdays) ? source.workdays.map((value, index) => {
    const day = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const week = typeof day.opensWeek === "number" ? day.opensWeek : index + 1;
    return {
      opensWeek: week,
      opensDay: 1,
      opensTime: "09:00",
      dueWeek: week,
      dueDay: 7,
      dueTime: "23:59",
      ...day,
    };
  }) : undefined;
  const parsed = contentSchema.safeParse(source ? { ...source, workdays } : value);
  if (!parsed.success) return null;
  const content = parsed.data as OfficeLifeContent;
  const dayNumbers = new Set<number>();
  const stepIds = new Set<string>();
  for (const day of content.workdays) {
    if (dayNumbers.has(day.day)) return null;
    dayNumbers.add(day.day);
    const opens: SchedulePoint = { week: day.opensWeek, day: day.opensDay, time: day.opensTime };
    const due: SchedulePoint = { week: day.dueWeek, day: day.dueDay, time: day.dueTime };
    if (!isValidSchedulePoint(opens) || !isValidSchedulePoint(due)) return null;
    if (day.dueWeek < day.opensWeek || (day.dueWeek === day.opensWeek && day.dueDay < day.opensDay) ||
      (day.dueWeek === day.opensWeek && day.dueDay === day.opensDay && day.dueTime <= day.opensTime)) return null;
    if (!day.steps.some((step) => step.kind !== "inbox")) return null;
    for (const step of day.steps) {
      if (stepIds.has(step.id)) return null;
      stepIds.add(step.id);
      if (step.kind === "meeting" && (
        !step.lines.some((line) => "you" in line) ||
        step.lines.some((line) => "speaker" in line && !step.participants.includes(line.speaker))
      )) return null;
    }
  }
  if (content.workdays.some((day, index) => day.day !== index + 1)) return null;
  return content;
}

function replaceIntern<T>(value: T, intern: string): T {
  if (typeof value === "string") return value.replaceAll("{{intern}}", intern) as T;
  if (Array.isArray(value)) return value.map((item) => replaceIntern(item, intern)) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceIntern(item, intern)])) as T;
  return value;
}

export function personalizeOfficeLifeContent(content: OfficeLifeContent, intern: string) {
  return replaceIntern(content, intern);
}

export function castFromOfficeLifeContent(content: OfficeLifeContent): Cast {
  return {
    ...content.cast,
    company: content.company,
    department: content.department,
    clientCompany: content.clientCompany,
    clientBusiness: content.clientBusiness,
    project: content.project,
    labTool: content.labTool,
  };
}

export function isPersonId(value: unknown): value is PersonId {
  return ["ceo", "manager", "supporter", "challenger", "client"].includes(String(value));
}

export type OfficeLifeStep = Step;
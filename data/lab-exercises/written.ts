import {
  avoid, brief, chars, corrected, correcting, easy, must, paragraphs, piece, tags, words, writing,
  type Client, type LabExercise, type Mistake,
} from "./helpers";

// Exercises done in the Content lab: writing for a client, prompting an AI,
// and finding what's wrong in something.

const CLEAR = "Clear and correct: a busy client could use it straight away";
const FITS = "Fits this client and their customers";

// ── Social Media Marketing ──────────────────────────────────────────────────
const ZUMA: Client = {
  name: "Zuma Kicks",
  about: "A small Abuja shop selling clean, affordable sneakers. Sneakers start from N18000, delivery in Abuja takes one day, and people order on WhatsApp.",
  voice: "Friendly, young and confident. Short sentences. No shouting.",
  audience: "Abuja students and young workers aged 18 to 30 who like to look good on a budget.",
};
const TASTY: Client = {
  name: "Tasty Pot",
  about: "A home caterer in Kubwa, Abuja. Party trays from N25000, orders two days ahead, free delivery in Kubwa.",
  voice: "Warm and cheerful, like a good aunty. Never pushy.",
  audience: "Families and offices in Abuja planning small parties.",
};

// ── Digital Marketing ───────────────────────────────────────────────────────
const CRUST: Client = {
  name: "Crust & Crumb Bakery",
  about: "A small bakery in Wuse 2, Abuja. Birthday cakes from N25000, ready in 48 hours, ordered on WhatsApp.",
  voice: "Warm, simple and honest.",
  audience: "Abuja parents and office workers buying cakes for birthdays.",
};
const GREEN: Client = {
  name: "GreenVolt Solar",
  about: "A Kaduna company that installs home solar. Starter system N450000, installed in two days, with a two-year warranty and payment over six months.",
  voice: "Plain, patient and trustworthy. No jargon.",
  audience: "Home owners and small shops in Kaduna who are tired of fuel costs.",
};

// ── AI for Content Creation ─────────────────────────────────────────────────
const NGOZI: Client = {
  name: "Mama Ngozi's Kitchen",
  about: "A small restaurant in Garki, Abuja, serving home-style jollof, egusi and pounded yam. Lunch plates from N3500. Open Monday to Saturday.",
  voice: "Homely and proud of the food.",
  audience: "Office workers looking for a good lunch.",
};
const GLOW: Client = {
  name: "Glow Haven",
  about: "An Abuja skincare brand. Shea body butter 200ml for N6500, made in Nigeria with no bleaching agents. Delivery across Nigeria in three days.",
  voice: "Gentle, honest and encouraging. No medical claims and no talk of fairer skin.",
  audience: "Nigerian women aged 20 to 40 who want healthy skin.",
};

// ── Virtual Assistant ───────────────────────────────────────────────────────
const ADAEZE: Client = {
  name: "Adaeze Obi Events",
  about: "Mrs Adaeze Obi plans weddings and parties in Abuja. She is often on site, so her assistant handles messages, files and her calendar.",
  voice: "Polite, warm and to the point.",
  audience: "Couples, families, vendors and venues.",
};
const BRIGHT: Client = {
  name: "Bright Path Tutors",
  about: "A Lagos home-tutoring company run by Mr Femi Cole. It matches children with tutors. Lessons cost N8000 each, and a missed lesson can be moved if the parent gives 24 hours' notice.",
  voice: "Calm, kind and professional.",
  audience: "Busy parents and part-time tutors.",
};

// ── Cybersecurity ───────────────────────────────────────────────────────────
const BELLO: Client = {
  name: "The Bello family",
  about: "A family of five in Abuja. Dad runs a shop with online payments, Mum teaches, and three children use phones for school.",
  voice: "Plain words anyone at home understands.",
  audience: "The family, who are not technical.",
};
const PHARMA: Client = {
  name: "Kubwa Pharmacy",
  about: "A busy pharmacy with six staff, two computers, one Wi-Fi network, a payment terminal and customer records.",
  voice: "Plain and practical. The owner is not technical.",
  audience: "The owner, Mrs Hauwa Sani, and her staff.",
};

// A shared shape for "find and fix" exercises.
function fix(
  at: { track: string; level: string; week: number; title: string },
  client: Client,
  situation: string,
  steps: string[],
  adds: string,
  draft: string,
  reference: string,
  mistakes: Mistake[],
): LabExercise {
  return { ...at, kind: "CONTENT", brief: brief(situation, steps, adds), config: correcting(client, draft, reference, mistakes), model: corrected(draft, mistakes) };
}

const FIX_STEPS = [
  "Read the notes on the right. They are the truth.",
  "Read the draft line by line and find every mistake.",
  "Correct only what is wrong. Leave the rest as it is.",
];

const vaWords: Mistake[] = [
  ["An SOP is a standard monthly payment.", "An SOP is a set of step-by-step instructions for a task.", "SOP means standard operating procedure: instructions for a task."],
  ["Inbox zero means deleting every email.", "Inbox zero means every email has been dealt with or filed.", "Inbox zero is about handling every email, not deleting it."],
  ["When it is 9am in Lagos, it is 9am in London all year.", "When it is 9am in Lagos, it is 8am in London in winter.", "Nigeria is UTC+1 all year, and London is UTC+0 in winter."],
  ["A deliverable is the person who pays you.", "A deliverable is the finished work you hand over.", "A deliverable is the work; the person who pays is the client."],
  ["You may share a client's details with friends you trust.", "You never share a client's details with anyone.", "Client information is confidential.", "CLAIM"],
];
const vaWordsDraft = `A short guide for new virtual assistants

A virtual assistant helps clients from a distance, using the internet. ${vaWords[0][0]} Clients like them because work is done the same way each time.

Good assistants keep a tidy inbox. ${vaWords[1][0]} They also plan the client's calendar so that meetings do not clash.

Time zones matter when a client is abroad. ${vaWords[2][0]} Always write the time zone in an invitation.

At the end of a job you hand over your work. ${vaWords[3][0]} Agree it in writing before you start.

Trust is everything in this job. ${vaWords[4][0]}`;

const calendar: Mistake[] = [
  ["Monday 10:00 to 11:30: Cake tasting at Wuse", "Monday 13:00 to 14:30: Cake tasting at Wuse", "It clashes with the Okafor meeting on Monday from 9:30 to 11:00."],
  ["Tuesday 08:00: Call with the London client", "Tuesday 11:00: Call with the London client", "The London client can only talk after 10am London time, which is 11am in Abuja."],
  ["Wednesday 14:00 to 18:00: Site visit at the Musa venue, then Thursday off", "Wednesday 14:00 to 16:00: Site visit at the Musa venue, then pick up the children at 16:30", "She must pick up her children at 16:30 every Wednesday."],
  ["Friday 16:00: Send the Bassey quote", "Thursday 12:00: Send the Bassey quote", "The Bassey quote is due by the end of Thursday."],
];
const calendarDraft = `Week plan for Mrs Adaeze Obi

Monday 09:30 to 11:00: Meeting with the Okafor family (booked by the client, cannot move)
${calendar[0][0]}
Monday 15:00: Reply to vendor emails

${calendar[1][0]}
Tuesday 14:00 to 16:00: Choose flowers for the Okafor wedding

${calendar[2][0]}

Thursday 10:00 to 11:00: Staff meeting
${calendar[3][0]}
Friday 09:00 to 12:00: Okafor rehearsal`;

const leads: Mistake[] = [
  ["Greenfield Academy, Ikeja, 0803 111 2233", "Greenfield Academy, Ikeja, 0803 111 2323", "The phone number in the source ends in 2323.", "NUMBER"],
  ["Little Stars School, Yaba, hello@litlestars.example", "Little Stars School, Yaba, hello@littlestars.example", "The email address is missing a letter."],
  ["Crown Heights College, Lekki, 180 pupils", "Crown Heights College, Lekki, 810 pupils", "The source says 810 pupils.", "NUMBER"],
  ["Hilltop Primary, Surulere, contact: Mr Tunde Alabi", "Hilltop Primary, Surulere, contact: Mrs Tunde Alabi", "The source says Mrs."],
  ["Royal Seed School, Ikeja, 0805 777 8899", "Royal Seed School, Magodo, 0805 777 8899", "Royal Seed School is in Magodo."],
];
const leadsDraft = `Lead list for Bright Path Tutors

1. ${leads[0][0]}
2. ${leads[1][0]}
3. Sunrise Montessori, Ajah, info@sunrise.example
4. ${leads[2][0]}
5. ${leads[3][0]}
6. Bluebell School, Gbagada, 0806 222 3344
7. ${leads[4][0]}
8. Maple House, Victoria Island, 95 pupils`;

const cyberWords: Mistake[] = [
  ["Phishing is a way to make your internet faster.", "Phishing is a trick that pretends to be someone you trust to steal from you.", "Phishing is a scam."],
  ["MFA means using the same password everywhere.", "MFA means proving it is you in a second way, such as a code.", "MFA is multi-factor authentication."],
  ["Encryption makes a message easy for anyone to read.", "Encryption scrambles a message so only the right person can read it.", "Encryption hides the content."],
  ["A firewall cools down your computer.", "A firewall controls what may come in and out of a network.", "A firewall filters network traffic."],
  ["Availability means nobody can ever use the system.", "Availability means the right people can use the system when they need it.", "It is the A in the CIA triad."],
];
const cyberWordsDraft = `Staying safe online: a guide for our family

${cyberWords[0][0]} It often comes as a text, an email or a call that hurries you.

${cyberWords[1][0]} Turn it on for email, banking and WhatsApp.

Some apps protect messages while they travel. ${cyberWords[2][0]}

Our home router has a small guard at the door. ${cyberWords[3][0]}

Security people speak of three goals. Confidentiality means only the right people see information. Integrity means nobody changes it secretly. ${cyberWords[4][0]}`;

const checklist: Mistake[] = [
  ["Use one strong password for every account so you never forget it.", "Use a different strong password for every account, kept in a password manager.", "If one account leaks, all the others would be open.", "CLAIM"],
  ["Give your verification code to bank staff who call you.", "Never give your verification code to anyone, even someone who says they are from the bank.", "Real banks never ask for codes.", "CLAIM"],
  ["Turn off phone updates to save data.", "Keep phone updates on, because they fix security holes.", "Updates fix security problems.", "CLAIM"],
  ["Use your birthday as your phone PIN.", "Use a phone PIN that nobody could guess.", "A birthday is easy to guess.", "CLAIM"],
  ["Install apps from any link that looks useful.", "Install apps only from the official app store.", "Links can carry malware.", "CLAIM"],
];
const checklistDraft = `The Bello family security checklist

Accounts
- ${checklist[0][0]}
- Turn on two-step verification for email first, because it can reset everything else.
- ${checklist[1][0]}

Phones
- ${checklist[2][0]}
- Lock the screen after one minute.
- ${checklist[3][0]}

Apps
- ${checklist[4][0]}
- Remove apps nobody has used for months.

Backups
- Back up family photos to a second place every month.`;

const phishing: Mistake[] = [
  ["Message 2: SAFE because it mentions our bank by name", "Message 2: SCAM because the bank never asks for a PIN and the link is not the bank's", "It asks for a card PIN through a strange link."],
  ["Message 4: SAFE because the sender knows Mum's name", "Message 4: SCAM because a new number is asking for urgent money", "Scammers find names easily. Call the person on their known number."],
  ["Message 5: SCAM because all school messages are fake", "Message 5: SAFE because it came from the school's usual number and asks for nothing", "It is from the known school number and has no link or request."],
  ["Message 7: SAFE because everybody likes free airtime", "Message 7: SCAM because it offers a prize for forwarding and asks for a login", "Prizes for forwarding are a classic trick."],
  ["Message 9: SAFE because the attachment is called invoice", "Message 9: SCAM because an unexpected invoice ends in .exe", "An .exe file is a program, not an invoice."],
];
const phishingDraft = `Our check of ten messages

Message 1: SAFE because Dad asked for this one-time code a minute before
${phishing[0][0]}
Message 3: SCAM because it threatens to close the account in one hour
${phishing[1][0]}
${phishing[2][0]}
Message 6: SCAM because the web address spells the shop's name wrongly
${phishing[3][0]}
Message 8: SAFE because it is a delivery update for an order Mum placed, with no link
${phishing[4][0]}
Message 10: SCAM because a stranger offers a job and asks for a fee first`;
const phishingNotes = `THE MESSAGES
1. "Your login code is 482913." Dad was logging in when it came.
2. "FirstTrust Bank: your card is blocked. Confirm your PIN at firsttrust-verify.example."
3. "Pay now or your account closes in 1 hour."
4. New number: "Mum Aisha, it's your brother, I lost my phone. Send N50000 now."
5. From the school's saved number: "PTA meeting is on Saturday at 10am."
6. "Huge sale at www.jurnia-shop.example."
7. "Forward to 10 people and log in here to get N5000 airtime."
8. "Your parcel arrives today between 2pm and 4pm." Mum ordered a kettle yesterday.
9. Unknown sender, attachment: invoice_7781.exe
10. "Work from home, N200000 a month. Pay N5000 to register."`;

const network: Mistake[] = [
  ["DNS gives each device its electricity.", "DNS turns a name such as example.com into an IP address.", "DNS is like a phone book for names."],
  ["Port 443 is used for unsafe web pages (HTTP).", "Port 443 is used for safe web pages (HTTPS).", "HTTPS uses 443; HTTP uses 80.", "NUMBER"],
  ["192.168.1.5 is a public address anyone on the internet can reach.", "192.168.1.5 is a private address used inside the home.", "192.168.x.x addresses are private."],
  ["The router's job is to store photos.", "The router's job is to pass traffic between the home and the internet.", "A router moves traffic between networks."],
  ["Leave the router's first password as it is.", "Change the router's first password.", "Default passwords are known to everyone.", "CLAIM"],
];
const networkDraft = `How our home network works

Every device has an IP address so that others can find it. ${network[2][0]}

When we type a web address, our phone asks a DNS server for help. ${network[0][0]}

A port is like a numbered door on a device. Port 80 is for ordinary web pages. ${network[1][0]}

Everything passes through one box. ${network[3][0]} Because it guards the home, look after it. ${network[4][0]}`;

const linux: Mistake[] = [
  ["pwd: changes your password", "pwd: shows which folder you are in", "pwd means print working directory."],
  ["cd: copies a document", "cd: moves you to another folder", "cd means change directory."],
  ["chmod 777: the safest permission for private files", "chmod 600: a safe permission for private files, for the owner only", "777 lets everyone read, change and run the file.", "CLAIM"],
  ["rm -r: renames a folder", "rm -r: deletes a folder and everything in it", "rm removes. It cannot be undone."],
  ["grep: makes text bigger", "grep: finds lines that contain some text", "grep searches text."],
];
const linuxDraft = `Linux notes for the pharmacy's server

Moving around
${linux[0][0]}
ls -l: lists files with their permissions and owners
${linux[1][0]}

Files
cat: shows what is in a file
${linux[2][0]}
${linux[3][0]}

Finding things
${linux[4][0]}
tail -f: shows new lines in a log as they arrive

Always check which folder you are in before you delete anything.`;

const firewall: Mistake[] = [
  ["Wi-Fi security: WEP", "Wi-Fi security: WPA2 or WPA3", "WEP can be broken in minutes."],
  ["Customers use the same Wi-Fi as the payment terminal", "Customers use a separate guest Wi-Fi", "Guests must never share a network with payments.", "CLAIM"],
  ["Remote desktop: open to the whole internet", "Remote desktop: only through the VPN", "Open remote desktop is a common way in.", "CLAIM"],
  ["Firewall default: allow everything in", "Firewall default: block everything in, then allow what is needed", "Start closed, then open only what you need.", "CLAIM"],
  ["Router admin login: admin / admin", "Router admin login: a long password kept in the password manager", "Default logins are known to attackers.", "CLAIM"],
];
const firewallDraft = `Network plan for Kubwa Pharmacy

Wi-Fi
- Network name: KubwaPharm-Staff
- ${firewall[0][0]}
- ${firewall[1][0]}

Remote work
- Staff who work from home use a VPN.
- ${firewall[2][0]}

Firewall
- ${firewall[3][0]}
- Allow web traffic out on ports 80 and 443.

Router
- ${firewall[4][0]}
- Install router updates every month.`;

const jollof: Mistake[] = [
  ["in the heart of Lagos", "in Garki, Abuja", "The restaurant is in Garki, Abuja."],
  ["plates start from N1500", "plates start from N3500", "Lunch plates start from N3500.", "NUMBER"],
  ["open seven days a week", "open Monday to Saturday", "It is closed on Sunday."],
  ["Voted the best restaurant in Africa in 2025.", "Loved by office workers across Garki.", "No such award is in the notes.", "CLAIM"],
  ["\"I will never eat anywhere else,\" says the President.", "Come and taste it for yourself.", "The quote is made up.", "QUOTE"],
];
const jollofDraft = `Lunch that tastes like home

Mama Ngozi's Kitchen is a small restaurant ${jollof[0][0]}. We cook jollof, egusi and pounded yam the way your mother does, fresh every morning.

Our lunch ${jollof[1][0]}, so a good meal does not have to wait for payday. We are ${jollof[2][0]}, and lunch is ready from noon.

${jollof[3][0]} ${jollof[4][0]}

Bring a colleague and find a seat by the window.`;

const at = (track: string, level: string, week: number, title: string) => ({ track, level, week, title });
const SMM = "Social Media Marketing", DM = "Digital Marketing", AIC = "AI for Content Creation", VA = "Virtual Assistant", CYB = "Cybersecurity";

export const WRITTEN: LabExercise[] = [
  {
    ...at(SMM, "Beginner", 3, "Three posts that stop the scroll"),
    kind: "CONTENT",
    brief: brief("Zuma Kicks, a sneaker shop in Abuja, needs its first real posts. You already know who buys from it.", [
      "Write three posts: one that teaches, one that shows the product, one that starts a conversation.",
      "Open each with a hook that makes a student stop scrolling.",
      "For each, describe the Canva graphic you would design.",
    ], "the ready-to-post week you finish in Week 4. These three posts go straight into it."),
    config: writing(ZUMA, ["The first line would make a young person in Abuja stop", FITS], [
      piece("Teach", "A useful tip about sneakers, such as cleaning or matching them. Start with the hook, then a line beginning Graphic: with your design.", words(35, 110), must("Graphic:"), tags(1, 5), easy(18)),
      piece("Show", "Show the sneakers. Give the starting price and how to order. Include a Graphic: line.", words(35, 110), must("Graphic:", "N18000", "WhatsApp"), avoid("best in the world"), tags(1, 5)),
      piece("Talk", "Ask a question people enjoy answering. Include a Graphic: line.", words(25, 90), must("Graphic:", "?"), tags(1, 5)),
    ]),
    model: {
      teach: "White sneakers turning yellow? Stop washing them in the sun.\nMix a little baking soda with water. Brush gently. Dry them in the shade, stuffed with tissue. They stay white for months.\nGraphic: a split photo, yellow shoe on the left and clean shoe on the right, big text over it.\n#ZumaKicks #AbujaStyle",
      show: "Clean kicks should not finish your allowance.\nOur sneakers start from N18000, and delivery in Abuja takes one day. Send your size on WhatsApp and choose your colour today.\nGraphic: three pairs in a row on a plain green background, with the price in one corner.\n#ZumaKicks #AbujaSneakers",
      talk: "One pair for a whole semester. Which colour would you choose, black or white?\nTell us why in the comments. We read every one.\nGraphic: a black shoe and a white shoe facing each other like boxers.\n#ZumaKicks",
    },
  },
  {
    ...at(SMM, "Novice", 2, "Script a 30-second reel"),
    kind: "CONTENT",
    brief: brief("Tasty Pot, a caterer in Kubwa, has never posted a video. You will film one on your phone this week, so plan it here first.", [
      "Write a hook for the first 3 seconds.",
      "Write the script, scene by scene, for 30 seconds.",
      "Write the caption that goes with it.",
    ], "the two-week plan. This reel is one of its main posts, and you shoot it for this week's task."),
    config: writing(TASTY, ["Someone would watch to the end", FITS], [
      piece("Hook", "The words on screen and spoken in the first 3 seconds.", words(4, 20)),
      piece("Scenes", "At least four scenes, each on its own line starting Scene 1:, Scene 2: and so on. Say what we see and hear.", must("Scene 1:", "Scene 2:", "Scene 3:", "Scene 4:"), words(60, 200)),
      piece("Caption", "Say what a party tray costs and how far ahead to order.", must("N25000", "two days"), words(20, 80), tags(1, 5)),
    ]),
    model: {
      hook: "Your guests arrive in two hours. Nothing is cooked.",
      scenes: "Scene 1: A worried host opens an empty pot and looks at the clock. We hear it ticking.\nScene 2: A phone message arrives saying the Tasty Pot order is on its way to Kubwa. The music starts.\nScene 3: Close shots of jollof, chicken and small chops being packed into trays, with steam rising.\nScene 4: Guests laugh and eat while the host finally sits down and smiles at the camera.",
      caption: "Relax, we have the cooking. Party trays start from N25000. Order two days ahead and delivery in Kubwa is free. What are you celebrating next?\n#TastyPot #KubwaFood",
    },
  },
  {
    ...at(DM, "Beginner", 3, "Keywords and a page that earns the click"),
    kind: "CONTENT",
    brief: brief("Crust & Crumb Bakery's website never shows up on Google. Help people who want a cake in Abuja find it.", [
      "List 10 keywords people would really type, one per line.",
      "Write a page title that fits in search results.",
      "Write a page description that makes someone click.",
    ], "the bakery's starter marketing kit. These words go on its real page."),
    config: writing(CRUST, ["Someone looking for a cake in Abuja would click", FITS], [
      piece("Keywords", "10 keywords, one per line. Include the place, the product and at least one question people ask.", must("Abuja", "birthday cake", "how"), words(22, 90)),
      piece("Title", "The page title, 60 characters or fewer, with the product and the place.", chars(60), must("cake", "Abuja")),
      piece("Description", "The page description, 155 characters or fewer. Say why to choose this bakery and how to order.", chars(155), must("48 hours", "WhatsApp")),
    ]),
    model: {
      keywords: "birthday cake Abuja\nbirthday cake Wuse 2\ncake delivery Abuja\ncustom cakes Abuja\nbakery near me Wuse\nchildren birthday cake Abuja\nbirthday cake price in Abuja\nhow much is a birthday cake in Abuja\nsame week cake order Abuja\noffice party cake Abuja",
      title: "Birthday Cakes in Abuja, Ready in 48 Hours | Crust & Crumb",
      description: "Fresh birthday cakes from a small Wuse 2 bakery. Pick a design, add a name and order on WhatsApp. Ready in 48 hours.",
    },
  },
  {
    ...at(DM, "Beginner", 4, "A welcome series that sells"),
    kind: "CONTENT",
    brief: brief("People give Crust & Crumb their email for a cake guide, then hear nothing. Write the three emails that turn them into customers.", [
      "Email 1: welcome them and give something useful.",
      "Email 2: build trust and answer a worry.",
      "Email 3: ask them to order.",
    ], "the finished starter kit. With your customer journey, keywords and page wording, the bakery now has everything to start."),
    config: writing(CRUST, ["Each email has one clear purpose", FITS], [
      piece("Email 1", "Start with Subject: and the subject line. Welcome them and give one useful tip.", must("Subject:"), words(50, 150), easy(18)),
      piece("Email 2", "Start with Subject:. Answer a worry, such as late delivery or the cake not matching the picture.", must("Subject:", "48 hours"), words(50, 150), easy(18)),
      piece("Email 3", "Start with Subject:. Give the starting price and one clear way to order.", must("Subject:", "N25000", "WhatsApp"), words(40, 130), easy(18)),
    ]),
    model: {
      "email-1": "Subject: Welcome, and the cake size most people get wrong\n\nHello and welcome to Crust & Crumb.\n\nHere is a tip that saves money. Count your adults, then halve the number of children. That total is how many slices you need. An eight-inch cake gives about fourteen.\n\nKeep this email for your next birthday. We will send you one more tip soon.\n\nWarm wishes,\nThe bakers in Wuse 2",
      "email-2": "Subject: Will the cake look like the picture?\n\nIt is a fair worry, and we hear it often.\n\nSo we send you a photo before your cake leaves the bakery. If something is wrong, we fix it. We take every order at least 48 hours ahead, so nobody is rushing your cake.\n\nReply to this email with any question. A real baker will answer you.\n\nThe bakers in Wuse 2",
      "email-3": "Subject: Is a birthday coming up?\n\nIf someone you love has a birthday this month, we would be glad to bake for them.\n\nCakes start from N25000, with the name written on top. Tell us the date, the colour and the number of guests.\n\nOrder on WhatsApp today, and your cake will be ready on time.\n\nThe bakers in Wuse 2",
    },
  },
  {
    ...at(DM, "Novice", 1, "A blog post that helps and gets found"),
    kind: "CONTENT",
    brief: brief("GreenVolt Solar wants people in Kaduna to understand solar before they buy. Write its first blog post.", [
      "Write an outline with at least four points.",
      "Write the post for someone who has never bought solar.",
      "End with one sensible next step.",
    ], "the 30-day marketing plan. This post is its first piece of content."),
    config: writing(GREEN, ["A home owner learns something useful", "Honest, with no promises the company can't keep"], [
      piece("Outline", "The title and at least four points, one per line.", words(20, 90), must("solar")),
      piece("Post", "Mention Kaduna, the starter price and the warranty. Short paragraphs.", words(220, 450), must("Kaduna", "N450000", "warranty"), avoid("100%", "never fails"), easy(20), paragraphs(4)),
    ]),
    model: {
      outline: "What does home solar really cost in Kaduna?\nWhat a starter system can power\nThe real cost beside a month of fuel\nQuestions to ask before you pay\nA simple next step",
      post: "What does home solar really cost in Kaduna?\n\nMany families in Kaduna ask us the same thing. Is solar worth the money? The honest answer depends on what you use every day. So let us look at it together, in plain words.\n\nA starter system costs N450000. It can run lights, fans, a television, phones and a small freezer for part of the night. It will not run an air conditioner. If someone tells you that it will, ask them to show you.\n\nNow think about fuel. Write down what you spend on your generator for one month. Add the oil, the repairs and the noise. Then multiply it by twelve. Many homes are surprised by the total. You can also pay for the system over six months, so you do not need all the money today.\n\nBefore you pay anyone, ask four questions. How many hours will the battery last? Who comes if it stops working? How long does the job take? What does the warranty cover? Our own answer is simple. We install in two days, and you get a two-year warranty in writing.\n\nSolar is not magic. Dust reduces what the panels give you, so they need cleaning. Cloudy weeks give less power than sunny weeks. A good installer tells you this before you buy, not after.\n\nYour next step costs nothing. List the things you want to power at night and send us the list. We will tell you honestly if the starter system is enough.",
    },
  },
  {
    ...at(DM, "Novice", 2, "Get found on Google Maps"),
    kind: "CONTENT",
    brief: brief("When people in Kaduna search for solar, GreenVolt's Google profile is empty and has one angry review. Fix it.", [
      "Write the business description for its profile.",
      "Write three questions and answers customers need.",
      "Reply to the review: \"They came a day late and nobody called me.\"",
    ], "the 30-day plan. Local search becomes one of its channels."),
    config: writing(GREEN, ["Builds trust with someone who doesn't know the company", "The reply is calm, honest and puts things right"], [
      piece("Description", "750 characters or fewer. Say what you do, where, and why to trust you.", chars(750), words(50, 125), must("Kaduna", "two days", "warranty")),
      piece("Questions", "Three questions, each starting Q: with an answer starting A:", must("Q:", "A:", "six months"), words(50, 180)),
      piece("Reply", "Reply to the review. Apologise, say what you will do, and offer a way to talk.", must("sorry"), avoid("your fault", "liar"), words(30, 100)),
    ]),
    model: {
      description: "GreenVolt Solar installs home and small-shop solar across Kaduna. We visit, listen to what you want to power, and tell you honestly which system fits. Installation takes two days, and every system has a two-year warranty in writing. You can pay over six months. Our own technicians do the work and come back if you need them. Call or message us for a free visit.",
      questions: "Q: How much is a starter system?\nA: It costs N450000, with installation included.\nQ: Can I pay small small?\nA: Yes. You can spread the payment over six months.\nQ: What happens if something stops working?\nA: Call us. Your two-year warranty covers the parts, and our technicians will come to your home.",
      reply: "Good afternoon. We are sorry that we came a day late and that nobody called you. You deserved a message. We now confirm every visit the evening before. Please send us your number so our manager can call you today and check that your system is working well.",
    },
  },
  {
    ...at(AIC, "Beginner", 3, "Image prompts and a flyer"),
    kind: "CONTENT",
    brief: brief("Mama Ngozi's Kitchen needs a lunch flyer. Plan the pictures and the words here, then make it in Canva for this week's task.", [
      "Write two AI image prompts with a subject, a place, light and a style.",
      "Write the words for the flyer. Less is more.",
    ], "the finished post and flyer. This flyer goes out with the post you fact-check in Week 4."),
    config: writing(NGOZI, ["The prompt would give a believable Nigerian picture", "The flyer can be read in five seconds"], [
      piece("Image 1", "A prompt for the main food picture. Say the subject, the place, the light and the style.", words(25, 90), must("light", "style")),
      piece("Image 2", "A prompt with people in it, true to Abuja.", words(25, 90), must("Abuja", "light")),
      piece("Flyer", "Every word on the flyer: headline, offer, price, days and place.", words(12, 45), must("N3500", "Garki", "Monday")),
    ]),
    model: {
      "image-1": "A plate of smoky jollof rice with grilled chicken and fried plantain on a wooden table in a small Nigerian restaurant, warm afternoon light from a window, steam rising, close-up food photography style, shallow focus, no text.",
      "image-2": "Four Nigerian office workers sharing lunch and laughing at a bright corner table in a small Abuja restaurant, plates of egusi and pounded yam in front of them, soft natural light, candid photo style, no text.",
      flyer: "Lunch that tastes like home\nJollof, egusi and pounded yam\nPlates from N3500\nMonday to Saturday, from noon\nMama Ngozi's Kitchen, Garki, Abuja",
    },
  },
  fix(at(AIC, "Beginner", 4, "Fact-check your AI post"), NGOZI,
    "An AI wrote the post that goes with your flyer. It reads well, but some of it is false. Nothing goes out under a client's name until it's checked.",
    FIX_STEPS, "your finished, fact-checked post and flyer: something a real restaurant could publish today.",
    jollofDraft,
    "FACTS FROM THE RESTAURANT\n- Garki, Abuja\n- Jollof, egusi and pounded yam, cooked fresh every morning\n- Lunch plates from N3500, ready from noon\n- Open Monday to Saturday\n- No awards, and no celebrity customers",
    jollof),
  {
    ...at(AIC, "Novice", 1, "Make AI sound like the brand"),
    kind: "CONTENT",
    brief: brief("Glow Haven says AI makes everyone sound the same. Prove that it doesn't have to.", [
      "Write a prompt that makes AI write a caption in Glow Haven's voice.",
      "Write a second prompt for a reply to a customer.",
      "Describe the voice and the rules. Don't write the answer yourself.",
    ], "the prompt library you hand over in Week 4. These are its first two prompts."),
    config: writing(GLOW, ["Sounds gentle and honest, like Glow Haven", "Makes no medical or fairness claims"], [
      piece("Caption", "A prompt that produces a caption for the shea body butter with its price.", words(25, 80), must("N6500", "shea"), avoid("fair skin", "cure"), tags(1, 4)),
      piece("Reply", "A prompt that produces a reply to a customer who asks if it lightens the skin.", words(25, 90), avoid("lightens your skin", "fairer")),
    ], "PROMPT"),
  },
  {
    ...at(AIC, "Novice", 2, "Script, voiceover and captions"),
    kind: "CONTENT",
    brief: brief("Glow Haven wants a 40-second video made with AI. Write everything the tools need.", [
      "Write the voiceover, short enough for 40 seconds.",
      "Write the on-screen captions, a few words at a time.",
      "Write the pictures you would ask AI for, scene by scene.",
    ], "the two-week content pack. This is its first video."),
    config: writing(GLOW, ["Sounds natural when read aloud", FITS], [
      piece("Voiceover", "About 40 seconds when spoken.", words(70, 110), must("shea"), avoid("cure", "bleach your"), easy(16)),
      piece("Captions", "At least six captions, one per line, seven words or fewer each.", words(18, 60)),
      piece("Scenes", "Scene 1: to Scene 4:, each an image prompt.", must("Scene 1:", "Scene 2:", "Scene 3:", "Scene 4:"), words(50, 180)),
    ]),
    model: {
      voiceover: "Harmattan is coming, and your skin can feel it. Dry hands. Tight cheeks. That dusty look by noon. Our body butter is made in Nigeria from pure shea, whipped until it is soft. Warm a little in your hands after your bath. Press it in slowly. No bleaching agents. No hurry. Just skin that feels like yours again. One jar is six thousand five hundred naira, and we deliver across Nigeria in three days. Be gentle with yourself this season.",
      captions: "Harmattan is coming\nDry skin by noon?\nPure Nigerian shea\nNo bleaching agents\nWarm it in your hands\nDelivered in three days",
      scenes: "Scene 1: Dusty harmattan morning over an Abuja street, soft haze, wide shot.\nScene 2: Close-up of dry brown hands rubbed together, natural window light.\nScene 3: A wooden spoon lifting creamy shea butter from a jar, slow and soft.\nScene 4: A Nigerian woman smiling in a bright room, skin glowing naturally, warm light.",
    },
  },
  {
    ...at(AIC, "Novice", 3, "One idea, five formats"),
    kind: "CONTENT",
    brief: brief("Glow Haven's founder said: \"Healthy skin comes from small habits, not harsh products.\" Make that one idea work in different places.", [
      "Write it as a caption, a short thread, an email, a status and a video hook.",
      "Change the shape for each place. Don't paste the same words.",
    ], "the content pack. One idea now fills most of a week."),
    config: writing(GLOW, ["Each version suits its place", "The idea stays the same"], [
      piece("Caption", "For a photo post.", words(30, 90), must("habit"), tags(1, 4)),
      piece("Thread", "At least four short lines, numbered 1. to 4.", must("1.", "2.", "3.", "4."), words(40, 130)),
      piece("Email", "Starts with Subject:", must("Subject:", "habit"), words(50, 150)),
      piece("Status", "For WhatsApp status, 100 characters or fewer.", chars(100), words(4, 20)),
    ]),
    model: {
      caption: "Your skin does not need a battle. It needs a habit.\nWash gently. Moisturise while your skin is damp. Wear your scarf on dusty days. Small things, done daily, show on your face by month end.\n#GlowHaven #HealthySkin",
      thread: "1. Harsh products promise quick change, and your skin pays for it.\n2. Small habits work slower and last longer.\n3. Start with two: wash gently at night, and moisturise while you are damp.\n4. Give it four weeks, then look at your own photos.",
      email: "Subject: The two-minute habit your skin will thank you for\n\nHello,\n\nMost of us look for one product that changes everything. Our founder thinks differently. She says that healthy skin comes from small habits, not harsh products.\n\nSo try this tonight. Wash with warm water, pat your skin, and moisturise before it dries. It takes two minutes. Do it for four weeks.\n\nBe gentle with yourself,\nGlow Haven",
      status: "Two minutes tonight. Better skin in four weeks.",
    },
  },
  {
    ...at(AIC, "Novice", 4, "The two-week content pack"),
    kind: "CONTENT",
    brief: brief("Deliver Glow Haven's two-week pack: prompts that its small team can reuse, not just posts.", [
      "Write a prompt for a week of caption ideas.",
      "Write a prompt for a product post.",
      "Write a prompt for an answer to a common worry.",
      "Make each one clear enough for a stranger to use.",
    ], "your milestone: a content pack and a prompt library a brand can keep using."),
    config: writing(GLOW, ["On brand and honest", "Ready to post with little editing"], [
      piece("Ideas", "A prompt that produces seven caption ideas, one for each day.", words(60, 260), must("Monday", "Sunday")),
      piece("Product", "A prompt that produces a product post with price and delivery time.", words(30, 110), must("N6500", "three days"), avoid("cure", "fairer")),
      piece("Worry", "A prompt that produces an honest answer to: is shea too oily for my face?", words(35, 130), must("shea"), avoid("guarantee")),
    ], "PROMPT"),
  },

  fix(at(VA, "Beginner", 1, "Check a new assistant's guide"), ADAEZE,
    "Mrs Obi is training a second assistant and asked for a short guide. Someone wrote it in a hurry, and parts of it would cause real trouble.",
    FIX_STEPS, "the week you organise for her in Week 4. First, get the basics exactly right.",
    vaWordsDraft,
    "NOTES FROM MRS OBI\n- SOP: standard operating procedure, the steps for doing a task\n- Inbox zero: every email answered, filed or scheduled\n- Nigeria is UTC+1 all year. London is UTC+0 in winter\n- A deliverable is the finished work\n- Client information stays private, always",
    vaWords),
  {
    ...at(VA, "Beginner", 2, "Five emails from a client's desk"),
    kind: "CONTENT",
    brief: brief("Mrs Obi is at a venue all day. These messages can't wait, and they go out in her name.", [
      "Confirm a meeting with the Okafor family on Monday at 9:30am.",
      "Ask a vendor politely why the chairs are late.",
      "Say no to a date she can't do, without losing the customer.",
      "Chase a payment kindly.",
    ], "her organised week. These are four of the messages in the inbox you sort in Week 4."),
    config: writing(ADAEZE, ["Polite, clear and ready to send", "Says exactly what happens next"], [
      piece("Confirm", "Starts with Subject:. Confirm the meeting and ask for anything you need.", must("Subject:", "Monday", "9:30"), words(30, 110)),
      piece("Late chairs", "Starts with Subject:. Find out what happened and get a new time.", must("Subject:", "chairs"), avoid("useless", "stupid"), words(30, 110)),
      piece("Say no", "Starts with Subject:. She is booked on 12 December. Offer another way.", must("Subject:", "12 December"), words(35, 120)),
      piece("Payment", "Starts with Subject:. The balance of N150000 was due on Friday.", must("Subject:", "N150000", "Friday"), avoid("or else"), words(30, 110)),
    ]),
    model: {
      confirm: "Subject: Our meeting on Monday at 9:30am\n\nGood morning Mr and Mrs Okafor,\n\nMrs Obi looks forward to meeting you on Monday at 9:30am in our Wuse office. Please bring your guest list and any pictures you like. If you need to change the time, kindly reply by Sunday evening.\n\nWarm regards,\nFor Adaeze Obi Events",
      "late-chairs": "Subject: Chairs for today's event\n\nGood afternoon,\n\nWe expected the chairs at the venue by 1pm, and they have not arrived. Please could you tell us where the truck is now and the time it will reach us? Guests arrive at 4pm, so we need them by 2:30pm.\n\nThank you for your quick help.\nFor Adaeze Obi Events",
      "say-no": "Subject: Your event on 12 December\n\nDear Ms Danjuma,\n\nThank you for thinking of us. Mrs Obi is already booked on 12 December and would not want to give your day less than it deserves. She is free on 13 and 19 December. We can also recommend a planner we trust. Which would you prefer?\n\nKind regards,\nFor Adaeze Obi Events",
      payment: "Subject: Balance for your event\n\nDear Mr Bassey,\n\nWe hope you are well. This is a gentle reminder that the balance of N150000 was due on Friday. Once we have it, we will confirm the hall and the caterer for you. If you have already paid, please send us the receipt and accept our thanks.\n\nKind regards,\nFor Adaeze Obi Events",
    },
  },
  {
    ...at(VA, "Beginner", 3, "Put a client's files in order"),
    kind: "CONTENT",
    brief: brief("Mrs Obi's Drive has 400 files with names like \"new new final.docx\". Nobody can find a contract on a wedding day.", [
      "Design a folder structure, one folder per line.",
      "Write a file-naming rule with three examples.",
      "List the columns of a sheet that tracks every event.",
    ], "her organised week. Good files are what let you plan the rest without her."),
    config: writing(ADAEZE, ["A new person could find any file in a minute", "Simple enough to keep up every day"], [
      piece("Folders", "Main folders and what's inside them. Cover clients, contracts, invoices and vendors.", must("Clients", "Contracts", "Invoices", "Vendors"), words(15, 120)),
      piece("Naming", "The rule, then three example names. Put the date first as year-month-day.", must("2026-"), avoid("final final"), words(20, 120)),
      piece("Event sheet", "The columns, and what each is for. Include the date, the client, the balance and the status.", must("Date", "Client", "Balance", "Status"), words(25, 140)),
    ]),
    model: {
      folders: "Clients\n  2026 Okafor wedding\n  2026 Bassey birthday\nContracts\n  Signed\n  Waiting\nInvoices\n  Sent\n  Paid\nVendors\n  Caterers\n  Halls\n  Decorators\nTemplates",
      naming: "Rule: date, then client, then what it is, with no spaces at the ends. Only one copy is kept, and old ones move to Archive.\n2026-12-05 Okafor contract signed\n2026-12-08 Bassey invoice 2\n2026-12-10 Musa venue photos",
      "event-sheet": "Date: the day of the event\nClient: the name and phone number\nVenue: the place and the contact person\nTotal: the full price agreed\nBalance: what is still owed\nStatus: enquiry, booked, paid or done\nNext step: the one thing to do now",
    },
  },
  fix(at(VA, "Beginner", 4, "Plan the week without a clash"), ADAEZE,
    "Here is a first plan of Mrs Obi's week. If it goes out like this, she'll miss a client, a deadline and her own children.",
    ["Read her notes carefully.", "Find every entry that breaks one of them.", "Move or correct only those entries."],
    "your milestone: a client's whole week organised. Inbox, files and calendar now work together.",
    calendarDraft,
    "NOTES FROM MRS OBI\n- The Okafor meeting is Monday 9:30 to 11:00 and cannot move\n- The London client can talk only after 10am London time (11am in Abuja)\n- She picks up her children at 16:30 every Wednesday\n- The Bassey quote is due by the end of Thursday\n- Keep Friday morning for the Okafor rehearsal",
    calendar),
  {
    ...at(VA, "Novice", 1, "Build the task board"),
    kind: "CONTENT",
    brief: brief("Mr Cole of Bright Path Tutors keeps tasks in his head and on paper. Design the board that replaces both.", [
      "Choose the columns and say when a card moves.",
      "Write three real task cards.",
      "Write the daily update you would send him.",
    ], "your week of support. Everything you do for him this month lives on this board."),
    config: writing(BRIGHT, ["Nothing could be forgotten with this board", CLEAR], [
      piece("Columns", "Each column and the rule for moving a card into it.", must("To do", "Doing", "Waiting", "Done"), words(30, 140)),
      piece("Cards", "Three cards, each with Task:, Owner:, Due: and Done when:", must("Task:", "Owner:", "Due:", "Done when:"), words(50, 200)),
      piece("Update", "A daily message: done, next, and blocked.", must("Done", "Next", "Blocked"), words(25, 110)),
    ]),
    model: {
      columns: "To do: agreed work that nobody has started\nDoing: work being done today, three cards at most\nWaiting: we need an answer from someone, and their name is on the card\nDone: finished and checked, moved to the archive every Friday",
      cards: "Task: Match the Adeyemi twins with a maths tutor\nOwner: Assistant\nDue: Tuesday 5pm\nDone when: the parent and the tutor have both agreed a time\n\nTask: Send November invoices\nOwner: Assistant\nDue: Friday noon\nDone when: every parent has an invoice\n\nTask: Call tutors about December dates\nOwner: Mr Cole\nDue: Thursday\nDone when: the calendar shows who is away",
      update: "Good evening Mr Cole.\nDone: matched two families and sent six invoices.\nNext: call tutors about December tomorrow morning.\nBlocked: Mrs Bello has not chosen a lesson time, so please approve the Saturday slot.",
    },
  },
  fix(at(VA, "Novice", 2, "Data entry with no mistakes"), BRIGHT,
    "A lead list was typed from a source sheet, in a hurry. One wrong digit means a school is never reached.",
    ["Compare every line with the source.", "Correct each mistake exactly.", "Leave correct lines alone."],
    "your week of support. Mr Cole's team will call from this list.",
    leadsDraft,
    "SOURCE SHEET\n1. Greenfield Academy | Ikeja | 0803 111 2323\n2. Little Stars School | Yaba | hello@littlestars.example\n3. Sunrise Montessori | Ajah | info@sunrise.example\n4. Crown Heights College | Lekki | 810 pupils\n5. Hilltop Primary | Surulere | Mrs Tunde Alabi\n6. Bluebell School | Gbagada | 0806 222 3344\n7. Royal Seed School | Magodo | 0805 777 8899\n8. Maple House | Victoria Island | 95 pupils",
    leads),
  {
    ...at(VA, "Novice", 3, "Answer customers well"),
    kind: "CONTENT",
    brief: brief("Parents write to Bright Path all day. Write replies the whole team can reuse.", [
      "A parent missed a lesson and gave two hours' notice.",
      "A tutor didn't come, and the parent is angry.",
      "A parent asks for a discount.",
      "A new parent asks how it works.",
    ], "your week of support. These become the templates you answer from."),
    config: writing(BRIGHT, ["Kind, and true to the company's rules", "The customer knows what happens next"], [
      piece("Missed lesson", "Keep the 24 hours rule, kindly.", must("24 hours"), words(35, 120)),
      piece("Angry parent", "Apologise, act, and say when you'll be back in touch.", must("sorry"), avoid("calm down", "not our fault"), words(35, 120)),
      piece("Discount", "Lessons are N8000. There is no discount, but be helpful.", must("N8000"), words(30, 110)),
      piece("New parent", "Explain how it works in simple steps.", must("N8000", "tutor"), words(40, 140)),
    ]),
    model: {
      "missed-lesson": "Good afternoon Mrs Eze. Thank you for letting us know, and we hope everyone is well. We can move a lesson when we hear at least 24 hours before, because the tutor has kept the time. This one counts as taken. Shall I book the next lesson for the same time on Thursday?",
      "angry-parent": "Good evening Mr Yusuf. We are sorry that nobody came and that your son was left waiting. I am calling the tutor now. You will hear from me by 7pm with what happened and a new time, and you will not pay for today. Thank you for telling us at once.",
      discount: "Good morning Mrs Ade. Thank you for asking. Each lesson is N8000, and we keep one price for every family so that tutors are paid fairly. If it helps, two children can share one lesson, or we can start with one lesson a week. Which would you like?",
      "new-parent": "Welcome to Bright Path. First, tell us your child's class and the subject. Next, we choose a tutor near you and send their profile. Then you pick a time for the first lesson. Each lesson is N8000. After it, tell us honestly how it went. If the tutor is not right for your child, we will find another.",
    },
  },
  {
    ...at(VA, "Novice", 4, "A full week as the assistant"),
    kind: "CONTENT",
    brief: brief("Mr Cole travels on Monday and won't be online. You run Bright Path for the week.", [
      "Triage Monday's inbox: say what you'd do with each message and in what order.",
      "Plan his Friday, when he's back from noon.",
      "Write Friday's report.",
      "Inbox: (a) a tutor resigns from next week, (b) a parent says a tutor arrived drunk, (c) a school wants a meeting on Friday, (d) an advert for office chairs, (e) an invoice question.",
    ], "your milestone: a full week of support, done the way a professional would."),
    config: writing(BRIGHT, ["Serious things come first", "Mr Cole could trust this assistant alone"], [
      piece("Triage", "Five lines starting (a) to (e), in the order you'd handle them, with what you do.", must("(a)", "(b)", "(c)", "(d)", "(e)"), words(60, 220)),
      piece("Friday", "A plan with times. He lands at noon and has a school meeting.", must("12:", "school"), words(30, 130)),
      piece("Report", "What was done, what needs his decision, and what comes next week.", must("Done", "Decision", "Next week"), words(60, 220), easy(22)),
    ]),
    model: {
      triage: "(b) First. Call the parent, make sure the child is safe, stop that tutor's lessons today and write down what was said.\n(a) Second. Thank the tutor, ask for the last day, and list the families who need a replacement.\n(c) Third. Offer the school 2pm on Friday, after Mr Cole lands.\n(e) Fourth. Check the invoice and answer the parent before close.\n(d) Last. Archive the advert.",
      friday: "12:00 Mr Cole lands and rests\n13:00 Twenty-minute call with me on the week\n14:00 Meeting with the school\n15:30 Decision on the two tutors\n16:30 Free",
      report: "Done: every message was answered the same day. The tutor in the complaint has stopped lessons, and the family has a new tutor from Monday. Nine invoices were sent, and eight are paid.\n\nDecision needed: please decide whether to end the contract of the tutor in the complaint. My notes are in the Drive. Also approve two new tutors to replace the one who resigned.\n\nNext week: first lessons with the replacement tutors, the December calendar, and one unpaid invoice to follow.",
    },
  },

  fix(at(CYB, "Beginner", 1, "Correct the family safety guide"), BELLO,
    "The Bellos printed a safety guide from a group chat. Some of it is dangerously wrong.",
    FIX_STEPS, "the safety check-up you finish in Week 4. A check-up starts with the right words.",
    cyberWordsDraft,
    "CORRECT MEANINGS\n- Phishing: pretending to be someone trusted, to steal\n- MFA: a second proof that it's you\n- Encryption: scrambling a message so that only the right person can read it\n- Firewall: controls what may enter and leave a network\n- CIA: confidentiality, integrity, availability (the right people can use it when they need it)",
    cyberWords),
  fix(at(CYB, "Beginner", 2, "Fix a risky security checklist"), BELLO,
    "Dad wrote this checklist for everyone's phone and accounts. Half of it would let a thief in.",
    FIX_STEPS, "the family's check-up. This checklist stays on their fridge, so every line must be right.",
    checklistDraft,
    "GOOD PRACTICE\n- A different strong password for each account, in a password manager\n- Codes are never shared, not even with a bank\n- Updates stay on\n- PINs nobody can guess\n- Apps only from the official store",
    checklist),
  fix(at(CYB, "Beginner", 3, "Ten messages: safe or scam?"), BELLO,
    "The family saved ten messages and tried to judge them. Five of their answers are wrong, and the reason matters as much as the answer.",
    ["Read each message in the notes.", "Check the family's answer and reason.", "Where they're wrong, change both the answer and the reason."],
    "the family's check-up. After this, they can spot a scam without you.",
    phishingDraft, phishingNotes, phishing),
  fix(at(CYB, "Beginner", 4, "Explain the home network"), BELLO,
    "To finish the check-up, the Bellos need one page on how their home network works and what to protect. This draft isn't safe to give them yet.",
    FIX_STEPS, "your milestone: a full safety check-up for a family, covering accounts, devices, scams and the home network.",
    networkDraft,
    "FACTS\n- DNS turns names into IP addresses\n- HTTP uses port 80, HTTPS uses port 443\n- 192.168.x.x addresses are private\n- A router passes traffic between the home and the internet\n- Always change default passwords",
    network),
  fix(at(CYB, "Novice", 1, "Correct the server notes"), PHARMA,
    "Kubwa Pharmacy's server runs Linux. A past helper left these notes, and following them could wipe the records.",
    FIX_STEPS, "the security audit in Week 4. You'll need these commands to look around safely.",
    linuxDraft,
    "MANUAL\n- pwd: print the current folder\n- cd: change folder\n- cat: show a file\n- chmod 600: only the owner can read and write\n- rm -r: delete a folder and its contents\n- grep: find lines with some text\n- tail -f: follow a log",
    linux),
  fix(at(CYB, "Novice", 2, "Secure the pharmacy's network plan"), PHARMA,
    "This is the network plan an installer left. Customers' records and the payment terminal depend on it.",
    FIX_STEPS, "the audit. Your corrected plan becomes its network section.",
    firewallDraft,
    "RULES OF THUMB\n- WPA2 or WPA3 only\n- Guests on their own network\n- Remote access through a VPN\n- Block incoming by default, allow what's needed\n- No default logins",
    firewall),
  {
    ...at(CYB, "Novice", 4, "The small-business security audit"),
    kind: "CONTENT",
    brief: brief("Write the audit for Mrs Sani. You found: one shared password for both computers, no backups since March, customer Wi-Fi now separate, staff clicking email links, and old software on the till.", [
      "Write a summary that she can read in one minute.",
      "List the risks, most serious first, each with what could happen.",
      "Recommend fixes, with who does each one and by when.",
    ], "your milestone: a security audit a real business could act on tomorrow."),
    config: writing(PHARMA, ["Risks are ranked sensibly, with reasons", "An owner who isn't technical knows what to do first"], [
      piece("Summary", "One minute to read. Say what's good as well.", words(50, 130), must("backup", "password"), easy(20)),
      piece("Risks", "At least four, each starting High:, Medium: or Low:", must("High:", "Medium:", "backup", "password"), words(80, 260)),
      piece("Fixes", "Each fix with Who: and By:", must("Who:", "By:", "backup"), words(70, 260)),
    ]),
    model: {
      summary: "Mrs Sani, your pharmacy has one strong point: customers now use a separate Wi-Fi. Two things need action this week. There has been no backup since March, so one broken computer could lose every record. Also, both computers share one password, so you cannot tell who did what. The other fixes are cheap and can be done this month.",
      risks: "High: no backup since March. If a computer fails or is locked by malware, customer records and stock are gone.\nHigh: one shared password. Anyone who leaves the job can still get in, and nobody can be held responsible.\nMedium: staff click links in emails. One wrong click could give a thief your accounts.\nMedium: the till runs old software. Known holes in it can be used against you.\nLow: nobody checks who can see customer records. Review it every three months.",
      fixes: "1. Start a daily backup to a drive kept off site, and test it. Who: Mr Audu. By: Wednesday.\n2. Give each person their own login and a long password. Who: Mrs Sani. By: Friday.\n3. Update the till software after closing. Who: the supplier. By: the end of the month.\n4. Hold a 30-minute lesson on fake emails. Who: the auditor. By: the 15th.\n5. Review who sees customer records. Who: Mrs Sani. By: every quarter.",
    },
  },
];

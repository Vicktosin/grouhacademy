// Entry assessments for the tracks and levels that had none, based on
// data/curriculum.json. Each question: prompt, the right answer, then three
// wrong ones (lib/entry-assessments.ts mixes the order). A track and level
// that already has an assessment keeps it.

export type EntryQuestion = [prompt: string, correct: string, wrong1: string, wrong2: string, wrong3: string];

/** Track name (as in the curriculum) > level name > questions. */
export const ENTRY_ASSESSMENTS: Record<string, Record<string, EntryQuestion[]>> = {
  "Social Media Marketing": {
    Novice: [
      ["What are content pillars?", "The main topics a brand posts about", "The tallest posts on a page", "Paid adverts only", "The people who follow a page"],
      ["What does brand voice mean?", "The way a brand sounds when it speaks to people", "The music used in a video", "How loud a video is", "The brand's phone number"],
      ["What matters most in the first 3 seconds of a short video?", "A hook that makes people keep watching", "A long list of credits", "The company address", "A blank screen"],
      ["A customer leaves an angry comment. What is the best first step?", "Reply calmly and offer to help", "Delete it and block them", "Argue with them", "Ignore every comment from now on"],
    ],
    Intermediate: [
      ["What is a KPI?", "A number that shows whether you are reaching a goal", "A type of photo", "A password for a page", "A kind of hashtag"],
      ["Which number shows how many different people saw a post?", "Reach", "Budget", "Captions", "Followers you follow"],
      ["In Meta Ads Manager, what is an audience?", "The group of people who can see your ad", "The colour of your ad", "Your bank account", "The time you log in"],
      ["What is user-generated content?", "Content made by customers or followers about a brand", "Content only the owner makes", "A paid TV advert", "A private company report"],
    ],
    Advanced: [
      ["What does a social media audit do?", "Checks what is working and what is not on a brand's pages", "Deletes old accounts", "Buys new followers", "Changes the brand's name"],
      ["What is retargeting?", "Showing ads to people who already visited or engaged", "Showing ads to nobody", "Posting the same photo every day", "Changing your target age each hour"],
      ["In an A/B test, what should you change between the two ads?", "One thing at a time", "Everything at once", "Nothing at all", "Only the spelling of your name"],
      ["A false story about your client is spreading. What should you do first?", "Get the facts and agree a calm reply", "Post an angry reply at once", "Delete every page", "Pretend you never saw it"],
    ],
    Professional: [
      ["What should a client proposal include?", "The problem, your plan, the price and the timeline", "Only your photo", "Other clients' passwords", "A list of your hobbies"],
      ["Why does a team use an approval step?", "So content is checked before it goes out", "So posts take longer for no reason", "To hide posts from the client", "To avoid planning"],
      ["What makes a portfolio case study strong?", "The goal, what you did and the results", "Only a logo", "A very long story with no results", "Copied work"],
      ["What is the safest way to share access to a client's page?", "Give roles through Meta Business Suite", "Share the password in a group chat", "Print the password", "Use one password for every client"],
    ],
  },
  "Digital Marketing": {
    Novice: [
      ["What is content marketing?", "Sharing useful content to attract customers", "Buying every billboard", "Sending random messages", "Copying a competitor's website"],
      ["What does a Google Business Profile help with?", "Being found in local searches and on maps", "Editing videos", "Paying staff", "Writing code"],
      ["In Google Ads, what is a keyword?", "A word you want your ad to show for", "Your account password", "The ad's colour", "The name of your bank"],
      ["What does an exact match keyword do?", "Shows your ad for searches with that same meaning", "Shows your ad to everyone online", "Stops your ad completely", "Makes your ad free"],
    ],
    Intermediate: [
      ["What is GA4 used for?", "Seeing what people do on a website", "Designing logos", "Sending text messages", "Storing photos"],
      ["What is a UTM link used for?", "Tracking where visitors came from", "Making a page load faster", "Hiding a website", "Printing a flyer"],
      ["What is a conversion?", "A visitor doing what you wanted, such as buying", "A visitor leaving at once", "A page changing colour", "A broken link"],
      ["You spent N10,000 and made N40,000 in sales. What is your ROAS?", "4", "10", "40", "0.25"],
    ],
    Advanced: [
      ["What does positioning mean?", "How you want customers to see your brand compared with others", "Where your office desk is", "The size of your logo", "Your place in a queue"],
      ["What does a CRM help you do?", "Keep track of customers and leads", "Edit pictures", "Make a website faster", "Write computer code"],
      ["Which is a good example of marketing automation?", "A welcome email sent when someone signs up", "Typing each email by hand at midnight", "Printing a poster", "Calling your own phone"],
      ["What makes a good growth experiment?", "A clear idea, one change and a number to measure", "Many changes and no measurement", "A guess with no plan", "Copying without testing"],
    ],
    Professional: [
      ["What does ROI tell you?", "What you gained compared with what you spent", "How many staff you have", "The date a campaign started", "The size of an advert"],
      ["What is forecasting?", "Estimating future results from data", "Writing a past report", "Designing a banner", "Choosing a font"],
      ["A client keeps adding work that was not agreed. What should you do?", "Go back to the agreed scope and discuss time and cost", "Do it all in silence", "Stop replying", "Delete the project"],
      ["What should a campaign case study show?", "The goal, the actions and the results", "Only the colours used", "Private client data", "The weather that week"],
    ],
  },
  "AI for Content Creation": {
    Novice: [
      ["How can you help an AI tool write in a brand's voice?", "Give it examples and clear rules about tone", "Type faster", "Use no instructions", "Ask it to guess"],
      ["What comes first when making a short video with AI?", "A script or clear idea", "The final export", "The view count", "The comments"],
      ["What does repurposing content mean?", "Turning one piece into other formats", "Deleting old posts", "Copying other people's work", "Posting the same thing to one page all day"],
      ["Why should you check AI writing before posting?", "It can state things that are not true", "It is always perfect", "It cannot use words", "It deletes itself"],
    ],
    Intermediate: [
      ["What does giving the AI a role do?", "Guides how it thinks and answers", "Makes it slower", "Turns it off", "Changes your password"],
      ["Why add examples to a prompt?", "To show the kind of answer you want", "To confuse the tool", "To use more battery", "To hide the question"],
      ["When should you tell people content was made with AI?", "When it could mislead them, or a rule or client asks for it", "Never", "Only on Fridays", "Only if it is badly made"],
      ["Which is a useful way to track content performance?", "Record reach and engagement each week", "Guess how it did", "Look once a year", "Count only your own likes"],
    ],
    Advanced: [
      ["What is a content system?", "A repeatable way to plan, make and publish content", "A type of camera", "A single post", "A computer virus"],
      ["What is batching?", "Making several pieces of content in one session", "Deleting drafts", "Posting without planning", "Using one hashtag"],
      ["How should AI research be used in a strategy?", "Check it against reliable sources", "Accept it all without checking", "Hide it from the team", "Use it only for pictures"],
      ["What is thought leadership content?", "Content that shares real insight and experience", "Content copied from others", "Only price lists", "Random memes"],
    ],
    Professional: [
      ["What should a service package state clearly?", "What is included, the price and the timeline", "Only a nice name", "Nothing until the end", "Your tool passwords"],
      ["Why have a quality check before delivery?", "To catch errors and keep the brand right", "To delay the client", "To raise the price", "To avoid feedback"],
      ["What belongs in an AI content portfolio?", "Your best work with the goal and result", "Every draft you made", "Other people's work", "Private client files"],
      ["A client asks you to use a celebrity's face without permission. What should you do?", "Explain the risk and suggest another idea", "Do it secretly", "Charge more and do it", "Post it on your own page"],
    ],
  },
  "AI Automation": {
    Novice: [
      ["What does a filter do in a workflow?", "Lets only the right items continue", "Changes the colour of an app", "Deletes the workflow", "Speeds up the internet"],
      ["What is a path (branch) used for?", "Doing different things in different cases", "Saving battery", "Printing a page", "Changing a password"],
      ["Which is a good job for an AI step?", "Sorting messages by topic", "Charging a phone", "Plugging in a cable", "Opening a window"],
      ["What is an FAQ bot?", "A bot that answers common questions", "A bot that deletes files", "A type of spreadsheet", "A payment card"],
    ],
    Intermediate: [
      ["What is JSON?", "A text format for sharing data between apps", "A type of chatbot", "A video format", "A computer brand"],
      ["What does a webhook do?", "Sends data to another app when something happens", "Stores photos", "Blocks the internet", "Checks spelling"],
      ["Why use a loop?", "To repeat a step for each item", "To stop a workflow", "To hide an error", "To change a logo"],
      ["What does error handling do?", "Decides what happens when a step fails", "Creates more errors", "Deletes the data", "Makes text bold"],
    ],
    Advanced: [
      ["What makes an AI agent different from a simple chatbot?", "It can use tools to do tasks", "It has no instructions", "It only works offline", "It cannot read text"],
      ["What is a knowledge base used for?", "Giving the assistant facts to answer from", "Storing passwords in public", "Making videos", "Charging customers"],
      ["How should you keep an API key?", "Store it as a secret and never share it", "Post it in a group", "Write it in a public page", "Put it in the file name"],
      ["What is a retry?", "Trying a failed step again", "Deleting a step", "Charging twice on purpose", "Closing an account"],
    ],
    Professional: [
      ["What does scoping a project mean?", "Agreeing what will and will not be done", "Choosing a logo", "Buying a new laptop", "Skipping the plan"],
      ["An automation saves 10 hours a month. What else do you need to show its value?", "What those hours cost and what it costs to run", "The app's colour", "Your age", "The number of tabs open"],
      ["What should a handover include?", "Instructions, access and who to contact", "Only a thank-you message", "Nothing", "Your personal passwords"],
      ["Why charge for maintenance?", "Workflows need checks and fixes when apps change", "To hide mistakes", "Because apps never change", "To stop the client using it"],
    ],
  },
  "Front-End Development": {
    Novice: [
      ["What is a variable in JavaScript?", "A named place to keep a value", "A type of image", "A web address", "A CSS colour"],
      ["What is an event?", "Something that happens, such as a click", "A saved file", "A web host", "A font size"],
      ["What is the DOM?", "The page's elements that JavaScript can change", "A type of domain name", "A database", "An image editor"],
      ["What is Git used for?", "Tracking changes to code", "Drawing logos", "Sending emails", "Playing videos"],
    ],
    Intermediate: [
      ["What does fetch do?", "Requests data from a server", "Deletes a page", "Adds a font", "Closes the browser"],
      ["What is an array?", "A list of values", "A single letter", "A CSS rule", "A web host"],
      ["In React, what are props?", "Values passed into a component", "Errors in a page", "Image files", "Server names"],
      ["What is state in React?", "Data that can change and update the screen", "A country setting", "A static image", "A folder name"],
    ],
    Advanced: [
      ["What does the useState hook do?", "Keeps a value that can change in a component", "Adds a CSS file", "Creates a server", "Deletes a component"],
      ["Why is accessibility important?", "So that everyone can use the site", "To make pages slower", "To hide content", "To use more colours"],
      ["What is Tailwind CSS?", "A set of utility classes for styling", "A database", "A programming language", "A web browser"],
      ["Which helps a page load faster?", "Smaller, well-sized images", "Very large images", "Many unused scripts", "Autoplaying videos"],
    ],
    Professional: [
      ["What is a test in code?", "Code that checks other code works", "A type of website", "A design file", "A hosting plan"],
      ["What is a pull request?", "A request to review and merge your changes", "A way to download a game", "A server error", "A CSS property"],
      ["Why use branches?", "To work on changes without breaking the main code", "To delete the project", "To slow the team", "To hide your name"],
      ["What should a portfolio project show?", "A live link, the code and what you did", "Only a title", "Someone else's code", "Your passwords"],
    ],
  },
  "Back-End Engineering": {
    Novice: [
      ["What does CRUD stand for?", "Create, Read, Update, Delete", "Copy, Run, Upload, Download", "Code, Review, Use, Deploy", "Connect, Reset, Undo, Drop"],
      ["Which SQL word reads data from a table?", "SELECT", "INSERT", "DELETE", "DROP"],
      ["Which HTTP method usually creates something new?", "POST", "GET", "DELETE", "HEAD"],
      ["What does a JOIN do?", "Combines rows from related tables", "Deletes a table", "Connects to Wi-Fi", "Changes a password"],
    ],
    Intermediate: [
      ["How should passwords be stored?", "Hashed", "As plain text", "In the page address", "In a public file"],
      ["What does a JWT help with?", "Proving who a user is on each request", "Drawing a chart", "Styling a page", "Sending an SMS"],
      ["Why validate input?", "To reject wrong or unsafe data", "To make the API slower", "To hide errors", "To accept anything"],
      ["Where should secret keys be kept when deploying?", "In environment variables", "In public code", "In the page title", "In a comment"],
    ],
    Advanced: [
      ["What does rate limiting do?", "Limits how many requests someone can make", "Speeds up typing", "Deletes users", "Adds more tables"],
      ["How does a database index help?", "It makes searches faster", "It deletes old rows", "It changes passwords", "It sends emails"],
      ["Why use pagination?", "To return data in smaller parts", "To return everything at once", "To hide data forever", "To rename tables"],
      ["How do you know a payment webhook is real?", "Check its signature", "Trust every request", "Check the colour", "Ask the customer"],
    ],
    Professional: [
      ["What does CI do?", "Runs checks automatically when code changes", "Deletes code", "Designs screens", "Buys a domain"],
      ["What is the point of a system design?", "To plan how the parts work together", "To choose a logo", "To avoid testing", "To hide problems"],
      ["What is a unit test?", "A test of one small piece of code", "A test of the internet speed", "A user survey", "A design review"],
      ["What should good API documentation show?", "Endpoints, inputs, outputs and examples", "Only the author's name", "Database passwords", "Nothing"],
    ],
  },
  "WordPress Development": {
    Novice: [
      ["What is a block in WordPress?", "A piece of content you can add to a page", "A banned user", "A web host", "A password"],
      ["What does an SEO plugin help with?", "Being found in search engines", "Editing videos", "Printing pages", "Sending SMS"],
      ["Why take backups?", "To restore the site if something breaks", "To make the site slower", "To delete old posts", "To add followers"],
      ["Which is a page builder?", "Elementor", "Gmail", "Excel", "WhatsApp"],
    ],
    Intermediate: [
      ["What is WooCommerce?", "A plugin for building an online store", "A web browser", "A photo editor", "A domain name"],
      ["Why use Paystack test mode?", "To try payments without real money", "To charge customers twice", "To hide orders", "To speed up images"],
      ["Which helps a WordPress site load faster?", "Compressing images", "Adding many unused plugins", "Uploading huge images", "Turning off caching"],
      ["What does a shipping setting decide?", "Where you deliver and what it costs", "The site's font", "The admin password", "The logo size"],
    ],
    Advanced: [
      ["Why use a child theme?", "So your changes survive theme updates", "To delete the main theme", "To add users", "To host videos"],
      ["What is a custom post type?", "Your own kind of content, such as Projects", "A broken post", "A paid advert", "A spam comment"],
      ["What does ACF let you add?", "Extra fields to your content", "More electricity", "A new domain", "A phone line"],
      ["Which is good security practice?", "Keep everything updated and use strong passwords", "Use admin as the password", "Share one login", "Never update"],
    ],
    Professional: [
      ["What should a client brief tell you?", "The goals, content, budget and deadline", "Only the colour", "Nothing important", "The client's passwords to everything"],
      ["What is a migration?", "Moving a site to a new host or domain", "Deleting a site", "Writing a blog post", "Changing a font"],
      ["What should a maintenance package include?", "Updates, backups and checks", "Only a logo", "Free unlimited new sites", "Nothing in writing"],
      ["What does DNS do?", "Points a domain to the right server", "Edits images", "Writes content", "Takes payments"],
    ],
  },
  "Virtual Assistant": {
    Beginner: [
      ["What does a virtual assistant do?", "Helps clients with tasks from a distance", "Repairs computers in a shop", "Drives for a company", "Sells phones on the street"],
      ["Which is the best way to start a work email?", "A polite greeting", "All capital letters", "No subject and no greeting", "A joke about the client"],
      ["Which tool is best for a shared schedule?", "A calendar app", "A music player", "A game", "A torch app"],
      ["A client sends you private information. What should you do?", "Keep it confidential", "Post it online", "Share it with friends", "Print it for neighbours"],
    ],
    Novice: [
      ["What are Trello and Asana used for?", "Organising tasks and projects", "Editing music", "Making calls only", "Paying bills"],
      ["How do you check that online research is reliable?", "Compare it with trusted sources", "Take the first result", "Guess", "Ask nobody"],
      ["What matters most in data entry?", "Accuracy", "Bright colours", "Long sentences", "Loud music"],
      ["A customer is upset. What is the best tone?", "Calm, polite and helpful", "Angry", "Sarcastic", "Silent"],
    ],
    Intermediate: [
      ["Why schedule social media posts?", "So they go out on time without posting by hand", "To hide them", "To delete them", "To pay more"],
      ["What is an invoice?", "A document asking for payment", "A type of photo", "A job advert", "A calendar"],
      ["What is an SOP?", "Step-by-step instructions for a task", "A sales offer price", "A social post", "A saved password"],
      ["What should a weekly client report include?", "What was done, what is next and any problems", "Only a greeting", "Your private plans", "Other clients' data"],
    ],
    Advanced: [
      ["What is a lead?", "A person or business that may become a customer", "A type of cable", "A finished task", "A refund"],
      ["What are meeting minutes?", "A short record of what was discussed and decided", "The length of a break", "A clock setting", "A travel ticket"],
      ["When booking travel for a client, what should you check first?", "Dates, budget and preferences", "The hotel's logo", "Your own holiday", "The pilot's name"],
      ["What can Zapier do?", "Connect apps so tasks happen automatically", "Print photos", "Charge a laptop", "Draw by hand"],
    ],
    Professional: [
      ["What makes a good Upwork proposal?", "It speaks to the client's need and shows proof", "It is copied for every job", "It is one word", "It lists your problems"],
      ["Why use a contract?", "To agree the work, price and terms", "To avoid work", "To confuse the client", "To hide the price"],
      ["Which is a fair way to set a price?", "Think about time, skill, value and market rates", "Pick any number", "Always work free", "Copy a random price"],
      ["What should a VA portfolio show?", "Samples of work and results, with no private data", "Client passwords", "Only your photo", "Unfinished drafts"],
    ],
  },
  Cybersecurity: {
    Beginner: [
      ["What is cybersecurity?", "Protecting devices, accounts and data from attacks", "Selling computers", "Making phone cases", "Designing logos"],
      ["Which password is strongest?", "A long one with mixed words, numbers and symbols", "123456", "Your first name", "password"],
      ["An unknown email asks for your bank PIN. What should you do?", "Do not reply, and report it", "Send the PIN", "Forward it to friends", "Click every link"],
      ["Why install software updates?", "They often fix security problems", "They make a device unsafe", "They delete the internet", "They are only for games"],
    ],
    Novice: [
      ["What is Linux?", "An operating system", "A web page", "A type of virus", "A phone network"],
      ["What does a firewall do?", "Controls which network traffic is allowed", "Cools the computer", "Stores photos", "Writes emails"],
      ["What does a VPN do?", "Creates a private, encrypted connection", "Charges a battery", "Makes passwords public", "Deletes malware from a phone by itself"],
      ["What does HTTPS mean for a website?", "The connection is encrypted", "The site is always honest", "The site is free", "The site has no images"],
    ],
    Intermediate: [
      ["What is Wireshark used for?", "Looking at network traffic", "Editing videos", "Writing letters", "Booking flights"],
      ["Which targets may you scan with Nmap?", "Only ones you have permission to test", "Any website", "Your bank", "A stranger's phone"],
      ["What is a vulnerability?", "A weakness that could be attacked", "A strong password", "A safe backup", "A type of cable"],
      ["What does a SIEM do?", "Collects and checks logs for signs of attack", "Sends invoices", "Designs websites", "Plays music"],
    ],
    Advanced: [
      ["What is usually the first step when an incident is confirmed?", "Contain it so it does not spread", "Delete all the logs", "Tell nobody", "Restart everything at random"],
      ["What makes ethical hacking ethical?", "Written permission and clear limits", "Working at night", "Using free tools", "Not being noticed"],
      ["What does least privilege mean?", "Giving people only the access they need", "Giving everyone full access", "Removing all accounts", "Sharing one login"],
      ["Who is responsible for setting up access correctly in a cloud account?", "The customer who uses it", "Nobody", "Only the internet provider", "The laptop maker"],
    ],
    Professional: [
      ["What is the NDPA about?", "Protecting people's personal data in Nigeria", "Selling domain names", "Website design", "Mobile games"],
      ["What is ISO 27001?", "A standard for managing information security", "A type of virus", "A network cable", "A programming language"],
      ["What is the goal of security awareness training?", "Helping staff spot and avoid threats", "Teaching staff to hack", "Making work slower", "Removing passwords"],
      ["What is risk in security?", "How likely a threat is, and how much harm it could do", "A type of firewall", "A file backup", "A login page"],
    ],
  },
};

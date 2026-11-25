// Office Life's client and project for each track and level: the same client
// as that level's Practice Lab exercises, and the work that becomes the
// level's milestone (data/milestones).

export type OfficeProject = {
  company: string;
  /** Who they are, after "It is...". */
  business: string;
  contact: string;
  role: string;
  voice: "female" | "male";
  /** What the team delivers, as "a ...". */
  project: string;
};

const p = (company: string, business: string, contact: string, role: string, voice: "female" | "male", project: string): OfficeProject => ({ company, business, contact, role, voice, project });

export const OFFICE_DEPARTMENTS: Record<string, string> = {
  "Virtual Assistant": "Client Support",
  Cybersecurity: "Security",
};

export const OFFICE_PROJECTS: Record<string, Record<string, OfficeProject>> = {
  "Social Media Marketing": {
    Beginner: p("Zuma Kicks", "a small Abuja shop selling affordable sneakers", "Tega Oghene", "Owner", "male", "a ready-to-post week of content"),
    Novice: p("Tasty Pot", "a home caterer in Kubwa, Abuja", "Rose Adamu", "Owner", "female", "a two-week social media plan"),
    Intermediate: p("FitNation Gym", "a gym with two branches in Abuja", "Kunle Dare", "Manager", "male", "a monthly performance report"),
    Advanced: p("PureDrop Water", "a bottled water brand launching a new size", "Ifeoma Nwankwo", "Brand Manager", "female", "a product launch campaign"),
    Professional: p("Northern Crafts", "a company exporting leather goods from Kano", "Sadiq Yaro", "Director", "male", "a client campaign and proposal"),
  },
  "Digital Marketing": {
    Beginner: p("Crust & Crumb Bakery", "a small bakery in Wuse 2, Abuja", "Kemi Alade", "Owner", "female", "a starter marketing kit"),
    Novice: p("GreenVolt Solar", "a home solar installer in Kaduna", "Yakubu Danladi", "Sales Lead", "male", "a 30-day marketing plan"),
    Intermediate: p("ShopEase", "an online shop selling home goods across Nigeria", "Bukola Ige", "Growth Manager", "female", "a monthly marketing report"),
    Advanced: p("CarePlus Clinics", "a group of private clinics in Lagos and Abuja", "Dr Emeka Udo", "Operations Director", "male", "a full-funnel campaign"),
    Professional: p("Savanna Foods", "a packaged food company entering three new states", "Hadiza Lawan", "Marketing Director", "female", "a client campaign with budget and forecast"),
  },
  "AI for Content Creation": {
    Beginner: p("Mama Ngozi's Kitchen", "a small restaurant in Garki, Abuja", "Ngozi Anya", "Owner", "female", "a fact-checked post and flyer"),
    Novice: p("Glow Haven", "a Nigerian skincare brand in Abuja", "Simi Coker", "Founder", "female", "a two-week AI content pack"),
    Intermediate: p("LearnLoop", "an online school for secondary students", "Obinna Eke", "Head of Content", "male", "a measured content calendar"),
    Advanced: p("Arewa Travels", "a travel company opening new routes", "Maryam Sule", "Marketing Lead", "female", "a three-platform launch campaign"),
    Professional: p("BrightBooks Publishing", "a publisher that wants a content service", "Femi Lawson", "Managing Editor", "male", "a complete AI content service"),
  },
  "AI Automation": {
    Beginner: p("Crust & Crumb Bakery", "a small bakery in Wuse 2, Abuja", "Kemi Alade", "Owner", "female", "an automated order process"),
    Novice: p("Zenith Homes", "a company selling houses in Abuja", "Bisi Afolabi", "Sales Manager", "female", "a lead follow-up system"),
    Intermediate: p("MoveIt Logistics", "a delivery company with thirty riders", "Garba Idris", "Operations Manager", "male", "an automatic reporting system"),
    Advanced: p("HealthFirst HMO", "a health insurance company with a busy help desk", "Chioma Okeke", "Head of Service", "female", "an AI support automation"),
    Professional: p("Delta Mills", "a flour company with slow paper processes", "Efe Omoruyi", "Chief Operating Officer", "male", "a scoped and costed automation project"),
  },
  "Front-End Development": {
    Beginner: p("Mama Ngozi's Kitchen", "a small restaurant in Garki, Abuja", "Ngozi Anya", "Owner", "female", "a landing page"),
    Novice: p("Zuma Kicks", "a small Abuja shop selling affordable sneakers", "Tega Oghene", "Owner", "male", "a live business website"),
    Intermediate: p("EventHub", "a company listing events across Nigeria", "Lola Sanni", "Product Lead", "female", "a React app with live data"),
    Advanced: p("AgroMart", "an online market for farmers", "Ibrahim Tanko", "Product Manager", "male", "a fast and accessible web app"),
    Professional: p("CivicDesk", "a service that helps people reach their council", "Adaobi Ezeh", "Head of Product", "female", "a tested, team-built web app"),
  },
  "Back-End Engineering": {
    Beginner: p("Mama Ngozi's Kitchen", "a small restaurant in Garki, Abuja", "Ngozi Anya", "Owner", "female", "a menu API"),
    Novice: p("SmoothCuts", "a barbing salon that takes bookings", "Tunji Bello", "Owner", "male", "a bookings API"),
    Intermediate: p("StudyMate", "an app that connects students with notes", "Zara Mohammed", "Product Lead", "female", "a secure API with accounts"),
    Advanced: p("PayLane", "a payments startup for small shops", "Peter Obaseki", "Engineering Manager", "male", "a production-style payments API"),
    Professional: p("RouteWise", "a transport company growing across West Africa", "Amara Diallo", "Chief Technology Officer", "female", "a tested and documented system"),
  },
  "WordPress Development": {
    Beginner: p("Abuja Fresh Farms", "a farm delivering vegetables in Abuja", "Grace Onoja", "Owner", "female", "a small website"),
    Novice: p("Kola and Sons", "a building company in Abuja", "Kola Adeniyi", "Director", "male", "a business website with a handover guide"),
    Intermediate: p("Ada's Bakes", "a baker who wants to sell cakes online", "Ada Nwachukwu", "Owner", "female", "an online store"),
    Advanced: p("SkillBridge", "a training centre that needs courses and memberships", "Musa Galadima", "Programme Lead", "male", "a custom membership site"),
    Professional: p("Harbour Legal", "a law firm moving from an old website", "Temi Balogun", "Practice Manager", "female", "a migration and care plan"),
  },
  "Virtual Assistant": {
    Beginner: p("Adaeze Obi Events", "an events planner in Abuja", "Adaeze Obi", "Owner", "female", "an organised client week"),
    Novice: p("Bright Path Tutors", "a home-tutoring company in Lagos", "Femi Cole", "Founder", "male", "a full week of client support"),
    Intermediate: p("Petals & Co", "a flower shop with online orders", "Joy Ekanem", "Owner", "female", "a client report and written processes"),
    Advanced: p("Summit Advisory", "a consulting firm with a busy director", "Ladi Bankole", "Director", "male", "a client onboarding and support project"),
    Professional: p("Lumen Coaching", "a coach with clients in three countries", "Sarah Whyte", "Founder", "female", "a complete client support service"),
  },
  Cybersecurity: {
    Beginner: p("The Bello family", "a family of five in Abuja", "Aisha Bello", "Mother", "female", "a family safety check-up"),
    Novice: p("Kubwa Pharmacy", "a busy pharmacy with six staff", "Hauwa Sani", "Owner", "female", "a small-business security audit"),
    Intermediate: p("Crown Schools", "a group of schools with student records", "Tayo Ojo", "IT Coordinator", "male", "an incident report"),
    Advanced: p("QuickCredit", "a lending company whose systems were attacked", "Nneka Obi", "Risk Manager", "female", "an incident response"),
    Professional: p("Coastal Microfinance", "a bank preparing for a security review", "David Essien", "Compliance Lead", "male", "a company security programme"),
  },
};

// Seed data — mirrors the portfolio's original static content.
// Used by the admin "Initialize site content" button on first setup.

export const SEED = {
  hero: {
    badgeEnabled: true,
    badgeText: "Available for new projects",
    metaLabel: "Portfolio",
    titleLine1: "Kang",
    titleLine2: "Somaliza.",
    subtitle: "Designer · Content Creator · Operations",
    tagline:
      "Phnom Penh–based. I help brands look good and reach the right people through poster, brochure and social media design, plus content planning and video scripting.",
    photoYear: "2004",
  },

  about: {
    quote: "I help brands look good — and reach the right people.",
    quoteEmphasis: "right",
    body1:
      "I’m Kang Somaliza — a Phnom Penh–based designer, content creator, and operations support, currently studying at the National University of Management. I help brands look good and reach the right people through poster, brochure and social media design, plus content planning, video scripting, and event coordination.",
    body2:
      "Whether it’s a long-term role or a one-off freelance project, I’m friendly, dependable, and open to feedback — making sure the work fits exactly what you need. If you’re looking for someone to bring your brand or campaign to life, let’s create something together.",
    factBasedIn: "Phnom Penh,\nCambodia",
    factStudying: "National University of Management",
    factCurrently: "Open to full-time roles & freelance projects",
    factLanguages: "Khmer · English",
  },

  services: {
    title: "What I can do for you.",
    titleEmphasis: "for you",
    items: [
      { no: "S/01", title: "Social Media Content", desc: "Posts and feed visuals tuned to each platform — built to match your brand voice and stop the scroll." },
      { no: "S/02", title: "Poster & Brochure Design", desc: "Print-ready visuals for events, campaigns and announcements — clean in hand, sharp on screen." },
      { no: "S/03", title: "Content Planning", desc: "Calendars, copy direction and scheduling that keep your channels consistent week after week." },
      { no: "S/04", title: "Video Scripting & Direction", desc: "Short-form scripts and on-set direction for clear, on-brand storytelling." },
      { no: "S/05", title: "Event Marketing Materials", desc: "Cohesive visuals for booths, signage and event collateral — from teaser to thank-you." },
    ],
  },

  workIntro: {
    title: "Five campaigns. One year. Twenty-five pieces.",
    titleEmphasis: "Twenty-five pieces.",
    archiveLabel: "See the full archive",
    archiveName: "Unilinks Cambodia",
    archiveMeta: "on Facebook",
    archiveUrl: "https://www.facebook.com/share/18dfpKaKsn/?mibextid=wwXIfr",
  },

  videos: {
    lead: "",
    items: [
      { title: "Unilinks Reel", num: "01", url: "https://www.facebook.com/share/v/14fUxcBi3kv/" },
      { title: "Unilinks Reel", num: "02", url: "https://www.facebook.com/share/v/1E8GpjvhGW/" },
    ],
  },

  events: {
    lead: "On-the-ground at Unilinks events — coordinating booths, talking to students, running the show.",
    images: [
      "assets/events/event-1.jpg",
      "assets/events/event-2.jpg",
      "assets/events/event-3.jpg",
      "assets/events/event-4.jpg",
      "assets/events/event-5.jpg",
      "assets/events/event-6.jpg",
    ],
  },

  skills: {
    title: "The toolkit.",
    titleEmphasis: "toolkit",
    soft: ["Operations", "Teamwork", "Graphic Design", "Communication", "Content Planning"],
    technical: ["Social Media Management", "Poster & Brochure Design", "Content Scheduling", "Video Scripting"],
    languages: [
      { label: "Khmer", meta: "/ Native" },
      { label: "English", meta: "/ Conversational" },
    ],
    tools: [
      { mark: "Cv", name: "Canva" },
      { mark: "Fg", name: "Figma" },
      { mark: "Gw", name: "Google Workspace" },
      { mark: "Tr", name: "Trello" },
    ],
  },

  contact: {
    title: "Let's create something together.",
    titleEmphasis: "together",
    lead: "Open to full-time roles and freelance projects. Drop a message below — I’ll usually reply within a day.",
    email: "lizakang123@gmail.com",
    phoneDisplay: "+855 11 453 444",
    phoneHref: "+85511453444",
    linkedinUrl: "https://www.linkedin.com/in/kang-somaliza-643b1732a",
    linkedinDisplay: "/kang-somaliza",
    telegramUrl: "https://t.me/k_somaliza",
    telegramDisplay: "@k_somaliza",
  },

  footer: {
    copy: "© 2026 Kang Somaliza · Made in Phnom Penh",
  },

  projects: [
    {
      id: "taiwan",
      no: "P/01",
      title: "Taiwan Study-Abroad Campaign",
      meta: "Unilinks Global Education / Social Series / 2025",
      desc: "A 6-piece social media series promoting Unilinks’ Taiwan partner programs — photo-driven layouts in Khmer and English with university and program highlights.",
      cols: 3,
      ratio: "landscape",
      images: [
        "assets/work/taiwan/taiwan-1.png",
        "assets/work/taiwan/taiwan-2.png",
        "assets/work/taiwan/taiwan-3.png",
        "assets/work/taiwan/taiwan-4.png",
        "assets/work/taiwan/taiwan-5.png",
        "assets/work/taiwan/taiwan-6.png",
      ],
      order: 1,
    },
    {
      id: "mascot",
      no: "P/02",
      title: "Mascot Series — Study Programs",
      meta: "Unilinks Global Education / Illustration Series / 2025",
      desc: "An 8-piece character illustration series introducing Unilinks’ international study programs — playful mascots paired with country and program flags.",
      cols: 4,
      ratio: "square",
      images: [
        "assets/work/mascot/mascot-1.png",
        "assets/work/mascot/mascot-2.png",
        "assets/work/mascot/mascot-3.png",
        "assets/work/mascot/mascot-4.png",
        "assets/work/mascot/mascot-5.png",
        "assets/work/mascot/mascot-6.png",
        "assets/work/mascot/mascot-7.png",
        "assets/work/mascot/mascot-8.png",
      ],
      order: 2,
    },
    {
      id: "emgs",
      no: "P/03",
      title: "EMGS Mobile App Launch",
      meta: "Unilinks Global Education / Product Launch / 2025",
      desc: "A 5-piece rollout for the EMGS Hub mobile app — Student Visa (i-Kad), health updates and university info for Cambodian students bound for Malaysia.",
      cols: 3,
      ratio: "square",
      images: [
        "assets/work/emgs-app/app-1.png",
        "assets/work/emgs-app/app-2.png",
        "assets/work/emgs-app/app-3.png",
        "assets/work/emgs-app/app-4.png",
        "assets/work/emgs-app/app-5.png",
      ],
      order: 3,
    },
    {
      id: "swineburne",
      no: "P/04",
      title: "Swineburne @ INTI Partnership",
      meta: "Unilinks Global Education / Campaign / 2026",
      desc: "A 3-piece campaign announcing the Swineburne University at INTI partnership intake for May and August 2026.",
      cols: 3,
      ratio: "wide",
      images: [
        "assets/work/swineburne/swineburne-1.png",
        "assets/work/swineburne/swineburne-2.png",
        "assets/work/swineburne/swineburne-3.png",
      ],
      order: 4,
    },
    {
      id: "brand-moments",
      no: "P/05",
      title: "Brand Moments",
      meta: "Unilinks Global Education / Standalone Posts / 2025–2026",
      desc: "Standalone seasonal and lifestyle posts — Khmer New Year greetings, Entertainment-on-tour, and a Malaysia vs Taiwan country comparison.",
      cols: 3,
      ratio: "portrait",
      images: [
        "assets/work/brand-moments/khmer-new-year.png",
        "assets/work/brand-moments/entertainment.png",
        "assets/work/brand-moments/study-malaysia.png",
      ],
      order: 5,
    },
  ],

  experience: [
    {
      id: "unilinks",
      company: "Unilinks Global Education",
      role: "Marketing & Operations",
      period: "2024 — 2025",
      location: "Phnom Penh, Cambodia",
      lead: "My first hands-on role — and where most of the work above came from.",
      bullets: [
        "Supported daily operations and admin, improving workflow and team coordination.",
        "Planned and ran events end-to-end — logistics, coordination, on-the-ground execution.",
        "Designed social media content and marketing materials that grew brand visibility and engagement.",
        "Scheduled and managed posts across multiple social platforms.",
        "Directed and scripted video content for clear, on-brand storytelling.",
        "Created posters, brochures and promotional materials for campaigns and events.",
      ],
      order: 1,
    },
  ],

  education: [
    { id: "num", period: "2023 — Present", school: "National University of Management", level: "University", current: true, order: 1 },
    { id: "belties-hs", period: "2020 — 2022", school: "Belties International School", level: "High School", current: false, order: 2 },
    { id: "belties-ss", period: "2016 — 2019", school: "Belties International School", level: "Secondary School", current: false, order: 3 },
    { id: "hun-neang", period: "2010 — 2016", school: "Hun Neang Boeung Trabek", level: "Primary School", current: false, order: 4 },
  ],
};

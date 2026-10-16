// Shared by the new admin (admin-preview.html) and the redesigned preview pages.
// New data lives in its own Firestore docs (site_content/v2_*), so the live
// site and the old admin are never affected.
import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export const HOME_DOC = "v2_home";
export const MEDIA_PREFIX = "v2_media_";

// What the homepage shows until something is saved in the admin
export const DEFAULT_HOME = {
  intro: {
    kangPhoto: "assets/intro/kang.jpg",
    somalizaPhoto: "assets/intro/somaliza.jpg",
    based: "Based in Phnom Penh, Cambodia",
  },
  hero: {
    desc: "I design campaign visuals, illustrations and social content — calm, considered work for brands like *Unilinks Global Education*. Based in Phnom Penh, Cambodia.",
    pills: ["Available for projects", "Visual Designer", "Content Creator"],
  },
  work: [
    {
      name: "Art*work*", small: "Campaigns · Illustration · Brand posts", tag: "5 projects · 25 pieces",
      years: "2025–26", link: "artwork-new-preview.html", fill: false,
      images: [
        "taiwan/taiwan-1", "mascot/mascot-1", "emgs-app/app-1", "swineburne/swineburne-1", "brand-moments/khmer-new-year",
        "taiwan/taiwan-3", "mascot/mascot-4", "emgs-app/app-2", "brand-moments/study-malaysia", "mascot/mascot-7",
      ].map((n) => `assets/work/${n}.png`),
    },
    {
      name: "*Events*", small: "Event coordination · On the ground", tag: "Unilinks · Bamnang",
      years: "2025–26", link: "events-new-preview.html", fill: true,
      images: [
        ...[1, 2, 3, 4, 5, 6].map((n) => `assets/events/event-${n}.jpg`),
        ...[1, 2, 3, 4, 5].map((n) => `assets/Bamnang%20event/photo_${n}_2026-05-14_21-10-30.jpg`),
      ],
    },
    {
      name: "Content *Planning*", small: "Editorial calendars · Campaign rollouts", tag: "Social strategy",
      years: "2025–26", link: "content-planning-new-preview.html", fill: false,
      images: [],
    },
  ],
};

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// "*word*" → green italic word
export const stars = (s) => esc(s).replace(/\*([^*]+)\*/g, "<em>$1</em>");

// Saved home data on top of the defaults (any part never saved keeps its default)
export async function loadHome() {
  try {
    const snap = await getDoc(doc(db, "site_content", HOME_DOC));
    const d = snap.exists() ? snap.data() : {};
    return {
      intro: { ...DEFAULT_HOME.intro, ...(d.intro || {}) },
      hero: { ...DEFAULT_HOME.hero, ...(d.hero || {}) },
      work: Array.isArray(d.work) ? d.work : DEFAULT_HOME.work,
    };
  } catch (e) {
    console.warn("[v2] using default home content:", e.message);
    return DEFAULT_HOME;
  }
}

// ---------- About ----------
export const ABOUT_DOC = "v2_about";

export const DEFAULT_ABOUT = {
  main: {
    quote: "I help brands look good\n— and reach the *right* people.",
    paragraphs: [
      "I’m Kang Somaliza — a Phnom Penh–based designer, content creator, and operations support, currently studying at the National University of Management. I help brands look good and reach the right people through poster, brochure and social media design, plus content planning, video scripting, and event coordination.",
      "Whether it’s a long-term role or a one-off freelance project, I’m friendly, dependable, and open to feedback — making sure the work fits exactly what you need. If you’re looking for someone to bring your brand or campaign to life, let’s create something together.",
    ],
    photo: "assets/profile.jpg",
  },
  toolkit: {
    soft: ["Operations", "Teamwork", "Graphic Design", "Communication", "Content Planning"],
    tech: ["Social Media Management", "Poster & Brochure Design", "Content Scheduling", "Video Scripting"],
    langs: [{ name: "Khmer", level: "Native" }, { name: "English", level: "Conversational" }],
  },
  education: [
    { years: "2023 — Present", school: "National University of Management", level: "University", current: true },
    { years: "2016 — 2022", school: "Belties International School", level: "Secondary & High School", current: false },
    { years: "2010 — 2016", school: "Hun Neang Boeung Trabek", level: "Primary School", current: false },
  ],
};

export async function loadAbout() {
  try {
    const snap = await getDoc(doc(db, "site_content", ABOUT_DOC));
    const d = snap.exists() ? snap.data() : {};
    return {
      main: { ...DEFAULT_ABOUT.main, ...(d.main || {}) },
      toolkit: { ...DEFAULT_ABOUT.toolkit, ...(d.toolkit || {}) },
      education: Array.isArray(d.education) ? d.education : DEFAULT_ABOUT.education,
    };
  } catch (e) {
    console.warn("[v2] using default about content:", e.message);
    return DEFAULT_ABOUT;
  }
}

// ---------- Experience (services + jobs; each job has its own page) ----------
export const EXP_DOC = "v2_experience";

const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

export const DEFAULT_EXPERIENCE = {
  services: [
    { title: "Social Media Content", desc: "Posts and feed visuals tuned to each platform — built to match your brand voice and stop the scroll." },
    { title: "Poster & Brochure Design", desc: "Print-ready visuals for events, campaigns and announcements — clean in hand, sharp on screen." },
    { title: "Content Planning", desc: "Calendars, copy direction and scheduling that keep your channels consistent week after week." },
    { title: "Video Scripting & Direction", desc: "Short-form scripts and on-set direction for clear, on-brand storytelling." },
    { title: "Event Marketing Materials", desc: "Cohesive visuals for booths, signage and event collateral — from teaser to thank-you." },
  ],
  jobs: [
    {
      id: "unilinks",
      company: "Unilinks Global Education", role: "Marketing & Operations", years: "2024 — 2025", place: "Phnom Penh, Cambodia",
      lead: "My first hands-on role — and where most of my work came from.",
      did: [
        "Supported daily operations and admin, improving workflow and team coordination.",
        "Planned and ran events end-to-end — logistics, coordination, on-the-ground execution.",
        "Designed social media content and marketing materials that grew brand visibility and engagement.",
        "Scheduled and managed posts across multiple social platforms.",
        "Directed and scripted video content for clear, on-brand storytelling.",
        "Created posters, brochures and promotional materials for campaigns and events.",
      ],
      content: { desc: "Monthly content calendars, captions and copy direction that kept Unilinks’ channels posting consistently.", images: [] },
      video: {
        desc: "Short-form reels I scripted and directed for Unilinks — clear, on-brand storytelling for students and parents.",
        items: [
          { name: "Unilinks Reel No. 01", url: "https://www.facebook.com/share/v/14fUxcBi3kv/" },
          { name: "Unilinks Reel No. 02", url: "https://www.facebook.com/share/v/1E8GpjvhGW/" },
        ],
      },
      events: {
        desc: "On the ground at Unilinks events — coordinating booths, talking to students about study-abroad opportunities, and capturing the energy of every fair and gathering.",
        images: range(6).map((n) => `assets/events/event-${n}.jpg`),
      },
      design: [
        { name: "Taiwan Study-Abroad Campaign", info: "Social series · 2025", shape: "landscape",
          desc: "A 6-piece social media series promoting Unilinks’ Taiwan partner programs — photo-driven layouts in Khmer and English with university and program highlights.",
          images: range(6).map((n) => `assets/work/taiwan/taiwan-${n}.png`) },
        { name: "Mascot Series — Study Programs", info: "Illustration series · 2025", shape: "square",
          desc: "An 8-piece character illustration series introducing Unilinks’ international study programs — playful mascots paired with country and program flags.",
          images: range(8).map((n) => `assets/work/mascot/mascot-${n}.png`) },
        { name: "EMGS Mobile App Launch", info: "Product launch · 2025", shape: "square",
          desc: "A 5-piece rollout for the EMGS Hub mobile app — Student Visa (i-Kad), health updates and university info for Cambodian students bound for Malaysia.",
          images: range(5).map((n) => `assets/work/emgs-app/app-${n}.png`) },
        { name: "Swineburne @ INTI Partnership", info: "Campaign · 2026", shape: "wide",
          desc: "A 3-piece campaign announcing the Swineburne University at INTI partnership intake for May and August 2026.",
          images: range(3).map((n) => `assets/work/swineburne/swineburne-${n}.png`) },
        { name: "Brand Moments", info: "Standalone posts · 2025–2026", shape: "portrait",
          desc: "Standalone seasonal and lifestyle posts — Khmer New Year greetings, Entertainment-on-tour, and a Malaysia vs Taiwan country comparison.",
          images: ["entertainment", "khmer-new-year", "study-malaysia"].map((n) => `assets/work/brand-moments/${n}.png`) },
      ],
      link: { label: "See the full archive", name: "Unilinks Cambodia", meta: "on Facebook", url: "https://www.facebook.com/share/18dfpKaKsn/?mibextid=wwXIfr" },
    },
    {
      id: "bamnang",
      company: "Bamnang", role: "Digital Connect Meet Up", years: "Aug 2025 — Oct 2025", place: "Phnom Penh, Cambodia",
      lead: "Last year’s event provided me with a comprehensive education on current digital trends.",
      did: [
        "I really enjoy the Digital Connect Meet Up. Besides learning so many new things from the experts, it was great to feel part of a real community and meet so many cool, talented people. Along the way, I’ve even started working with a new group of friends on an AI project to help improve things in Cambodia!",
      ],
      content: { desc: "", images: [] },
      video: { desc: "", items: [] },
      events: {
        desc: "Moments from the Digital Connect Meet Up — learning from experts and meeting the community.",
        images: range(5).map((n) => `assets/Bamnang%20event/photo_${n}_2026-05-14_21-10-30.jpg`),
      },
      design: [],
      link: { label: "", name: "", meta: "", url: "" },
    },
  ],
};

export const blankJob = () => ({
  id: "job" + Date.now().toString(36),
  company: "New job", role: "", years: "", place: "", lead: "", did: [],
  content: { desc: "", images: [] }, video: { desc: "", items: [] }, events: { desc: "", images: [] },
  design: [], link: { label: "", name: "", meta: "", url: "" },
});

export async function loadExperience() {
  try {
    const snap = await getDoc(doc(db, "site_content", EXP_DOC));
    const d = snap.exists() ? snap.data() : {};
    return {
      services: Array.isArray(d.services) ? d.services : DEFAULT_EXPERIENCE.services,
      jobs: Array.isArray(d.jobs) ? d.jobs : DEFAULT_EXPERIENCE.jobs,
    };
  } catch (e) {
    console.warn("[v2] using default experience content:", e.message);
    return DEFAULT_EXPERIENCE;
  }
}

// "Social series · 2025" → { type: "Social series", year: "2025" }
export function splitInfo(info) {
  const parts = String(info || "").split("·").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return { type: parts[0] || "", year: "" };
  return { type: parts.slice(0, -1).join(" · "), year: parts[parts.length - 1] };
}

export const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";

// Every design project from every job, each with a stable id for its own page
export function allDesignProjects(jobs) {
  const used = new Set();
  return jobs.flatMap((j) => (j.design || []).map((p) => {
    let id = slug(p.name), n = 2;
    while (used.has(id)) id = `${slug(p.name)}-${n++}`;
    used.add(id);
    return { ...p, id, company: j.company, jobId: j.id };
  }));
}

// ---------- Contact + footer ----------
export const CONTACT_DOC = "v2_contact";

export const DEFAULT_CONTACT = {
  info: [
    { name: "Email", value: "lizakang123@gmail.com" },
    { name: "Phone", value: "+855 11 453 444" },
    { name: "LinkedIn", value: "linkedin.com/in/kang-somaliza-643b1732a" },
    { name: "Telegram", value: "t.me/k_somaliza" },
  ],
  footer: { text: "© 2026 Kang Somaliza · Made in Phnom Penh" },
};

export async function loadContact() {
  try {
    const snap = await getDoc(doc(db, "site_content", CONTACT_DOC));
    const d = snap.exists() ? snap.data() : {};
    return {
      info: Array.isArray(d.info) ? d.info : DEFAULT_CONTACT.info,
      footer: { ...DEFAULT_CONTACT.footer, ...(d.footer || {}) },
    };
  } catch (e) {
    console.warn("[v2] using default contact content:", e.message);
    return DEFAULT_CONTACT;
  }
}

// What a contact opens: email → mailto, phone → tel, anything else → web link
export function contactLink(value) {
  const v = String(value || "").trim();
  if (/^(https?:|mailto:|tel:)/i.test(v)) return { href: v, external: /^https?:/i.test(v) };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { href: "mailto:" + v, external: false };
  if (/^\+?[\d\s()-]{6,}$/.test(v)) return { href: "tel:" + v.replace(/[^\d+]/g, ""), external: false };
  return { href: "https://" + v, external: true };
}

// ---------- Resume ----------
export const CV_DOC = "v2_cv";

export async function loadDocData(name) {
  try {
    const snap = await getDoc(doc(db, "site_content", name));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    return null;
  }
}

// Photos uploaded in the admin are stored as "media:<id>"; files in the site are plain paths
export const isMedia = (ref) => typeof ref === "string" && ref.startsWith("media:");

const mediaCache = new Map();
export function resolveImage(ref) {
  if (!isMedia(ref)) return Promise.resolve(ref || "");
  if (!mediaCache.has(ref)) {
    mediaCache.set(ref, getDoc(doc(db, "site_content", MEDIA_PREFIX + ref.slice(6)))
      .then((s) => (s.exists() ? `data:${s.data().type || "image/jpeg"};base64,${s.data().data}` : ""))
      .catch(() => ""));
  }
  return mediaCache.get(ref);
}
export const resolveImages = (refs) => Promise.all((refs || []).map(resolveImage)).then((a) => a.filter(Boolean));

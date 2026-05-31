import { db, auth, ADMIN_EMAIL } from "./firebase-config.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { SEED } from "./seed-data.js";

// ==============================
// DOM refs & helpers
// ==============================
const signinView = document.getElementById("signin-view");
const portalView = document.getElementById("portal-view");
const signinBtn = document.getElementById("signin-btn");
const signinStatus = document.getElementById("signin-status");
const navRight = document.getElementById("admin-nav-right");
const portalMain = document.getElementById("portal-main");
const portalNav = document.getElementById("portal-nav");
const portalSubtabs = document.getElementById("portal-subtabs");

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const setSigninStatus = (text, kind) => {
  signinStatus.textContent = text;
  signinStatus.dataset.kind = kind || "";
};

const fmtDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
};

// Renders one save status next to a Save button
const setStatus = (statusEl, text, kind) => {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.dataset.kind = kind || "";
  if (kind === "success") {
    setTimeout(() => {
      if (statusEl.dataset.kind === "success") {
        statusEl.textContent = "";
        statusEl.dataset.kind = "";
      }
    }, 3000);
  }
};

// ==============================
// Auth
// ==============================
signinBtn?.addEventListener("click", async () => {
  setSigninStatus("Opening Google sign-in…", "pending");
  signinBtn.disabled = true;
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error(err);
    setSigninStatus(err.message || "Sign-in failed.", "error");
  } finally {
    signinBtn.disabled = false;
  }
});

const renderUserBadge = (user) => {
  navRight.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "admin__user";
  if (user.photoURL) {
    const img = document.createElement("img");
    img.src = user.photoURL;
    img.alt = "";
    wrap.appendChild(img);
  }
  const name = document.createElement("span");
  name.textContent = user.email;
  wrap.appendChild(name);

  const out = document.createElement("button");
  out.className = "admin__signout";
  out.textContent = "Sign out";
  out.addEventListener("click", () => signOut(auth));

  navRight.appendChild(wrap);
  navRight.appendChild(out);
};

// ==============================
// Inbox subscription (badge updates + auto-rerender if open)
// ==============================
let messagesCache = [];
let unsubscribeMessages = null;

const subscribeMessages = () => {
  const q = query(collection(db, "contact_messages"), orderBy("createdAt", "desc"));
  unsubscribeMessages = onSnapshot(
    q,
    (snap) => {
      messagesCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const badge = document.getElementById("inbox-badge");
      if (badge) badge.textContent = snap.size > 0 ? String(snap.size) : "";
      if (currentPage === "inbox") renderInbox();
    },
    (err) => console.error("Inbox snapshot error:", err)
  );
};

// ==============================
// Sidebar icons (Heroicons-style outline)
// ==============================
const ICONS = {
  inbox: `<svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 13.5h3.86c.85 0 1.65.46 2.06 1.21l.27.5a2.34 2.34 0 0 0 2.06 1.2h3.22a2.34 2.34 0 0 0 2.06-1.2l.27-.5a2.34 2.34 0 0 1 2.06-1.21h3.86M2.25 13.84V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.16c0-.22-.04-.45-.1-.66l-2.4-7.84a2.25 2.25 0 0 0-2.16-1.59H6.91a2.25 2.25 0 0 0-2.16 1.59l-2.4 7.84a2.25 2.25 0 0 0-.1.66Z"/></svg>`,
  home: `<svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.95-8.96a1.5 1.5 0 0 1 2.12 0l8.96 8.96M4.5 9.75v10.13c0 .62.5 1.12 1.13 1.12H9.75v-6.38c0-.31.25-.56.56-.56h3.38c.31 0 .56.25.56.56v6.38h4.13c.62 0 1.12-.5 1.12-1.12V9.75M8.25 21h7.5"/></svg>`,
  user: `<svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Zm-11.25 14.12c.42-3.84 3.66-6.83 7.5-6.83s7.08 2.99 7.5 6.83a23.85 23.85 0 0 1-15 0Z"/></svg>`,
  briefcase: `<svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 14.15v4.07A2.25 2.25 0 0 1 18 20.47H6a2.25 2.25 0 0 1-2.25-2.25v-4.07m16.5 0a24.3 24.3 0 0 1-8.25 1.43c-2.97 0-5.83-.5-8.25-1.43m16.5 0v-1.91c0-1.18-.79-2.21-1.94-2.46a47.4 47.4 0 0 0-12.62 0 2.5 2.5 0 0 0-1.94 2.46v1.91M16.5 6V5.25A2.25 2.25 0 0 0 14.25 3h-4.5A2.25 2.25 0 0 0 7.5 5.25V6h9Z"/></svg>`,
  skills: `<svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17 17.25 21A2.65 2.65 0 1 0 21 17.25l-5.83-5.83m-3.75 3.75-5.83 5.83A2.65 2.65 0 1 1 1.85 14.5l5.83-5.83m3.74 6.34a23.5 23.5 0 0 1-3.74-3.74m3.74 3.74L7.67 8.67m0 0a23.5 23.5 0 0 1-3.75-7.61L2.78 2.19l7.61 3.75m-2.72 2.73 2.73-2.73m9.7 1.42a6.38 6.38 0 0 1-7.81 7.81L9.46 12.5a6.38 6.38 0 0 1 7.81-7.81l-3.6 3.6 2.83 2.84 3.6-3.6Z"/></svg>`,
  contact: `<svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.76c0 1.6 1.12 2.99 2.7 3.21.96.13 1.93.22 2.91.27V21l4.34-4.34c.68 0 1.36-.04 2.04-.11 1.64-.18 2.74-1.6 2.74-3.21V8.79c0-1.61-1.1-3.04-2.74-3.21a48.4 48.4 0 0 0-10.27 0 3.21 3.21 0 0 0-2.74 3.21v3.97Z"/></svg>`,
  settings: `<svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.59 3.94a1.13 1.13 0 0 1 1.11-.94h2.59c.55 0 1.02.4 1.11.94l.21 1.28c.09.55.46.99.97 1.21.39.18.77.39 1.13.62.45.31 1.04.4 1.55.21l1.21-.45c.51-.19 1.09 0 1.36.46l1.3 2.25c.27.46.16 1.04-.25 1.39l-.99.83c-.43.36-.62.92-.55 1.48.04.34.05.68.05 1.02s-.02.69-.05 1.02c-.07.56.13 1.12.55 1.48l.99.83c.4.34.51.93.24 1.39l-1.29 2.25c-.27.46-.85.66-1.36.46l-1.21-.45c-.51-.19-1.1-.1-1.55.21-.36.24-.74.45-1.13.63-.5.22-.88.66-.96 1.21l-.21 1.28c-.09.54-.56.94-1.1.94H10.7c-.55 0-1.02-.4-1.11-.94l-.21-1.28c-.09-.55-.46-.99-.96-1.21-.39-.18-.77-.39-1.13-.62-.45-.31-1.04-.4-1.55-.21l-1.21.45c-.51.19-1.09 0-1.36-.46l-1.3-2.25c-.27-.46-.16-1.04.25-1.39l.99-.83c.43-.36.62-.92.55-1.48a8.97 8.97 0 0 1 0-2.04c.07-.56-.13-1.12-.55-1.48l-.99-.83c-.4-.34-.51-.93-.24-1.39l1.29-2.25c.27-.46.85-.66 1.36-.46l1.21.45c.51.19 1.1.1 1.55-.21.36-.24.74-.45 1.13-.63.5-.22.88-.66.96-1.21l.21-1.28ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>`,
};

// ==============================
// Pages config (top-level groups + optional sub-tabs)
// ==============================
const PAGES = {
  inbox:      { label: "Inbox",      icon: "inbox",     showBadge: true,  render: renderInbox },
  home:       { label: "Home",       icon: "home",                        render: renderHeroEditor },
  about:      { label: "About",      icon: "user",      subs: [
    { id: "main",      label: "About",        render: renderAboutEditor },
    { id: "education", label: "Education",    render: renderEducationEditor },
  ]},
  experience: { label: "Experience", icon: "briefcase", subs: [
    { id: "services",  label: "Services",     render: renderServicesEditor },
    { id: "workIntro", label: "Work Intro",   render: renderWorkIntroEditor },
    { id: "projects",  label: "Projects",     render: renderProjectsEditor },
    { id: "content",   label: "Content",      render: renderContentEditor },
    { id: "videos",    label: "Videos",       render: renderVideosEditor },
    { id: "events",    label: "Events",       render: renderEventsEditor },
    { id: "jobs",      label: "Past Roles",   render: renderExperienceEditor },
  ]},
  skills:     { label: "Skills",     icon: "skills",                      render: renderSkillsEditor },
  contact:    { label: "Contact",    icon: "contact",   subs: [
    { id: "main",      label: "Contact info", render: renderContactEditor },
    { id: "footer",    label: "Footer",       render: renderFooterEditor },
  ]},
  settings:   { label: "Settings",   icon: "settings",   subs: [
    { id: "main",      label: "Setup",        render: renderSetup },
    { id: "resume",    label: "Resume / CV",  render: renderResumeEditor },
  ]},
};

let currentPage = "inbox";
let currentSub = null;

// Build the sidebar from PAGES config (called once on auth)
function buildSidebar() {
  portalNav.innerHTML = Object.entries(PAGES).map(([id, p]) => `
    <a class="portal__navlink" data-page="${id}" href="#${id}">
      <span class="portal__navicon">${ICONS[p.icon] || ""}</span>
      <span class="portal__navlabel">${p.label}</span>
      ${p.showBadge ? `<span class="portal__badge" id="${id}-badge"></span>` : ""}
    </a>
  `).join("");
}

// Show a page (with optional sub-tab). If page has subs, renders the sub-tab pill bar.
function showPage(pageId, subId) {
  if (!PAGES[pageId]) pageId = "inbox";
  const page = PAGES[pageId];
  currentPage = pageId;

  $$(".portal__navlink").forEach((a) => {
    a.classList.toggle("is-active", a.dataset.page === pageId);
  });

  if (page.subs) {
    const sub = page.subs.find((s) => s.id === subId) || page.subs[0];
    currentSub = sub.id;
    portalSubtabs.hidden = false;
    portalSubtabs.innerHTML = page.subs.map((s) => `
      <button type="button" class="portal__subtab ${s.id === sub.id ? "is-active" : ""}" data-sub="${s.id}">${s.label}</button>
    `).join("");
    const newHash = `#${pageId}/${sub.id}`;
    if (location.hash !== newHash) history.replaceState(null, "", newHash);
    sub.render();
  } else {
    currentSub = null;
    portalSubtabs.hidden = true;
    portalSubtabs.innerHTML = "";
    const newHash = `#${pageId}`;
    if (location.hash !== newHash) history.replaceState(null, "", newHash);
    page.render();
  }
}

document.addEventListener("click", (e) => {
  const navLink = e.target.closest(".portal__navlink");
  if (navLink) {
    e.preventDefault();
    showPage(navLink.dataset.page);
    return;
  }
  const subTab = e.target.closest(".portal__subtab");
  if (subTab) {
    showPage(currentPage, subTab.dataset.sub);
  }
});

window.addEventListener("hashchange", () => {
  const [page, sub] = location.hash.replace(/^#/, "").split("/");
  showPage(page || "inbox", sub);
});

// ==============================
// Auth state
// ==============================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (unsubscribeMessages) { unsubscribeMessages(); unsubscribeMessages = null; }
    portalView.hidden = true;
    signinView.hidden = false;
    navRight.innerHTML = "";
    setSigninStatus("", "");
    return;
  }
  if (user.email !== ADMIN_EMAIL) {
    setSigninStatus(`Access denied for ${user.email}. Only the site owner can use the admin portal.`, "error");
    await signOut(auth);
    return;
  }
  signinView.hidden = true;
  portalView.hidden = false;
  renderUserBadge(user);
  buildSidebar();
  subscribeMessages();
  const [page, sub] = location.hash.replace(/^#/, "").split("/");
  showPage(page || "inbox", sub);
});

// ==============================
// Firestore helpers
// ==============================
const loadDoc = async (section) => {
  const snap = await getDoc(doc(db, "site_content", section));
  return snap.exists() ? snap.data() : null;
};
const saveDoc = (section, data) => setDoc(doc(db, "site_content", section), data, { merge: false });

const loadCollection = async (name) => {
  const snap = await getDocs(query(collection(db, name), orderBy("order", "asc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ==============================
// Form helpers (build HTML)
// ==============================
const field = ({ label, name, type = "text", value = "", textarea = false, rows = 3, hint = "", placeholder = "" }) => {
  const id = `f-${name}`;
  const phAttr = placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : "";
  const input = textarea
    ? `<textarea id="${id}" name="${name}" rows="${rows}"${phAttr}>${escapeHtml(value)}</textarea>`
    : `<input type="${type}" id="${id}" name="${name}" value="${escapeHtml(value)}"${phAttr} />`;
  return `
    <label class="form__field">
      <span class="form__label">${escapeHtml(label)}</span>
      ${input}
      ${hint ? `<span class="form__hint">${escapeHtml(hint)}</span>` : ""}
    </label>`;
};

const checkboxField = ({ label, name, checked }) => `
  <label class="form__check">
    <input type="checkbox" name="${name}" ${checked ? "checked" : ""} />
    <span>${escapeHtml(label)}</span>
  </label>`;

const formActions = (statusId = "form-status") => `
  <div class="form__actions">
    <button type="submit" class="btn btn--primary">Save changes</button>
    <span class="form__status" id="${statusId}" role="status" aria-live="polite"></span>
  </div>`;

const editorHead = (title, lead) => `
  <header class="editor__head">
    <div>
      <h1 class="editor__title">${escapeHtml(title)}</h1>
      ${lead ? `<p class="editor__lead">${escapeHtml(lead)}</p>` : ""}
    </div>
  </header>`;

// ==============================
// Generic submit wrapper
// ==============================
const wireSave = (formId, statusId, handler) => {
  const form = document.getElementById(formId);
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = document.getElementById(statusId);
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    setStatus(status, "Saving…", "pending");
    try {
      await handler(new FormData(form), form);
      setStatus(status, "Saved.", "success");
    } catch (err) {
      console.error(err);
      setStatus(status, err.message || "Save failed.", "error");
    } finally {
      submit.disabled = false;
    }
  });
};

// ==============================
// EDITORS
// ==============================

// ---------- Inbox ----------
function renderInbox() {
  if (!messagesCache.length) {
    portalMain.innerHTML = `
      ${editorHead("Inbox", "Messages submitted via the contact form on the public site.")}
      <div class="empty">Your inbox is empty.</div>
    `;
    return;
  }
  portalMain.innerHTML = `
    ${editorHead("Inbox", `${messagesCache.length} message${messagesCache.length === 1 ? "" : "s"} total.`)}
    <ul class="messages">
      ${messagesCache.map((m) => `
        <li class="message" data-id="${m.id}">
          <div class="message__head">
            <span class="message__name">${escapeHtml(m.name || "(no name)")}</span>
            <span class="message__meta">${escapeHtml(fmtDate(m.createdAt))}</span>
          </div>
          <div class="message__email"><a href="mailto:${encodeURIComponent(m.email || "")}">${escapeHtml(m.email || "")}</a></div>
          <div class="message__body">${escapeHtml(m.message || "")}</div>
          <div class="message__actions"><button type="button" class="message__delete" data-id="${m.id}">Delete</button></div>
        </li>
      `).join("")}
    </ul>
  `;
  $$(".message__delete", portalMain).forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this message?")) return;
      try { await deleteDoc(doc(db, "contact_messages", btn.dataset.id)); }
      catch (err) { alert("Delete failed: " + err.message); }
    });
  });
}

// ---------- Setup (one-time seed) ----------
async function renderSetup() {
  portalMain.innerHTML = `
    ${editorHead("Setup", "First-time setup: copy the current portfolio's static content into Firestore so the admin editors have something to work with.")}
    <div class="setup-card">
      <h3>Initialize site content from seed</h3>
      <p>Populates each section in Firestore with the original portfolio content — only fills sections that are empty, so it's safe to run more than once.</p>
      <div class="form__actions" style="border:none; padding-top:0;">
        <button class="btn btn--primary" id="seed-empty-btn">Initialize empty sections</button>
        <span class="form__status" id="seed-status" role="status" aria-live="polite"></span>
      </div>
    </div>
    <div class="setup-card" style="margin-top:18px; border-color:#e2c0a8;">
      <h3>Reset everything to seed</h3>
      <p>Overwrites <strong>all</strong> sections (including ones you've edited) with the original seed content. Use with caution.</p>
      <div class="form__actions" style="border:none; padding-top:0;">
        <button class="btn btn--outline" id="seed-overwrite-btn">Overwrite everything</button>
      </div>
    </div>
  `;

  const status = document.getElementById("seed-status");
  document.getElementById("seed-empty-btn").addEventListener("click", () => runSeed({ overwrite: false, status }));
  document.getElementById("seed-overwrite-btn").addEventListener("click", () => {
    if (!confirm("This will overwrite all sections, projects, experience, and education with the seed data. Continue?")) return;
    runSeed({ overwrite: true, status });
  });
}

async function runSeed({ overwrite, status }) {
  setStatus(status, "Seeding…", "pending");
  try {
    const sections = ["hero", "about", "services", "workIntro", "videos", "events", "skills", "contact", "footer"];
    const results = [];
    for (const s of sections) {
      const existing = overwrite ? null : await loadDoc(s);
      if (existing && !overwrite) { results.push(`${s}: skipped (exists)`); continue; }
      await saveDoc(s, SEED[s]);
      results.push(`${s}: written`);
    }
    // Collections
    await seedCollection("projects", SEED.projects, overwrite, results);
    await seedCollection("experience", SEED.experience, overwrite, results);
    await seedCollection("education", SEED.education, overwrite, results);
    setStatus(status, results.join(" · "), "success");
  } catch (err) {
    console.error(err);
    setStatus(status, err.message || "Seed failed.", "error");
  }
}

async function seedCollection(name, items, overwrite, results) {
  const existing = await getDocs(collection(db, name));
  if (existing.size > 0 && !overwrite) {
    results.push(`${name}: skipped (${existing.size} docs exist)`);
    return;
  }
  if (overwrite && existing.size > 0) {
    const batch = writeBatch(db);
    existing.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  for (const item of items) {
    const { id, ...data } = item;
    if (id) await setDoc(doc(db, name, id), data);
    else await addDoc(collection(db, name), data);
  }
  results.push(`${name}: ${items.length} written`);
}

// ---------- Hero ----------
const MAX_HERO_PHOTO_BYTES = 700 * 1024;
const HERO_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DEFAULT_HERO_PHOTO = "assets/profile.jpg";

// Defaults for the new homepage editors (used as fallback if Firestore doc missing)
const DEFAULT_HOME_FEATURED = {
  title: "Selected projects.",
  titleEmphasis: "projects.",
  lead: "A few campaigns from the last year — social series, brand illustrations, and product launches designed for Unilinks Global Education.",
};
const DEFAULT_HIRE_CTA = {
  label: "Let's work together",
  title: "Have a project in mind?",
  titleEmphasis: "in mind?",
  lead: "Open to full-time roles, freelance gigs, and friendly collaborations. If you need someone to bring your brand or campaign to life, let's talk.",
  buttonText: "Hire Me",
  buttonHref: "contact.html",
};
// The three "Featured Work" folder cards on the home page (Artwork / Event / Content Planning).
const DEFAULT_HOME_FOLDERS = {
  folder1: {
    tab: "Artwork",
    title: "Artwork",
    desc: "Campaign visuals, illustrations, mascots, and brand work — projects designed for Unilinks Global Education and beyond.",
  },
  folder2: {
    tab: "Event",
    title: "Event",
    desc: "On-the-ground moments from study-abroad fairs, campus visits, and Unilinks campaign events.",
  },
  folder3: {
    tab: "Content Planning",
    title: "Content Planning",
    desc: "Editorial calendars, social series concepts, and multi-channel campaign rollouts.",
  },
};

async function renderHeroEditor() {
  const [hero, featured, hireCta, homeFolders] = await Promise.all([
    loadDoc("hero"),
    loadDoc("homeFeatured"),
    loadDoc("hireCta"),
    loadDoc("homeFolders"),
  ]);
  const data = hero || SEED.hero;
  const featuredData = featured || DEFAULT_HOME_FEATURED;
  const hireData = hireCta || DEFAULT_HIRE_CTA;
  const foldersData = homeFolders || DEFAULT_HOME_FOLDERS;
  const f1 = foldersData.folder1 || DEFAULT_HOME_FOLDERS.folder1;
  const f2 = foldersData.folder2 || DEFAULT_HOME_FOLDERS.folder2;
  const f3 = foldersData.folder3 || DEFAULT_HOME_FOLDERS.folder3;

  portalMain.innerHTML = `
    ${editorHead("Hero", "The first thing visitors see.")}
    <div id="hero-photo-card"></div>
    <form class="form" id="hero-form">
      ${checkboxField({ label: 'Show "Available for new projects" badge', name: "badgeEnabled", checked: !!data.badgeEnabled })}
      ${field({ label: "Badge text", name: "badgeText", value: data.badgeText })}
      ${field({ label: "Meta label (small text above title)", name: "metaLabel", value: data.metaLabel })}
      <div class="form__row">
        ${field({ label: "Title — line 1", name: "titleLine1", value: data.titleLine1 })}
        ${field({ label: "Title — line 2 (accent)", name: "titleLine2", value: data.titleLine2 })}
      </div>
      ${field({ label: "Subtitle", name: "subtitle", value: data.subtitle })}
      ${field({ label: "Tagline (paragraph under title)", name: "tagline", value: data.tagline, textarea: true, rows: 4 })}
      ${field({ label: 'Photo caption year (next to "Est.")', name: "photoYear", value: data.photoYear })}
      ${formActions("hero-status")}
    </form>

    ${editorHead("Featured Work intro", "The 'Selected projects.' section header and lead paragraph on your home page.")}
    <form class="form" id="home-featured-form">
      ${field({ label: "Section title", name: "title", value: featuredData.title, hint: "The big serif heading. Example: 'Selected projects.'" })}
      ${field({ label: "Word to italicize in olive", name: "titleEmphasis", value: featuredData.titleEmphasis, hint: "Part of the title text that should appear italic + olive. Must exactly match a word in the title above." })}
      ${field({ label: "Lead paragraph", name: "lead", value: featuredData.lead, textarea: true, rows: 3 })}
      ${formActions("home-featured-status")}
    </form>

    ${editorHead("Hire Me CTA", "The 'Have a project in mind?' panel below the featured work on home.")}
    <form class="form" id="hire-cta-form">
      ${field({ label: "Small label above title", name: "label", value: hireData.label, hint: "Tiny uppercase olive label. Example: 'Let\\'s work together'" })}
      ${field({ label: "Title", name: "title", value: hireData.title, hint: "The big call to action. Example: 'Have a project in mind?'" })}
      ${field({ label: "Word(s) to italicize in olive", name: "titleEmphasis", value: hireData.titleEmphasis, hint: "Substring of the title to italicize. Example: 'in mind?'" })}
      ${field({ label: "Description below title", name: "lead", value: hireData.lead, textarea: true, rows: 3 })}
      <div class="form__row">
        ${field({ label: "Button text", name: "buttonText", value: hireData.buttonText })}
        ${field({ label: "Button link", name: "buttonHref", value: hireData.buttonHref, hint: "Where the button goes. Example: contact.html or mailto:you@example.com" })}
      </div>
      ${formActions("hire-cta-status")}
    </form>

    ${editorHead("Featured folders", "The three folder cards in the Featured Work section on your home page (Artwork / Event / Content Planning). Only the text changes here — the photos and the page each card opens stay the same.")}
    <form class="form" id="home-folders-form">
      <h3 class="form__subhead">Folder 1</h3>
      <div class="form__row">
        ${field({ label: "Tab label (small label on the folder tab)", name: "f1-tab", value: f1.tab })}
        ${field({ label: "Title", name: "f1-title", value: f1.title })}
      </div>
      ${field({ label: "Description", name: "f1-desc", value: f1.desc, textarea: true, rows: 3 })}

      <h3 class="form__subhead">Folder 2</h3>
      <div class="form__row">
        ${field({ label: "Tab label", name: "f2-tab", value: f2.tab })}
        ${field({ label: "Title", name: "f2-title", value: f2.title })}
      </div>
      ${field({ label: "Description", name: "f2-desc", value: f2.desc, textarea: true, rows: 3 })}

      <h3 class="form__subhead">Folder 3</h3>
      <div class="form__row">
        ${field({ label: "Tab label", name: "f3-tab", value: f3.tab })}
        ${field({ label: "Title", name: "f3-title", value: f3.title })}
      </div>
      ${field({ label: "Description", name: "f3-desc", value: f3.desc, textarea: true, rows: 3 })}
      ${formActions("home-folders-status")}
    </form>
  `;

  await renderHeroPhotoCard();

  wireSave("hero-form", "hero-status", async (fd) => {
    await saveDoc("hero", {
      badgeEnabled: fd.get("badgeEnabled") === "on",
      badgeText: fd.get("badgeText"),
      metaLabel: fd.get("metaLabel"),
      titleLine1: fd.get("titleLine1"),
      titleLine2: fd.get("titleLine2"),
      subtitle: fd.get("subtitle"),
      tagline: fd.get("tagline"),
      photoYear: fd.get("photoYear"),
    });
  });

  wireSave("home-featured-form", "home-featured-status", async (fd) => {
    await saveDoc("homeFeatured", {
      title: fd.get("title"),
      titleEmphasis: fd.get("titleEmphasis"),
      lead: fd.get("lead"),
    });
  });

  wireSave("hire-cta-form", "hire-cta-status", async (fd) => {
    await saveDoc("hireCta", {
      label: fd.get("label"),
      title: fd.get("title"),
      titleEmphasis: fd.get("titleEmphasis"),
      lead: fd.get("lead"),
      buttonText: fd.get("buttonText"),
      buttonHref: fd.get("buttonHref"),
    });
  });

  wireSave("home-folders-form", "home-folders-status", async (fd) => {
    await saveDoc("homeFolders", {
      folder1: { tab: fd.get("f1-tab"), title: fd.get("f1-title"), desc: fd.get("f1-desc") },
      folder2: { tab: fd.get("f2-tab"), title: fd.get("f2-title"), desc: fd.get("f2-desc") },
      folder3: { tab: fd.get("f3-tab"), title: fd.get("f3-title"), desc: fd.get("f3-desc") },
    });
  });
}

async function renderHeroPhotoCard() {
  const card = document.getElementById("hero-photo-card");
  if (!card) return;
  const photo = await loadDoc("heroPhoto");
  const hasFile = !!(photo && photo.data && photo.enabled);
  const previewSrc = hasFile
    ? `data:${photo.type || "image/jpeg"};base64,${photo.data}`
    : DEFAULT_HERO_PHOTO;

  card.innerHTML = `
    <div class="cv-card">
      <div class="cv-card__row">
        <div class="hero-photo-preview">
          <img src="${escapeHtml(previewSrc)}" alt="Current profile photo" />
        </div>
        <div class="cv-card__info">
          <p class="cv-card__name">${hasFile ? escapeHtml(photo.fileName || "profile photo") : "Using default photo"}</p>
          <p class="cv-card__meta">${hasFile ? `${formatBytes(photo.size)} · Updated ${escapeHtml(fmtDate(photo.updatedAt))}` : "No custom photo uploaded yet"}</p>
        </div>
        <div class="cv-card__actions">
          ${hasFile ? `<button type="button" class="btn btn--outline cv-card__delete" id="hero-photo-delete">Delete</button>` : ""}
        </div>
      </div>
      <div class="cv-card__upload">
        <input type="file" accept="image/jpeg,image/png,image/webp" id="hero-photo-input" hidden />
        <button type="button" class="btn btn--primary" id="hero-photo-trigger">
          ${hasFile ? "Upload new photo" : "Upload photo"}
        </button>
        <p class="cv-card__limit">JPEG, PNG, or WebP. Maximum file size: 700 KB. Tip: if your photo is bigger, you can shrink it for free at tinypng.com.</p>
        <p class="form__status" id="hero-photo-status" role="status" aria-live="polite"></p>
      </div>
    </div>
  `;

  const fileInput = document.getElementById("hero-photo-input");
  const trigger = document.getElementById("hero-photo-trigger");
  const status = document.getElementById("hero-photo-status");

  trigger.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    const isImage = HERO_PHOTO_TYPES.includes(file.type)
      || /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!isImage) {
      setStatus(status, "Please choose a JPEG, PNG, or WebP image.", "error");
      fileInput.value = "";
      return;
    }
    if (file.size > MAX_HERO_PHOTO_BYTES) {
      setStatus(status, `That file is ${formatBytes(file.size)} — too big. The max is 700 KB. Try compressing it at tinypng.com first.`, "error");
      fileInput.value = "";
      return;
    }

    trigger.disabled = true;
    setStatus(status, `Uploading ${escapeHtml(file.name)}…`, "pending");
    try {
      const dataB64 = await fileToBase64(file);
      await saveDoc("heroPhoto", {
        fileName: file.name,
        size: file.size,
        type: file.type || "image/jpeg",
        data: dataB64,
        enabled: true,
        updatedAt: serverTimestamp(),
      });
      setStatus(status, "Uploaded! Your home screen photo has been updated.", "success");
      setTimeout(renderHeroPhotoCard, 700);
    } catch (err) {
      console.error(err);
      setStatus(status, err.message || "Upload failed.", "error");
      trigger.disabled = false;
    }
  });

  document.getElementById("hero-photo-delete")?.addEventListener("click", async () => {
    if (!confirm("Delete the profile photo?\n\nYour home screen will go back to using the default photo (assets/profile.jpg) until you upload a new one.")) return;
    setStatus(status, "Deleting…", "pending");
    try {
      await saveDoc("heroPhoto", { enabled: false, updatedAt: serverTimestamp() });
      setStatus(status, "Deleted.", "success");
      setTimeout(renderHeroPhotoCard, 600);
    } catch (err) {
      console.error(err);
      setStatus(status, err.message || "Delete failed.", "error");
    }
  });
}

// ---------- About ----------
async function renderAboutEditor() {
  const data = (await loadDoc("about")) || SEED.about;
  portalMain.innerHTML = `
    ${editorHead("About", "Quote, body paragraphs, and the four facts on the right.")}
    <form class="form" id="about-form">
      ${field({ label: "Quote (large heading)", name: "quote", value: data.quote, textarea: true, rows: 2 })}
      ${field({ label: "Italicize which word/phrase inside the quote (optional)", name: "quoteEmphasis", value: data.quoteEmphasis, hint: "e.g. 'right' will italicize that word in the quote." })}
      ${field({ label: "Body paragraph 1", name: "body1", value: data.body1, textarea: true, rows: 5 })}
      ${field({ label: "Body paragraph 2", name: "body2", value: data.body2, textarea: true, rows: 4 })}
      <div class="form__row">
        ${field({ label: "Based in", name: "factBasedIn", value: data.factBasedIn, hint: "Use a newline for the second line" })}
        ${field({ label: "Studying", name: "factStudying", value: data.factStudying })}
      </div>
      <div class="form__row">
        ${field({ label: "Currently", name: "factCurrently", value: data.factCurrently })}
        ${field({ label: "Languages", name: "factLanguages", value: data.factLanguages })}
      </div>
      ${formActions("about-status")}
    </form>
  `;
  // textarea for factBasedIn — convert it to textarea by replacing
  const basedIn = $('[name="factBasedIn"]', portalMain);
  if (basedIn) {
    const ta = document.createElement("textarea");
    ta.name = "factBasedIn"; ta.rows = 2;
    ta.value = data.factBasedIn || "";
    basedIn.replaceWith(ta);
  }
  wireSave("about-form", "about-status", async (fd) => {
    await saveDoc("about", {
      quote: fd.get("quote"),
      quoteEmphasis: fd.get("quoteEmphasis"),
      body1: fd.get("body1"),
      body2: fd.get("body2"),
      factBasedIn: fd.get("factBasedIn"),
      factStudying: fd.get("factStudying"),
      factCurrently: fd.get("factCurrently"),
      factLanguages: fd.get("factLanguages"),
    });
  });
}

// ---------- Services ----------
async function renderServicesEditor() {
  const data = (await loadDoc("services")) || SEED.services;
  const items = Array.isArray(data.items) ? data.items : [];
  portalMain.innerHTML = `
    ${editorHead("Services", "The 'What I can do for you' section.")}
    <form class="form" id="services-form">
      ${field({ label: "Section title", name: "title", value: data.title })}
      ${field({ label: "Italicize which word/phrase in title", name: "titleEmphasis", value: data.titleEmphasis })}
      <div>
        <span class="form__label" style="margin-bottom:8px; display:block;">Service items</span>
        <div class="list-mgr" id="services-items">${items.map(serviceItemHtml).join("")}</div>
        <button type="button" class="list-mgr__add" id="services-add" style="margin-top:12px;">+ Add service</button>
      </div>
      ${formActions("services-status")}
    </form>
  `;
  bindListMgr("services-items", "services-add", () => serviceItemHtml({ no: "S/0X", title: "", desc: "" }));
  wireSave("services-form", "services-status", async (fd) => {
    const itemsRoot = document.getElementById("services-items");
    const items = $$(".list-mgr__item", itemsRoot).map((row) => ({
      no: $('[name="item-no"]', row).value.trim(),
      title: $('[name="item-title"]', row).value.trim(),
      desc: $('[name="item-desc"]', row).value.trim(),
    })).filter((i) => i.title);
    await saveDoc("services", {
      title: fd.get("title"),
      titleEmphasis: fd.get("titleEmphasis"),
      items,
    });
  });
}
const serviceItemHtml = (s) => `
  <div class="list-mgr__item">
    <div class="list-mgr__item-head">
      <span class="list-mgr__item-title">Service</span>
      <div class="list-mgr__controls">
        <button type="button" class="icon-btn" data-move="up">↑</button>
        <button type="button" class="icon-btn" data-move="down">↓</button>
        <button type="button" class="icon-btn icon-btn--danger" data-remove>Remove</button>
      </div>
    </div>
    <div class="form__row">
      <label class="form__field">
        <span class="form__label">Number</span>
        <input type="text" name="item-no" value="${escapeHtml(s.no)}" />
      </label>
      <label class="form__field">
        <span class="form__label">Title</span>
        <input type="text" name="item-title" value="${escapeHtml(s.title)}" />
      </label>
    </div>
    <label class="form__field">
      <span class="form__label">Description</span>
      <textarea name="item-desc" rows="2">${escapeHtml(s.desc)}</textarea>
    </label>
  </div>`;

// ---------- Work intro ----------
async function renderWorkIntroEditor() {
  const data = (await loadDoc("workIntro")) || SEED.workIntro;
  portalMain.innerHTML = `
    ${editorHead("Work — Intro", "Section title and the 'See the full archive' link below the projects.")}
    <form class="form" id="workintro-form">
      ${field({ label: "Section title", name: "title", value: data.title })}
      ${field({ label: "Italicize which word/phrase in title", name: "titleEmphasis", value: data.titleEmphasis })}
      <div class="form__row">
        ${field({ label: "Archive link label", name: "archiveLabel", value: data.archiveLabel })}
        ${field({ label: "Archive name (e.g. Unilinks Cambodia)", name: "archiveName", value: data.archiveName })}
      </div>
      <div class="form__row">
        ${field({ label: "Archive meta (e.g. on Facebook)", name: "archiveMeta", value: data.archiveMeta })}
        ${field({ label: "Archive URL", name: "archiveUrl", value: data.archiveUrl, type: "url" })}
      </div>
      ${formActions("workintro-status")}
    </form>
  `;
  wireSave("workintro-form", "workintro-status", async (fd) => {
    await saveDoc("workIntro", {
      title: fd.get("title"),
      titleEmphasis: fd.get("titleEmphasis"),
      archiveLabel: fd.get("archiveLabel"),
      archiveName: fd.get("archiveName"),
      archiveMeta: fd.get("archiveMeta"),
      archiveUrl: fd.get("archiveUrl"),
    });
  });
}

// ---------- Projects (CRUD) ----------
async function renderProjectsEditor() {
  const projects = await loadCollection("projects");
  portalMain.innerHTML = `
    ${editorHead("Projects", "Add, edit, reorder, or delete your work entries.")}
    <div style="margin-bottom:18px;">
      <button class="btn btn--primary" id="add-project-btn">+ Add new project</button>
    </div>
    <div id="projects-list-mgr">
      ${projects.length === 0 ? '<div class="empty">No projects yet — click "Add new project" or run Setup → Initialize.</div>' : ""}
      ${projects.map((p) => projectCardHtml(p)).join("")}
    </div>
  `;
  document.getElementById("add-project-btn").addEventListener("click", () => addProject());
  bindProjectCards();
}

const RATIO_OPTIONS = ["landscape", "square", "wide", "portrait"];
const projectCardHtml = (p) => `
  <article class="item-card" data-id="${escapeHtml(p.id)}">
    <header class="item-card__head">
      <h3 class="item-card__title">${escapeHtml(p.no || "")} — ${escapeHtml(p.title || "(untitled)")}</h3>
      <div class="item-card__actions">
        <button type="button" class="icon-btn" data-action="up">↑</button>
        <button type="button" class="icon-btn" data-action="down">↓</button>
        <button type="button" class="icon-btn icon-btn--danger" data-action="delete">Delete</button>
      </div>
    </header>
    <form class="form" data-project-form>
      <div class="form__row">
        ${field({ label: "Number (e.g. P/01)", name: "no", value: p.no })}
        ${field({ label: "Order (lower shows first)", name: "order", type: "number", value: p.order ?? 1 })}
      </div>
      ${field({ label: "Title", name: "title", value: p.title })}
      ${field({ label: "Meta line (use ' / ' as separator)", name: "meta", value: p.meta, hint: "Example: Unilinks Global Education / Social Series / 2025" })}
      ${field({ label: "Description", name: "desc", value: p.desc, textarea: true, rows: 3 })}
      <div class="form__row">
        <label class="form__field">
          <span class="form__label">Grid columns</span>
          <select name="cols">
            <option value="3" ${p.cols === 3 ? "selected" : ""}>3 columns</option>
            <option value="4" ${p.cols === 4 ? "selected" : ""}>4 columns</option>
          </select>
        </label>
        <label class="form__field">
          <span class="form__label">Image ratio</span>
          <select name="ratio">
            ${RATIO_OPTIONS.map((r) => `<option value="${r}" ${p.ratio === r ? "selected" : ""}>${r}</option>`).join("")}
          </select>
        </label>
      </div>
      <div>
        <span class="form__label" style="margin-bottom:8px; display:block;">Image URLs (paths or full URLs)</span>
        <div class="img-urls" data-image-list>
          ${(p.images || []).map(imgRowHtml).join("")}
        </div>
        <button type="button" class="list-mgr__add" data-add-image style="margin-top:8px;">+ Add image</button>
        <p class="form__hint" style="margin-top:6px;">Local paths like <code>assets/work/myproject/img-1.png</code> work after uploading the file via FTP/redeploy. External URLs (https://…) work directly.</p>
      </div>
      <div class="form__actions">
        <button type="submit" class="btn btn--primary">Save project</button>
        <span class="form__status" role="status" aria-live="polite"></span>
      </div>
    </form>
  </article>
`;
const imgRowHtml = (src = "") => `
  <div class="img-urls__row">
    <img class="img-urls__preview" src="${escapeHtml(src)}" alt="" onerror="this.style.opacity=0.3" />
    <input type="text" name="image-url" value="${escapeHtml(src)}" placeholder="assets/work/.../image.png" />
    <button type="button" class="icon-btn icon-btn--danger" data-remove-image>×</button>
  </div>`;

function bindProjectCards() {
  $$(".item-card", portalMain).forEach((card) => {
    const id = card.dataset.id;
    const form = $("[data-project-form]", card);

    // Add / remove image rows
    $("[data-add-image]", card).addEventListener("click", () => {
      $("[data-image-list]", card).insertAdjacentHTML("beforeend", imgRowHtml(""));
    });
    card.addEventListener("click", (e) => {
      if (e.target.matches("[data-remove-image]")) {
        e.target.closest(".img-urls__row").remove();
      }
    });
    // Live-update image preview as user types
    card.addEventListener("input", (e) => {
      if (e.target.matches('input[name="image-url"]')) {
        const img = e.target.previousElementSibling;
        if (img) img.src = e.target.value;
      }
    });
    // Reorder + delete
    $$(".item-card__actions [data-action]", card).forEach((btn) => {
      btn.addEventListener("click", () => handleProjectAction(id, btn.dataset.action, card));
    });
    // Save
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = $(".form__status", form);
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      setStatus(status, "Saving…", "pending");
      try {
        const images = $$('input[name="image-url"]', card).map((i) => i.value.trim()).filter(Boolean);
        const data = {
          no: $('[name="no"]', form).value.trim(),
          title: $('[name="title"]', form).value.trim(),
          meta: $('[name="meta"]', form).value.trim(),
          desc: $('[name="desc"]', form).value.trim(),
          cols: parseInt($('[name="cols"]', form).value, 10) || 3,
          ratio: $('[name="ratio"]', form).value,
          images,
          order: parseInt($('[name="order"]', form).value, 10) || 1,
        };
        await setDoc(doc(db, "projects", id), data);
        setStatus(status, "Saved.", "success");
      } catch (err) {
        console.error(err);
        setStatus(status, err.message || "Save failed.", "error");
      } finally {
        submit.disabled = false;
      }
    });
  });
}

async function handleProjectAction(id, action, card) {
  if (action === "delete") {
    if (!confirm("Delete this project?")) return;
    try { await deleteDoc(doc(db, "projects", id)); renderProjectsEditor(); }
    catch (err) { alert("Delete failed: " + err.message); }
  } else if (action === "up" || action === "down") {
    try { await reorderItem("projects", id, action); renderProjectsEditor(); }
    catch (err) { alert("Reorder failed: " + err.message); }
  }
}

async function reorderItem(coll, id, direction) {
  const items = await loadCollection(coll);
  const idx = items.findIndex((i) => i.id === id);
  const swap = direction === "up" ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= items.length) return;
  const a = items[idx], b = items[swap];
  const batch = writeBatch(db);
  batch.update(doc(db, coll, a.id), { order: b.order });
  batch.update(doc(db, coll, b.id), { order: a.order });
  await batch.commit();
}

async function addProject() {
  const slug = prompt("Short ID for this project (lowercase, hyphens only — e.g. 'new-campaign'):", "new-project");
  if (!slug) return;
  const cleanId = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  if (!cleanId) return;
  const items = await loadCollection("projects");
  const maxOrder = items.reduce((m, p) => Math.max(m, p.order || 0), 0);
  try {
    await setDoc(doc(db, "projects", cleanId), {
      no: `P/${String(items.length + 1).padStart(2, "0")}`,
      title: "New project",
      meta: "",
      desc: "",
      cols: 3,
      ratio: "landscape",
      images: [],
      order: maxOrder + 1,
    });
    renderProjectsEditor();
  } catch (err) {
    alert("Add failed: " + err.message + "\n\nTip: this ID may already exist. Try a different one.");
  }
}

// ---------- Videos ----------
async function renderVideosEditor() {
  const data = (await loadDoc("videos")) || SEED.videos;
  const items = data.items || [];
  portalMain.innerHTML = `
    ${editorHead("Videos", "Reels and video links shown under the work section.")}
    <form class="form" id="videos-form">
      <div>
        <span class="form__label" style="margin-bottom:8px; display:block;">Video items</span>
        <div class="list-mgr" id="videos-items">${items.map(videoItemHtml).join("")}</div>
        <button type="button" class="list-mgr__add" id="videos-add" style="margin-top:12px;">+ Add video</button>
      </div>
      ${formActions("videos-status")}
    </form>
  `;
  bindListMgr("videos-items", "videos-add", () => videoItemHtml({ title: "Unilinks Reel", num: "", url: "" }));
  wireSave("videos-form", "videos-status", async () => {
    const itemsRoot = document.getElementById("videos-items");
    const items = $$(".list-mgr__item", itemsRoot).map((row) => ({
      title: $('[name="item-title"]', row).value.trim(),
      num: $('[name="item-num"]', row).value.trim(),
      url: $('[name="item-url"]', row).value.trim(),
    })).filter((i) => i.url);
    await saveDoc("videos", { items });
  });
}
const videoItemHtml = (v) => `
  <div class="list-mgr__item">
    <div class="list-mgr__item-head">
      <span class="list-mgr__item-title">Video</span>
      <div class="list-mgr__controls">
        <button type="button" class="icon-btn" data-move="up">↑</button>
        <button type="button" class="icon-btn" data-move="down">↓</button>
        <button type="button" class="icon-btn icon-btn--danger" data-remove>Remove</button>
      </div>
    </div>
    <div class="form__row">
      ${field({ label: "Title", name: "item-title", value: v.title })}
      ${field({ label: "Number (e.g. 01)", name: "item-num", value: v.num })}
    </div>
    ${field({ label: "URL", name: "item-url", value: v.url, type: "url" })}
  </div>`;

// ---------- Events (CRUD with rich fields + image upload) ----------
const MAX_EVENT_IMAGE_BYTES = 350 * 1024;          // per uploaded image
const MAX_EVENT_DOC_BASE64_BYTES = 800 * 1024;     // per event doc (stay under Firestore 1 MB)
const EVENT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function renderEventsEditor() {
  const leadDoc = (await loadDoc("events")) || SEED.events;
  let events = await loadCollection("events");

  // First-time auto-migration: if no event docs exist yet but the old image
  // strip has paths, turn each one into its own event doc so nothing visually
  // disappears for the user.
  if (events.length === 0 && Array.isArray(leadDoc?.images) && leadDoc.images.length > 0) {
    try {
      const batch = writeBatch(db);
      leadDoc.images.filter(Boolean).forEach((src, i) => {
        const id = `event-${i + 1}`;
        batch.set(doc(db, "events", id), {
          title: "",
          date: "",
          location: "",
          desc: "",
          images: [{ kind: "url", src }],
          order: i + 1,
        });
      });
      await batch.commit();
      events = await loadCollection("events");
    } catch (err) {
      console.warn("Event auto-migration failed:", err.message);
    }
  }

  portalMain.innerHTML = `
    ${editorHead("Events", "Each event has its own card with title, date, location, description, and pictures.")}
    <form class="form" id="events-lead-form" style="margin-bottom:24px;">
      ${field({ label: "Section lead (one-line intro shown above all events)", name: "lead", value: leadDoc?.lead || "", textarea: true, rows: 2 })}
      ${formActions("events-lead-status")}
    </form>
    <div style="margin-bottom:18px;">
      <button class="btn btn--primary" id="add-event-btn">+ Add new event</button>
    </div>
    <div id="events-list-mgr">
      ${events.length === 0 ? '<div class="empty">No events yet — click "Add new event" to add your first one.</div>' : ""}
      ${events.map((ev) => eventCardHtml(ev)).join("")}
    </div>
  `;
  wireSave("events-lead-form", "events-lead-status", async (fd) => {
    await saveDoc("events", { lead: fd.get("lead") || "" });
  });
  document.getElementById("add-event-btn").addEventListener("click", () => addEvent());
  bindEventCards();
}

const eventCardHtml = (ev) => {
  const title = ev.title || "(untitled event)";
  const imgs = (ev.images || []).map((img) => eventImageRowHtml(img)).join("");
  return `
    <article class="item-card" data-event-id="${escapeHtml(ev.id)}">
      <header class="item-card__head">
        <h3 class="item-card__title">${escapeHtml(title)}</h3>
        <div class="item-card__actions">
          <button type="button" class="icon-btn" data-event-action="up">↑</button>
          <button type="button" class="icon-btn" data-event-action="down">↓</button>
          <button type="button" class="icon-btn icon-btn--danger" data-event-action="delete">Delete</button>
        </div>
      </header>
      <form class="form" data-event-form>
        ${field({ label: "Title", name: "title", value: ev.title, placeholder: "e.g. Unilinks Open Day 2025" })}
        <div class="form__row">
          ${field({ label: "Date", name: "date", value: ev.date, placeholder: "e.g. March 2025" })}
          ${field({ label: "Location", name: "location", value: ev.location, placeholder: "e.g. Phnom Penh" })}
        </div>
        ${field({ label: "Description", name: "desc", value: ev.desc, textarea: true, rows: 3, hint: "1–2 lines about what happened at this event." })}
        ${field({ label: "Order (lower number shows first)", name: "order", type: "number", value: ev.order ?? 1 })}
        <div>
          <span class="form__label" style="margin-bottom:8px; display:block;">Pictures</span>
          <div class="img-urls" data-event-images>${imgs}</div>
          <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
            <input type="file" accept="image/jpeg,image/png,image/webp" data-event-upload-input hidden />
            <button type="button" class="btn btn--outline" data-event-upload-trigger>📁 Upload from computer</button>
            <button type="button" class="list-mgr__add" data-event-add-url>+ Add URL / path</button>
          </div>
          <p class="form__hint" style="margin-top:8px;">
            <strong>Upload:</strong> JPEG / PNG / WebP, max 350 KB per picture, ~2 uploads per event (Firestore limit). Compress big photos at tinypng.com first.
            <strong>URL / path:</strong> no size limit — paste like <code>assets/events/photo.jpg</code> or <code>https://…</code>.
          </p>
        </div>
        <div class="form__actions">
          <button type="submit" class="btn btn--primary">Save event</button>
          <span class="form__status" role="status" aria-live="polite"></span>
        </div>
      </form>
    </article>
  `;
};

const eventImageRowHtml = (img) => {
  const isUpload = img && img.kind === "upload" && img.data;
  if (isUpload) {
    const preview = `data:${img.type || "image/jpeg"};base64,${img.data}`;
    return `
      <div class="img-urls__row" data-event-img-row data-kind="upload"
           data-upload-data="${img.data}"
           data-upload-type="${escapeHtml(img.type || "image/jpeg")}"
           data-upload-name="${escapeHtml(img.fileName || "image")}"
           data-upload-size="${img.size || 0}">
        <img class="img-urls__preview" src="${preview}" alt="" />
        <div class="event-img__meta">Uploaded: ${escapeHtml(img.fileName || "image")} · ${formatBytes(img.size || 0)}</div>
        <button type="button" class="icon-btn icon-btn--danger" data-remove-event-img>×</button>
      </div>
    `;
  }
  const src = (img && (typeof img === "string" ? img : img.src)) || "";
  return `
    <div class="img-urls__row" data-event-img-row data-kind="url">
      <img class="img-urls__preview" src="${escapeHtml(src)}" alt="" onerror="this.style.opacity=0.3" />
      <input type="text" name="event-image-url" value="${escapeHtml(src)}" placeholder="assets/events/photo.jpg or https://..." />
      <button type="button" class="icon-btn icon-btn--danger" data-remove-event-img>×</button>
    </div>
  `;
};

function bindEventCards() {
  $$("[data-event-id]", portalMain).forEach((card) => {
    const id = card.dataset.eventId;
    const form = $("[data-event-form]", card);
    const imgList = $("[data-event-images]", card);
    if (!form || !imgList) return;

    // URL row: live preview as user types
    imgList.addEventListener("input", (e) => {
      if (e.target.matches('input[name="event-image-url"]')) {
        const preview = e.target.parentElement.querySelector(".img-urls__preview");
        if (preview) preview.src = e.target.value;
      }
    });

    // Remove image row
    imgList.addEventListener("click", (e) => {
      if (e.target.matches("[data-remove-event-img]")) {
        e.target.closest("[data-event-img-row]").remove();
      }
    });

    // Add URL row
    $("[data-event-add-url]", card).addEventListener("click", () => {
      imgList.insertAdjacentHTML("beforeend", eventImageRowHtml({ kind: "url", src: "" }));
      const last = imgList.querySelector("[data-event-img-row]:last-child input");
      if (last) { last.focus(); last.scrollIntoView({ behavior: "smooth", block: "center" }); }
    });

    // Upload from computer
    const uploadInput = $("[data-event-upload-input]", card);
    const uploadTrigger = $("[data-event-upload-trigger]", card);
    const status = form.querySelector(".form__status");
    uploadTrigger.addEventListener("click", () => uploadInput.click());
    uploadInput.addEventListener("change", async () => {
      const file = uploadInput.files?.[0];
      if (!file) return;
      const isImage = EVENT_IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
      if (!isImage) {
        setStatus(status, "Please choose a JPEG, PNG, or WebP image.", "error");
        uploadInput.value = "";
        return;
      }
      if (file.size > MAX_EVENT_IMAGE_BYTES) {
        setStatus(status, `That file is ${formatBytes(file.size)} — too big. Max is 350 KB. Compress at tinypng.com first.`, "error");
        uploadInput.value = "";
        return;
      }
      try {
        const data = await fileToBase64(file);
        imgList.insertAdjacentHTML("beforeend", eventImageRowHtml({
          kind: "upload", data, type: file.type, fileName: file.name, size: file.size,
        }));
        setStatus(status, "Picture added. Click 'Save event' to keep it.", "success");
        uploadInput.value = "";
      } catch (err) {
        setStatus(status, err.message || "Could not read the file.", "error");
        uploadInput.value = "";
      }
    });

    // Save form
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      setStatus(status, "Saving…", "pending");
      try {
        const fd = new FormData(form);
        const rows = $$("[data-event-img-row]", imgList);
        const images = rows.map((row) => {
          if (row.dataset.kind === "upload" && row.dataset.uploadData) {
            return {
              kind: "upload",
              data: row.dataset.uploadData,
              type: row.dataset.uploadType || "image/jpeg",
              fileName: row.dataset.uploadName || "image",
              size: Number(row.dataset.uploadSize || 0),
            };
          }
          const input = $("input[name='event-image-url']", row);
          const src = input?.value.trim();
          return src ? { kind: "url", src } : null;
        }).filter(Boolean);

        // Stay under Firestore's per-doc size cap
        const totalBase64 = images.reduce((sum, img) =>
          img.kind === "upload" ? sum + (img.data?.length || 0) : sum, 0);
        if (totalBase64 > MAX_EVENT_DOC_BASE64_BYTES) {
          throw new Error(`Total uploaded pictures are ~${formatBytes(totalBase64)} — over the ~${formatBytes(MAX_EVENT_DOC_BASE64_BYTES)} per-event limit. Remove an upload or compress further.`);
        }

        await setDoc(doc(db, "events", id), {
          title: fd.get("title") || "",
          date: fd.get("date") || "",
          location: fd.get("location") || "",
          desc: fd.get("desc") || "",
          order: Number(fd.get("order")) || 1,
          images,
        });
        setStatus(status, "Saved.", "success");
        setTimeout(renderEventsEditor, 600);
      } catch (err) {
        console.error(err);
        setStatus(status, err.message || "Save failed.", "error");
      } finally {
        submit.disabled = false;
      }
    });

    // Up / Down / Delete
    $$("[data-event-action]", card.querySelector(".item-card__head")).forEach((btn) => {
      btn.addEventListener("click", () => handleEventAction(id, btn.dataset.eventAction));
    });
  });
}

async function handleEventAction(id, action) {
  if (action === "delete") {
    if (!confirm("Delete this event?")) return;
    try { await deleteDoc(doc(db, "events", id)); renderEventsEditor(); }
    catch (err) { alert("Delete failed: " + err.message); }
    return;
  }
  if (action === "up" || action === "down") {
    try { await reorderItem("events", id, action); renderEventsEditor(); }
    catch (err) { alert("Reorder failed: " + err.message); }
  }
}

async function addEvent() {
  const items = await loadCollection("events");
  const maxOrder = items.reduce((m, p) => Math.max(m, p.order || 0), 0);
  const id = `event-${Date.now().toString(36)}`;
  try {
    await setDoc(doc(db, "events", id), {
      title: "New event",
      date: "",
      location: "",
      desc: "",
      images: [],
      order: maxOrder + 1,
    });
    renderEventsEditor();
  } catch (err) {
    alert("Add failed: " + err.message);
  }
}

// ---------- Content (CRUD with image upload — content planning / writing samples) ----------
async function renderContentEditor() {
  const leadDoc = (await loadDoc("contentLead")) || { lead: "Writing, captions, and content planning samples." };
  const items = await loadCollection("content");

  portalMain.innerHTML = `
    ${editorHead("Content", "Content planning, captions, and writing samples. The top one also appears on the home page Featured Work.")}
    <form class="form" id="content-lead-form" style="margin-bottom:24px;">
      ${field({ label: "Section lead (shown above the Content cards on Experience page)", name: "lead", value: leadDoc?.lead || "", textarea: true, rows: 2 })}
      ${formActions("content-lead-status")}
    </form>
    <div style="margin-bottom:18px;">
      <button class="btn btn--primary" id="add-content-btn">+ Add new content piece</button>
    </div>
    <div id="content-list-mgr">
      ${items.length === 0 ? '<div class="empty">No content pieces yet — click "Add new content piece" to add your first one.</div>' : ""}
      ${items.map((c) => contentCardHtml(c)).join("")}
    </div>
  `;
  wireSave("content-lead-form", "content-lead-status", async (fd) => {
    await saveDoc("contentLead", { lead: fd.get("lead") || "" });
  });
  document.getElementById("add-content-btn").addEventListener("click", () => addContent());
  bindContentCards();
}

const contentCardHtml = (c) => {
  const title = c.title || "(untitled content piece)";
  const imgs = (c.images || []).map((img) => eventImageRowHtml(img)).join("");
  return `
    <article class="item-card" data-content-id="${escapeHtml(c.id)}">
      <header class="item-card__head">
        <h3 class="item-card__title">${escapeHtml(title)}</h3>
        <div class="item-card__actions">
          <button type="button" class="icon-btn" data-content-action="up">↑</button>
          <button type="button" class="icon-btn" data-content-action="down">↓</button>
          <button type="button" class="icon-btn icon-btn--danger" data-content-action="delete">Delete</button>
        </div>
      </header>
      <form class="form" data-content-form>
        ${field({ label: "Title", name: "title", value: c.title, placeholder: "e.g. Content calendar — September 2025" })}
        ${field({ label: "Category", name: "category", value: c.category, placeholder: "e.g. Content Planning, Caption Writing, Editorial" })}
        ${field({ label: "Description", name: "desc", value: c.desc, textarea: true, rows: 3, hint: "1–2 lines about this content piece." })}
        ${field({ label: "Link (optional)", name: "link", value: c.link, type: "url", hint: "Makes the whole card clickable. Paste a full link like https://facebook.com/... or a page on your site like experience.html. Leave blank for no link." })}
        ${field({ label: "Order (lower number shows first)", name: "order", type: "number", value: c.order ?? 1 })}
        <div>
          <span class="form__label" style="margin-bottom:8px; display:block;">Pictures</span>
          <div class="img-urls" data-content-images>${imgs}</div>
          <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
            <input type="file" accept="image/jpeg,image/png,image/webp" data-content-upload-input hidden />
            <button type="button" class="btn btn--outline" data-content-upload-trigger>📁 Upload from computer</button>
            <button type="button" class="list-mgr__add" data-content-add-url>+ Add URL / path</button>
          </div>
          <p class="form__hint" style="margin-top:8px;">
            <strong>Upload:</strong> JPEG / PNG / WebP, max 350 KB per picture, ~2 uploads per piece (Firestore limit). Compress big photos at tinypng.com first.
            <strong>URL / path:</strong> no size limit — paste like <code>assets/content/photo.jpg</code> or <code>https://…</code>.
          </p>
        </div>
        <div class="form__actions">
          <button type="submit" class="btn btn--primary">Save content</button>
          <span class="form__status" role="status" aria-live="polite"></span>
        </div>
      </form>
    </article>
  `;
};

function bindContentCards() {
  $$("[data-content-id]", portalMain).forEach((card) => {
    const id = card.dataset.contentId;
    const form = $("[data-content-form]", card);
    const imgList = $("[data-content-images]", card);
    if (!form || !imgList) return;

    imgList.addEventListener("input", (e) => {
      if (e.target.matches('input[name="event-image-url"]')) {
        const preview = e.target.parentElement.querySelector(".img-urls__preview");
        if (preview) preview.src = e.target.value;
      }
    });

    imgList.addEventListener("click", (e) => {
      if (e.target.matches("[data-remove-event-img]")) {
        e.target.closest("[data-event-img-row]").remove();
      }
    });

    $("[data-content-add-url]", card).addEventListener("click", () => {
      imgList.insertAdjacentHTML("beforeend", eventImageRowHtml({ kind: "url", src: "" }));
      const last = imgList.querySelector("[data-event-img-row]:last-child input");
      if (last) { last.focus(); last.scrollIntoView({ behavior: "smooth", block: "center" }); }
    });

    const uploadInput = $("[data-content-upload-input]", card);
    const uploadTrigger = $("[data-content-upload-trigger]", card);
    const status = form.querySelector(".form__status");
    uploadTrigger.addEventListener("click", () => uploadInput.click());
    uploadInput.addEventListener("change", async () => {
      const file = uploadInput.files?.[0];
      if (!file) return;
      const isImage = EVENT_IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
      if (!isImage) {
        setStatus(status, "Please choose a JPEG, PNG, or WebP image.", "error");
        uploadInput.value = "";
        return;
      }
      if (file.size > MAX_EVENT_IMAGE_BYTES) {
        setStatus(status, `That file is ${formatBytes(file.size)} — too big. Max is 350 KB. Compress at tinypng.com first.`, "error");
        uploadInput.value = "";
        return;
      }
      try {
        const data = await fileToBase64(file);
        imgList.insertAdjacentHTML("beforeend", eventImageRowHtml({
          kind: "upload", data, type: file.type, fileName: file.name, size: file.size,
        }));
        setStatus(status, "Picture added. Click 'Save content' to keep it.", "success");
        uploadInput.value = "";
      } catch (err) {
        setStatus(status, err.message || "Could not read the file.", "error");
        uploadInput.value = "";
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      setStatus(status, "Saving…", "pending");
      try {
        const fd = new FormData(form);
        const rows = $$("[data-event-img-row]", imgList);
        const images = rows.map((row) => {
          if (row.dataset.kind === "upload" && row.dataset.uploadData) {
            return {
              kind: "upload",
              data: row.dataset.uploadData,
              type: row.dataset.uploadType || "image/jpeg",
              fileName: row.dataset.uploadName || "image",
              size: Number(row.dataset.uploadSize || 0),
            };
          }
          const input = $("input[name='event-image-url']", row);
          const src = input?.value.trim();
          return src ? { kind: "url", src } : null;
        }).filter(Boolean);

        const totalBase64 = images.reduce((sum, img) =>
          img.kind === "upload" ? sum + (img.data?.length || 0) : sum, 0);
        if (totalBase64 > MAX_EVENT_DOC_BASE64_BYTES) {
          throw new Error(`Total uploaded pictures are ~${formatBytes(totalBase64)} — over the ~${formatBytes(MAX_EVENT_DOC_BASE64_BYTES)} per-piece limit. Remove an upload or compress further.`);
        }

        await setDoc(doc(db, "content", id), {
          title: fd.get("title") || "",
          category: fd.get("category") || "",
          desc: fd.get("desc") || "",
          link: (fd.get("link") || "").trim(),
          order: Number(fd.get("order")) || 1,
          images,
        });
        setStatus(status, "Saved.", "success");
        setTimeout(renderContentEditor, 600);
      } catch (err) {
        console.error(err);
        setStatus(status, err.message || "Save failed.", "error");
      } finally {
        submit.disabled = false;
      }
    });

    $$("[data-content-action]", card.querySelector(".item-card__head")).forEach((btn) => {
      btn.addEventListener("click", () => handleContentAction(id, btn.dataset.contentAction));
    });
  });
}

async function handleContentAction(id, action) {
  if (action === "delete") {
    if (!confirm("Delete this content piece?")) return;
    try { await deleteDoc(doc(db, "content", id)); renderContentEditor(); }
    catch (err) { alert("Delete failed: " + err.message); }
    return;
  }
  if (action === "up" || action === "down") {
    try { await reorderItem("content", id, action); renderContentEditor(); }
    catch (err) { alert("Reorder failed: " + err.message); }
  }
}

async function addContent() {
  const items = await loadCollection("content");
  const maxOrder = items.reduce((m, p) => Math.max(m, p.order || 0), 0);
  const id = `content-${Date.now().toString(36)}`;
  try {
    await setDoc(doc(db, "content", id), {
      title: "New content piece",
      category: "Content Planning",
      desc: "",
      link: "",
      images: [],
      order: maxOrder + 1,
    });
    renderContentEditor();
  } catch (err) {
    alert("Add failed: " + err.message);
  }
}

// ---------- Experience (CRUD) ----------
async function renderExperienceEditor() {
  const jobs = await loadCollection("experience");
  portalMain.innerHTML = `
    ${editorHead("Experience", "Add, edit, reorder, or delete past roles.")}
    <div style="margin-bottom:18px;">
      <button class="btn btn--primary" id="add-job-btn">+ Add new role</button>
    </div>
    <div>
      ${jobs.length === 0 ? '<div class="empty">No experience entries yet.</div>' : ""}
      ${jobs.map((j) => jobCardHtml(j)).join("")}
    </div>
  `;
  document.getElementById("add-job-btn").addEventListener("click", addJob);
  bindJobCards();
}

const jobCardHtml = (j) => `
  <article class="item-card" data-id="${escapeHtml(j.id)}">
    <header class="item-card__head">
      <h3 class="item-card__title">${escapeHtml(j.company || "(untitled)")} — ${escapeHtml(j.role || "")}</h3>
      <div class="item-card__actions">
        <button type="button" class="icon-btn" data-action="up">↑</button>
        <button type="button" class="icon-btn" data-action="down">↓</button>
        <button type="button" class="icon-btn icon-btn--danger" data-action="delete">Delete</button>
      </div>
    </header>
    <form class="form" data-job-form>
      <div class="form__row">
        ${field({ label: "Company", name: "company", value: j.company })}
        ${field({ label: "Role", name: "role", value: j.role })}
      </div>
      <div class="form__row">
        ${field({ label: "Period (e.g. 2024 — 2025)", name: "period", value: j.period })}
        ${field({ label: "Location", name: "location", value: j.location })}
      </div>
      ${field({ label: "Lead (one-line intro)", name: "lead", value: j.lead, textarea: true, rows: 2 })}
      ${field({ label: "Bullets (one per line)", name: "bullets", value: (j.bullets || []).join("\n"), textarea: true, rows: 6 })}
      ${field({ label: "Order", name: "order", type: "number", value: j.order ?? 1 })}
      <div class="form__actions">
        <button type="submit" class="btn btn--primary">Save role</button>
        <span class="form__status" role="status" aria-live="polite"></span>
      </div>
    </form>
  </article>
`;

function bindJobCards() {
  $$(".item-card", portalMain).forEach((card) => {
    const id = card.dataset.id;
    const form = $("[data-job-form]", card);
    $$(".item-card__actions [data-action]", card).forEach((btn) => {
      btn.addEventListener("click", () => handleJobAction(id, btn.dataset.action));
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = $(".form__status", form);
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      setStatus(status, "Saving…", "pending");
      try {
        const bullets = ($('[name="bullets"]', form).value || "").split("\n").map((l) => l.trim()).filter(Boolean);
        const data = {
          company: $('[name="company"]', form).value.trim(),
          role: $('[name="role"]', form).value.trim(),
          period: $('[name="period"]', form).value.trim(),
          location: $('[name="location"]', form).value.trim(),
          lead: $('[name="lead"]', form).value.trim(),
          bullets,
          order: parseInt($('[name="order"]', form).value, 10) || 1,
        };
        await setDoc(doc(db, "experience", id), data);
        setStatus(status, "Saved.", "success");
      } catch (err) {
        console.error(err);
        setStatus(status, err.message || "Save failed.", "error");
      } finally {
        submit.disabled = false;
      }
    });
  });
}

async function handleJobAction(id, action) {
  if (action === "delete") {
    if (!confirm("Delete this role?")) return;
    try { await deleteDoc(doc(db, "experience", id)); renderExperienceEditor(); }
    catch (err) { alert("Delete failed: " + err.message); }
  } else {
    try { await reorderItem("experience", id, action); renderExperienceEditor(); }
    catch (err) { alert("Reorder failed: " + err.message); }
  }
}

async function addJob() {
  const slug = prompt("Short ID for this role (e.g. 'company-name'):", "new-role");
  if (!slug) return;
  const cleanId = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  if (!cleanId) return;
  const items = await loadCollection("experience");
  const maxOrder = items.reduce((m, p) => Math.max(m, p.order || 0), 0);
  try {
    await setDoc(doc(db, "experience", cleanId), {
      company: "New company", role: "", period: "", location: "", lead: "",
      bullets: [], order: maxOrder + 1,
    });
    renderExperienceEditor();
  } catch (err) {
    alert("Add failed: " + err.message);
  }
}

// ---------- Education (CRUD) ----------
async function renderEducationEditor() {
  const items = await loadCollection("education");
  portalMain.innerHTML = `
    ${editorHead("Education", "Schools and education levels.")}
    <div style="margin-bottom:18px;">
      <button class="btn btn--primary" id="add-edu-btn">+ Add new entry</button>
    </div>
    <div>
      ${items.length === 0 ? '<div class="empty">No education entries yet.</div>' : ""}
      ${items.map(eduCardHtml).join("")}
    </div>
  `;
  document.getElementById("add-edu-btn").addEventListener("click", addEdu);
  bindEduCards();
}

const eduCardHtml = (e) => `
  <article class="item-card" data-id="${escapeHtml(e.id)}">
    <header class="item-card__head">
      <h3 class="item-card__title">${escapeHtml(e.school || "(untitled)")} — ${escapeHtml(e.level || "")}</h3>
      <div class="item-card__actions">
        <button type="button" class="icon-btn" data-action="up">↑</button>
        <button type="button" class="icon-btn" data-action="down">↓</button>
        <button type="button" class="icon-btn icon-btn--danger" data-action="delete">Delete</button>
      </div>
    </header>
    <form class="form" data-edu-form>
      <div class="form__row">
        ${field({ label: "Period (e.g. 2023 — Present)", name: "period", value: e.period })}
        ${field({ label: "Order", name: "order", type: "number", value: e.order ?? 1 })}
      </div>
      ${field({ label: "School", name: "school", value: e.school })}
      ${field({ label: "Level (e.g. University, High School)", name: "level", value: e.level })}
      ${checkboxField({ label: "Currently studying here (highlights this entry)", name: "current", checked: !!e.current })}
      <div class="form__actions">
        <button type="submit" class="btn btn--primary">Save entry</button>
        <span class="form__status" role="status" aria-live="polite"></span>
      </div>
    </form>
  </article>
`;

function bindEduCards() {
  $$(".item-card", portalMain).forEach((card) => {
    const id = card.dataset.id;
    const form = $("[data-edu-form]", card);
    $$(".item-card__actions [data-action]", card).forEach((btn) => {
      btn.addEventListener("click", () => handleEduAction(id, btn.dataset.action));
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = $(".form__status", form);
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      setStatus(status, "Saving…", "pending");
      try {
        await setDoc(doc(db, "education", id), {
          period: $('[name="period"]', form).value.trim(),
          school: $('[name="school"]', form).value.trim(),
          level: $('[name="level"]', form).value.trim(),
          current: $('[name="current"]', form).checked,
          order: parseInt($('[name="order"]', form).value, 10) || 1,
        });
        setStatus(status, "Saved.", "success");
      } catch (err) {
        console.error(err);
        setStatus(status, err.message || "Save failed.", "error");
      } finally {
        submit.disabled = false;
      }
    });
  });
}

async function handleEduAction(id, action) {
  if (action === "delete") {
    if (!confirm("Delete this entry?")) return;
    try { await deleteDoc(doc(db, "education", id)); renderEducationEditor(); }
    catch (err) { alert("Delete failed: " + err.message); }
  } else {
    try { await reorderItem("education", id, action); renderEducationEditor(); }
    catch (err) { alert("Reorder failed: " + err.message); }
  }
}

async function addEdu() {
  const slug = prompt("Short ID for this entry (e.g. 'high-school'):", "new-edu");
  if (!slug) return;
  const cleanId = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  if (!cleanId) return;
  const items = await loadCollection("education");
  const maxOrder = items.reduce((m, p) => Math.max(m, p.order || 0), 0);
  try {
    await setDoc(doc(db, "education", cleanId), {
      period: "", school: "New school", level: "", current: false, order: maxOrder + 1,
    });
    renderEducationEditor();
  } catch (err) {
    alert("Add failed: " + err.message);
  }
}

// ---------- Skills ----------
async function renderSkillsEditor() {
  const data = (await loadDoc("skills")) || SEED.skills;
  portalMain.innerHTML = `
    ${editorHead("Skills & Tools", "The 'toolkit' section.")}
    <form class="form" id="skills-form">
      ${field({ label: "Section title", name: "title", value: data.title })}
      ${field({ label: "Italicize which word/phrase in title", name: "titleEmphasis", value: data.titleEmphasis })}
      ${field({ label: "Soft Skills (one per line)", name: "soft", value: (data.soft || []).join("\n"), textarea: true, rows: 5 })}
      ${field({ label: "Technical Skills (one per line)", name: "technical", value: (data.technical || []).join("\n"), textarea: true, rows: 5 })}
      <div>
        <span class="form__label" style="margin-bottom:8px; display:block;">Languages</span>
        <div class="list-mgr" id="skills-langs">${(data.languages || []).map(langItemHtml).join("")}</div>
        <button type="button" class="list-mgr__add" id="skills-langs-add" style="margin-top:12px;">+ Add language</button>
      </div>
      <div>
        <span class="form__label" style="margin-bottom:8px; display:block;">Tools (under "Designed with")</span>
        <div class="list-mgr" id="skills-tools">${(data.tools || []).map(toolItemHtml).join("")}</div>
        <button type="button" class="list-mgr__add" id="skills-tools-add" style="margin-top:12px;">+ Add tool</button>
      </div>
      ${formActions("skills-status")}
    </form>
  `;
  bindListMgr("skills-langs", "skills-langs-add", () => langItemHtml({ label: "", meta: "" }));
  bindListMgr("skills-tools", "skills-tools-add", () => toolItemHtml({ mark: "", name: "" }));
  wireSave("skills-form", "skills-status", async (fd) => {
    const langs = $$("#skills-langs .list-mgr__item").map((row) => ({
      label: $('[name="lang-label"]', row).value.trim(),
      meta: $('[name="lang-meta"]', row).value.trim(),
    })).filter((l) => l.label);
    const tools = $$("#skills-tools .list-mgr__item").map((row) => ({
      mark: $('[name="tool-mark"]', row).value.trim(),
      name: $('[name="tool-name"]', row).value.trim(),
    })).filter((t) => t.name);
    const splitLines = (s) => (s || "").split("\n").map((l) => l.trim()).filter(Boolean);
    await saveDoc("skills", {
      title: fd.get("title"),
      titleEmphasis: fd.get("titleEmphasis"),
      soft: splitLines(fd.get("soft")),
      technical: splitLines(fd.get("technical")),
      languages: langs,
      tools,
    });
  });
}
const langItemHtml = (l) => `
  <div class="list-mgr__item">
    <div class="list-mgr__item-head">
      <span class="list-mgr__item-title">Language</span>
      <div class="list-mgr__controls">
        <button type="button" class="icon-btn" data-move="up">↑</button>
        <button type="button" class="icon-btn" data-move="down">↓</button>
        <button type="button" class="icon-btn icon-btn--danger" data-remove>Remove</button>
      </div>
    </div>
    <div class="form__row">
      ${field({ label: "Language", name: "lang-label", value: l.label })}
      ${field({ label: "Meta (e.g. / Native)", name: "lang-meta", value: l.meta })}
    </div>
  </div>`;
const toolItemHtml = (t) => `
  <div class="list-mgr__item">
    <div class="list-mgr__item-head">
      <span class="list-mgr__item-title">Tool</span>
      <div class="list-mgr__controls">
        <button type="button" class="icon-btn" data-move="up">↑</button>
        <button type="button" class="icon-btn" data-move="down">↓</button>
        <button type="button" class="icon-btn icon-btn--danger" data-remove>Remove</button>
      </div>
    </div>
    <div class="form__row">
      ${field({ label: "Mark (2 letters, e.g. Cv)", name: "tool-mark", value: t.mark })}
      ${field({ label: "Name (e.g. Canva)", name: "tool-name", value: t.name })}
    </div>
  </div>`;

// ---------- Contact ----------
async function renderContactEditor() {
  const data = (await loadDoc("contact")) || SEED.contact;
  portalMain.innerHTML = `
    ${editorHead("Contact", "Section heading and the four contact links shown below the form.")}
    <form class="form" id="contact-edit-form">
      ${field({ label: "Section title", name: "title", value: data.title })}
      ${field({ label: "Italicize which word/phrase in title", name: "titleEmphasis", value: data.titleEmphasis })}
      ${field({ label: "Lead paragraph", name: "lead", value: data.lead, textarea: true, rows: 3 })}
      ${field({ label: "Email address", name: "email", value: data.email, type: "email" })}
      <div class="form__row">
        ${field({ label: "Phone — display", name: "phoneDisplay", value: data.phoneDisplay })}
        ${field({ label: "Phone — link href (digits only, with +)", name: "phoneHref", value: data.phoneHref })}
      </div>
      <div class="form__row">
        ${field({ label: "LinkedIn URL", name: "linkedinUrl", value: data.linkedinUrl, type: "url" })}
        ${field({ label: "LinkedIn — display text", name: "linkedinDisplay", value: data.linkedinDisplay })}
      </div>
      <div class="form__row">
        ${field({ label: "Telegram URL", name: "telegramUrl", value: data.telegramUrl, type: "url" })}
        ${field({ label: "Telegram — display text", name: "telegramDisplay", value: data.telegramDisplay })}
      </div>
      ${formActions("contact-status")}
    </form>
  `;
  wireSave("contact-edit-form", "contact-status", async (fd) => {
    await saveDoc("contact", {
      title: fd.get("title"),
      titleEmphasis: fd.get("titleEmphasis"),
      lead: fd.get("lead"),
      email: fd.get("email"),
      phoneDisplay: fd.get("phoneDisplay"),
      phoneHref: fd.get("phoneHref"),
      linkedinUrl: fd.get("linkedinUrl"),
      linkedinDisplay: fd.get("linkedinDisplay"),
      telegramUrl: fd.get("telegramUrl"),
      telegramDisplay: fd.get("telegramDisplay"),
    });
  });
}

// ---------- Footer ----------
async function renderFooterEditor() {
  const data = (await loadDoc("footer")) || SEED.footer;
  portalMain.innerHTML = `
    ${editorHead("Footer", "Copyright line at the bottom of the page.")}
    <form class="form" id="footer-form">
      ${field({ label: "Footer copy", name: "copy", value: data.copy })}
      ${formActions("footer-status")}
    </form>
  `;
  wireSave("footer-form", "footer-status", async (fd) => {
    await saveDoc("footer", { copy: fd.get("copy") });
  });
}

// ==============================
// List manager (add / remove / reorder)
// Used by services, videos, languages, tools
// ==============================
function bindListMgr(listId, addBtnId, makeNew) {
  const list = document.getElementById(listId);
  const addBtn = document.getElementById(addBtnId);
  if (!list || !addBtn) return;
  addBtn.addEventListener("click", () => list.insertAdjacentHTML("beforeend", makeNew()));
  list.addEventListener("click", (e) => {
    const item = e.target.closest(".list-mgr__item");
    if (!item) return;
    if (e.target.matches("[data-remove]")) {
      item.remove();
    } else if (e.target.matches('[data-move="up"]')) {
      const prev = item.previousElementSibling;
      if (prev) list.insertBefore(item, prev);
    } else if (e.target.matches('[data-move="down"]')) {
      const next = item.nextElementSibling;
      if (next) list.insertBefore(next, item);
    }
  });
}

// ==============================
// Resume / CV editor
// ==============================
const MAX_CV_BYTES = 500 * 1024;

const formatBytes = (n) => {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result || "");
    const i = result.indexOf(",");
    resolve(i >= 0 ? result.slice(i + 1) : result);
  };
  reader.onerror = () => reject(reader.error || new Error("Could not read the file."));
  reader.readAsDataURL(file);
});

const base64ToBlob = (base64, type = "application/pdf") => {
  const bytes = atob(base64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type });
};

async function renderResumeEditor() {
  const cv = await loadDoc("cv");
  const hasFile = !!(cv && cv.data && cv.enabled);

  portalMain.innerHTML = `
    ${editorHead("Resume / CV", "Upload your resume PDF here. The Download Resume button on your Home and Contact pages updates automatically. Delete it and the button hides until you upload a new one.")}

    <div class="cv-card">
      ${hasFile ? `
        <div class="cv-card__row">
          <div class="cv-card__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="32" height="32"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25M9 16.5v.75m3-3v3M15 12v5.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>
          </div>
          <div class="cv-card__info">
            <p class="cv-card__name">${escapeHtml(cv.fileName || "resume.pdf")}</p>
            <p class="cv-card__meta">${formatBytes(cv.size)} · Updated ${escapeHtml(fmtDate(cv.updatedAt))}</p>
          </div>
          <div class="cv-card__actions">
            <button type="button" class="btn btn--outline" id="cv-preview-btn">Preview</button>
            <button type="button" class="btn btn--outline cv-card__delete" id="cv-delete-btn">Delete</button>
          </div>
        </div>
      ` : `
        <div class="cv-card__empty">
          <div class="cv-card__icon cv-card__icon--lg" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="48" height="48"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>
          </div>
          <p class="cv-card__empty-title">No resume uploaded yet</p>
          <p class="cv-card__empty-hint">When you upload a PDF, the "Download Resume" button on your Home and Contact pages will turn on automatically.</p>
        </div>
      `}

      <div class="cv-card__upload">
        <input type="file" accept="application/pdf,.pdf" id="cv-upload-input" hidden />
        <button type="button" class="btn btn--primary" id="cv-upload-trigger">
          ${hasFile ? "Upload new PDF" : "Upload PDF"}
        </button>
        <p class="cv-card__limit">Maximum file size: 500 KB. Tip: if your PDF is bigger, you can shrink it for free at smallpdf.com or ilovepdf.com.</p>
        <p class="form__status" id="cv-status" role="status" aria-live="polite"></p>
      </div>
    </div>
  `;

  const fileInput = document.getElementById("cv-upload-input");
  const trigger = document.getElementById("cv-upload-trigger");
  const status = document.getElementById("cv-status");

  trigger.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setStatus(status, "Please choose a PDF file.", "error");
      fileInput.value = "";
      return;
    }
    if (file.size > MAX_CV_BYTES) {
      setStatus(status, `That file is ${formatBytes(file.size)} — too big. The max is 500 KB. Try compressing it at smallpdf.com first.`, "error");
      fileInput.value = "";
      return;
    }

    trigger.disabled = true;
    setStatus(status, `Uploading ${escapeHtml(file.name)}…`, "pending");
    try {
      const data = await fileToBase64(file);
      await saveDoc("cv", {
        fileName: file.name,
        size: file.size,
        type: file.type || "application/pdf",
        data,
        enabled: true,
        updatedAt: serverTimestamp(),
      });
      setStatus(status, "Uploaded! Your Download Resume button is now using this file.", "success");
      setTimeout(renderResumeEditor, 700);
    } catch (err) {
      console.error(err);
      setStatus(status, err.message || "Upload failed.", "error");
      trigger.disabled = false;
    }
  });

  document.getElementById("cv-preview-btn")?.addEventListener("click", () => {
    if (!cv?.data) return;
    const blob = base64ToBlob(cv.data, cv.type || "application/pdf");
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  });

  document.getElementById("cv-delete-btn")?.addEventListener("click", async () => {
    if (!confirm("Delete the resume?\n\nThe Download Resume button will hide on your live site until you upload a new PDF.")) return;
    setStatus(status, "Deleting…", "pending");
    try {
      await saveDoc("cv", { enabled: false, updatedAt: serverTimestamp() });
      setStatus(status, "Deleted.", "success");
      setTimeout(renderResumeEditor, 600);
    } catch (err) {
      console.error(err);
      setStatus(status, err.message || "Delete failed.", "error");
    }
  });
}

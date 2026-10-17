// New admin, built from the design mockup. Each page saves to its own doc
// (site_content/v2_home, v2_about, …) and uploaded photos to site_content/v2_media_*.
// Only the redesigned preview pages read these, so the live site and old admin are untouched.
import { db, auth, ADMIN_EMAIL } from "./firebase-config.js";
import {
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  doc, setDoc, deleteDoc, serverTimestamp, collection, query, orderBy, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
  HOME_DOC, ABOUT_DOC, EXP_DOC, CONTACT_DOC, CV_DOC, MEDIA_PREFIX, DEFAULT_HOME, DEFAULT_ABOUT,
  loadHome, loadAbout, loadExperience, loadContact, loadDocData, blankJob, esc, isMedia, resolveImage,
} from "./v2-data.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clone = (v) => JSON.parse(JSON.stringify(v));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const plain = (s) => String(s ?? "").replace(/\*/g, "");

const setMsg = (el, text, kind) => {
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind || "";
  if (kind === "ok") setTimeout(() => { if (el.dataset.kind === "ok") { el.textContent = ""; el.dataset.kind = ""; } }, 2500);
};

// ==============================
// Sign in
// ==============================
const signinView = $("#signin"), portal = $("#portal"), signinMsg = $("#signin-msg");

$("#signin-btn").addEventListener("click", async () => {
  setMsg(signinMsg, "Opening Google sign-in…", "wait");
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error(err);
    const hint = /unauthorized-domain/.test(err.code || "")
      ? "This website address isn't allowed to sign in yet (Firebase → Authentication → Authorized domains)."
      : err.message || "Sign-in failed.";
    setMsg(signinMsg, hint, "error");
  }
});
$("#signout").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    portal.hidden = true; signinView.hidden = false; $("#signout").hidden = true; $("#who").textContent = "";
    return;
  }
  if (user.email !== ADMIN_EMAIL) {
    setMsg(signinMsg, `Access denied for ${user.email}. Only the site owner can use this admin.`, "error");
    await signOut(auth);
    return;
  }
  signinView.hidden = true; portal.hidden = false; $("#signout").hidden = false;
  $("#who").textContent = user.email;
  await start();
});

// ==============================
// Data: what's saved vs. what's on screen, per page
// ==============================
const saved = {};  // { v2_home: {...}, v2_about: {...} }
const draft = {};
const uploadedNow = new Set(); // photos uploaded this visit (removed again if never saved)

let started = false;
async function start() {
  if (started) return;
  started = true;
  const [home, about, exp, contact] = await Promise.all([loadHome(), loadAbout(), loadExperience(), loadContact()]);
  saved[HOME_DOC] = clone(home); saved[ABOUT_DOC] = clone(about);
  saved[EXP_DOC] = clone(exp); saved[CONTACT_DOC] = clone(contact);
  Object.keys(saved).forEach((k) => { draft[k] = clone(saved[k]); });
  buildSide();
  subscribeInbox();
  const [id, sub] = location.hash.slice(1).split("/");
  if (id === "job" && sub) openJob(decodeURIComponent(sub));
  else showPage(id || "home");
}

window.addEventListener("beforeunload", (e) => {
  if (Object.keys(draft).some((k) => !same(draft[k], saved[k]))) { e.preventDefault(); e.returnValue = ""; }
});

// "work.0.name" ↔ obj.work[0].name
const getPath = (obj, path) => path.split(".").reduce((o, k) => o[k], obj);
function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  keys.reduce((o, k) => o[k], obj)[last] = value;
}

function mediaRefs(v, out = new Set()) {
  if (typeof v === "string") { if (isMedia(v)) out.add(v); }
  else if (Array.isArray(v)) v.forEach((x) => mediaRefs(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => mediaRefs(x, out));
  return out;
}

async function savePart(docName, part, msgEl) {
  setMsg(msgEl, "Saving…", "wait");
  try {
    await setDoc(doc(db, "site_content", docName), { [part]: draft[docName][part], updatedAt: serverTimestamp() }, { merge: true });
    // Remove photos that were taken out (keep anything still used anywhere on screen)
    const keep = new Set(Object.values(draft).flatMap((d) => [...mediaRefs(d)]));
    const gone = new Set([...mediaRefs(saved[docName][part]), ...uploadedNow].filter((r) => !keep.has(r)));
    for (const r of gone) {
      await deleteDoc(doc(db, "site_content", MEDIA_PREFIX + r.slice(6))).catch(() => {});
      uploadedNow.delete(r);
    }
    saved[docName][part] = clone(draft[docName][part]);
    setMsg(msgEl, "Saved ✓", "ok");
    markUnsaved();
  } catch (err) {
    console.error(err);
    setMsg(msgEl, "Couldn't save: " + (err.message || err), "error");
  }
}

// ==============================
// Photos: shrink, then store each as its own document
// ==============================
const MAX_PHOTO_BYTES = 600 * 1024;

async function shrink(file) {
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch { throw new Error(`"${file.name}" isn't a photo this browser can read. Please use JPG, PNG or WebP.`); }
  let max = 1800, blob = null;
  while (max >= 500) {
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    const g = c.getContext("2d");
    g.fillStyle = "#0E0E0E"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(bmp, 0, 0, c.width, c.height);
    for (const q of [0.86, 0.76, 0.66, 0.56]) {
      blob = await new Promise((r) => c.toBlob(r, "image/jpeg", q));
      if (blob && blob.size <= MAX_PHOTO_BYTES) return blob;
    }
    max = Math.round(max * 0.75);
  }
  if (!blob) throw new Error("Couldn't prepare that photo.");
  return blob;
}

const blobToBase64 = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(",")[1]);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});

async function uploadPhoto(file) {
  const blob = await shrink(file);
  const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).replace(/[^a-z0-9]/gi, "").slice(0, 20);
  await setDoc(doc(db, "site_content", MEDIA_PREFIX + id), {
    data: await blobToBase64(blob), type: "image/jpeg", size: blob.size, name: file.name, createdAt: serverTimestamp(),
  });
  const ref = "media:" + id;
  uploadedNow.add(ref);
  return ref;
}

function pickPhotos({ multiple, msgEl }) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/jpeg,image/png,image/webp"; input.multiple = !!multiple;
    input.onchange = async () => {
      const files = [...(input.files || [])];
      const refs = [];
      for (let i = 0; i < files.length; i++) {
        setMsg(msgEl, `Uploading photo ${i + 1} of ${files.length}…`, "wait");
        try { refs.push(await uploadPhoto(files[i])); }
        catch (err) { setMsg(msgEl, err.message, "error"); resolve(refs); return; }
      }
      resolve(refs);
    };
    input.click();
  });
}

function hydrate(root) {
  $$("img[data-ref]", root).forEach(async (img) => { img.src = await resolveImage(img.dataset.ref); });
}

// ==============================
// Building blocks (shared by every page)
// ==============================
const num = (n) => `<span class="card__num">${n}</span>`;
const foot = (part) => `<div class="card__foot"><span class="msg" data-msg></span><button type="button" class="btn btn--main" data-save="${part}">Save</button></div>`;
const moveBtns = (list, i) => `<div class="move"><button type="button" data-list="${list}" data-op="up" data-i="${i}" title="Move up">▲</button><button type="button" data-list="${list}" data-op="down" data-i="${i}" title="Move down">▼</button></div>`;
const xBtn = (list, i, ask) => `<button type="button" class="x" data-list="${list}" data-op="x" data-i="${i}" ${ask ? `data-ask="${esc(ask)}"` : ""} title="Remove">×</button>`;
const addBtn = (list, blank, label) => `<button type="button" class="btn btn--small add" data-list="${list}" data-op="add" data-new="${esc(JSON.stringify(blank))}">${label}</button>`;
const input = (path, value, extra = "") => `<input type="text" data-path="${path}" value="${esc(value)}" ${extra} />`;
const textField = (label, path, value, hint = "") => `
  <div class="field"><label>${label}</label>${input(path, value)}${hint ? `<p class="hint">${hint}</p>` : ""}</div>`;

// A list of one-line texts (pills, skills…)
const textList = (list, items, addLabel) => `
  <div class="list">${items.map((t, i) => `
    <div class="item">${moveBtns(list, i)}${input(`${list}.${i}`, t, `aria-label="Item ${i + 1}"`)}${xBtn(list, i)}</div>`).join("")}
  </div>${addBtn(list, "", addLabel)}`;

// One photo with Change / Use original
const photoField = (label, path, ref, original, note) => `
  <div class="field"><span class="label">${label}</span>
    <div class="photo">
      <img data-ref="${esc(ref)}" alt="" />
      <div class="photo__info"><b>${ref === original ? "Your original photo" : "Your new photo"}</b>${note}</div>
      <div class="photo__btns">
        <button type="button" class="btn btn--small" data-photo="${path}">Change</button>
        ${ref === original ? "" : `<button type="button" class="btn btn--small" data-photo-reset="${path}" data-original="${esc(original)}">Use original</button>`}
      </div>
    </div></div>`;

// A grid of photos with ◀ × ▶ and + Add photos
const gallery = (path, refs) => `
  <div class="gallery">${refs.map((ref, k) => `
    <div class="pic"><img data-ref="${esc(ref)}" alt="" />
      <div class="pic__tools">
        <button type="button" data-gal="${path}" data-op="left" data-k="${k}" title="Move left">◀</button>
        <button type="button" class="pic__x" data-gal="${path}" data-op="x" data-k="${k}" title="Remove photo">×</button>
        <button type="button" data-gal="${path}" data-op="right" data-k="${k}" title="Move right">▶</button>
      </div></div>`).join("")}
    <button type="button" class="up" data-gal="${path}" data-op="add">+ Add<br/>photos</button>
  </div>`;

// An item that opens with Edit ▾
const openRows = new Set();
const expandable = (list, i, head, body, delLabel, ask) => `
  <details class="proj" data-open-key="${list}.${i}" ${openRows.has(`${list}.${i}`) ? "open" : ""}>
    <summary>${moveBtns(list, i)}${head}</summary>
    <div class="proj__body">${body}
      <button type="button" class="del-link" data-list="${list}" data-op="x" data-i="${i}" data-ask="${esc(ask)}">${delLabel}</button>
    </div>
  </details>`;

// ==============================
// Pages
// ==============================
const tabs = {}; // which inner tab is open (e.g. toolkit → "tech")

const PAGES = [
  { id: "inbox", label: "Inbox", render: renderInbox, badge: true },
  "-",
  {
    id: "home", label: "Home", doc: HOME_DOC, view: "index.html",
    lead: "Everything on your homepage, from top to bottom.",
    steps: [
      { id: "intro", label: "Intro screen", html: introHtml },
      { id: "hero", label: "Hero", html: heroHtml },
      { id: "work", label: "Selected work", html: workHtml },
    ],
  },
  {
    id: "about", label: "About", doc: ABOUT_DOC, view: "about.html",
    lead: "Your story, your toolkit and where you studied.",
    steps: [
      { id: "main", label: "About me", html: aboutMainHtml },
      { id: "toolkit", label: "Toolkit", html: toolkitHtml },
      { id: "education", label: "Study history", html: educationHtml },
    ],
  },
  {
    id: "experience", label: "Experience", doc: EXP_DOC, view: "experience.html",
    lead: "Your services and your jobs. Each job has its own page.",
    steps: [
      { id: "services", label: "Services", html: servicesHtml },
      { id: "jobs", label: "Jobs", html: jobsHtml },
    ],
  },
  {
    id: "contact", label: "Contact", doc: CONTACT_DOC, view: "contact.html",
    lead: "How people reach you, and the line at the bottom of every page.",
    steps: [
      { id: "info", label: "Contact info", html: contactInfoHtml },
      { id: "footer", label: "Footer", html: footerHtml },
    ],
  },
  "-",
  {
    id: "settings", label: "Settings", view: "contact.html",
    lead: "Your resume file and setup.",
    steps: [
      { id: "resume", label: "Resume / CV", html: resumeHtml, after: wireResume },
      { id: "setup", label: "Setup", html: setupHtml },
    ],
  },
];

// One job's own page (opened from Experience → Jobs → Edit). Not in the menu.
const JOB_FIELDS = {
  details: ["company", "role", "years", "place", "lead"],
  did: ["did"], content: ["content"], video: ["video"], events: ["events"], design: ["design"], link: ["link"],
};
const JOB_PAGE = {
  id: "job", parent: "experience", doc: EXP_DOC, saveKey: "jobs",
  lead: "These parts are in the same order as this job's page on your website, from top to bottom.",
  steps: [
    { id: "details", label: "Job details", html: jobDetailsHtml },
    { id: "did", label: "What I did", html: jobDidHtml },
    { id: "content", label: "Content planning", html: jobContentHtml },
    { id: "video", label: "Videos", html: jobVideoHtml },
    { id: "events", label: "Event photos", html: jobEventsHtml },
    { id: "design", label: "Design work", html: jobDesignHtml },
    { id: "link", label: "Link at the bottom", html: jobLinkHtml },
  ],
};
let jobId = null;
const jobIndex = () => draft[EXP_DOC].jobs.findIndex((j) => j.id === jobId);

const pageById = (id) => PAGES.find((p) => p.id === id);
let page = null;
const stepOf = {}; // last open step per page

function buildSide() {
  $("#side").innerHTML = PAGES.map((p) => p === "-" ? "<hr />" :
    `<button type="button" data-page="${p.id}">${p.label}${p.badge ? ` <span class="soon-tag" id="badge-${p.id}"></span>` : ""}</button>`).join("");
  $$("#side button").forEach((b) => b.addEventListener("click", () => showPage(b.dataset.page)));
}

function highlightSide(id) {
  $$("#side button").forEach((b) => b.classList.toggle("is-on", b.dataset.page === id));
}

function showPage(id) {
  page = pageById(id) || pageById("home");
  history.replaceState(null, "", "#" + page.id);
  highlightSide(page.id);
  if (page.render) page.render();
  else renderPage();
  window.scrollTo(0, 0);
}

function openJob(id) {
  jobId = id;
  if (jobIndex() === -1) return showPage("experience");
  page = JOB_PAGE;
  history.replaceState(null, "", "#job/" + encodeURIComponent(id));
  highlightSide("experience");
  renderPage();
  window.scrollTo(0, 0);
}

function renderPage() {
  const p = page;
  const isJob = p === JOB_PAGE;
  const j = isJob ? draft[EXP_DOC].jobs[jobIndex()] : null;
  stepOf[p.id] = stepOf[p.id] || p.steps[0].id;
  $("#main").innerHTML = `
    ${isJob ? '<a href="#experience" class="back" id="back">← Back to Experience</a>' : ""}
    <div class="page__head"><h1>${isJob ? esc(j.company) || "(no name)" : p.label}</h1>
      <a class="view" href="${isJob ? `job.html?job=${encodeURIComponent(j.id)}` : p.view}" target="_blank" rel="noopener">${isJob ? "View this job's page ↗" : "View on page ↗"}</a></div>
    <p class="page__lead">${p.lead}</p>
    <div class="steps" id="steps">${p.steps.map((s, i) =>
      `<button type="button" data-step="${s.id}">${i + 1} · ${s.label}<span data-dirty="${s.id}"></span></button>`).join("")}</div>
    <div id="part"></div>`;
  $$("#steps button").forEach((b) => b.addEventListener("click", () => { stepOf[p.id] = b.dataset.step; renderStep(); }));
  $("#back")?.addEventListener("click", (e) => { e.preventDefault(); stepOf.experience = "jobs"; showPage("experience"); });
  wirePart($("#part"));
  renderStep();
}

function renderStep() {
  const p = page, step = p.steps.find((s) => s.id === stepOf[p.id]);
  $$("#steps button").forEach((b) => b.classList.toggle("is-on", b.dataset.step === step.id));
  const part = $("#part");
  part.innerHTML = step.html(p.doc ? draft[p.doc] : null);
  hydrate(part);
  $$("details.proj", part).forEach((d) => d.addEventListener("toggle", () => {
    d.open ? openRows.add(d.dataset.openKey) : openRows.delete(d.dataset.openKey);
  }));
  if (step.after) step.after(part);
  markUnsaved();
}

// A • on each part that has changes not saved yet
function markUnsaved() {
  if (!page || !page.doc) return;
  $$("[data-dirty]").forEach((s) => {
    const k = s.dataset.dirty;
    let changed;
    if (page === JOB_PAGE) {
      const a = draft[EXP_DOC].jobs.find((j) => j.id === jobId) || {};
      const b = saved[EXP_DOC].jobs.find((j) => j.id === jobId) || {};
      changed = JOB_FIELDS[k].some((f) => !same(a[f], b[f]));
    } else {
      changed = !same(draft[page.doc][k], saved[page.doc][k]);
    }
    s.textContent = changed ? " •" : "";
  });
}

// ---------- HOME: 1. Intro ----------
function introHtml(d) {
  return `
    <div class="card">
      <h2>${num(1)}Intro screen</h2>
      <p class="card__help">The black screen people see first. Hovering over each name shows its photo.</p>
      <div class="row2">
        ${photoField('Photo for "KANG"', "intro.kangPhoto", d.intro.kangPhoto, DEFAULT_HOME.intro.kangPhoto, "Shows when someone hovers over KANG.")}
        ${photoField('Photo for "SOMALIZA"', "intro.somalizaPhoto", d.intro.somalizaPhoto, DEFAULT_HOME.intro.somalizaPhoto, "Shows when someone hovers over SOMALIZA.")}
      </div>
      ${textField("Small text in the top right", "intro.based", d.intro.based)}
      ${foot("intro")}
    </div>`;
}

// ---------- HOME: 2. Hero ----------
function heroHtml(d) {
  return `
    <div class="card">
      <h2>${num(2)}Hero</h2>
      <p class="card__help">The first part of the homepage, under the intro.</p>
      <div class="field">
        <label>Description (left side)</label>
        <textarea data-path="hero.desc" rows="4">${esc(d.hero.desc)}</textarea>
        <p class="hint">Tip: put *stars* around words you want in green, like *Unilinks Global Education*.</p>
      </div>
      <span class="label">Pills (right side)</span>
      ${textList("hero.pills", d.hero.pills, "+ Add pill")}
      <p class="hint">The first pill is green. Three pills looks best.</p>
      ${foot("hero")}
    </div>`;
}

// ---------- HOME: 3. Selected work ----------
const PAGE_LINKS = [
  ["artwork.html", "Artwork page"],
  ["events.html", "Events page"],
  ["content-planning.html", "Content Planning page"],
  ["about.html", "About page"],
  ["experience.html", "Experience page"],
  ["contact.html", "Contact page"],
];

function workHtml(d) {
  const blank = { name: "New row", small: "", tag: "", years: "", link: PAGE_LINKS[0][0], fill: false, images: [] };
  return `
    <div class="card">
      <h2>${num(3)}Selected work</h2>
      <p class="card__help">The big rows with the slideshow. Click <b>Edit ▾</b> on a row to change its words and photos.</p>
      ${d.work.length ? "" : '<p class="empty-note">No rows yet. Add one below.</p>'}
      ${d.work.map((r, i) => {
        const links = PAGE_LINKS.some(([v]) => v === r.link) ? PAGE_LINKS : [[r.link, r.link], ...PAGE_LINKS];
        const head = `
          ${r.images.length ? `<img class="thumb" data-ref="${esc(r.images[0])}" alt="" />` : '<span class="thumb"></span>'}
          <div class="item__title"><b>${esc(plain(r.name)) || "(no name)"}</b>
            <span>${r.images.length ? `${r.images.length} photo${r.images.length === 1 ? "" : "s"}` : "Coming soon · no photos yet"}</span></div>`;
        const body = `
          <div class="row2">
            ${textField("Row name", `work.${i}.name`, r.name, "Put *stars* around the part in green, like Art*work*.")}
            ${textField("Small text under the name", `work.${i}.small`, r.small)}
            ${textField("Little tag in brackets", `work.${i}.tag`, r.tag, "Example: 5 projects · 25 pieces")}
            ${textField("Years", `work.${i}.years`, r.years)}
          </div>
          <div class="field"><label>Opens which page when clicked</label>
            <select data-path="work.${i}.link">${links.map(([v, l]) => `<option value="${esc(v)}" ${v === r.link ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
          <label class="check"><input type="checkbox" data-path="work.${i}.fill" ${r.fill ? "checked" : ""} /> Photos fill the whole frame (best for event photos)</label>
          ${r.images.length ? "" : '<p class="empty-note">No photos yet, so the slideshow shows “Coming soon.”</p>'}
          <span class="label">Slideshow photos</span>
          ${gallery(`work.${i}.images`, r.images)}
          <p class="hint">Hover over a photo to move it or remove it.</p>`;
        return expandable("work", i, head, body, "Delete this row", `Delete the row "${plain(r.name)}"? It's only gone for good after you press Save.`);
      }).join("")}
      ${addBtn("work", blank, "+ Add row")}
      ${foot("work")}
    </div>`;
}

// ---------- ABOUT: 1. About me ----------
function aboutMainHtml(d) {
  const m = d.main;
  return `
    <div class="card">
      <h2>${num(1)}About me</h2>
      <p class="card__help">The big quote, your paragraphs and your photo at the top of the About page.</p>
      <div class="field">
        <label>Big quote</label>
        <textarea data-path="main.quote" rows="3">${esc(m.quote)}</textarea>
        <p class="hint">Each new line starts a new line on the page. Put *stars* around words you want in green, like *right*.</p>
      </div>
      <span class="label">Paragraphs</span>
      <div class="list">${m.paragraphs.map((t, i) => `
        <div class="item" style="align-items:flex-start">${moveBtns("main.paragraphs", i)}
          <textarea data-path="main.paragraphs.${i}" rows="4" style="flex:1">${esc(t)}</textarea>${xBtn("main.paragraphs", i, "Remove this paragraph?")}</div>`).join("")}
      </div>
      ${addBtn("main.paragraphs", "", "+ Add paragraph")}
      <div style="height:22px"></div>
      ${photoField("Your photo (next to the text)", "main.photo", m.photo, DEFAULT_ABOUT.main.photo, "A tall photo (portrait) looks best.")}
      ${foot("main")}
    </div>`;
}

// ---------- ABOUT: 2. Toolkit ----------
const TOOLKIT_TABS = [["soft", "Soft Skills"], ["tech", "Technical"], ["langs", "Languages"]];

function toolkitHtml(d) {
  const t = tabs.toolkit || "soft";
  const k = d.toolkit;
  const body = t === "langs" ? `
      <div class="list">${k.langs.map((l, i) => `
        <div class="item">${moveBtns("toolkit.langs", i)}
          ${input(`toolkit.langs.${i}.name`, l.name, 'placeholder="Language" aria-label="Language"')}
          ${input(`toolkit.langs.${i}.level`, l.level, 'placeholder="Level" aria-label="Level" style="max-width:200px"')}
          ${xBtn("toolkit.langs", i)}</div>`).join("")}
      </div>
      <p class="hint">Left box: the language. Right box: your level (for example Native, Fluent, Conversational).</p>
      ${addBtn("toolkit.langs", { name: "", level: "" }, "+ Add language")}`
    : textList(`toolkit.${t}`, k[t], t === "soft" ? "+ Add soft skill" : "+ Add technical skill");
  return `
    <div class="card">
      <h2>${num(2)}Toolkit</h2>
      <p class="card__help">The 3 columns of skills on your About page.</p>
      <div class="tabs">${TOOLKIT_TABS.map(([id, label]) =>
        `<button type="button" class="${id === t ? "is-on" : ""}" data-tab="toolkit" data-value="${id}">${label}</button>`).join("")}</div>
      ${body}
      ${foot("toolkit")}
    </div>`;
}

// ---------- ABOUT: 3. Study history ----------
function educationHtml(d) {
  const blank = { years: "", school: "New school", level: "", current: false };
  return `
    <div class="card">
      <h2>${num(3)}Study history</h2>
      <p class="card__help">Newest at the top. Use ▲▼ to change the order, and <b>Edit ▾</b> to change a school.</p>
      ${d.education.length ? "" : '<p class="empty-note">No schools yet. Add one below.</p>'}
      ${d.education.map((e, i) => {
        const head = `<div class="item__title"><b>${esc(e.school) || "(no name)"}</b>
          <span>${esc([e.years, e.level].filter(Boolean).join(" · ")) || "No years yet"}${e.current ? " · studying here now" : ""}</span></div>`;
        const body = `
          ${textField("School name", `education.${i}.school`, e.school)}
          <div class="row2">
            ${textField("Years", `education.${i}.years`, e.years, "Example: 2016 — 2022, or 2023 — Present")}
            ${textField("Level", `education.${i}.level`, e.level, "Example: University, High School")}
          </div>
          <label class="check"><input type="checkbox" data-path="education.${i}.current" ${e.current ? "checked" : ""} /> I study here now (this school gets highlighted)</label>`;
        return expandable("education", i, head, body, "Delete this school", `Delete "${e.school}"? It's only gone for good after you press Save.`);
      }).join("")}
      ${addBtn("education", blank, "+ Add school")}
      ${foot("education")}
    </div>`;
}

// ---------- EXPERIENCE: 1. Services ----------
function servicesHtml(d) {
  return `
    <div class="card">
      <h2>${num(1)}Services</h2>
      <p class="card__help">A name and a short description for each. Click <b>Edit ▾</b> to change one.</p>
      ${d.services.length ? "" : '<p class="empty-note">No services yet. Add one below.</p>'}
      ${d.services.map((s, i) => expandable("services", i,
        `<div class="item__title"><b>${esc(s.title) || "(no name)"}</b><span>${esc(String(s.desc).slice(0, 70))}${String(s.desc).length > 70 ? "…" : ""}</span></div>`,
        `${textField("Service name", `services.${i}.title`, s.title)}
         <div class="field"><label>Short description</label><textarea data-path="services.${i}.desc" rows="3">${esc(s.desc)}</textarea></div>`,
        "Delete this service", `Delete "${s.title}"? It's only gone for good after you press Save.`)).join("")}
      ${addBtn("services", { title: "New service", desc: "" }, "+ Add service")}
      ${foot("services")}
    </div>`;
}

// ---------- EXPERIENCE: 2. Jobs ----------
function jobsHtml(d) {
  return `
    <div class="card">
      <h2>${num(2)}Jobs</h2>
      <p class="card__help">Each job is one row on your Experience page. Click <b>Edit</b> to change everything on that job's own page.</p>
      ${d.jobs.length ? "" : '<p class="empty-note">No jobs yet. Add one below.</p>'}
      <div class="list">${d.jobs.map((j, i) => `
        <div class="item">${moveBtns("jobs", i)}
          <div class="item__title"><b>${esc(j.company) || "(no name)"}</b><span>${esc([j.role, j.years].filter(Boolean).join(" · "))}</span></div>
          <button type="button" class="btn btn--small" data-job-edit="${esc(j.id)}">Edit</button>
          ${xBtn("jobs", i, `Delete the job "${j.company}" and everything on its page? It's only gone for good after you press Save.`)}
        </div>`).join("")}
      </div>
      <button type="button" class="btn btn--small add" data-job-add>+ Add job</button>
      <p class="hint">Moving or deleting jobs here needs a Save below. Changes inside a job are saved on that job's page.</p>
      ${foot("jobs")}
    </div>`;
}

// ---------- ONE JOB ----------
const where = (t) => `<p class="hint" style="margin:-12px 0 18px">On the website: ${t}</p>`;
const jobCard = (n, title, help, place, inner) => `
  <div class="card">
    <h2>${num(n)}${title}</h2>
    <p class="card__help">${help}</p>
    ${where(place)}
    ${inner}
    ${foot("jobs")}
  </div>`;
const jp = (rest) => `jobs.${jobIndex()}.${rest}`;
const curJob = (d) => d.jobs[jobIndex()];

function jobDetailsHtml(d) {
  const j = curJob(d);
  return jobCard(1, "Job details", "The name, position and years at the top of the job page.", "top of the page", `
    <div class="row2">
      ${textField("Company name", jp("company"), j.company)}
      ${textField("Your position", jp("role"), j.role)}
      ${textField("Years", jp("years"), j.years, "Example: 2024 — 2025")}
      ${textField("Location", jp("place"), j.place)}
    </div>
    ${textField("Short intro line", jp("lead"), j.lead, "One sentence about this job, shown under the name.")}`);
}

function jobDidHtml(d) {
  const j = curJob(d), list = jp("did");
  return jobCard(2, "What I did", "Your main tasks. One task per box.", '"What I did" list', `
    ${j.did.length ? "" : '<p class="empty-note">No tasks yet. This list is hidden on the website until you add one.</p>'}
    <div class="list">${j.did.map((t, i) => `
      <div class="item" style="align-items:flex-start">${moveBtns(list, i)}
        <textarea data-path="${list}.${i}" rows="2" style="flex:1">${esc(t)}</textarea>${xBtn(list, i)}</div>`).join("")}
    </div>
    ${addBtn(list, "", "+ Add task")}`);
}

function jobContentHtml(d) {
  const j = curJob(d);
  return jobCard(3, "Content planning", "A short description and photos of your content plans.", '"Work results — Content Planning"', `
    <div class="field"><label>Description</label><textarea data-path="${jp("content.desc")}" rows="3">${esc(j.content.desc)}</textarea></div>
    ${j.content.images.length ? "" : `<p class="empty-note">${j.content.desc ? "No photos yet, so the website shows “Coming soon.”" : "Empty, so this part is hidden on the website."}</p>`}
    <span class="label">Photos</span>
    ${gallery(jp("content.images"), j.content.images)}`);
}

function jobVideoHtml(d) {
  const j = curJob(d), list = jp("video.items");
  return jobCard(4, "Videos", "Paste the Facebook, YouTube or TikTok link for each video.", '"Work results — Video"', `
    <div class="field"><label>Description</label><textarea data-path="${jp("video.desc")}" rows="3">${esc(j.video.desc)}</textarea></div>
    ${j.video.items.length ? "" : '<p class="empty-note">No videos yet. This part is hidden on the website until you add one.</p>'}
    <div class="list">${j.video.items.map((v, i) => `
      <div class="item">${moveBtns(list, i)}
        ${input(`${list}.${i}.name`, v.name, 'placeholder="Video name" aria-label="Video name" style="max-width:220px"')}
        ${input(`${list}.${i}.url`, v.url, 'placeholder="https://facebook.com/..." aria-label="Video link"')}
        ${xBtn(list, i)}</div>`).join("")}
    </div>
    <p class="hint">Left box: the video's name. Right box: its link.</p>
    ${addBtn(list, { name: "", url: "" }, "+ Add video")}`);
}

function jobEventsHtml(d) {
  const j = curJob(d);
  return jobCard(5, "Event photos", "A short description and your photos from events. These also show on your Events page.", '"Work results — Events" and the Events page', `
    <div class="field"><label>Description</label><textarea data-path="${jp("events.desc")}" rows="3">${esc(j.events.desc)}</textarea></div>
    ${j.events.images.length ? "" : '<p class="empty-note">No photos yet. This part is hidden on the website until you add some.</p>'}
    <span class="label">Photos</span>
    ${gallery(jp("events.images"), j.events.images)}`);
}

const SHAPES = [["square", "Square"], ["landscape", "Landscape (a bit wide)"], ["wide", "Wide"], ["portrait", "Portrait (tall)"]];

function jobDesignHtml(d) {
  const j = curJob(d), list = jp("design");
  return jobCard(6, "Design work", "Each project has a name, a short description and its photos. These also show on your Artwork page. Click <b>Edit ▾</b> to open a project.", '"Work results — Design" and the Artwork page', `
    ${j.design.length ? "" : '<p class="empty-note">No design projects yet. This part is hidden on the website until you add one.</p>'}
    ${j.design.map((p, i) => expandable(list, i,
      `${p.images.length ? `<img class="thumb" data-ref="${esc(p.images[0])}" alt="" />` : '<span class="thumb"></span>'}
       <div class="item__title"><b>${esc(p.name) || "(no name)"}</b><span>${esc(p.info)}${p.info ? " · " : ""}${p.images.length} photo${p.images.length === 1 ? "" : "s"}</span></div>`,
      `<div class="row2">
         ${textField("Project name", `${list}.${i}.name`, p.name)}
         ${textField("Type and year", `${list}.${i}.info`, p.info, "Example: Social series · 2025")}
       </div>
       <div class="field"><label>Description</label><textarea data-path="${list}.${i}.desc" rows="3">${esc(p.desc)}</textarea></div>
       <div class="field"><label>Photo shape on the project page</label>
         <select data-path="${list}.${i}.shape">${SHAPES.map(([v, l]) => `<option value="${v}" ${v === p.shape ? "selected" : ""}>${l}</option>`).join("")}</select></div>
       <span class="label">Photos</span>
       ${gallery(`${list}.${i}.images`, p.images)}
       <p class="hint">Hover over a photo to move it or remove it.</p>`,
      "Delete this project", `Delete the project "${p.name}"? It's only gone for good after you press Save.`)).join("")}
    ${addBtn(list, { name: "New project", info: "", desc: "", shape: "square", images: [] }, "+ Add project")}`);
}

function jobLinkHtml(d) {
  const l = curJob(d).link;
  return jobCard(7, "Link at the bottom", "Optional. A big link at the end of the page, like your Facebook page.", "very bottom of the page", `
    ${textField("Link", jp("link.url"), l.url, "Leave this empty to hide the link.")}
    <div class="row2">
      ${textField("Small text before", jp("link.label"), l.label, "Example: See the full archive")}
      ${textField("Big text", jp("link.name"), l.name, "Example: Unilinks Cambodia")}
      ${textField("Small text after", jp("link.meta"), l.meta, "Example: on Facebook")}
    </div>`);
}

// ---------- CONTACT ----------
function contactInfoHtml(d) {
  const list = "info";
  return `
    <div class="card">
      <h2>${num(1)}Contact info</h2>
      <p class="card__help">Shown on your Contact page and at the bottom of your homepage. Add as many ways to reach you as you like.</p>
      <div class="list">${d.info.map((c, i) => `
        <div class="item">${moveBtns(list, i)}
          ${input(`${list}.${i}.name`, c.name, 'placeholder="Name, e.g. Instagram" aria-label="Name" style="max-width:180px"')}
          ${input(`${list}.${i}.value`, c.value, 'placeholder="Address or link" aria-label="Address or link"')}
          ${xBtn(list, i)}</div>`).join("")}
      </div>
      <p class="hint">Left box: the name people see (Email, Facebook, Instagram…). Right box: your email, phone number or link. The website works out what to open.</p>
      ${addBtn(list, { name: "", value: "" }, "+ Add contact")}
      ${foot("info")}
    </div>`;
}

function footerHtml(d) {
  return `
    <div class="card">
      <h2>${num(2)}Footer</h2>
      <p class="card__help">The small line at the very bottom of every page.</p>
      ${textField("Footer text", "footer.text", d.footer.text)}
      ${foot("footer")}
    </div>`;
}

// ---------- INBOX (messages from your contact form) ----------
let inbox = [];
function subscribeInbox() {
  onSnapshot(query(collection(db, "contact_messages"), orderBy("createdAt", "desc")), (snap) => {
    inbox = snap.docs.map((x) => ({ id: x.id, ...x.data() }));
    const badge = $("#badge-inbox");
    if (badge) badge.textContent = inbox.length ? String(inbox.length) : "";
    if (page && page.id === "inbox") renderInbox();
  }, (err) => console.error("Inbox:", err));
}

function renderInbox() {
  const when = (ts) => {
    if (!ts) return "";
    const t = ts.toDate ? ts.toDate() : new Date(ts);
    return t.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  };
  $("#main").innerHTML = `
    <div class="page__head"><h1>Inbox</h1></div>
    <p class="page__lead">Messages people sent from your contact form${inbox.length ? ` · ${inbox.length} total` : ""}.</p>
    ${inbox.length ? inbox.map((m) => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <b>${esc(m.name || "(no name)")}</b><span class="hint" style="margin:0">${esc(when(m.createdAt))}</span>
        </div>
        <p style="margin:4px 0 14px"><a href="mailto:${esc(m.email || "")}" style="color:var(--olive)">${esc(m.email || "")}</a></p>
        <p style="white-space:pre-wrap;line-height:1.6;color:var(--ink-2)">${esc(m.message || "")}</p>
        <div class="card__foot"><a class="btn btn--small" href="mailto:${esc(m.email || "")}">Reply by email</a>
          <button type="button" class="btn btn--small" data-msg-del="${esc(m.id)}">Delete</button></div>
      </div>`).join("") : '<div class="soon">No messages yet.</div>'}`;
  $$("[data-msg-del]").forEach((b) => b.addEventListener("click", async () => {
    if (!confirm("Delete this message? This can't be undone.")) return;
    try { await deleteDoc(doc(db, "contact_messages", b.dataset.msgDel)); }
    catch (err) { alert("Couldn't delete: " + err.message); }
  }));
}

// ---------- SETTINGS: Resume ----------
const MAX_CV_BYTES = 700 * 1024;
let cvInfo;

function resumeHtml() {
  const c = cvInfo;
  const status = c === undefined ? "Checking…"
    : c && c.data && c.enabled !== false ? `<b>${esc(c.fileName || "resume.pdf")}</b>${Math.round((c.size || 0) / 1024)} KB${c.fromOld ? " · from your current admin" : ""}`
    : c && c.enabled === false ? "<b>No resume</b>The Download Resume button is hidden."
    : "<b>Using the file in your website folder</b>assets/cv.pdf";
  return `
    <div class="card">
      <h2>${num(1)}Resume / CV</h2>
      <p class="card__help">The PDF people get when they click <b>Download Resume</b> on your Contact page.</p>
      <div class="photo">
        <div class="photo__info">${status}</div>
        <div class="photo__btns">
          <button type="button" class="btn btn--small" id="cv-up">Upload new PDF</button>
          ${c && c.data && c.enabled !== false && !c.fromOld ? '<button type="button" class="btn btn--small" id="cv-off">Remove</button>' : ""}
        </div>
      </div>
      <p class="hint">PDF only, up to 700 KB. If yours is bigger, you can shrink it for free at smallpdf.com.</p>
      <div class="card__foot"><span class="msg" data-msg></span></div>
    </div>`;
}

function wireResume(part) {
  if (cvInfo === undefined) {
    (async () => {
      const mine = await loadDocData(CV_DOC);
      const old = mine ? null : await loadDocData("cv");
      cvInfo = mine || (old ? { ...old, fromOld: true } : null);
      if (page.id === "settings" && stepOf.settings === "resume") renderStep();
    })();
  }
  const msgEl = $("[data-msg]", part);
  $("#cv-up", part)?.addEventListener("click", () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/pdf,.pdf";
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) return setMsg(msgEl, "Please choose a PDF file.", "error");
      if (f.size > MAX_CV_BYTES) return setMsg(msgEl, `That file is ${Math.round(f.size / 1024)} KB, but the most is 700 KB. Try shrinking it at smallpdf.com.`, "error");
      setMsg(msgEl, "Uploading…", "wait");
      try {
        const data = await blobToBase64(f);
        cvInfo = { fileName: f.name, size: f.size, type: "application/pdf", data, enabled: true };
        await setDoc(doc(db, "site_content", CV_DOC), { ...cvInfo, updatedAt: serverTimestamp() });
        renderStep();
        setMsg($("[data-msg]", $("#part")), "Uploaded ✓", "ok");
      } catch (err) { setMsg(msgEl, "Couldn't upload: " + err.message, "error"); }
    };
    inp.click();
  });
  $("#cv-off", part)?.addEventListener("click", async () => {
    if (!confirm("Remove your resume? The Download Resume button will be hidden until you upload a new one.")) return;
    try {
      await setDoc(doc(db, "site_content", CV_DOC), { enabled: false, updatedAt: serverTimestamp() });
      cvInfo = { enabled: false };
      renderStep();
    } catch (err) { setMsg(msgEl, "Couldn't remove: " + err.message, "error"); }
  });
}

function setupHtml() {
  return `
    <div class="card">
      <h2>${num(2)}Setup</h2>
      <p class="card__help">Nothing to do here. Everything is already set up.</p>
      <div class="soon">This new admin saves to its own place, so your live website and your current admin are not changed.
        When the redesign goes live, this admin will replace the current one.</div>
    </div>`;
}

// ==============================
// Typing and buttons inside a part (connected once per page; content is redrawn)
// ==============================
function wirePart(part) {
  const d = () => draft[page.doc];
  const rerender = () => renderStep();
  const swap = (arr, i, j) => { if (j < 0 || j >= arr.length) return false; [arr[i], arr[j]] = [arr[j], arr[i]]; return true; };
  const swapOpen = (list, i, j) => {
    const a = openRows.has(`${list}.${i}`), b = openRows.has(`${list}.${j}`);
    openRows.delete(`${list}.${i}`); openRows.delete(`${list}.${j}`);
    if (a) openRows.add(`${list}.${j}`); if (b) openRows.add(`${list}.${i}`);
  };
  const clearOpen = (list) => [...openRows].forEach((k) => { if (k.startsWith(list + ".")) openRows.delete(k); });
  const note = (text) => setMsg($("[data-msg]", part), text, "ok");

  part.addEventListener("input", (e) => {
    const el = e.target.closest("[data-path]");
    if (!el) return;
    setPath(d(), el.dataset.path, el.type === "checkbox" ? el.checked : el.value);
    markUnsaved();
  });

  part.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.closest("summary")) e.preventDefault(); // arrows in a row header shouldn't open it
    const msgEl = $("[data-msg]", part);
    const ds = b.dataset;

    if (ds.save) return savePart(page.doc, page.saveKey || ds.save, msgEl);
    if (ds.tab) { tabs[ds.tab] = ds.value; return rerender(); }

    // Jobs: open one, or add a new one and open it
    if (ds.jobEdit) { stepOf.job = "details"; return openJob(ds.jobEdit); }
    if ("jobAdd" in ds) {
      const j = blankJob();
      draft[EXP_DOC].jobs.push(j);
      stepOf.job = "details";
      return openJob(j.id);
    }

    // Lists: add / remove / move
    if (ds.list) {
      const arr = getPath(d(), ds.list), i = +ds.i;
      if (ds.op === "add") {
        arr.push(JSON.parse(ds.new));
        openRows.add(`${ds.list}.${arr.length - 1}`);
        rerender();
        const inputs = $$(`[data-path^="${ds.list}.${arr.length - 1}"]`, part);
        inputs[0]?.focus();
        return;
      }
      if (ds.op === "x") {
        if (ds.ask && !confirm(ds.ask)) return;
        arr.splice(i, 1); clearOpen(ds.list);
        return rerender();
      }
      const j = ds.op === "up" ? i - 1 : i + 1;
      if (swap(arr, i, j)) { swapOpen(ds.list, i, j); rerender(); }
      return;
    }

    // One photo
    if (ds.photo) {
      const [ref] = await pickPhotos({ multiple: false, msgEl });
      if (ref) { setPath(d(), ds.photo, ref); rerender(); note("Photo added. Don't forget to Save."); }
      return;
    }
    if (ds.photoReset) { setPath(d(), ds.photoReset, ds.original); return rerender(); }

    // Photo grids
    if (ds.gal) {
      const imgs = getPath(d(), ds.gal), k = +ds.k;
      if (ds.op === "add") {
        const refs = await pickPhotos({ multiple: true, msgEl });
        if (refs.length) { imgs.push(...refs); rerender(); note(`${refs.length} photo${refs.length === 1 ? "" : "s"} added. Don't forget to Save.`); }
        return;
      }
      if (ds.op === "x") imgs.splice(k, 1);
      else if (!swap(imgs, k, ds.op === "left" ? k - 1 : k + 1)) return;
      return rerender();
    }
  });
}

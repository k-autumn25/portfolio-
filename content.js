import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// ==============================
// Helpers
// ==============================
const $ = (id) => document.getElementById(id);

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);

// Wraps the chosen substring in <em>…</em>. Used for italic emphasis in titles.
const emphasize = (text, emphasis) => {
  const safe = escapeHtml(text);
  if (!emphasis) return safe;
  const safeEm = escapeHtml(emphasis);
  return safe.replace(safeEm, `<em>${safeEm}</em>`);
};

const setText = (id, value) => {
  const el = $(id);
  if (el && value != null) el.textContent = value;
};

const setHTML = (id, value) => {
  const el = $(id);
  if (el && value != null) el.innerHTML = value;
};

const setHidden = (id, hidden) => {
  const el = $(id);
  if (el) el.hidden = !!hidden;
};

// Convert "Phnom Penh,\nCambodia" to "Phnom Penh,<br />Cambodia"
const nl2br = (s) => escapeHtml(s).replace(/\n/g, "<br />");

// ==============================
// Section renderers
// ==============================
function renderHero(d) {
  if (!d) return;
  setText("hero-meta-label", d.metaLabel);
  setText("hero-badge-text", d.badgeText);
  setHidden("hero-badge", !d.badgeEnabled);
  setText("hero-title-1", d.titleLine1);
  // Strip trailing punctuation on the outlined name line. A period rendered
  // as outline-only looks like a stray dot, which is not what we want.
  const line2 = String(d.titleLine2 || "").replace(/[.!?]+$/, "");
  setText("hero-title-2", line2);
  setText("hero-subtitle", d.subtitle);
  setText("hero-tagline", d.tagline);
  setText("hero-photo-year", d.photoYear);
}

function renderHeroPhoto(p) {
  if (!p || !p.enabled || !p.data) return;
  const img = document.querySelector(".hero__photo img");
  if (img) img.src = `data:${p.type || "image/jpeg"};base64,${p.data}`;
}

function renderAbout(d) {
  if (!d) return;
  // Quote with optional emphasized word inside <em>
  const quoteHtml = (() => {
    const safe = escapeHtml(d.quote || "");
    if (!d.quoteEmphasis) return safe;
    return safe.replace(escapeHtml(d.quoteEmphasis), `<em>${escapeHtml(d.quoteEmphasis)}</em>`);
  })();
  setHTML("about-quote", quoteHtml);
  setText("about-body-1", d.body1);
  setText("about-body-2", d.body2);

  const facts = $("about-facts");
  if (facts) {
    facts.innerHTML = `
      <div class="fact"><dt>Based in</dt><dd>${nl2br(d.factBasedIn || "")}</dd></div>
      <div class="fact"><dt>Studying</dt><dd>${escapeHtml(d.factStudying || "")}</dd></div>
      <div class="fact"><dt>Currently</dt><dd>${escapeHtml(d.factCurrently || "")}</dd></div>
      <div class="fact"><dt>Languages</dt><dd>${escapeHtml(d.factLanguages || "")}</dd></div>
    `;
  }
}

function renderServices(d) {
  if (!d) return;
  if (d.title) setHTML("services-title", emphasize(d.title, d.titleEmphasis) + ".");
  const grid = $("services-grid");
  if (!grid || !Array.isArray(d.items)) return;
  grid.innerHTML = d.items.map((s) => `
    <article class="service">
      <span class="service__no">${escapeHtml(s.no || "")}</span>
      <h3 class="service__title">${escapeHtml(s.title || "")}</h3>
      <p class="service__desc">${escapeHtml(s.desc || "")}</p>
    </article>
  `).join("");
}

function renderWorkIntro(d) {
  if (!d) return;
  if (d.title) setHTML("work-title", emphasize(d.title, d.titleEmphasis));
  const link = $("work-archive-link");
  if (link && d.archiveUrl) link.href = d.archiveUrl;
  setText("work-archive-label", d.archiveLabel);
  setText("work-archive-name", d.archiveName);
  setText("work-archive-meta", d.archiveMeta);
}

// Render the home-page Featured Work section header (title + lead).
// Wraps the title in mask spans so the existing reveal animation still works.
function renderHomeFeatured(d) {
  if (!d) return;
  const titleEl = $("home-featured-title");
  if (titleEl && d.title) {
    const safe = escapeHtml(d.title);
    let inner;
    if (d.titleEmphasis) {
      const em = escapeHtml(d.titleEmphasis);
      const idx = safe.indexOf(em);
      if (idx > -1) {
        const before = safe.slice(0, idx).trim();
        const emText = `<em>${em}</em>`;
        const after = safe.slice(idx + em.length).trim();
        const beforeMask = before
          ? `<span class="reveal-mask"><span class="reveal-mask__inner">${before}</span></span>`
          : "";
        const emMask = `<span class="reveal-mask ${before ? "reveal-mask--delay-1" : ""}"><span class="reveal-mask__inner">${emText}${after}</span></span>`;
        inner = beforeMask + emMask;
      } else {
        inner = `<span class="reveal-mask"><span class="reveal-mask__inner">${safe}</span></span>`;
      }
    } else {
      inner = `<span class="reveal-mask"><span class="reveal-mask__inner">${safe}</span></span>`;
    }
    titleEl.innerHTML = inner;
  }
  setText("home-featured-lead", d.lead);
}

// Render the Hire Me CTA panel content.
function renderHireCta(d) {
  if (!d) return;
  setText("hire-label", d.label);
  const titleEl = $("hire-title");
  if (titleEl && d.title) {
    const safe = escapeHtml(d.title);
    let inner;
    if (d.titleEmphasis) {
      const em = escapeHtml(d.titleEmphasis);
      const idx = safe.indexOf(em);
      if (idx > -1) {
        const before = safe.slice(0, idx).trim();
        const emText = `<em>${em}</em>`;
        const after = safe.slice(idx + em.length).trim();
        const beforeMask = before
          ? `<span class="reveal-mask"><span class="reveal-mask__inner">${before}</span></span>`
          : "";
        const emMask = `<span class="reveal-mask ${before ? "reveal-mask--delay-1" : ""}"><span class="reveal-mask__inner">${emText}${after}</span></span>`;
        inner = beforeMask + emMask;
      } else {
        inner = `<span class="reveal-mask"><span class="reveal-mask__inner">${safe}</span></span>`;
      }
    } else {
      inner = `<span class="reveal-mask"><span class="reveal-mask__inner">${safe}</span></span>`;
    }
    titleEl.innerHTML = inner;
  }
  setText("hire-lead", d.lead);
  setText("hire-button-text", d.buttonText);
  const btn = $("hire-button");
  if (btn && d.buttonHref) btn.href = d.buttonHref;
}

// Render the first 3 projects as Featured Work cards on the homepage.
// Only runs if #work-grid exists on the page.
function renderFeaturedProjects(items) {
  const grid = $("work-grid");
  if (!grid || !Array.isArray(items) || !items.length) return;
  const featured = items.slice(0, 3);
  // Extract the middle slash-separated segment of `meta` as the category tag.
  const getCategory = (meta) => {
    const parts = String(meta || "").split("/").map((s) => s.trim());
    return parts[1] || "";
  };
  grid.innerHTML = featured.map((p) => {
    const safeId = (p.id || "").replace(/[^a-z0-9-]/gi, "");
    const cover = (p.images && p.images[0]) || "";
    const category = getCategory(p.meta);
    return `
      <article class="card">
        <div class="card__media">
          ${category ? `<span class="card__category">${escapeHtml(category)}</span>` : ""}
          <img src="${escapeHtml(cover)}" alt="${escapeHtml(p.title || "")} cover" loading="lazy" />
        </div>
        <div class="card__body">
          <span class="card__num">${escapeHtml(p.no || "")}</span>
          <h3 class="card__title">${escapeHtml(p.title || "")}</h3>
          <p class="card__desc">${escapeHtml(p.desc || "")}</p>
          <a href="experience.html#project-${safeId}" class="card__btn">
            View Case Study <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </article>
    `;
  }).join("");
}

function renderProjects(items) {
  const list = $("projects-list");
  if (!list) return;
  if (!items || !items.length) {
    list.innerHTML = "";
    return;
  }
  list.innerHTML = items.map((p) => {
    const cols = p.cols === 4 ? "project__grid--4" : "project__grid--3";
    const ratioClass = p.ratio ? `project__grid--${escapeHtml(p.ratio)}` : "";
    const safeId = (p.id || "").replace(/[^a-z0-9-]/gi, "");
    const images = (p.images || []).map((src, i) => `
      <a class="project__img" href="${escapeHtml(src)}" target="_blank" rel="noopener">
        <img src="${escapeHtml(src)}" alt="${escapeHtml(p.title || "")} image ${i + 1}" loading="lazy" />
      </a>
    `).join("");
    return `
      <article class="project" id="project-${safeId}">
        <header class="project__header">
          <span class="project__no">${escapeHtml(p.no || "")}</span>
          <div class="project__heading">
            <h3 class="project__title">${escapeHtml(p.title || "")}</h3>
            <p class="project__meta">${escapeHtml(p.meta || "").replace(/\s\/\s/g, ' <span class="project__sep">/</span> ')}</p>
          </div>
        </header>
        <p class="project__desc">${escapeHtml(p.desc || "")}</p>
        <div class="project__grid ${cols} ${ratioClass}">${images}</div>
      </article>
    `;
  }).join("");
}

// Pill bar above Featured Work — switches between Design / Content / Video / Events panes
function wireWorkPanes() {
  const bar = document.getElementById("project-filters");
  if (!bar || bar.dataset.wired === "true") return;
  bar.dataset.wired = "true";

  const showPane = (name) => {
    document.querySelectorAll(".work-pane").forEach((pane) => {
      pane.hidden = pane.dataset.pill !== name;
    });
  };

  // Apply whichever pill is active on initial load
  const activeBtn = bar.querySelector(".project-filter.is-active") || bar.querySelector(".project-filter");
  if (activeBtn) showPane(activeBtn.dataset.filter);

  bar.addEventListener("click", (e) => {
    const btn = e.target.closest(".project-filter");
    if (!btn) return;
    bar.querySelectorAll(".project-filter").forEach((b) => {
      const active = b === btn;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
    showPane(btn.dataset.filter);
  });
}

function renderVideos(d) {
  if (!d) return;
  const grid = $("videos-grid");
  if (!grid || !Array.isArray(d.items)) return;
  grid.innerHTML = d.items.map((v) => `
    <a class="video-card" href="${escapeHtml(v.url || "#")}" target="_blank" rel="noopener">
      <span class="video-card__art" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </span>
      <div>
        <h4 class="video-card__title">${escapeHtml(v.title || "")} ${v.num ? `<em>No.&nbsp;${escapeHtml(v.num)}</em>` : ""}</h4>
        <p class="video-card__meta">Watch on Facebook <span aria-hidden="true">→</span></p>
      </div>
    </a>
  `).join("");
}

function renderEvents(d, items) {
  if (d) setText("events-lead", d.lead);
  const strip = $("events-strip");
  if (!strip) return;

  const resolveImgSrc = (img) => {
    if (!img) return "";
    if (typeof img === "string") return img;
    if (img.kind === "upload" && img.data) {
      const type = img.type || "image/jpeg";
      return `data:${type};base64,${img.data}`;
    }
    return img.src || "";
  };

  if (Array.isArray(items) && items.length > 0) {
    strip.classList.remove("events__strip");
    strip.classList.add("events__cards");
    strip.innerHTML = items.map((ev) => {
      const imgList = (ev.images || []).map((img, i) => {
        const src = resolveImgSrc(img);
        if (!src) return "";
        return `
          <a class="event-card__img" href="${escapeHtml(src)}" target="_blank" rel="noopener">
            <img src="${escapeHtml(src)}" alt="${escapeHtml(ev.title || "Event")} photo ${i + 1}" loading="lazy" />
          </a>
        `;
      }).filter(Boolean).join("");
      const count = (ev.images || []).filter((img) => resolveImgSrc(img)).length;
      const metaBits = [ev.date, ev.location].filter(Boolean).map(escapeHtml)
        .join(' <span class="event-card__sep">·</span> ');
      return `
        <article class="event-card">
          <header class="event-card__header">
            ${ev.title ? `<h3 class="event-card__title">${escapeHtml(ev.title)}</h3>` : ""}
            ${metaBits ? `<p class="event-card__meta">${metaBits}</p>` : ""}
          </header>
          ${ev.desc ? `<p class="event-card__desc">${escapeHtml(ev.desc)}</p>` : ""}
          ${imgList ? `<div class="event-card__gallery" data-count="${count}">${imgList}</div>` : ""}
        </article>
      `;
    }).join("");
    return;
  }

  // Fallback: old single-strip behaviour (used only if collection is empty)
  if (d && Array.isArray(d.images) && d.images.length) {
    strip.classList.add("events__strip");
    strip.classList.remove("events__cards");
    strip.innerHTML = d.images.map((src, i) => `
      <div class="events__img"><img src="${escapeHtml(src)}" alt="Event photo ${i + 1}" loading="lazy" /></div>
    `).join("");
  } else {
    strip.innerHTML = "";
  }
}

function renderExperience(items) {
  const list = $("experience-list");
  if (!list || !items || !items.length) return;
  list.innerHTML = items.map((j) => `
    <article class="job">
      <header class="job__head">
        <div class="job__company">
          <h3 class="job__name">${escapeHtml(j.company || "")}</h3>
          <p class="job__role">${escapeHtml(j.role || "")}</p>
        </div>
        <div class="job__when">
          <p class="job__period">${escapeHtml(j.period || "")}</p>
          <p class="job__loc">${escapeHtml(j.location || "")}</p>
        </div>
      </header>
      ${j.lead ? `<p class="job__lead">${escapeHtml(j.lead)}</p>` : ""}
      ${Array.isArray(j.bullets) && j.bullets.length ? `
        <ul class="job__list">${j.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
      ` : ""}
    </article>
  `).join("");
}

function renderEducation(items) {
  const list = $("education-list");
  if (!list || !items || !items.length) return;
  list.innerHTML = items.map((e) => `
    <li class="edu-item${e.current ? " edu-item--current" : ""}">
      <span class="edu__period">${escapeHtml(e.period || "")}</span>
      <h3 class="edu__school">${escapeHtml(e.school || "")}</h3>
      <span class="edu__level">${escapeHtml(e.level || "")}</span>
    </li>
  `).join("");
}

const TOOL_LOGOS = {
  "canva": `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="cv-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00C4CC"/><stop offset="100%" stop-color="#7D2AE8"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#cv-g)"/><path d="M68 38 C 63 30, 50 28, 42 34 C 32 42, 32 60, 42 68 C 50 74, 63 72, 68 64" stroke="white" stroke-width="7" fill="none" stroke-linecap="round"/></svg>`,
  "figma": `<svg viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg"><path d="M25 0 H50 V50 H25 A25 25 0 0 1 25 0 Z" fill="#FF7262"/><path d="M50 0 H75 A25 25 0 0 1 75 50 H50 Z" fill="#F24E1E"/><rect x="25" y="50" width="25" height="50" fill="#A259FF"/><circle cx="75" cy="75" r="25" fill="#1ABCFE"/><path d="M50 100 V125 A25 25 0 0 1 25 150 V100 Z" fill="#0ACF83"/></svg>`,
  "google workspace": `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="38" height="38" rx="6" fill="#4285F4"/><rect x="56" y="6" width="38" height="38" rx="6" fill="#EA4335"/><rect x="6" y="56" width="38" height="38" rx="6" fill="#FBBC04"/><rect x="56" y="56" width="38" height="38" rx="6" fill="#34A853"/></svg>`,
  "trello": `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="tr-g" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#0091E6"/><stop offset="100%" stop-color="#0079BF"/></linearGradient></defs><rect x="0" y="0" width="100" height="100" rx="15" fill="url(#tr-g)"/><rect x="18" y="18" width="28" height="58" rx="4" fill="white"/><rect x="54" y="18" width="28" height="38" rx="4" fill="white"/></svg>`,
};

function renderSkills(d) {
  if (!d) return;
  if (d.title) setHTML("skills-title", emphasize(d.title, d.titleEmphasis));
  const grid = $("skills-grid");
  if (grid) {
    const col = (title, items, isLang) => `
      <div class="skill-col">
        <h3 class="skill-col__title">${escapeHtml(title)}</h3>
        <ul class="skill-col__list">
          ${(items || []).map((it) => isLang
            ? `<li>${escapeHtml(it.label || "")} ${it.meta ? `<span class="skill-col__meta">${escapeHtml(it.meta)}</span>` : ""}</li>`
            : `<li>${escapeHtml(it)}</li>`
          ).join("")}
        </ul>
      </div>
    `;
    grid.innerHTML = col("Soft Skills", d.soft) + col("Technical", d.technical) + col("Languages", d.languages, true);
  }
  const tools = $("tools-grid");
  if (tools && Array.isArray(d.tools)) {
    tools.innerHTML = d.tools.map((t) => {
      const key = (t.name || "").toLowerCase().trim();
      const logo = TOOL_LOGOS[key];
      const visual = logo
        ? `<span class="tool__logo" aria-hidden="true">${logo}</span>`
        : `<span class="tool__mark">${escapeHtml(t.mark || "")}</span>`;
      return `
      <div class="tool">
        ${visual}
        <span class="tool__name">${escapeHtml(t.name || "")}</span>
      </div>
    `;
    }).join("");
  }
}

function renderContact(d) {
  if (!d) return;
  if (d.title) setHTML("contact-title", emphasize(d.title, d.titleEmphasis).replace(/^Let'?s create something /, "Let&rsquo;s create<br />something "));
  setText("contact-lead", d.lead);
  const list = $("contact-list");
  if (!list) return;
  const items = [];
  if (d.email) items.push({ label: "Email", value: d.email, href: `mailto:${d.email}`, arrow: "→" });
  if (d.phoneDisplay) items.push({ label: "Phone", value: d.phoneDisplay, href: `tel:${d.phoneHref || d.phoneDisplay}`, arrow: "→" });
  if (d.linkedinUrl) items.push({ label: "LinkedIn", value: d.linkedinDisplay || d.linkedinUrl, href: d.linkedinUrl, arrow: "↗", external: true });
  if (d.telegramUrl) items.push({ label: "Telegram", value: d.telegramDisplay || d.telegramUrl, href: d.telegramUrl, arrow: "↗", external: true });
  list.innerHTML = items.map((it) => `
    <li>
      <a href="${escapeHtml(it.href)}" ${it.external ? 'target="_blank" rel="noopener"' : ""} class="contact-item">
        <span class="contact-item__label">${escapeHtml(it.label)}</span>
        <span class="contact-item__value">${escapeHtml(it.value)}</span>
        <span class="contact-item__arrow" aria-hidden="true">${it.arrow}</span>
      </a>
    </li>
  `).join("");
}

function renderFooter(d) {
  if (!d) return;
  setText("footer-copy", d.copy);
}

function renderCv(d) {
  const buttons = document.querySelectorAll("[data-cv-download]");
  if (!buttons.length) return;

  if (!d) return;

  if (d.enabled === false || !d.data) {
    buttons.forEach((b) => { b.hidden = true; });
    return;
  }

  try {
    const bytes = atob(d.data);
    const buf = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
    const blob = new Blob([buf], { type: d.type || "application/pdf" });
    const url = URL.createObjectURL(blob);
    buttons.forEach((b) => {
      b.hidden = false;
      b.href = url;
      if (d.fileName) b.setAttribute("download", d.fileName);
    });
  } catch (e) {
    console.warn("[content] Could not decode CV data:", e.message);
  }
}

async function loadCvIfNeeded() {
  if (!document.querySelector("[data-cv-download]")) return;
  const cv = await loadDoc("cv");
  renderCv(cv);
}

// ==============================
// Loaders (gracefully no-op on missing data)
// ==============================
async function loadDoc(id) {
  try {
    const snap = await getDoc(doc(db, "site_content", id));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn(`[content] Failed to load site_content/${id}:`, e.message);
    return null;
  }
}

async function loadCollection(name) {
  try {
    const snap = await getDocs(query(collection(db, name), orderBy("order", "asc")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn(`[content] Failed to load ${name}:`, e.message);
    return [];
  }
}

async function init() {
  const [hero, heroPhoto, about, services, workIntro, videos, events, eventItems, skills, contact, footer, projects, experience, education, homeFeatured, hireCta] = await Promise.all([
    loadDoc("hero"),
    loadDoc("heroPhoto"),
    loadDoc("about"),
    loadDoc("services"),
    loadDoc("workIntro"),
    loadDoc("videos"),
    loadDoc("events"),
    loadCollection("events"),
    loadDoc("skills"),
    loadDoc("contact"),
    loadDoc("footer"),
    loadCollection("projects"),
    loadCollection("experience"),
    loadCollection("education"),
    loadDoc("homeFeatured"),
    loadDoc("hireCta"),
  ]);

  renderHero(hero);
  renderHeroPhoto(heroPhoto);
  renderAbout(about);
  renderServices(services);
  renderWorkIntro(workIntro);
  renderHomeFeatured(homeFeatured);
  renderHireCta(hireCta);
  if (projects && projects.length) renderProjects(projects);
  if (projects && projects.length) renderFeaturedProjects(projects);
  renderVideos(videos);
  renderEvents(events, eventItems);
  wireWorkPanes();
  renderExperience(experience);
  renderEducation(education);
  renderSkills(skills);
  renderContact(contact);
  renderFooter(footer);
  loadCvIfNeeded();

  // Re-trigger reveal observer if script.js already initialized it
  document.dispatchEvent(new CustomEvent("content:rendered"));
}

init();

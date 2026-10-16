// Artwork index (artwork.html) + single project page (project.html?p=<id>).
// Renders from the seed data right away, then swaps in the live Firestore
// "projects" collection (the one edited in Admin → Projects).
import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { SEED } from "./seed-data.js";

const $ = (id) => document.getElementById(id);

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);

// "P/01" → "01"; falls back to list position
const numberOf = (p, i) => (p.no || String(i + 1).padStart(2, "0")).replace(/^P\//i, "");

// meta is "Client / Type / Year" — split into named parts
function parseMeta(meta) {
  const parts = String(meta || "").split(/\s+\/\s+/).map((s) => s.trim()).filter(Boolean);
  return {
    client: parts.length > 2 ? parts[0] : parts.length === 2 ? parts[0] : "",
    type: parts.length > 2 ? parts.slice(1, -1).join(" / ") : "",
    year: parts.length >= 2 ? parts[parts.length - 1] : parts[0] || "",
  };
}

const projectUrl = (p) => `project.html?p=${encodeURIComponent(p.id || "")}`;

// ---------- Index ----------
function renderIndex(projects) {
  const list = $("artwork-index");
  if (!list) return;
  setCount(projects.length);
  list.innerHTML = projects.map((p, i) => {
    const m = parseMeta(p.meta);
    const cover = (p.images || [])[0] || "";
    return `
      <li>
        <a class="aw-row" href="${projectUrl(p)}" data-cover="${escapeHtml(cover)}">
          <span class="aw-row__no">${escapeHtml(numberOf(p, i))}</span>
          <span class="aw-row__year">${escapeHtml(m.year)}</span>
          <span class="aw-row__main">
            <span class="aw-row__title">${escapeHtml(p.title || "")}</span>
            <span class="aw-row__type">${escapeHtml(m.type || m.client)}</span>
          </span>
          <span class="aw-row__cta">View project <span aria-hidden="true">→</span></span>
        </a>
      </li>`;
  }).join("");
}

function setCount(n) {
  const el = $("artwork-count");
  if (el) el.textContent = `(${String(n).padStart(2, "0")})`;
}

// Small preview image that follows the cursor over the list (mouse only)
function wireHoverPreview() {
  const list = $("artwork-index");
  const preview = $("aw-preview");
  if (!list || !preview || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const img = preview.querySelector("img");

  list.addEventListener("mousemove", (e) => {
    preview.style.transform = `translate(${e.clientX + 24}px, ${e.clientY - 90}px)`;
  });
  list.addEventListener("mouseover", (e) => {
    const row = e.target.closest(".aw-row");
    if (!row || !row.dataset.cover) return;
    if (img.getAttribute("src") !== row.dataset.cover) img.src = row.dataset.cover;
    preview.classList.add("is-on");
  });
  list.addEventListener("mouseleave", () => preview.classList.remove("is-on"));
}

// ---------- Single project ----------
function renderProject(projects, isFinal) {
  const root = $("project-detail");
  if (!root) return;
  const id = new URLSearchParams(location.search).get("p");
  const i = projects.findIndex((p) => p.id === id);

  if (i === -1) {
    if (!isFinal) return;
    root.innerHTML = `
      <h1 class="pd__title">Project not found.</h1>
      <a class="pd__back" href="artwork.html">← All artwork</a>`;
    return;
  }

  const p = projects[i];
  const next = projects[(i + 1) % projects.length];
  const m = parseMeta(p.meta);
  const images = p.images || [];
  document.title = `${p.title} — Kang Somaliza`;

  const facts = [
    ["Client", m.client],
    ["Type", m.type],
    ["Year", m.year],
    ["Pieces", images.length ? String(images.length) : ""],
  ].filter(([, v]) => v);

  root.innerHTML = `
    <a class="pd__back" href="artwork.html">← All artwork</a>
    <span class="pd__no">${escapeHtml(numberOf(p, i))} / ${String(projects.length).padStart(2, "0")}</span>
    <h1 class="pd__title">${escapeHtml(p.title || "")}</h1>

    <div class="pd__intro">
      <dl class="pd__facts">
        ${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${escapeHtml(v)}</dd></div>`).join("")}
      </dl>
      <p class="pd__desc">${escapeHtml(p.desc || "")}</p>
    </div>

    <div class="pd__gallery pd__gallery--${escapeHtml(p.ratio || "square")}">
      ${images.map((src, n) => `
        <a class="pd__img" href="${escapeHtml(src)}" target="_blank" rel="noopener">
          <img src="${escapeHtml(src)}" alt="${escapeHtml(p.title || "")} — piece ${n + 1}" loading="${n < 2 ? "eager" : "lazy"}" />
        </a>`).join("")}
    </div>

    ${projects.length > 1 ? `
    <a class="pd__next" href="${projectUrl(next)}">
      <span class="pd__next-label">Next project</span>
      <span class="pd__next-title">${escapeHtml(next.title || "")} <span aria-hidden="true">→</span></span>
    </a>` : ""}
  `;
}

// ---------- Boot ----------
function render(projects, isFinal) {
  renderIndex(projects);
  renderProject(projects, isFinal);
}

async function loadProjects() {
  try {
    const snap = await getDocs(query(collection(db, "projects"), orderBy("order", "asc")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("[artwork] Failed to load projects:", e.message);
    return [];
  }
}

render(SEED.projects, false);
wireHoverPreview();
loadProjects().then((live) => {
  render(live.length ? live : SEED.projects, true);
});

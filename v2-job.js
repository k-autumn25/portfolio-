// Draws one job's page (job.html?job=<id>) from the new admin's Experience → Jobs.
import { loadExperience, resolveImages, esc } from "./v2-data.js";

const root = document.getElementById("v2-job");
const want = new URLSearchParams(location.search).get("job") || root.dataset.job;
const { jobs } = await loadExperience();
const j = jobs.find((x) => x.id === want);

if (!j) {
  root.innerHTML = `<h1 class="job__name">Job not found.</h1>`;
} else {
  document.title = `${j.company} — Kang Somaliza`;
  const grid = async (refs, wide, alt) => {
    const urls = await resolveImages(refs);
    return `<div class="jobd__grid${wide ? " jobd__grid--wide" : ""}">${urls.map((u, i) =>
      `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="${esc(alt)} ${i + 1}" loading="lazy" /></a>`).join("")}</div>`;
  };
  const h = (t) => `<h2 class="jobd__h">${t}</h2>`;
  const desc = (t) => (t ? `<p class="jobd__group-desc">${esc(t)}</p>` : "");
  const parts = [];

  parts.push(`
    <article class="job">
      <header class="job__head">
        <div class="job__company">
          <h1 class="job__name">${esc(j.company)}</h1>
          <p class="job__role">${esc(j.role)}</p>
        </div>
        <div class="job__when">
          <p class="job__period">${esc(j.years)}</p>
          <p class="job__loc">${esc(j.place)}</p>
        </div>
      </header>
      ${j.lead ? `<p class="job__lead">${esc(j.lead)}</p>` : ""}
      ${j.did.filter(Boolean).length ? `${h("What I did")}<ul class="job__list">${j.did.filter(Boolean).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    </article>`);

  // Content planning: shows "Coming soon" if there's a description but no photos yet
  if (j.content.desc || j.content.images.length) {
    parts.push(`${h("Work results &mdash; Content Planning")}<div class="jobd__group">${desc(j.content.desc)}
      ${j.content.images.length ? await grid(j.content.images, false, "Content planning")
        : '<div class="jobd__soon"><h3 class="jobd__soon-title">Coming soon.</h3><p>Content planning samples will go here.</p></div>'}</div>`);
  }

  const vids = j.video.items.filter((v) => v.url);
  if (vids.length) {
    parts.push(`${h("Work results &mdash; Video")}<div class="jobd__group">${desc(j.video.desc)}
      <div class="videos__grid">${vids.map((v) => `
        <a class="video-card" href="${esc(v.url)}" target="_blank" rel="noopener">
          <span class="video-card__art" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
          <div><h4 class="video-card__title">${esc(v.name || "Video")}</h4><p class="video-card__meta">Watch <span aria-hidden="true">&rarr;</span></p></div>
        </a>`).join("")}</div></div>`);
  }

  if (j.events.images.length) {
    parts.push(`${h("Work results &mdash; Events")}<div class="jobd__group">${desc(j.events.desc)}${await grid(j.events.images, true, j.company + " event")}</div>`);
  }

  if (j.design.length) {
    const groups = await Promise.all(j.design.map(async (p) => `
      <div class="jobd__group">
        <h3 class="jobd__group-title">${esc(p.name)}</h3>
        ${p.info ? `<p class="jobd__group-meta">${esc(p.info)}</p>` : ""}
        ${desc(p.desc)}
        ${await grid(p.images, p.shape === "landscape" || p.shape === "wide", p.name)}
      </div>`));
    parts.push(`${h("Work results &mdash; Design")}${groups.join("")}`);
  }

  if (j.link.url) {
    parts.push(`
      <a href="${esc(j.link.url)}" target="_blank" rel="noopener" class="work__more-link">
        <span class="work__more-label">${esc(j.link.label)}</span>
        <span class="work__more-name">${esc(j.link.name || j.link.url)} <span class="work__more-arrow" aria-hidden="true">&nearr;</span></span>
        <span class="work__more-meta">${esc(j.link.meta)}</span>
      </a>`);
  }

  root.innerHTML = parts.join("\n");
}

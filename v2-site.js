// On every redesigned preview page: footer text and the Download Resume button,
// both edited in the new admin (Contact → Footer, Settings → Resume).
import { loadContact, loadDocData, CV_DOC, contactLink, esc } from "./v2-data.js";

const contact = await loadContact();

const footer = document.getElementById("v2-footer-copy");
if (footer) footer.textContent = contact.footer.text;

// Homepage footer: the text plus a link for each contact
const homeFooter = document.getElementById("v2-home-footer");
if (homeFooter) {
  homeFooter.innerHTML = `<div>${esc(contact.footer.text)}</div><div>${contact.info.filter((c) => c.name && c.value).map((c) => {
    const l = contactLink(c.value);
    return `<a href="${esc(l.href)}"${l.external ? ' target="_blank" rel="noopener"' : ""}>${esc(c.name)}</a>`;
  }).join(" · ")}</div>`;
}

// Resume: the new admin's file, else the current one, else the file in the site
const cvButtons = document.querySelectorAll("[data-v2-cv]");
if (cvButtons.length) {
  const cv = (await loadDocData(CV_DOC)) || (await loadDocData("cv"));
  if (cv && cv.enabled !== false && cv.data) {
    try {
      const bytes = atob(cv.data);
      const buf = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([buf], { type: "application/pdf" }));
      cvButtons.forEach((b) => { b.href = url; b.setAttribute("download", cv.fileName || "Kang-Somaliza-Resume.pdf"); b.hidden = false; });
    } catch (e) { console.warn("[v2] resume:", e.message); }
  } else if (cv && cv.enabled === false) {
    cvButtons.forEach((b) => { b.hidden = true; });
  }
}

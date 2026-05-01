import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const form = document.getElementById("contact-form");
if (form) {
  const nameEl = document.getElementById("cf-name");
  const emailEl = document.getElementById("cf-email");
  const messageEl = document.getElementById("cf-message");
  const submitBtn = document.getElementById("cf-submit");
  const statusEl = document.getElementById("cf-status");

  const setStatus = (text, kind) => {
    statusEl.textContent = text;
    statusEl.dataset.kind = kind || "";
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = nameEl.value.trim();
    const email = emailEl.value.trim();
    const message = messageEl.value.trim();

    if (!name || !email || !message) {
      setStatus("Please fill in name, email, and message.", "error");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("That email doesn't look right.", "error");
      return;
    }

    submitBtn.disabled = true;
    setStatus("Sending…", "pending");

    try {
      await addDoc(collection(db, "contact_messages"), {
        name,
        email,
        message,
        createdAt: serverTimestamp(),
      });
      form.reset();
      setStatus("Thanks — your message is on its way. I'll reply soon.", "success");
    } catch (err) {
      console.error("Contact form error:", err);
      setStatus("Something went wrong. Please email lizakang123@gmail.com directly.", "error");
    } finally {
      submitBtn.disabled = false;
    }
  });
}

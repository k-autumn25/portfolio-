/* ============================
   Theme toggle (light / dark)
   Runs on every page. Initial value set by inline head script
   to avoid flash. This handles the click + localStorage save.
   ============================ */
(() => {
  const root = document.documentElement;
  const toggles = document.querySelectorAll('.theme-toggle');
  if (!toggles.length) return;

  toggles.forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      if (next === 'dark') {
        root.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
      } else {
        root.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
      }
    });
  });
})();


/* ============================
   Navigation
   ============================ */
const nav = document.getElementById('nav');
const navToggle = nav.querySelector('.nav__toggle');
const navLinks = nav.querySelectorAll('.nav__links a');

navToggle.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('is-open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    nav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

const closeNav = () => {
  if (!nav.classList.contains('is-open')) return;
  nav.classList.remove('is-open');
  navToggle.setAttribute('aria-expanded', 'false');
};

document.addEventListener('click', (e) => {
  if (!nav.classList.contains('is-open')) return;
  if (e.target.closest('.nav__links') || e.target.closest('.nav__toggle')) return;
  closeNav();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeNav();
});

// Highlight current page in nav
const currentPage = document.body.dataset.page;
if (currentPage) {
  navLinks.forEach((link) => {
    const href = link.getAttribute('href') || '';
    const match = href.replace(/\.html$/, '');
    if (match === currentPage) link.classList.add('is-active');
  });
}

const onScroll = () => {
  if (window.scrollY > 16) nav.classList.add('is-scrolled');
  else nav.classList.remove('is-scrolled');
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();


/* ============================
   Scroll-reveal animations
   ============================ */
const revealSelectors = [
  '.section__header',
  '.section__title',
  '.about__quote',
  '.about__body',
  '.fact',
  '.service',
  '.project__header',
  '.project__desc',
  '.project__img',
  '.work__sub-header',
  '.work__sub-lead',
  '.video-card',
  '.events__img',
  '.work__more-link',
  '.job__head',
  '.job__lead',
  '.job__list > li',
  '.edu-item',
  '.skill-col',
  '.tools',
  '.contact__title',
  '.contact__side',
  '.contact-item',
];

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
);

function stagger(parentSel, childSel, step = 0.07, max = 6) {
  document.querySelectorAll(parentSel).forEach((parent) => {
    parent.querySelectorAll(childSel).forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i, max) * step}s`;
    });
  });
}

function setupReveals() {
  revealSelectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      if (!el.classList.contains('reveal')) {
        el.classList.add('reveal');
        revealObserver.observe(el);
      }
    });
  });

  stagger('.services__grid', '.service');
  stagger('.facts', '.fact');
  stagger('.skills__grid', '.skill-col');
  stagger('.tools__grid', '.tool');
  stagger('.events__strip', '.events__img', 0.06);
  stagger('.contact__list', '.contact-item');
  stagger('.edu__list', '.edu-item');
  stagger('.job__list', 'li', 0.05);
  stagger('.videos__grid', '.video-card', 0.08);

  document.querySelectorAll('.project__grid').forEach((grid) => {
    grid.querySelectorAll('.project__img').forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i, 8) * 0.05}s`;
    });
  });
}

setupReveals();
document.addEventListener('content:rendered', setupReveals);


/* ============================
   Shared premium effects (all pages)
   Cursor glow follower + reveal-mask scroll observer.
   Background blobs/wash run via CSS keyframes — no JS needed.
   ============================ */
const _premium = (() => {
  const isTouch = window.matchMedia('(hover: none)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Cursor glow (any page that has #cursorGlow) ---- */
  const glow = document.getElementById('cursorGlow');
  if (!isTouch && !prefersReducedMotion && glow) {
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let glowX = mouseX;
    let glowY = mouseY;
    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      glow.classList.add('is-active');
    });
    window.addEventListener('mouseleave', () => glow.classList.remove('is-active'));
    (function tick() {
      glowX += (mouseX - glowX) * 0.12;
      glowY += (mouseY - glowY) * 0.12;
      glow.style.transform = `translate(${glowX}px, ${glowY}px) translate(-50%, -50%)`;
      requestAnimationFrame(tick);
    })();
  }

  /* ---- Scroll-reveal observer for cards, CTA, and reveal-masks.
         Tracks seen elements so we don't double-observe after a re-render. ---- */
  const seen = new WeakSet();
  let revealObserver = null;
  if ('IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
  }
  function attachReveals() {
    document.querySelectorAll('.card, .cta, .reveal-mask').forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      if (revealObserver) revealObserver.observe(el);
      else el.classList.add('is-visible');
    });
  }
  attachReveals();
  document.addEventListener('content:rendered', attachReveals);

  return { isTouch, prefersReducedMotion, attachReveals };
})();


/* ============================
   Homepage-only effects
   Parallax, letter split, 3D card tilt
   ============================ */
(() => {
  if (document.body.dataset.page !== 'home') return;

  const { isTouch, prefersReducedMotion } = _premium;

  /* ---- Subtle parallax on hero text + photo ---- */
  if (!prefersReducedMotion) {
    const heroText = document.getElementById('heroText');
    const heroMedia = document.getElementById('heroMedia');
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (heroText) heroText.style.transform = `translateY(${y * 0.08}px)`;
      if (heroMedia) heroMedia.style.transform = `translateY(${y * -0.05}px)`;
    }, { passive: true });
  }

  /* ---- Letter-by-letter hero title split.
         Runs after content.js renders the title text from Firestore so
         we don't get our spans wiped out by a setText call. ---- */
  let titleSplit = false;
  function splitHeroTitle() {
    if (titleSplit) return;
    const lines = document.querySelectorAll('.hero--v2 .hero__title-line');
    if (!lines.length) return;
    lines.forEach((line, lineIdx) => {
      const text = line.textContent;
      line.textContent = '';
      [...text].forEach((ch, i) => {
        const span = document.createElement('span');
        span.className = 'hero__char';
        if (ch === ' ') span.setAttribute('data-space', '1');
        else span.textContent = ch;
        const base = 0.25 + lineIdx * 0.18;
        span.style.animationDelay = `${(base + i * 0.05).toFixed(2)}s`;
        line.appendChild(span);
      });
    });
    titleSplit = true;
  }
  document.addEventListener('content:rendered', splitHeroTitle);
  // Fallback if Firestore is slow/offline
  setTimeout(splitHeroTitle, 1500);

  /* ---- 3D tilt on work cards (re-attaches when cards re-render) ---- */
  if (!isTouch && !prefersReducedMotion) {
    const tilted = new WeakSet();
    function attachTilt() {
      document.querySelectorAll('.card').forEach((card) => {
        if (tilted.has(card)) return;
        tilted.add(card);
        let rafId = null;
        card.addEventListener('mousemove', (e) => {
          const rect = card.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width - 0.5;
          const y = (e.clientY - rect.top) / rect.height - 0.5;
          if (rafId) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            card.style.transform = `translateY(-8px) rotateX(${y * -5}deg) rotateY(${x * 6}deg)`;
          });
        });
        card.addEventListener('mouseleave', () => {
          if (rafId) cancelAnimationFrame(rafId);
          card.style.transform = '';
        });
      });
    }
    attachTilt();
    document.addEventListener('content:rendered', attachTilt);
  }
})();


/* ============================
   Work-pane filter (Design / Content / Video / Events)
   Pure DOM logic — wired here so the tabs work even if content.js
   (which depends on the Firebase CDN) fails to load offline / over file://.
   Guarded by data-wired so it never double-binds with content.js.
   ============================ */
(() => {
  const bar = document.getElementById('project-filters');
  if (!bar || bar.dataset.wired === 'true') return;
  bar.dataset.wired = 'true';

  const showPane = (name) => {
    document.querySelectorAll('.work-pane').forEach((pane) => {
      pane.hidden = pane.dataset.pill !== name;
    });
  };

  const setActive = (filter) => {
    let matched = false;
    bar.querySelectorAll('.project-filter').forEach((b) => {
      const active = b.dataset.filter === filter;
      if (active) matched = true;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (matched) showPane(filter);
    return matched;
  };

  const hash = (location.hash || '').replace(/^#/, '').toLowerCase();
  const allowed = { content: 'content', video: 'video', events: 'events', design: 'design' };
  if (!setActive(allowed[hash] || '')) {
    const activeBtn = bar.querySelector('.project-filter.is-active') || bar.querySelector('.project-filter');
    if (activeBtn) showPane(activeBtn.dataset.filter);
  }

  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('.project-filter');
    if (!btn) return;
    bar.querySelectorAll('.project-filter').forEach((b) => {
      const active = b === btn;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    showPane(btn.dataset.filter);
  });
})();

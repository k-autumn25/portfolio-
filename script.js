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

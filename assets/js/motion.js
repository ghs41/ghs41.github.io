(() => {
  'use strict';

  const root = document.documentElement;
  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let frameRequested = false;

  function motionAllowed() {
    return !reduceMotion.matches;
  }

  function createScrollProgress() {
    if (document.querySelector('.scroll-progress')) return;

    const progress = document.createElement('div');
    progress.className = 'scroll-progress';
    progress.setAttribute('aria-hidden', 'true');
    progress.innerHTML = '<span></span>';
    body.prepend(progress);
  }

  function createPerformanceTicker() {
    if (document.querySelector('.performance-ticker')) return;

    const anchor = document.querySelector('main > .hero, main > .page-hero');
    if (!anchor) return;

    const ticker = document.createElement('div');
    ticker.className = 'performance-ticker';
    ticker.setAttribute('aria-hidden', 'true');

    const phrases = [
      'GHS 41 PERFORMANCE GARAGE',
      'AMAN',
      'ENJOY',
      'SANTUY',
      'BOOKING VIA WHATSAPP',
      'BAYAR DI BENGKEL'
    ];
    const sequence = phrases
      .map((phrase, index) => `<span${index === 0 ? ' class="ticker-brand"' : ''}>${phrase}</span><i></i>`)
      .join('');

    ticker.innerHTML = `
      <div class="ticker-track">
        <div class="ticker-sequence">${sequence}</div>
        <div class="ticker-sequence">${sequence}</div>
      </div>`;
    anchor.insertAdjacentElement('afterend', ticker);
  }

  function createScrollCue() {
    const hero = document.querySelector('.hero');
    if (!hero || hero.querySelector('.motion-scroll-cue')) return;

    const cue = document.createElement('div');
    cue.className = 'motion-scroll-cue';
    cue.setAttribute('aria-hidden', 'true');
    cue.innerHTML = '<span>Scroll to explore</span><i></i>';
    hero.append(cue);
  }

  function assignRevealDelays(scope = document) {
    const sections = scope === document
      ? [...document.querySelectorAll('main section, footer')]
      : [scope.closest?.('section') || scope];

    sections.forEach((section) => {
      if (!section?.querySelectorAll) return;
      [...section.querySelectorAll('.reveal')].forEach((element, index) => {
        element.style.setProperty('--reveal-delay', `${Math.min(index % 6, 5) * 70}ms`);
      });
    });
  }

  function registerMotionCards(scope = document) {
    if (!finePointer.matches || !motionAllowed()) return;

    const selector = [
      '.package-card',
      '.service-console',
      '.location-panel',
      '.page-hero-visual',
      '.contact-card',
      '.value-card',
      '.principle-card',
      '.service-category',
      '.price-rail'
    ].join(',');

    scope.querySelectorAll?.(selector).forEach((card) => {
      if (card.dataset.motionBound === 'true') return;
      card.dataset.motionBound = 'true';
      card.classList.add('motion-card');

      card.addEventListener('pointermove', (event) => {
        const bounds = card.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width;
        const y = (event.clientY - bounds.top) / bounds.height;
        card.style.setProperty('--glow-x', `${(x * 100).toFixed(1)}%`);
        card.style.setProperty('--glow-y', `${(y * 100).toFixed(1)}%`);
        card.style.setProperty('--tilt-x', `${((0.5 - y) * 4).toFixed(2)}deg`);
        card.style.setProperty('--tilt-y', `${((x - 0.5) * 5).toFixed(2)}deg`);
      });

      card.addEventListener('pointerenter', () => card.classList.add('is-tilting'));
      card.addEventListener('pointerleave', () => {
        card.classList.remove('is-tilting');
        card.style.setProperty('--tilt-x', '0deg');
        card.style.setProperty('--tilt-y', '0deg');
      });
    });
  }

  function updateMotionFrame() {
    frameRequested = false;
    const maximum = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const progress = Math.min(Math.max(window.scrollY / maximum, 0), 1);
    root.style.setProperty('--scroll-progress', progress.toFixed(4));

    const header = document.querySelector('.site-header');
    header?.classList.toggle('is-scrolled', window.scrollY > 18);

    if (!motionAllowed()) return;

    const heroMedia = document.querySelector('.hero-media');
    if (heroMedia) {
      heroMedia.style.setProperty('--parallax-y', `${Math.min(window.scrollY * 0.105, 76).toFixed(1)}px`);
    }

    document.querySelectorAll('.page-hero-visual img, .booking-image img, .services-media img').forEach((image) => {
      const bounds = image.getBoundingClientRect();
      if (bounds.bottom < -120 || bounds.top > window.innerHeight + 120) return;
      const offset = ((bounds.top + bounds.height / 2) - window.innerHeight / 2) * -0.035;
      image.style.setProperty('--parallax-y', `${Math.max(-24, Math.min(24, offset)).toFixed(1)}px`);
    });
  }

  function requestMotionFrame() {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(updateMotionFrame);
  }

  function initPointerSpotlight() {
    if (!finePointer.matches || !motionAllowed()) return;

    const targets = document.querySelectorAll('.hero, .page-hero');
    targets.forEach((target) => {
      target.addEventListener('pointermove', (event) => {
        const bounds = target.getBoundingClientRect();
        target.style.setProperty('--spot-x', `${event.clientX - bounds.left}px`);
        target.style.setProperty('--spot-y', `${event.clientY - bounds.top}px`);
      });
    });
  }

  function animateFilteredCards(event) {
    if (!motionAllowed()) return;
    const filter = event.target.closest?.('.filter-btn[data-filter]');
    if (!filter) return;

    window.requestAnimationFrame(() => {
      document.querySelectorAll('#package-grid .package-card:not([hidden])').forEach((card, index) => {
        card.animate([
          { opacity: 0, transform: 'translate3d(0, 14px, 0) scale(.985)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
        ], {
          duration: 460,
          delay: Math.min(index, 8) * 55,
          easing: 'cubic-bezier(.22, .8, .22, 1)',
          fill: 'both'
        });
      });
    });
  }

  function setMotionState() {
    root.classList.toggle('motion-reduced', reduceMotion.matches);
    root.classList.toggle('motion-enabled', !reduceMotion.matches);
    if (!reduceMotion.matches) registerMotionCards();
    requestMotionFrame();
  }

  createScrollProgress();
  createPerformanceTicker();
  createScrollCue();
  assignRevealDelays();
  registerMotionCards();
  initPointerSpotlight();
  setMotionState();

  document.addEventListener('ghs41:content-rendered', (event) => {
    const scope = event.detail?.root || document;
    assignRevealDelays(scope);
    registerMotionCards(scope);
  });
  document.addEventListener('click', animateFilteredCards);
  window.addEventListener('scroll', requestMotionFrame, { passive: true });
  window.addEventListener('resize', requestMotionFrame, { passive: true });
  reduceMotion.addEventListener?.('change', setMotionState);
  finePointer.addEventListener?.('change', () => registerMotionCards());

  window.requestAnimationFrame(() => {
    root.classList.add('motion-ready');
    requestMotionFrame();
  });
})();

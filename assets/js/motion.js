(() => {
  'use strict';

  const root = document.documentElement;
  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const supportsAnimation = typeof Element.prototype.animate === 'function';
  const numberFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

  const motionCards = new Set();
  const magneticElements = new Set();
  const countedElements = new WeakSet();
  const revealElements = new WeakSet();
  const numberFrames = new Map();
  const numberOriginals = new WeakMap();
  const magneticReturnAnimations = new WeakMap();
  const revealAnimations = new WeakMap();
  const filterAnimations = new WeakMap();

  let depthImages = [];
  let sections = [];
  let frameRequested = false;
  let pointerFrameRequested = false;
  let pointerBound = false;
  let pointerTarget = null;
  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;
  let activeSection = null;

  // Touch devices use the base app's lightweight opacity reveals. Stop here
  // before binding desktop-only observers and scroll/pointer machinery: this
  // avoids long compositor/main-thread tasks on iOS Safari while retaining the
  // static performance ticker and premium visual system.
  if (!finePointer.matches) {
    const reduced = reduceMotion.matches;
    root.classList.toggle('motion-reduced', reduced);
    root.classList.toggle('motion-enabled', !reduced);
    root.classList.add('motion-lite', 'motion-ready');
    createPerformanceTicker();
    return;
  }

  function motionAllowed() {
    return !reduceMotion.matches;
  }

  function richMotionAllowed() {
    return motionAllowed() && finePointer.matches;
  }

  function interactiveMotionAllowed() {
    return richMotionAllowed();
  }

  function setStyleProperty(element, property, value) {
    if (!element || element.style.getPropertyValue(property) === value) return;
    element.style.setProperty(property, value);
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

  function refreshDepthTargets() {
    depthImages = [...document.querySelectorAll(
      '.page-hero-visual img, .booking-image img, .services-media img'
    )];
    sections = [...document.querySelectorAll('main > section')];
    sections.forEach((section, index) => {
      section.style.setProperty('--section-index', String(index + 1));
    });
  }

  function assignRevealDelays(scope = document) {
    const targetSections = scope === document
      ? [...document.querySelectorAll('main section, footer')]
      : [scope.closest?.('section') || scope];

    targetSections.forEach((section) => {
      if (!section?.querySelectorAll) return;
      [...section.querySelectorAll('.reveal')].forEach((element, index) => {
        element.style.setProperty('--reveal-delay', `${Math.min(index % 7, 6) * 64}ms`);
        element.dataset.motionOrder = String(index);
      });
    });
  }

  function revealDelay(element) {
    const order = Number(element.dataset.motionOrder || 0);
    return Math.min(Math.max(order, 0), 6) * 64;
  }

  function playHeroFrameIntro() {
    if (!richMotionAllowed() || !supportsAnimation) return;
    const frame = document.querySelector('.hero-frame');
    if (!frame || frame.dataset.motionPlayed === 'true') return;
    frame.dataset.motionPlayed = 'true';

    frame.querySelectorAll('.hero-frame-corner').forEach((corner, index) => {
      const animation = corner.animate([
        { opacity: 0, transform: 'scale(.55)' },
        { opacity: .52, transform: 'scale(1)' }
      ], {
        duration: 620,
        delay: 180 + index * 58,
        easing: 'cubic-bezier(.16, 1, .3, 1)',
        fill: 'both'
      });
      animation.finished.then(() => animation.cancel()).catch(() => {});
    });

    const rail = frame.querySelector('.hero-frame-rail');
    if (rail) {
      const animation = rail.animate([
        { opacity: 0, clipPath: 'inset(0 100% 0 0)' },
        { opacity: 1, clipPath: 'inset(0 0% 0 0)' }
      ], {
        duration: 940,
        delay: 310,
        easing: 'cubic-bezier(.16, 1, .3, 1)',
        fill: 'both'
      });
      animation.finished.then(() => animation.cancel()).catch(() => {});
    }
  }

  function playSectionCue(section) {
    if (!richMotionAllowed() || !supportsAnimation || section.dataset.motionCuePlayed === 'true') return;
    const chrome = section.querySelector(':scope > .section-chrome');
    if (!chrome) return;
    section.dataset.motionCuePlayed = 'true';

    const index = chrome.querySelector('.section-index');
    const rail = chrome.querySelector('.section-rail');
    if (index) {
      const animation = index.animate([
        { opacity: 0, transform: 'translate3d(0, 9px, 0)' },
        { opacity: 1, transform: 'translate3d(0, 0, 0)' }
      ], {
        duration: 560,
        easing: 'cubic-bezier(.16, 1, .3, 1)',
        fill: 'both'
      });
      animation.finished.then(() => animation.cancel()).catch(() => {});
    }
    if (rail) {
      const animation = rail.animate([
        { opacity: 0, clipPath: 'inset(0 100% 0 0)' },
        { opacity: 1, clipPath: 'inset(0 0% 0 0)' }
      ], {
        duration: 760,
        delay: 70,
        easing: 'cubic-bezier(.16, 1, .3, 1)',
        fill: 'both'
      });
      animation.finished.then(() => animation.cancel()).catch(() => {});
    }
  }

  function playMaskReveal(element) {
    if (!richMotionAllowed() || !supportsAnimation || element.dataset.motionRevealed === 'true') return;
    element.dataset.motionRevealed = 'true';

    revealAnimations.get(element)?.cancel();

    const isCard = element.matches('.package-card, .service-row, .contact-card, .value-card, .principle-card');
    const animation = element.animate([
      {
        opacity: 0,
        clipPath: isCard ? 'inset(0 0 12% 0 round 4px)' : 'inset(0 0 26% 0)',
        filter: 'blur(6px)'
      },
      {
        opacity: 1,
        clipPath: 'inset(0 0 0% 0)',
        filter: 'blur(0)'
      }
    ], {
      duration: isCard ? 680 : 820,
      delay: revealDelay(element),
      easing: 'cubic-bezier(.16, 1, .3, 1)',
      fill: 'both'
    });
    revealAnimations.set(element, animation);

    animation.finished
      .then(() => {
        animation.cancel();
        if (revealAnimations.get(element) === animation) revealAnimations.delete(element);
      })
      .catch(() => {});
  }

  const revealObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('visible');
          playMaskReveal(entry.target);
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -24px' })
    : null;

  function registerPremiumReveals(scope = document) {
    // The base app already provides lightweight opacity/translate reveals.
    // Avoid duplicating them with blur + clip-path WAAPI layers on touch devices,
    // where long pages can exhaust Safari's compositor memory while scrolling.
    if (!richMotionAllowed()) return;

    const candidates = [];
    if (scope instanceof Element && scope.matches('.reveal')) candidates.push(scope);
    scope.querySelectorAll?.('.reveal').forEach((element) => candidates.push(element));

    candidates.forEach((element) => {
      if (revealElements.has(element)) return;
      revealElements.add(element);
      if (!motionAllowed() || !revealObserver) {
        element.classList.add('visible');
        return;
      }
      revealObserver.observe(element);
    });
  }

  function scheduleCardPointerFrame(card, event) {
    card._motionPointerX = event.clientX;
    card._motionPointerY = event.clientY;
    if (card._motionPointerFrame) return;

    card._motionPointerFrame = window.requestAnimationFrame(() => {
      card._motionPointerFrame = 0;
      if (!interactiveMotionAllowed() || !card.isConnected) return;

      const bounds = card.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const x = Math.min(Math.max((card._motionPointerX - bounds.left) / bounds.width, 0), 1);
      const y = Math.min(Math.max((card._motionPointerY - bounds.top) / bounds.height, 0), 1);
      card.style.setProperty('--glow-x', `${(x * 100).toFixed(1)}%`);
      card.style.setProperty('--glow-y', `${(y * 100).toFixed(1)}%`);
      card.style.setProperty('--tilt-x', `${((0.5 - y) * 3.2).toFixed(2)}deg`);
      card.style.setProperty('--tilt-y', `${((x - 0.5) * 4).toFixed(2)}deg`);
      card.style.setProperty('--card-depth', `${(Math.hypot(x - 0.5, y - 0.5) * 2).toFixed(3)}`);
    });
  }

  function resetMotionCard(card) {
    if (card._motionPointerFrame) {
      window.cancelAnimationFrame(card._motionPointerFrame);
      card._motionPointerFrame = 0;
    }
    card.classList.remove('is-tilting');
    card.style.setProperty('--tilt-x', '0deg');
    card.style.setProperty('--tilt-y', '0deg');
    card.style.setProperty('--card-depth', '0');
  }

  function registerMotionCards(scope = document) {
    if (!finePointer.matches) return;

    const selector = [
      '.package-card',
      '.service-console',
      '.location-panel',
      '.page-hero-visual',
      '.contact-card',
      '.value-card',
      '.principle-card',
      '.service-category',
      '.price-rail',
      '.catalog-option-card',
      '.catalog-modification-card'
    ].join(',');

    scope.querySelectorAll?.(selector).forEach((card) => {
      if (card.dataset.motionBound === 'true') return;
      card.dataset.motionBound = 'true';
      card.classList.add('motion-card');
      motionCards.add(card);

      card.addEventListener('pointermove', (event) => {
        if (!interactiveMotionAllowed()) return;
        scheduleCardPointerFrame(card, event);
      }, { passive: true });
      card.addEventListener('pointerenter', () => {
        if (interactiveMotionAllowed()) card.classList.add('is-tilting');
      }, { passive: true });
      card.addEventListener('pointerleave', () => resetMotionCard(card), { passive: true });
    });
  }

  function magneticStrength(element) {
    if (element.matches('.nav-cta')) return 5;
    if (element.matches('.choose-package, .filter-btn')) return 3.5;
    return 6;
  }

  function registerMagneticElements(scope = document) {
    if (!finePointer.matches) return;

    const selector = '.btn, .nav-cta, .choose-package, .hero-utility a, .section-bridge a';
    scope.querySelectorAll?.(selector).forEach((element) => {
      if (element.dataset.magneticBound === 'true') return;
      element.dataset.magneticBound = 'true';
      element.classList.add('motion-magnetic');
      magneticElements.add(element);

      element.addEventListener('pointermove', (event) => {
        if (!interactiveMotionAllowed()) return;
        magneticReturnAnimations.get(element)?.cancel();
        element._magneticPointerX = event.clientX;
        element._magneticPointerY = event.clientY;
        if (element._magneticFrame) return;
        element._magneticFrame = window.requestAnimationFrame(() => {
          element._magneticFrame = 0;
          if (!interactiveMotionAllowed() || !element.isConnected) return;
          const bounds = element.getBoundingClientRect();
          if (!bounds.width || !bounds.height) return;
          const strength = magneticStrength(element);
          const x = ((element._magneticPointerX - bounds.left) / bounds.width - 0.5) * strength * 2;
          const y = ((element._magneticPointerY - bounds.top) / bounds.height - 0.5) * strength * 1.45;
          element.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
        });
      }, { passive: true });

      element.addEventListener('pointerleave', () => {
        if (element._magneticFrame) {
          window.cancelAnimationFrame(element._magneticFrame);
          element._magneticFrame = 0;
        }
        const current = element.style.translate || '0px 0px';
        if (!supportsAnimation || !motionAllowed()) {
          element.style.removeProperty('translate');
          return;
        }
        const animation = element.animate([
          { translate: current },
          { translate: '0px 0px' }
        ], {
          duration: 420,
          easing: 'cubic-bezier(.16, 1, .3, 1)'
        });
        magneticReturnAnimations.set(element, animation);
        element.style.removeProperty('translate');
        animation.finished.catch(() => {});
      }, { passive: true });
    });
  }

  function parseCountableText(element) {
    const original = element.textContent.trim();
    if (!original || original.length > 32) return null;
    const match = original.match(/^(.*?)(\d[\d.]*)([^\d]*)$/u);
    if (!match) return null;
    const target = Number(match[2].replace(/\./g, ''));
    if (!Number.isFinite(target) || target <= 0 || target > 999999999) return null;
    return {
      original,
      prefix: match[1],
      suffix: match[3],
      target,
      grouped: match[2].includes('.')
    };
  }

  function formatCount(value, grouped) {
    return grouped ? numberFormatter.format(value) : String(value);
  }

  function countNumber(element) {
    if (!richMotionAllowed() || countedElements.has(element)) return;
    const parsed = parseCountableText(element);
    if (!parsed) return;

    countedElements.add(element);
    element.classList.add('motion-counting');
    const hadAriaLabel = element.hasAttribute('aria-label');
    numberOriginals.set(element, { text: parsed.original, hadAriaLabel });
    if (!hadAriaLabel) element.setAttribute('aria-label', parsed.original);

    const startValue = Math.max(0, Math.round(parsed.target * 0.78));
    const duration = Math.min(880, 560 + String(parsed.target).length * 42);
    const startTime = performance.now();

    const step = (time) => {
      if (!richMotionAllowed() || !element.isConnected) {
        element.textContent = parsed.original;
        element.classList.remove('motion-counting');
        if (!hadAriaLabel) element.removeAttribute('aria-label');
        numberOriginals.delete(element);
        numberFrames.delete(element);
        return;
      }

      const elapsed = Math.min(Math.max((time - startTime) / duration, 0), 1);
      const eased = 1 - Math.pow(1 - elapsed, 4);
      const value = Math.round(startValue + (parsed.target - startValue) * eased);
      element.textContent = `${parsed.prefix}${formatCount(value, parsed.grouped)}${parsed.suffix}`;

      if (elapsed < 1) {
        numberFrames.set(element, window.requestAnimationFrame(step));
        return;
      }

      element.textContent = parsed.original;
      element.classList.remove('motion-counting');
      element.classList.add('motion-counted');
      if (!hadAriaLabel) element.removeAttribute('aria-label');
      numberOriginals.delete(element);
      numberFrames.delete(element);
    };

    numberFrames.set(element, window.requestAnimationFrame(step));
  }

  const numberObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          countNumber(entry.target);
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.52, rootMargin: '0px 0px -8%' })
    : null;

  function registerCountableNumbers(scope = document) {
    if (!richMotionAllowed()) return;

    // Never tween prices: transient values can look like a real, incorrect quote.
    // Count-up motion is reserved for decorative, non-transactional figures.
    const selector = '[data-motion-count]';

    scope.querySelectorAll?.(selector).forEach((element) => {
      if (element.dataset.countBound === 'true' || !parseCountableText(element)) return;
      if (!motionAllowed() || !numberObserver) return;
      element.dataset.countBound = 'true';
      numberObserver.observe(element);
    });
  }

  function updatePointerFrame() {
    pointerFrameRequested = false;
    if (!interactiveMotionAllowed()) return;

    const target = pointerTarget?.isConnected ? pointerTarget : null;
    const bounds = target?.getBoundingClientRect();

    setStyleProperty(root, '--pointer-x', `${pointerX.toFixed(1)}px`);
    setStyleProperty(root, '--pointer-y', `${pointerY.toFixed(1)}px`);
    setStyleProperty(root, '--pointer-x-ratio', (pointerX / Math.max(window.innerWidth, 1)).toFixed(4));
    setStyleProperty(root, '--pointer-y-ratio', (pointerY / Math.max(window.innerHeight, 1)).toFixed(4));

    if (!target || !bounds) return;
    setStyleProperty(target, '--spot-x', `${(pointerX - bounds.left).toFixed(1)}px`);
    setStyleProperty(target, '--spot-y', `${(pointerY - bounds.top).toFixed(1)}px`);
  }

  function requestPointerFrame() {
    if (pointerFrameRequested) return;
    pointerFrameRequested = true;
    window.requestAnimationFrame(updatePointerFrame);
  }

  function initPointerSpotlight() {
    if (pointerBound) return;
    pointerBound = true;
    document.addEventListener('pointermove', (event) => {
      if (!interactiveMotionAllowed()) return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      pointerTarget = event.target instanceof Element
        ? event.target.closest('.hero, .page-hero, .packages-section, .services-section')
        : null;
      requestPointerFrame();
    }, { passive: true });
  }

  function measureSectionProgress(viewportHeight) {
    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    const measurements = [];

    sections.forEach((section, index) => {
      if (!section.isConnected) return;
      const bounds = section.getBoundingClientRect();
      const withinRange = bounds.bottom > -viewportHeight * 0.3 && bounds.top < viewportHeight * 1.3;
      if (!withinRange) return;

      const progress = Math.min(Math.max((viewportHeight - bounds.top) / (viewportHeight + bounds.height), 0), 1);
      const center = bounds.top + bounds.height / 2;
      const depth = Math.min(Math.max((center - viewportHeight / 2) / viewportHeight, -1), 1);
      measurements.push({
        section,
        progress: progress.toFixed(4),
        depth: depth.toFixed(4)
      });

      const distance = Math.abs(center - viewportHeight / 2);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { section, index };
      }
    });

    return { measurements, nearest };
  }

  function applySectionProgress({ measurements, nearest }) {
    measurements.forEach(({ section, progress, depth }) => {
      setStyleProperty(section, '--section-progress', progress);
      setStyleProperty(section, '--section-depth', depth);
    });

    if (!nearest || nearest.section === activeSection) return;
    activeSection?.classList.remove('motion-section-active');
    activeSection = nearest.section;
    activeSection.classList.add('motion-section-active');
    playSectionCue(activeSection);
    setStyleProperty(root, '--active-section', String(nearest.index + 1));
    root.dataset.activeMotionSection = activeSection.dataset.motionSection || String(nearest.index + 1);
  }

  function resetSectionMotion() {
    sections.forEach((section) => {
      section.style.removeProperty('--section-progress');
      section.style.removeProperty('--section-depth');
      section.classList.remove('motion-section-active');
    });
    activeSection = null;
    root.style.removeProperty('--active-section');
    delete root.dataset.activeMotionSection;
  }

  function updateMotionFrame() {
    frameRequested = false;
    const viewportHeight = Math.max(window.innerHeight, 1);
    const maximum = Math.max(document.documentElement.scrollHeight - viewportHeight, 1);
    const progress = Math.min(Math.max(window.scrollY / maximum, 0), 1);
    const interactive = interactiveMotionAllowed();
    const header = document.querySelector('.site-header');
    const heroMedia = interactive ? document.querySelector('.hero-media') : null;
    const sectionState = interactive ? measureSectionProgress(viewportHeight) : null;
    const imageStates = interactive
      ? depthImages.flatMap((image) => {
          if (!image.isConnected) return [];
          const bounds = image.getBoundingClientRect();
          if (bounds.bottom < -120 || bounds.top > viewportHeight + 120) return [];
          const offset = ((bounds.top + bounds.height / 2) - viewportHeight / 2) * -0.032;
          return [{ image, value: `${Math.max(-22, Math.min(22, offset)).toFixed(1)}px` }];
        })
      : [];

    setStyleProperty(root, '--scroll-progress', progress.toFixed(4));
    setStyleProperty(root, '--viewport-progress', progress.toFixed(4));
    header?.classList.toggle('is-scrolled', window.scrollY > 18);
    if (sectionState) applySectionProgress(sectionState);

    if (!interactive) return;

    if (heroMedia) {
      setStyleProperty(heroMedia, '--parallax-y', `${Math.min(window.scrollY * 0.088, 68).toFixed(1)}px`);
    }

    imageStates.forEach(({ image, value }) => {
      setStyleProperty(image, '--parallax-y', value);
    });
  }

  function requestMotionFrame() {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(updateMotionFrame);
  }

  function animateFilteredCards(event) {
    if (!richMotionAllowed() || !supportsAnimation) return;
    const filter = event.target.closest?.('.filter-btn[data-filter]');
    if (!filter) return;

    window.requestAnimationFrame(() => {
      document.querySelectorAll('#package-grid .package-card:not([hidden])').forEach((card, index) => {
        revealObserver?.unobserve(card);
        card.classList.add('visible');
        card.dataset.motionRevealed = 'true';
        revealAnimations.get(card)?.cancel();
        filterAnimations.get(card)?.cancel();

        const animation = card.animate([
          { opacity: .35, transform: 'translateY(10px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], {
          duration: 360,
          easing: 'cubic-bezier(.16, 1, .3, 1)',
          fill: 'both'
        });
        filterAnimations.set(card, animation);
        animation.finished.then(() => {
          animation.cancel();
          if (filterAnimations.get(card) === animation) filterAnimations.delete(card);
        }).catch(() => {});
      });
    });
  }

  function resetInteractiveMotion() {
    motionCards.forEach(resetMotionCard);
    magneticElements.forEach((element) => {
      if (element._magneticFrame) {
        window.cancelAnimationFrame(element._magneticFrame);
        element._magneticFrame = 0;
      }
      magneticReturnAnimations.get(element)?.cancel();
      element.style.removeProperty('translate');
    });
  }

  function restoreCountingNumbers() {
    numberFrames.forEach((frame, element) => {
      window.cancelAnimationFrame(frame);
      const original = numberOriginals.get(element);
      if (original) {
        element.textContent = original.text;
        if (!original.hadAriaLabel) element.removeAttribute('aria-label');
      }
      element.classList.remove('motion-counting');
      numberOriginals.delete(element);
    });
    numberFrames.clear();
  }

  function setMotionState() {
    const reduced = reduceMotion.matches;
    const lightweight = !reduced && !finePointer.matches;
    root.classList.toggle('motion-reduced', reduced);
    root.classList.toggle('motion-enabled', !reduced);
    root.classList.toggle('motion-lite', lightweight);

    if (reduced || lightweight) {
      resetInteractiveMotion();
      resetSectionMotion();
      restoreCountingNumbers();
      if (reduced) {
        document.querySelectorAll('.reveal').forEach((element) => element.classList.add('visible'));
      }
    }

    if (!reduced) {
      registerMotionCards();
      registerMagneticElements();
      registerPremiumReveals();
      registerCountableNumbers();
    }
    requestMotionFrame();
  }

  function registerDynamicMotion(scope = document) {
    assignRevealDelays(scope);
    registerPremiumReveals(scope);
    registerMotionCards(scope);
    registerMagneticElements(scope);
    registerCountableNumbers(scope);
    refreshDepthTargets();
    requestMotionFrame();
  }

  createScrollProgress();
  createPerformanceTicker();
  createScrollCue();
  refreshDepthTargets();
  registerDynamicMotion();
  initPointerSpotlight();
  setMotionState();

  document.addEventListener('ghs41:content-rendered', (event) => {
    registerDynamicMotion(event.detail?.root || document);
  });
  document.addEventListener('ghs41:catalog-ready', () => registerDynamicMotion(document));
  document.addEventListener('click', animateFilteredCards);
  window.addEventListener('scroll', requestMotionFrame, { passive: true });
  window.addEventListener('resize', () => {
    refreshDepthTargets();
    requestPointerFrame();
    requestMotionFrame();
  }, { passive: true });
  reduceMotion.addEventListener?.('change', setMotionState);
  finePointer.addEventListener?.('change', setMotionState);

  window.requestAnimationFrame(() => {
    root.classList.add('motion-ready');
    playHeroFrameIntro();
    requestMotionFrame();
  });
})();

(() => {
  'use strict';

  const CONFIG = Object.freeze({
    workshopName: 'GHS 41',
    whatsappNumber: '6281395546714',
    area: 'Jalan Raya Cijerah, Cibuntu, Bandung Kulon, Kota Bandung, Jawa Barat 40213',
    mapsUrl: 'https://www.google.com/maps/place/GHS41/@-6.917235,107.5681643,17z/data=!3m1!4b1!4m6!3m5!1s0x2e68e57f4f86bb5b:0x88898e3045abe7a5!8m2!3d-6.917235!4d107.5707392!16s%2Fg%2F11jnsh2x7j?hl=id&entry=ttu&g_ep=EgoyMDI2MDcyOS4wIKXMDSoASAFQAw%3D%3D',
    currency: 'IDR'
  });

  const root = document.documentElement;
  const body = document.body;
  const app = window.GHS41 || {};
  let toastTimer = 0;

  function formatRupiah(amount) {
    const value = Number(amount);
    if (!Number.isFinite(value)) return 'Rp0';

    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: CONFIG.currency,
      maximumFractionDigits: 0
    }).format(value);
  }

  function showToast(message, duration = 3200) {
    if (!message || !body) return;

    let toast = document.querySelector('#toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      body.append(toast);
    }

    toast.textContent = String(message);
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), duration);
  }

  Object.assign(app, { config: CONFIG, formatRupiah, showToast });
  window.GHS41 = app;

  function initNavigation() {
    const toggle = document.querySelector('.nav-toggle');
    if (!toggle) return;

    const controlledId = toggle.getAttribute('aria-controls');
    const navigation = controlledId
      ? document.getElementById(controlledId)
      : document.querySelector('.main-nav');

    if (!navigation) return;

    function setNavigation(open, { restoreFocus = false } = {}) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Tutup menu navigasi' : 'Buka menu navigasi');
      navigation.classList.toggle('open', open);
      body?.classList.toggle('nav-open', open);

      if (restoreFocus) toggle.focus();
    }

    setNavigation(false);

    toggle.addEventListener('click', () => {
      setNavigation(toggle.getAttribute('aria-expanded') !== 'true');
    });

    navigation.addEventListener('click', (event) => {
      if (event.target.closest('a')) setNavigation(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setNavigation(false, { restoreFocus: true });
      }
    });

    const desktopQuery = window.matchMedia('(min-width: 921px)');
    const closeOnDesktop = (event) => {
      if (event.matches) setNavigation(false);
    };

    if (typeof desktopQuery.addEventListener === 'function') {
      desktopQuery.addEventListener('change', closeOnDesktop);
    } else if (typeof desktopQuery.addListener === 'function') {
      desktopQuery.addListener(closeOnDesktop);
    }
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const observedReveals = new WeakSet();
  const revealObserver = !prefersReducedMotion && 'IntersectionObserver' in window
    ? new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.09, rootMargin: '0px 0px -25px' })
    : null;

  function observeReveals(scope = document) {
    const elements = [];

    if (scope instanceof Element && scope.matches('.reveal')) elements.push(scope);
    if (typeof scope.querySelectorAll === 'function') {
      elements.push(...scope.querySelectorAll('.reveal'));
    }

    elements.forEach((element) => {
      if (observedReveals.has(element)) return;
      observedReveals.add(element);

      if (revealObserver) revealObserver.observe(element);
      else element.classList.add('visible');
    });
  }

  app.observeReveals = observeReveals;

  function initYear() {
    const currentYear = String(new Date().getFullYear());
    document.querySelectorAll('#current-year, [data-current-year]').forEach((element) => {
      element.textContent = currentYear;
    });
  }

  function whatsappUrl(message) {
    const number = CONFIG.whatsappNumber.replace(/\D/g, '');
    const path = number ? `https://wa.me/${number}` : 'https://wa.me/';
    return `${path}?text=${encodeURIComponent(message)}`;
  }

  function initWhatsappLinks() {
    document.querySelectorAll('[data-ghs41-map]').forEach((mapLink) => {
      if (!(mapLink instanceof HTMLAnchorElement)) return;
      mapLink.href = CONFIG.mapsUrl;
      mapLink.target = '_blank';
      mapLink.rel = 'noopener noreferrer';
    });

    const locationLink = document.querySelector('#location-whatsapp');
    if (locationLink) {
      locationLink.href = whatsappUrl(
        `Halo ${CONFIG.workshopName}, saya ingin menanyakan lokasi bengkel dan jadwal servis.`
      );
      locationLink.target = '_blank';
      locationLink.rel = 'noopener noreferrer';
      locationLink.setAttribute('aria-label', 'Tanyakan lokasi GHS 41 melalui WhatsApp (terbuka di tab baru)');
    }

    const floatingBooking = document.querySelector('#floating-wa');
    if (!floatingBooking) return;

    const bookingSection = document.querySelector('#booking')
      || document.querySelector('#booking-form')?.closest('.booking-section, section');
    if (!bookingSection) {
      floatingBooking.href = whatsappUrl(
        `Halo ${CONFIG.workshopName}, saya ingin booking servis motor. Mohon informasi jadwal yang tersedia.`
      );
      floatingBooking.target = '_blank';
      floatingBooking.rel = 'noopener noreferrer';
      floatingBooking.setAttribute('aria-label', 'Booking servis melalui WhatsApp (terbuka di tab baru)');
      return;
    }

    floatingBooking.href = '#booking';
    floatingBooking.addEventListener('click', (event) => {
      event.preventDefault();
      bookingSection.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    });
  }

  function initServiceWorker() {
    const canRegister = 'serviceWorker' in navigator
      && (window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      && /^https?:$/.test(location.protocol);

    if (!canRegister) return;

    window.addEventListener('load', () => {
      const serviceWorkerUrl = new URL('sw.js', document.baseURI);
      navigator.serviceWorker.register(serviceWorkerUrl.href).catch((error) => {
        console.warn('Service worker GHS 41 tidak dapat didaftarkan.', error);
      });
    }, { once: true });
  }

  initNavigation();
  initYear();
  initWhatsappLinks();
  observeReveals();
  initServiceWorker();

  document.addEventListener('ghs41:content-rendered', (event) => {
    observeReveals(event.detail?.root || document);
  });

  root.classList.add('app-ready');
})();

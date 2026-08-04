(() => {
  'use strict';

  const scriptUrl = document.currentScript?.src;
  const dataBaseUrl = scriptUrl
    ? new URL('../../data/', scriptUrl)
    : new URL('data/', document.baseURI);
  const packageGrid = document.querySelector('#package-grid');
  const serviceList = document.querySelector('#service-list');
  const catalogDetails = Object.freeze({
    priceValidity: document.querySelector('#catalog-price-validity'),
    oilUpgrades: document.querySelector('#oil-upgrade-list'),
    oilNotes: document.querySelector('#oil-upgrade-notes'),
    sparkAddons: document.querySelector('#spark-addon-list'),
    sparkNote: document.querySelector('#spark-addon-note'),
    terms: document.querySelector('#package-terms-list'),
    modificationRegular: document.querySelector('#modification-regular-note'),
    modifications: document.querySelector('#modification-guidance'),
    excludedParts: document.querySelector('#excluded-parts-list'),
    customerNotice: document.querySelector('#catalog-customer-notice')
  });
  const catalog = window.GHS41Catalog || {};
  const fallbackPackages = readPackageFallback();
  const fallbackServices = readServiceFallback();
  let packages = freezeList(fallbackPackages);
  let services = freezeList(fallbackServices);
  let oilTiers = Object.freeze([]);
  let oilPremiumUpgrades = Object.freeze([]);
  let sparkPlugAddons = Object.freeze([]);
  let terms = Object.freeze([]);
  let excludedParts = Object.freeze([]);
  let durationPolicy = '';
  let priceValidity = '';
  let priceLabel = '';
  let customerNotice = '';
  let modificationGuidance = Object.freeze({});
  let oilUpgradeNotes = Object.freeze([]);
  let sparkPlugNote = '';
  let activeFilter = getInitialFilter();

  function cleanString(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function freezeList(items) {
    return Object.freeze(items.map((item) => Object.freeze({
      ...item,
      ...(item.categories ? { categories: Object.freeze([...item.categories]) } : {}),
      ...(item.includes ? { includes: Object.freeze([...item.includes]) } : {}),
      ...(item.examples ? { examples: Object.freeze([...item.examples]) } : {}),
      ...(item.notes ? { notes: Object.freeze([...item.notes]) } : {}),
      ...(item.prices ? { prices: Object.freeze({ ...item.prices }) } : {})
    })));
  }

  function ensureUniqueIds(items, label) {
    const ids = new Set();
    items.forEach((item) => {
      if (ids.has(item.id)) throw new TypeError(`ID ${label} "${item.id}" digunakan lebih dari sekali.`);
      ids.add(item.id);
    });
    return items;
  }

  function normalisePackage(item, index, defaultDuration = '') {
    if (!item || typeof item !== 'object') {
      throw new TypeError(`Paket ke-${index + 1} bukan objek yang valid.`);
    }

    const id = cleanString(item.id);
    const name = cleanString(item.name);
    const title = cleanString(item.title) || name;
    const type = cleanString(item.type);
    const capacity = cleanString(item.capacity);
    const standardPrice = Number(item.prices?.standard);
    const premiumPrice = Number(item.prices?.premium);
    const categories = Array.isArray(item.categories)
      ? [...new Set(item.categories.map((value) => cleanString(value).toLowerCase()).filter(Boolean))]
      : [];
    const includes = Array.isArray(item.includes)
      ? item.includes.map(cleanString).filter(Boolean)
      : [];
    const notes = Array.isArray(item.notes) ? item.notes.map(cleanString).filter(Boolean) : [];
    const examples = Array.isArray(item.examples) ? item.examples.map(cleanString).filter(Boolean) : [];

    if (!id || !name || !type || !capacity) {
      throw new TypeError(`Data utama paket ke-${index + 1} tidak lengkap.`);
    }
    if (!Number.isFinite(standardPrice) || standardPrice < 0 || !Number.isFinite(premiumPrice) || premiumPrice < 0) {
      throw new TypeError(`Harga Standard/Premium paket "${name}" tidak valid.`);
    }
    if (!categories.length || !includes.length) {
      throw new TypeError(`Kategori atau rincian paket "${name}" tidak lengkap.`);
    }

    return {
      id,
      categories,
      type,
      title,
      name,
      capacity,
      customerType: cleanString(item.customerType),
      transmission: cleanString(item.transmission),
      prices: { standard: standardPrice, premium: premiumPrice },
      price: standardPrice,
      startingFrom: Boolean(item.startingFrom),
      warrantyDays: Number(item.warrantyDays) || 0,
      duration: cleanString(item.duration) || defaultDuration,
      eligibility: cleanString(item.eligibility),
      examples,
      notes,
      includes
    };
  }

  function normaliseService(item, index) {
    if (!item || typeof item !== 'object') {
      throw new TypeError(`Layanan ke-${index + 1} bukan objek yang valid.`);
    }

    const id = cleanString(item.id);
    const name = cleanString(item.name);
    const description = cleanString(item.description);
    const price = Number(item.price);

    if (!id || !name || !description || !Number.isFinite(price) || price < 0) {
      throw new TypeError(`Data layanan ke-${index + 1} tidak lengkap.`);
    }

    return {
      id,
      group: cleanString(item.group) || 'Layanan Bengkel',
      kind: cleanString(item.kind) || 'service',
      name,
      description,
      price,
      startingFrom: Boolean(item.startingFrom),
      bookable: item.bookable !== false
    };
  }

  function normaliseOilTier(item, index) {
    const id = cleanString(item?.id).toLowerCase();
    const label = cleanString(item?.label);
    if (!id || !label) throw new TypeError(`Tier oli ke-${index + 1} tidak valid.`);
    return Object.freeze({ id, label });
  }

  function normaliseAddon(item, index) {
    const id = cleanString(item?.id).toLowerCase();
    const label = cleanString(item?.label);
    const price = Number(item?.price);
    if (!id || !label || !Number.isFinite(price) || price < 0) {
      throw new TypeError(`Add-on busi ke-${index + 1} tidak valid.`);
    }
    return Object.freeze({ id, label, price });
  }

  async function fetchJson(fileName, label) {
    const response = await fetch(new URL(fileName, dataBaseUrl).href, {
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`${label} gagal dimuat (${response.status}).`);
    return response.json();
  }

  async function fetchPackageCatalog() {
    const payload = await fetchJson('packages.json', 'Katalog paket');
    if (!payload || !Array.isArray(payload.packages) || !payload.packages.length) {
      throw new TypeError('packages.json harus memiliki array packages yang tidak kosong.');
    }

    const loadedDurationPolicy = cleanString(payload.durationPolicy);
    const loadedPriceValidity = cleanString(payload.priceValidity);
    const includeSets = payload.includeSets && typeof payload.includeSets === 'object' ? payload.includeSets : {};
    const loadedPackages = ensureUniqueIds(
      payload.packages.map((item, index) => normalisePackage({
        ...item,
        includes: Array.isArray(item.includes) ? item.includes : includeSets[cleanString(item.includeSet)]
      }, index, loadedDurationPolicy)),
      'paket'
    );
    const loadedTiers = ensureUniqueIds((payload.oilTiers || []).map(normaliseOilTier), 'tier oli');
    const loadedAddons = ensureUniqueIds((payload.sparkPlugAddons || []).map(normaliseAddon), 'add-on busi');
    const loadedOilUpgrades = ensureUniqueIds((payload.oilPremiumUpgrades || []).map(normaliseAddon), 'upgrade oli premium');

    if (!loadedTiers.some((item) => item.id === 'standard') || !loadedTiers.some((item) => item.id === 'premium')) {
      throw new TypeError('Tier oli Standard dan Premium wajib tersedia.');
    }

    return {
      items: freezeList(loadedPackages),
      oilTiers: Object.freeze(loadedTiers),
      oilPremiumUpgrades: Object.freeze(loadedOilUpgrades),
      sparkPlugAddons: Object.freeze(loadedAddons),
      terms: Object.freeze((payload.terms || []).map(cleanString).filter(Boolean)),
      excludedParts: Object.freeze((payload.excludedParts || []).map(cleanString).filter(Boolean)),
      durationPolicy: loadedDurationPolicy,
      priceValidity: loadedPriceValidity,
      priceLabel: cleanString(payload.priceLabel),
      customerNotice: cleanString(payload.customerNotice),
      modificationGuidance: Object.freeze(payload.modificationGuidance && typeof payload.modificationGuidance === 'object' ? payload.modificationGuidance : {}),
      oilUpgradeNotes: Object.freeze((payload.oilUpgradeNotes || []).map(cleanString).filter(Boolean)),
      sparkPlugNote: cleanString(payload.sparkPlugNote)
    };
  }

  async function fetchServiceCatalog() {
    const payload = await fetchJson('services.json', 'Katalog layanan');
    if (!payload || !Array.isArray(payload.services) || !payload.services.length) {
      throw new TypeError('services.json harus memiliki array services yang tidak kosong.');
    }
    return freezeList(ensureUniqueIds(payload.services.map(normaliseService), 'layanan'));
  }

  function readPackageFallback() {
    if (!packageGrid) return [];

    return [...packageGrid.querySelectorAll('.package-card[data-standard-price][data-premium-price]')]
      .map((card, index) => {
        const title = cleanString(card.querySelector('.package-heading h3, h3')?.textContent);
        const standard = Number(card.dataset.standardPrice);
        const premium = Number(card.dataset.premiumPrice);
        return {
          id: cleanString(card.dataset.id) || `package-${index + 1}`,
          categories: cleanString(card.dataset.categories).split(/\s+/).filter(Boolean),
          type: cleanString(card.querySelector('.package-heading p, .package-type')?.textContent) || 'Paket Full Service',
          title,
          name: cleanString(card.dataset.name) || title,
          capacity: cleanString(card.querySelector('.package-heading span, .package-cc')?.textContent),
          prices: { standard, premium },
          price: standard,
          startingFrom: card.dataset.startingFrom === 'true',
          warrantyDays: 0,
          duration: cleanString(card.querySelector('.package-duration')?.textContent),
          eligibility: '',
          examples: [],
          notes: [],
          includes: [...card.querySelectorAll('li')].map((item) => cleanString(item.textContent)).filter(Boolean)
        };
      })
      .filter((item) => item.id && item.name && Number.isFinite(item.prices.standard) && Number.isFinite(item.prices.premium));
  }

  function readServiceFallback() {
    if (!serviceList) return [];
    return [...serviceList.querySelectorAll('.service-row')].map((row, index) => ({
      id: cleanString(row.dataset.id) || `service-${index + 1}`,
      group: cleanString(row.dataset.group) || 'Layanan Bengkel',
      kind: cleanString(row.dataset.kind) || 'service',
      name: cleanString(row.dataset.name) || cleanString(row.querySelector('h3')?.textContent),
      description: cleanString(row.querySelector('p')?.textContent),
      price: Number(row.dataset.price) || 0,
      startingFrom: row.dataset.startingFrom === 'true',
      bookable: row.dataset.bookable !== 'false'
    })).filter((item) => item.id && item.name);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  function displayPrice(price, startingFrom = false) {
    return `${startingFrom ? 'Mulai ' : ''}Rp${Number(price).toLocaleString('id-ID')}`;
  }

  function packageIcon(item) {
    if (item.categories.includes('sport') || item.categories.includes('manual')) {
      return '<path d="M7 31h8l5-9 9 2 5 7h7M14 31a5 5 0 1 0 0 .1M37 31a5 5 0 1 0 0 .1M19 22l-5-5h7l6 7M30 19h7"/>';
    }
    return '<path d="M8 31h8l5-8h13l5 8h3M15 31a5 5 0 1 0 0 .1M37 31a5 5 0 1 0 0 .1M20 15h8l3 8M13 18h7M17 18l-3 7"/>';
  }

  function packageTemplate(item) {
    const visibleDetails = item.includes.slice(0, 6);
    const remaining = item.includes.length - visibleDetails.length;
    const details = visibleDetails.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('');
    const duration = item.duration
      ? `<div class="package-terms package-duration"><p><strong>Estimasi durasi:</strong> ${escapeHtml(item.duration)}</p></div>`
      : '';

    return `
      <article class="package-card reveal"
        data-id="${escapeHtml(item.id)}"
        data-categories="${escapeHtml(item.categories.join(' '))}"
        data-name="${escapeHtml(item.name)}"
        data-standard-price="${item.prices.standard}"
        data-premium-price="${item.prices.premium}"
        data-starting-from="${item.startingFrom}">
        <div class="package-heading">
          <svg class="package-icon" viewBox="0 0 48 48" aria-hidden="true">${packageIcon(item)}</svg>
          <div><p>${escapeHtml(item.type)}</p><h3>${escapeHtml(item.title)}</h3><span>${escapeHtml(item.capacity)}</span></div>
        </div>
        <ul>${details}${remaining > 0 ? `<li class="package-more">+ ${remaining} rincian layanan lainnya</li>` : ''}</ul>
        <details class="package-details" data-package-id="${escapeHtml(item.id)}">
          <summary>Rincian lengkap paket</summary>
        </details>
        ${duration}
        <div class="package-tier-prices" role="group" aria-label="Pilihan harga berdasarkan jenis oli">
          <span class="tier-price" data-tier="standard"><small>Gulf Standard</small><strong>${displayPrice(item.prices.standard, item.startingFrom)}</strong></span>
          <span class="tier-price" data-tier="premium"><small>Gulf Premium</small><strong>${displayPrice(item.prices.premium, item.startingFrom)}</strong></span>
        </div>
        <div class="package-footer">
          <span>Garansi jasa ${item.warrantyDays} hari</span>
          <button class="choose-package" type="button" data-id="${escapeHtml(item.id)}">
            Pilih Paket
            <span class="arrow-icon" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M4 10h11M11 6l4 4-4 4"/></svg></span>
          </button>
        </div>
      </article>`;
  }

  function populatePackageDetails(details) {
    if (!(details instanceof HTMLDetailsElement) || details.dataset.detailsReady === 'true') return;
    const item = packages.find((entry) => entry.id === details.dataset.packageId);
    if (!item) return;

    const examples = item.examples.length
      ? `<div class="package-terms"><p><strong>Contoh motor:</strong> ${escapeHtml(item.examples.join(', '))}</p></div>`
      : '';
    const completeDetails = item.includes.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('');
    const note = [...item.notes, item.eligibility]
      .filter(Boolean)
      .map((text) => `<p>${escapeHtml(text)}</p>`)
      .join('');

    details.insertAdjacentHTML('beforeend', `${examples}<ul>${completeDetails}</ul><div class="package-terms">${note}</div>`);
    details.dataset.detailsReady = 'true';
  }

  function serviceTemplate(item, index) {
    return `
      <article class="service-row reveal"
        data-id="${escapeHtml(item.id)}"
        data-group="${escapeHtml(item.group)}"
        data-kind="${escapeHtml(item.kind)}"
        data-name="${escapeHtml(item.name)}"
        data-price="${item.price}"
        data-starting-from="${item.startingFrom}"
        data-bookable="${item.bookable}">
        <span class="service-no">${String(index + 1).padStart(2, '0')}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <p><span class="service-group">${escapeHtml(item.group)}</span> · ${escapeHtml(item.description)}</p>
        <strong>${displayPrice(item.price, item.startingFrom)}</strong>
      </article>`;
  }

  function catalogOptionTemplate(item) {
    return `
      <article class="catalog-option-card">
        <span>${escapeHtml(item.label)}</span>
        <strong>${item.price > 0 ? `+Rp${Number(item.price).toLocaleString('id-ID')}` : escapeHtml(item.label)}</strong>
      </article>`;
  }

  function modificationTemplate(item) {
    if (!item || typeof item !== 'object') return '';
    const examples = Array.isArray(item.examples) && item.examples.length
      ? `<p><strong>Contoh:</strong> ${escapeHtml(item.examples.join(', '))}</p>`
      : '';
    const pricing = cleanString(item.pricing) ? `<p class="catalog-modification-price">${escapeHtml(item.pricing)}</p>` : '';
    const notes = Array.isArray(item.notes) && item.notes.length
      ? `<ul>${item.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>`
      : '';
    const exclusions = Array.isArray(item.excludedServices) && item.excludedServices.length
      ? `<details><summary>Jasa di luar paket reguler</summary><ul>${item.excludedServices.map((service) => `<li>${escapeHtml(service)}</li>`).join('')}</ul></details>`
      : '';

    return `<article class="catalog-modification-card"><h3>${escapeHtml(item.title || 'Ketentuan modifikasi')}</h3>${pricing}${examples}${notes}${exclusions}</article>`;
  }

  function renderCatalogDetails() {
    if (catalogDetails.priceValidity) {
      catalogDetails.priceValidity.textContent = priceValidity || `${priceLabel || 'Harga'} mengikuti price list terbaru.`;
    }
    if (catalogDetails.oilUpgrades) {
      catalogDetails.oilUpgrades.innerHTML = oilPremiumUpgrades.map(catalogOptionTemplate).join('');
    }
    if (catalogDetails.oilNotes) {
      catalogDetails.oilNotes.innerHTML = oilUpgradeNotes.map((note) => `<p>${escapeHtml(note)}</p>`).join('');
    }
    if (catalogDetails.sparkAddons) {
      catalogDetails.sparkAddons.innerHTML = sparkPlugAddons.filter((item) => item.price > 0).map(catalogOptionTemplate).join('');
    }
    if (catalogDetails.sparkNote) catalogDetails.sparkNote.textContent = sparkPlugNote;
    if (catalogDetails.terms) {
      catalogDetails.terms.innerHTML = terms.map((term) => `<li>${escapeHtml(term)}</li>`).join('');
    }
    if (catalogDetails.modificationRegular) {
      catalogDetails.modificationRegular.textContent = cleanString(modificationGuidance.regular);
    }
    if (catalogDetails.modifications) {
      catalogDetails.modifications.innerHTML = ['light', 'performance', 'competition']
        .map((key) => modificationTemplate(modificationGuidance[key]))
        .join('');
    }
    if (catalogDetails.excludedParts) {
      catalogDetails.excludedParts.innerHTML = excludedParts.map((part) => `<li>${escapeHtml(part)}</li>`).join('');
    }
    if (catalogDetails.customerNotice) catalogDetails.customerNotice.textContent = customerNotice;
  }

  function showCatalogDetailsUnavailable() {
    if (catalogDetails.priceValidity) {
      catalogDetails.priceValidity.textContent = 'Rincian Harga Launching belum dapat dimuat. Minta price list terbaru melalui WhatsApp.';
    }
    [catalogDetails.oilUpgrades, catalogDetails.sparkAddons, catalogDetails.terms, catalogDetails.modifications, catalogDetails.excludedParts]
      .filter(Boolean)
      .forEach((container) => container.replaceChildren());
  }

  function renderPackages(items) {
    if (!packageGrid) return;
    packageGrid.innerHTML = items.map(packageTemplate).join('');
    packageGrid.setAttribute('aria-busy', 'false');
    applyFilter(activeFilter, false);
    document.dispatchEvent(new CustomEvent('ghs41:content-rendered', { detail: { root: packageGrid, type: 'packages' } }));
  }

  function renderServices(items) {
    if (!serviceList) return;
    serviceList.innerHTML = items.map(serviceTemplate).join('');
    serviceList.setAttribute('aria-busy', 'false');
    document.dispatchEvent(new CustomEvent('ghs41:content-rendered', { detail: { root: serviceList, type: 'services' } }));
  }

  function showLoadError(container, label) {
    if (!container || container.querySelector('.package-card, .service-row')) return;
    const status = document.createElement('div');
    const message = document.createElement('p');
    const contactLink = document.createElement('a');

    status.dataset.catalogStatus = '';
    status.setAttribute('role', 'status');
    message.append(`${label} belum dapat dimuat. `);
    contactLink.href = 'https://wa.me/6281395546714?text=Halo%20GHS%2041%2C%20saya%20ingin%20meminta%20price%20list%20terbaru.';
    contactLink.target = '_blank';
    contactLink.rel = 'noopener noreferrer';
    contactLink.textContent = 'Minta price list terbaru melalui WhatsApp.';
    message.append(contactLink);
    status.append(message);
    container.replaceChildren(status);
    container.setAttribute('aria-busy', 'false');
  }

  function getInitialFilter() {
    const selected = document.querySelector('.filter-btn[aria-pressed="true"], .filter-btn.active');
    return cleanString(selected?.dataset.filter).toLowerCase() || 'all';
  }

  function applyFilter(filterName = 'all', announce = true) {
    const filter = cleanString(filterName).toLowerCase() || 'all';
    activeFilter = filter;
    document.querySelectorAll('.filter-btn[data-filter]').forEach((button) => {
      const selected = cleanString(button.dataset.filter).toLowerCase() === filter;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
      if (!button.hasAttribute('type')) button.type = 'button';
    });

    if (!packageGrid) return 0;
    let visibleCount = 0;
    packageGrid.querySelectorAll('.package-card').forEach((card) => {
      const categories = cleanString(card.dataset.categories).split(/\s+/).filter(Boolean);
      const visible = filter === 'all' || categories.includes(filter);
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    if (announce) {
      packageGrid.setAttribute('aria-label', `${visibleCount} paket servis ditampilkan untuk filter ${filter === 'all' ? 'semua' : filter}`);
    }
    return visibleCount;
  }

  function getSelection(value) {
    if (!value) return null;
    const separator = String(value).indexOf(':');
    if (separator < 1) return null;
    const type = String(value).slice(0, separator);
    const id = String(value).slice(separator + 1);
    const list = type === 'package' ? packages : type === 'service' ? services : [];
    const item = list.find((entry) => entry.id === id);
    if (!item) return null;
    return {
      ...item,
      kind: type === 'package' ? 'Paket Servis' : 'Layanan Satuan',
      typeKey: type,
      value: `${type}:${id}`
    };
  }

  function selectPackage(id, source = null) {
    const item = packages.find((entry) => entry.id === id) || null;
    const value = `package:${id}`;
    document.dispatchEvent(new CustomEvent('ghs41:package-selected', { detail: { id, value, item, source } }));

    const bookingSection = document.querySelector('#booking');
    if (bookingSection) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      bookingSection.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    } else if (!document.querySelector('#package-select')) {
      const bookingUrl = new URL('booking.html', document.baseURI);
      bookingUrl.searchParams.set('package', value);
      window.location.assign(bookingUrl.href);
    }
    window.GHS41?.showToast?.('Paket dipilih. Lengkapi data booking.');
    return item;
  }

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const packageSummary = event.target.closest('.package-details > summary');
    if (packageSummary) populatePackageDetails(packageSummary.parentElement);

    const filterButton = event.target.closest('.filter-btn[data-filter]');
    if (filterButton) {
      applyFilter(filterButton.dataset.filter);
      return;
    }
    const chooseButton = event.target.closest('.choose-package[data-id]');
    if (chooseButton) selectPackage(chooseButton.dataset.id, chooseButton);
  });

  packageGrid?.addEventListener('toggle', (event) => {
    const details = event.target;
    if (details instanceof HTMLDetailsElement && details.open && details.matches('.package-details')) {
      populatePackageDetails(details);
    }
  }, true);

  Object.assign(catalog, { packages, services, oilTiers, oilPremiumUpgrades, sparkPlugAddons, terms, excludedParts, durationPolicy, priceValidity, priceLabel, customerNotice, modificationGuidance, oilUpgradeNotes, sparkPlugNote, getSelection, filter: applyFilter, selectPackage });
  window.GHS41Catalog = catalog;
  applyFilter(activeFilter, false);

  catalog.ready = Promise.allSettled([fetchPackageCatalog(), fetchServiceCatalog()]).then(([packageResult, serviceResult]) => {
    const errors = { packages: null, services: null };
    const sources = { packages: 'json', services: 'json' };

    if (packageResult.status === 'fulfilled') {
      packages = packageResult.value.items;
      oilTiers = packageResult.value.oilTiers;
      oilPremiumUpgrades = packageResult.value.oilPremiumUpgrades;
      sparkPlugAddons = packageResult.value.sparkPlugAddons;
      terms = packageResult.value.terms;
      excludedParts = packageResult.value.excludedParts;
      durationPolicy = packageResult.value.durationPolicy;
      priceValidity = packageResult.value.priceValidity;
      priceLabel = packageResult.value.priceLabel;
      customerNotice = packageResult.value.customerNotice;
      modificationGuidance = packageResult.value.modificationGuidance;
      oilUpgradeNotes = packageResult.value.oilUpgradeNotes;
      sparkPlugNote = packageResult.value.sparkPlugNote;
      renderPackages(packages);
      renderCatalogDetails();
    } else {
      console.warn('Katalog paket JSON tidak dapat dimuat.', packageResult.reason);
      errors.packages = packageResult.reason;
      sources.packages = fallbackPackages.length ? 'html' : 'unavailable';
      showLoadError(packageGrid, 'Katalog paket');
      showCatalogDetailsUnavailable();
    }

    if (serviceResult.status === 'fulfilled') {
      services = serviceResult.value;
      renderServices(services);
    } else {
      console.warn('Katalog layanan JSON tidak dapat dimuat.', serviceResult.reason);
      errors.services = serviceResult.reason;
      sources.services = fallbackServices.length ? 'html' : 'unavailable';
      showLoadError(serviceList, 'Katalog layanan');
    }

    Object.assign(catalog, { packages, services, oilTiers, oilPremiumUpgrades, sparkPlugAddons, terms, excludedParts, durationPolicy, priceValidity, priceLabel, customerNotice, modificationGuidance, oilUpgradeNotes, sparkPlugNote, sources: Object.freeze(sources) });
    const detail = { packages, services, oilTiers, oilPremiumUpgrades, sparkPlugAddons, terms, excludedParts, durationPolicy, priceValidity, priceLabel, customerNotice, modificationGuidance, oilUpgradeNotes, sparkPlugNote, sources: catalog.sources, errors: Object.freeze(errors) };
    document.dispatchEvent(new CustomEvent('ghs41:catalog-ready', { detail }));
    return detail;
  });
})();

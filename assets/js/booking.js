(() => {
  'use strict';

  const WHATSAPP_NUMBER = '6281395546714';
  const WORKSHOP_NAME = 'GHS 41';
  const form = document.querySelector('#booking-form');
  const packageSelect = document.querySelector('#package-select');

  if (!form && !packageSelect) return;

  let oilTierSelect = document.querySelector('#oil-tier');
  let sparkPlugAddonSelect = document.querySelector('#spark-plug-addon');
  let estimateBreakdown = document.querySelector('#estimate-breakdown');
  const estimateTotal = document.querySelector('#estimate-total');
  const estimateLabel = document.querySelector('#estimate-label');
  const formError = document.querySelector('#form-error');
  const dateInput = form?.elements.namedItem('date') || document.querySelector('#booking-date');
  const localToday = getLocalDateString();
  let pendingSelection = getRequestedSelection();

  ensureBookingHooks();
  if (dateInput instanceof HTMLInputElement) dateInput.min = localToday;

  function getLocalDateString() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function getRequestedSelection() {
    const requested = new URLSearchParams(window.location.search).get('package')?.trim() || '';
    if (!requested) return '';
    return requested.includes(':') ? requested : `package:${requested}`;
  }

  function ensureSelectHook(id, name, labelText, placeholder, afterElement) {
    const existing = document.getElementById(id);
    if (existing instanceof HTMLSelectElement || !form || !afterElement) return existing;

    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = labelText;
    const select = document.createElement('select');
    select.id = id;
    select.name = name;
    const option = document.createElement('option');
    option.value = '';
    option.textContent = placeholder;
    select.append(option);
    label.append(select);
    afterElement.insertAdjacentElement('afterend', label);
    return select;
  }

  function ensureBookingHooks() {
    if (!form || !packageSelect) return;
    const packageLabel = packageSelect.closest('label') || packageSelect;
    oilTierSelect = ensureSelectHook(
      'oil-tier',
      'oilTier',
      'Pilihan oli paket',
      'Pilih Gulf Standard atau Premium',
      packageLabel
    );
    sparkPlugAddonSelect = ensureSelectHook(
      'spark-plug-addon',
      'sparkPlugAddon',
      'Paket Plus Busi',
      'Pilih tambahan busi',
      oilTierSelect?.closest('label') || oilTierSelect || packageLabel
    );

    if (!estimateBreakdown && estimateTotal) {
      estimateBreakdown = document.createElement('span');
      estimateBreakdown.id = 'estimate-breakdown';
      estimateBreakdown.textContent = 'Belum ada rincian harga.';
      estimateTotal.insertAdjacentElement('afterend', estimateBreakdown);
    }
  }

  function formatRupiah(amount) {
    if (typeof window.GHS41?.formatRupiah === 'function') return window.GHS41.formatRupiah(amount);
    return new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', maximumFractionDigits: 0
    }).format(Number(amount) || 0);
  }

  function displayEstimate(amount, startingFrom = false) {
    return `${startingFrom ? 'Mulai ' : ''}${formatRupiah(amount)}`;
  }

  function waitForCatalog() {
    const currentCatalog = window.GHS41Catalog;
    if (currentCatalog?.ready) return Promise.resolve(currentCatalog.ready).then(() => currentCatalog);
    return new Promise((resolve) => {
      document.addEventListener('ghs41:catalog-ready', () => resolve(window.GHS41Catalog || null), { once: true });
    });
  }

  function clearGeneratedOptions(select) {
    select?.querySelectorAll('[data-catalog-generated="true"]').forEach((option) => option.remove());
  }

  function appendOptionGroup(select, label, type, items) {
    if (!select || !items.length) return;
    const group = document.createElement('optgroup');
    group.label = label;
    group.dataset.catalogGenerated = 'true';

    items.forEach((item) => {
      const option = document.createElement('option');
      option.value = `${type}:${item.id}`;
      if (type === 'package') {
        const prefix = item.startingFrom ? 'Mulai ' : '';
        option.textContent = `${item.name} — Standard ${prefix}${formatRupiah(item.prices.standard)} / Premium ${prefix}${formatRupiah(item.prices.premium)}`;
      } else {
        option.textContent = `${item.name} — ${displayEstimate(item.price, item.startingFrom)}`;
      }
      group.append(option);
    });
    select.append(group);
  }

  function populateSimpleOptions(select, items, placeholder) {
    if (!select) return;
    const previousValue = select.value;
    clearGeneratedOptions(select);
    if (!select.querySelector('option[value=""]')) {
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = placeholder;
      select.prepend(empty);
    }
    items.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.price > 0 ? `${item.label} (+${formatRupiah(item.price)})` : item.label;
      option.dataset.catalogGenerated = 'true';
      select.append(option);
    });
    const canRestore = [...select.options].some((option) => option.value === previousValue);
    select.value = canRestore ? previousValue : items.some((item) => item.id === 'none') ? 'none' : '';
  }

  function populateBookingControls(catalog) {
    if (!catalog) return;

    if (packageSelect) {
      const previousValue = pendingSelection || packageSelect.value;
      clearGeneratedOptions(packageSelect);
      appendOptionGroup(packageSelect, 'Paket Full Service', 'package', [...(catalog.packages || [])]);
      appendOptionGroup(
        packageSelect,
        'Oli, Komponen, dan Layanan Satuan',
        'service',
        [...(catalog.services || [])].filter((item) => item.bookable !== false)
      );
      packageSelect.value = [...packageSelect.options].some((option) => option.value === previousValue) ? previousValue : '';
      pendingSelection = '';
    }

    populateSimpleOptions(oilTierSelect, [...(catalog.oilTiers || [])], 'Pilih Gulf Standard atau Premium');
    populateSimpleOptions(sparkPlugAddonSelect, [...(catalog.sparkPlugAddons || [])], 'Pilih tambahan busi');
    syncPricingControls(catalog);
    updateEstimate(catalog);
    document.dispatchEvent(new CustomEvent('ghs41:booking-options-ready', { detail: { select: packageSelect } }));
  }

  function getAddon(catalog = window.GHS41Catalog) {
    const id = sparkPlugAddonSelect?.value || 'none';
    return catalog?.sparkPlugAddons?.find((item) => item.id === id)
      || catalog?.sparkPlugAddons?.find((item) => item.id === 'none')
      || { id: 'none', label: 'Tanpa busi baru', price: 0 };
  }

  function getPricing(selection, catalog = window.GHS41Catalog) {
    if (!selection) return null;
    if (selection.typeKey === 'service') {
      return {
        basePrice: selection.price,
        total: selection.price,
        startingFrom: selection.startingFrom,
        oilTier: null,
        addon: null
      };
    }

    const tierId = oilTierSelect?.value || '';
    const tier = catalog?.oilTiers?.find((item) => item.id === tierId) || null;
    const basePrice = Number(selection.prices?.[tierId]);
    if (!tier || !Number.isFinite(basePrice)) return null;
    const addon = getAddon(catalog);
    return {
      basePrice,
      total: basePrice + addon.price,
      startingFrom: selection.startingFrom,
      oilTier: tier,
      addon
    };
  }

  function syncPricingControls(catalog = window.GHS41Catalog) {
    const selection = catalog?.getSelection?.(packageSelect?.value) || null;
    const isPackage = selection?.typeKey === 'package';
    if (oilTierSelect) {
      oilTierSelect.disabled = !isPackage;
      oilTierSelect.required = isPackage;
      if (!isPackage) oilTierSelect.value = '';
    }
    if (sparkPlugAddonSelect) {
      sparkPlugAddonSelect.disabled = !isPackage;
      sparkPlugAddonSelect.required = isPackage;
      if (!isPackage) sparkPlugAddonSelect.value = 'none';
    }
    return selection;
  }

  function updateEstimate(catalog = window.GHS41Catalog) {
    if (!packageSelect) return null;
    const selection = catalog?.getSelection?.(packageSelect.value) || null;
    const pricing = getPricing(selection, catalog);
    let totalText = 'Rp0';
    let labelText = 'Pilih paket atau layanan';
    let breakdownText = 'Belum ada rincian harga.';

    if (selection?.typeKey === 'package' && !pricing) {
      labelText = selection.name;
      breakdownText = 'Pilih oli Gulf Standard atau Premium untuk melihat estimasi.';
    } else if (selection && pricing) {
      totalText = displayEstimate(pricing.total, pricing.startingFrom);
      labelText = selection.name;
      if (selection.typeKey === 'package') {
        const addonText = pricing.addon?.price
          ? ` + ${pricing.addon.label} ${formatRupiah(pricing.addon.price)}`
          : '';
        breakdownText = `${pricing.oilTier.label}: ${displayEstimate(pricing.basePrice, pricing.startingFrom)}${addonText}`;
      } else {
        breakdownText = `${selection.kind}: ${displayEstimate(pricing.basePrice, pricing.startingFrom)}`;
      }
    }

    if (estimateTotal) {
      estimateTotal.value = totalText;
      estimateTotal.textContent = totalText;
    }
    if (estimateLabel) estimateLabel.textContent = labelText;
    if (estimateBreakdown) estimateBreakdown.textContent = breakdownText;
    return { selection, pricing };
  }

  function selectFromCatalog(value) {
    if (!packageSelect || !value) return;
    if (![...packageSelect.options].some((option) => option.value === value)) {
      pendingSelection = value;
      return;
    }
    packageSelect.value = value;
    packageSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  document.addEventListener('ghs41:package-selected', (event) => selectFromCatalog(event.detail?.value || ''));
  packageSelect?.addEventListener('change', () => {
    syncPricingControls();
    updateEstimate();
  });
  oilTierSelect?.addEventListener('change', () => updateEstimate());
  sparkPlugAddonSelect?.addEventListener('change', () => updateEstimate());

  function clearInvalidState(field) {
    if (!(field instanceof HTMLElement)) return;
    field.classList.remove('invalid');
    field.removeAttribute('aria-invalid');
  }

  function markInvalid(field) {
    if (!(field instanceof HTMLElement)) return;
    field.classList.add('invalid');
    field.setAttribute('aria-invalid', 'true');
  }

  function elementValue(field) {
    return field && 'value' in field ? String(field.value).trim() : '';
  }

  function namedField(...names) {
    if (!form) return null;
    for (const name of names) {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLElement) return field;
    }
    return null;
  }

  function validateForm(catalog) {
    if (!form) return { message: '', firstInvalid: null };
    form.querySelectorAll('.invalid, [aria-invalid="true"]').forEach(clearInvalidState);
    const invalidFields = [];

    form.querySelectorAll('[required]').forEach((field) => {
      if (!(field instanceof HTMLElement) || field.matches(':disabled')) return;
      const empty = field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')
        ? !field.checked
        : !elementValue(field);
      if (empty) {
        markInvalid(field);
        invalidFields.push(field);
      }
    });
    if (invalidFields.length) {
      return { message: 'Lengkapi semua data wajib, termasuk pilihan oli paket.', firstInvalid: invalidFields[0] };
    }

    const phoneField = namedField('phone', 'whatsapp');
    const phoneDigits = elementValue(phoneField).replace(/\D/g, '');
    if (phoneField && (phoneDigits.length < 9 || phoneDigits.length > 15)) {
      markInvalid(phoneField);
      return { message: 'Nomor WhatsApp belum valid. Gunakan 9–15 digit.', firstInvalid: phoneField };
    }

    const yearField = namedField('year', 'motorYear');
    const yearValue = elementValue(yearField);
    if (yearField && yearValue) {
      const year = Number(yearValue);
      const maximumYear = new Date().getFullYear() + 1;
      if (!/^\d{4}$/.test(yearValue) || year < 1950 || year > maximumYear) {
        markInvalid(yearField);
        return { message: `Tahun motor harus antara 1950 dan ${maximumYear}.`, firstInvalid: yearField };
      }
    }

    const odometerField = namedField('odometer', 'kilometer');
    if (odometerField && elementValue(odometerField) && Number(elementValue(odometerField)) < 0) {
      markInvalid(odometerField);
      return { message: 'Kilometer kendaraan tidak boleh bernilai negatif.', firstInvalid: odometerField };
    }

    const bookingDateField = namedField('date');
    if (bookingDateField && elementValue(bookingDateField) < localToday) {
      markInvalid(bookingDateField);
      return { message: 'Tanggal kedatangan tidak boleh sebelum hari ini.', firstInvalid: bookingDateField };
    }

    const selectionField = namedField('package');
    const selected = catalog?.getSelection?.(elementValue(selectionField));
    if (!selected) {
      markInvalid(selectionField);
      return { message: 'Pilih paket atau layanan yang tersedia.', firstInvalid: selectionField };
    }
    const pricing = getPricing(selected, catalog);
    if (!pricing) {
      markInvalid(oilTierSelect);
      return { message: 'Pilih jenis oli Gulf Standard atau Premium.', firstInvalid: oilTierSelect };
    }

    const nativeInvalid = [...form.elements].find((field) => (
      field instanceof HTMLElement && !field.matches(':disabled') && 'checkValidity' in field && !field.checkValidity()
    ));
    if (nativeInvalid) {
      markInvalid(nativeInvalid);
      return { message: 'Periksa kembali data yang belum sesuai.', firstInvalid: nativeInvalid };
    }

    return { message: '', firstInvalid: null, selected, pricing };
  }

  function formatDate(dateString) {
    const date = new Date(`${dateString}T12:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(date);
  }

  function formValue(data, ...names) {
    for (const name of names) {
      const value = data.get(name);
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  }

  function createWhatsAppMessage(data, selection, pricing) {
    const motor = formValue(data, 'motor');
    const vehicle = motor || [formValue(data, 'brand', 'motorBrand'), formValue(data, 'model', 'motorModel')].filter(Boolean).join(' ');
    const year = formValue(data, 'year', 'motorYear');
    const plate = formValue(data, 'plate', 'licensePlate');
    const odometer = formValue(data, 'odometer', 'kilometer');
    const lines = [
      `Halo ${WORKSHOP_NAME}, saya ingin booking servis.`,
      '',
      `Nama: ${formValue(data, 'name')}`,
      `Nomor WhatsApp: ${formValue(data, 'phone', 'whatsapp')}`,
      `Jenis pelanggan: ${formValue(data, 'customerType', 'customer_type')}`,
      `Kendaraan: ${vehicle}`,
      `Jenis motor: ${formValue(data, 'motorType', 'motor_type')}`
    ];

    if (year) lines.push(`Tahun motor: ${year}`);
    lines.push(`Kapasitas mesin: ${formValue(data, 'cc', 'capacity')}`);
    if (plate) lines.push(`Nomor polisi: ${plate.toUpperCase()}`);
    if (odometer) lines.push(`Kilometer: ${Number(odometer).toLocaleString('id-ID')} km`);

    if (selection.typeKey === 'package') {
      lines.push(
        `Paket: ${selection.name}`,
        `Pilihan oli: ${pricing.oilTier.label}`,
        `Paket Plus Busi: ${pricing.addon.label}${pricing.addon.price ? ` (+${formatRupiah(pricing.addon.price)})` : ''}`
      );
    } else {
      lines.push(`Layanan: ${selection.name}`);
    }

    lines.push(
      `Estimasi website: ${displayEstimate(pricing.total, pricing.startingFrom)}`,
      `Keluhan: ${formValue(data, 'complaint', 'notes') || '-'}`,
      `Rencana kedatangan: ${formatDate(formValue(data, 'date'))}, pukul ${formValue(data, 'time')}`,
      '',
      'Mohon konfirmasi jadwal dan estimasi biaya akhirnya.',
      'Saya memahami pembayaran dilakukan langsung di bengkel dan tidak melalui website. Terima kasih.'
    );
    return lines.join('\n');
  }

  function openWhatsApp(message) {
    const link = document.createElement('a');
    link.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
  }

  form?.addEventListener('input', (event) => {
    clearInvalidState(event.target);
    if (formError) formError.textContent = '';
  });
  form?.addEventListener('change', (event) => {
    clearInvalidState(event.target);
    if (formError) formError.textContent = '';
  });
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const validation = validateForm(window.GHS41Catalog);
    if (formError) formError.textContent = validation.message;
    if (validation.message) {
      validation.firstInvalid?.focus();
      return;
    }

    openWhatsApp(createWhatsAppMessage(new FormData(form), validation.selected, validation.pricing));
    window.GHS41?.showToast?.('WhatsApp dibuka. Kirim pesan untuk menyelesaikan booking.');
    document.dispatchEvent(new CustomEvent('ghs41:booking-opened', { detail: { selectionId: validation.selected.id } }));
  });

  waitForCatalog().then(populateBookingControls).catch((error) => {
    console.error('Pilihan booking tidak dapat disiapkan.', error);
    if (formError) formError.textContent = 'Pilihan layanan belum dapat dimuat. Muat ulang halaman lalu coba lagi.';
  });
})();

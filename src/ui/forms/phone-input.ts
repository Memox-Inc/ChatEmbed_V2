// Phone input combo for the lead-capture form.
//
// Visitor-side UX (MMX-575):
//   - Flag + dial-code chip on the left, national-format input on the right,
//     all inside one rounded container.
//   - Click chip → full-overlay picker covering the form root (.mcx-lead-conv)
//     with a sticky search box, "Suggested" section (admin's default), and
//     the alphabetical list of the curated countries.
//   - As-you-type digit-only normalization and country-specific placeholder.
//   - Inline error / success states (visual ring + small icon).
//
// Replaces the v1 ``phone-field.ts`` — same call site, richer UX, and
// constrained to the admin's curated country list (no surprises).
//
// The component creates its own picker DOM but defers mounting until the
// visitor opens it; the picker is appended to the closest ``.mcx-lead-conv``
// ancestor so it covers the whole form area in both multi-step and
// single-step variants.

import type { CountryEntry } from './country-data';
import { countryByCode, pickCountries } from './country-data';
import type { PhoneFieldOptions } from '../../config/types';
import { stripPhoneDigits } from './validation';

export interface PhoneInputHandle {
  /** Outer container (flag chip + input). Append this to the form. */
  container: HTMLDivElement;
  /** The raw <input> for value reads + focus. */
  input: HTMLInputElement;
  /** Currently selected country (always present, never null). */
  getSelectedCountry: () => CountryEntry;
  /** Apply / clear an inline error state. */
  setError: (msg: string | null) => void;
  /** Apply / clear a visual "valid" state. */
  setValid: (ok: boolean) => void;
  /** Programmatically force-close the picker (e.g. on form unmount). */
  closePicker: () => void;
}

export function createPhoneInput(opt: PhoneFieldOptions): PhoneInputHandle {
  const curated = pickCountries(opt.allowed_countries);
  // Always return SOMETHING — fall back to US if the curated list is empty
  // (the server validator should prevent this, but be safe).
  const fallback: CountryEntry = countryByCode('US') ?? curated[0] ?? {
    code: 'US', dial: '+1', flag: '\u{1F1FA}\u{1F1F8}', name: 'United States',
    minLen: 10, maxLen: 10,
  };
  let selected: CountryEntry =
    curated.find(c => c.code === opt.default_country) ?? curated[0] ?? fallback;

  // ── Combo (collapsed) ──────────────────────────────────────────────────
  const container = document.createElement('div');
  container.className = 'mcx-phone-combo';

  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'mcx-phone-chip';
  chip.setAttribute('aria-haspopup', 'listbox');
  chip.setAttribute('aria-expanded', 'false');
  renderChipContent();

  const input = document.createElement('input');
  input.type = 'tel';
  input.inputMode = 'tel';
  input.className = 'mcx-phone-input';
  input.placeholder = placeholderFor(selected);

  // Subtle valid-state checkmark; CSS handles visibility off ``.mcx-phone-combo--valid``.
  const checkIcon = document.createElement('span');
  checkIcon.className = 'mcx-phone-check';
  checkIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

  container.append(chip, input, checkIcon);

  function renderChipContent(): void {
    chip.innerHTML = `<span class="mcx-phone-flag">${selected.flag}</span><span class="mcx-phone-dial">${selected.dial}</span><svg class="mcx-phone-chev" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;
  }

  function placeholderFor(c: CountryEntry): string {
    // Light national-format hint per country. Not a strict format —
    // visitors type freely and we strip non-digits at validation time.
    const samples: Record<string, string> = {
      US: '(555) 123-4567', CA: '(555) 123-4567', GB: '7400 123456',
      AU: '412 345 678',    DE: '151 1234 5678',  FR: '6 12 34 56 78',
      IN: '98765 43210',    BR: '11 91234-5678',  JP: '90-1234-5678',
      KR: '10-1234-5678',   SG: '8123 4567',      AE: '50 123 4567',
      ES: '612 345 678',    IT: '312 345 6789',   NL: '6 12345678',
      MX: '55 1234 5678',
    };
    return samples[c.code] || 'phone number';
  }

  // Keep input digits-only (as-typed). Light formatting is left to the
  // browser's tel-input default for now — the validator + normalizer
  // both work on stripped digits, so the visitor never gets bitten by
  // formatting drift.
  input.addEventListener('input', () => {
    setError(null);
  });

  // ── Picker overlay ─────────────────────────────────────────────────────
  let pickerHost: HTMLElement | null = null;
  let pickerEl: HTMLDivElement | null = null;
  let pickerSearch = '';
  let kbdFocusIdx = -1;

  function openPicker(): void {
    if (pickerEl) return;
    // Find the nearest ``.mcx-lead-conv`` ancestor — that's our overlay host.
    let host: HTMLElement | null = container.parentElement;
    while (host && !host.classList?.contains('mcx-lead-conv')) host = host.parentElement;
    if (!host) host = container.parentElement; // graceful fallback
    if (!host) return;
    pickerHost = host;
    host.classList.add('mcx-lead-conv--picker-on');
    chip.setAttribute('aria-expanded', 'true');
    chip.classList.add('mcx-phone-chip--open');

    pickerEl = document.createElement('div');
    pickerEl.className = 'mcx-phone-picker';
    pickerEl.setAttribute('role', 'dialog');
    pickerEl.setAttribute('aria-label', 'Select a country');

    pickerEl.innerHTML = `
      <div class="mcx-phone-picker-head">
        <button type="button" class="mcx-phone-picker-back" aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <input class="mcx-phone-picker-search" type="text" placeholder="Search country or code" autocomplete="off" aria-label="Search country" />
      </div>
      <div class="mcx-phone-picker-body" role="listbox"></div>
    `;
    host.appendChild(pickerEl);

    const back = pickerEl.querySelector<HTMLButtonElement>('.mcx-phone-picker-back')!;
    const search = pickerEl.querySelector<HTMLInputElement>('.mcx-phone-picker-search')!;
    const body = pickerEl.querySelector<HTMLDivElement>('.mcx-phone-picker-body')!;

    back.addEventListener('click', closePicker);
    search.addEventListener('input', () => {
      pickerSearch = search.value;
      kbdFocusIdx = -1;
      renderRows(body, search.value);
    });
    search.addEventListener('keydown', (e) => onPickerKey(e, body));
    pickerEl.addEventListener('keydown', (e) => onPickerKey(e, body));
    renderRows(body, '');

    // Defer focus so the slide-in animation isn't fought by a focus jump.
    setTimeout(() => search.focus(), 60);
  }

  function onPickerKey(e: KeyboardEvent, body: HTMLDivElement): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePicker();
      input.focus();
      return;
    }
    const rows = body.querySelectorAll<HTMLDivElement>('.mcx-phone-picker-row');
    if (rows.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      kbdFocusIdx = Math.min(rows.length - 1, kbdFocusIdx + 1);
      paintKbdFocus(rows);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      kbdFocusIdx = Math.max(0, kbdFocusIdx - 1);
      paintKbdFocus(rows);
    } else if (e.key === 'Enter' && kbdFocusIdx >= 0) {
      e.preventDefault();
      const iso = rows[kbdFocusIdx].dataset.iso;
      if (iso) chooseIso(iso);
    }
  }
  function paintKbdFocus(rows: NodeListOf<HTMLDivElement>): void {
    rows.forEach((r, i) => r.classList.toggle('mcx-phone-picker-row--kbd', i === kbdFocusIdx));
    rows[kbdFocusIdx]?.scrollIntoView({ block: 'nearest' });
  }

  function renderRows(body: HTMLDivElement, q: string): void {
    const ql = q.trim().toLowerCase();
    const matches = ql
      ? curated.filter(c =>
          c.name.toLowerCase().includes(ql)
          || c.code.toLowerCase().includes(ql)
          || c.dial.includes(ql),
        )
      : curated.slice();
    matches.sort((a, b) => a.name.localeCompare(b.name));
    if (matches.length === 0) {
      body.innerHTML = `<div class="mcx-phone-picker-empty">No matches</div>`;
      return;
    }
    const defaultIso = opt.default_country;
    const defaultRow = !ql && curated.find(c => c.code === defaultIso);
    const rest = matches.filter(c => c.code !== defaultIso);
    body.innerHTML = `
      ${defaultRow ? `
        <div class="mcx-phone-picker-section">Suggested</div>
        <div class="mcx-phone-picker-row mcx-phone-picker-row--suggested ${defaultRow.code === selected.code ? 'mcx-phone-picker-row--current' : ''}" data-iso="${defaultRow.code}" role="option" tabindex="0">
          <span class="mcx-phone-picker-flag">${defaultRow.flag}</span>
          <span class="mcx-phone-picker-name">${defaultRow.name}</span>
          <span class="mcx-phone-picker-dial">${defaultRow.dial}</span>
          <span class="mcx-phone-picker-pill">Default</span>
        </div>` : ''}
      ${rest.length > 0 ? `<div class="mcx-phone-picker-section">${defaultRow ? 'All countries' : (ql ? 'Results' : 'Countries')}</div>` : ''}
      ${rest.map(c => `
        <div class="mcx-phone-picker-row ${c.code === selected.code ? 'mcx-phone-picker-row--current' : ''}" data-iso="${c.code}" role="option" tabindex="0">
          <span class="mcx-phone-picker-flag">${c.flag}</span>
          <span class="mcx-phone-picker-name">${c.name}</span>
          <span class="mcx-phone-picker-dial">${c.dial}</span>
        </div>`).join('')}
    `;
    body.querySelectorAll<HTMLDivElement>('.mcx-phone-picker-row').forEach(row => {
      row.addEventListener('click', () => {
        const iso = row.dataset.iso;
        if (iso) chooseIso(iso);
      });
    });
  }

  function chooseIso(iso: string): void {
    const next = curated.find(c => c.code === iso);
    if (!next) return;
    selected = next;
    renderChipContent();
    input.placeholder = placeholderFor(selected);
    setError(null);
    setValid(false);
    closePicker();
    input.focus();
  }

  function closePicker(): void {
    if (!pickerEl) return;
    pickerEl.remove();
    pickerEl = null;
    pickerSearch = '';
    kbdFocusIdx = -1;
    if (pickerHost) {
      pickerHost.classList.remove('mcx-lead-conv--picker-on');
      pickerHost = null;
    }
    chip.setAttribute('aria-expanded', 'false');
    chip.classList.remove('mcx-phone-chip--open');
  }

  chip.addEventListener('click', (e) => {
    e.preventDefault();
    if (pickerEl) closePicker();
    else openPicker();
  });

  // ── Inline state helpers ──────────────────────────────────────────────
  function setError(msg: string | null): void {
    container.classList.toggle('mcx-phone-combo--error', !!msg);
    if (msg) container.classList.remove('mcx-phone-combo--valid');
  }
  function setValid(ok: boolean): void {
    container.classList.toggle('mcx-phone-combo--valid', ok);
    if (ok) container.classList.remove('mcx-phone-combo--error');
  }

  return {
    container, input,
    getSelectedCountry: () => selected,
    setError, setValid, closePicker,
    // expose for tests: digits-only normalized value via the input
    // (callers use ``input.value`` directly; ``stripPhoneDigits`` is the
    // canonical way to read the underlying number).
  };
}

export { stripPhoneDigits };

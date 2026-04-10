import { COUNTRY_CODES, type CountryEntry } from './country-data';

export interface PhoneFieldRefs {
  container: HTMLDivElement;
  input: HTMLInputElement;
  wrapper: HTMLDivElement;
  getSelectedCountry: () => CountryEntry;
  setError: (msg: string | null) => void;
  errorEl: HTMLDivElement;
}

export function createPhoneField(): PhoneFieldRefs {
  let selectedCountry = COUNTRY_CODES[0];
  let dropdownOpen = false;

  const container = document.createElement('div');
  container.className = 'mcx-form-field';

  const label = document.createElement('label');
  label.className = 'mcx-form-label';
  label.textContent = 'Phone:*';

  const inputRow = document.createElement('div');
  inputRow.className = 'mcx-form-input-row';

  const wrapper = document.createElement('div');
  wrapper.className = 'mcx-phone-wrapper';

  // Country code button
  const countryBtn = document.createElement('button');
  countryBtn.type = 'button';
  countryBtn.className = 'mcx-country-btn';

  function updateBtn(): void {
    countryBtn.innerHTML = `<span>${selectedCountry.dial}</span><span class="mcx-country-arrow">\u25BC</span>`;
  }
  updateBtn();

  // Phone input
  const input = document.createElement('input');
  input.type = 'tel';
  input.placeholder = '555 123 4567';
  input.maxLength = 15;
  input.className = 'mcx-phone-input';

  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^\d\s\-().]/g, '');
    if (input.value.trim()) {
      wrapper.classList.remove('mcx-field-error');
      errorEl.style.display = 'none';
    }
  });

  // Dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'mcx-country-dropdown';
  dropdown.style.display = 'none';

  const search = document.createElement('input');
  search.type = 'text';
  search.placeholder = 'Search country...';
  search.className = 'mcx-country-search';

  const list = document.createElement('div');
  list.className = 'mcx-country-list';

  function renderList(filter: string): void {
    list.innerHTML = '';
    const lf = filter.toLowerCase();
    COUNTRY_CODES.forEach((c) => {
      if (lf && !c.name.toLowerCase().includes(lf) && !c.dial.includes(lf) && !c.code.toLowerCase().includes(lf)) return;
      const row = document.createElement('div');
      row.className = 'mcx-country-row' + (c.code === selectedCountry.code && c.dial === selectedCountry.dial ? ' mcx-country-row--selected' : '');
      row.innerHTML = `<span class="mcx-country-flag">${c.flag}</span><span class="mcx-country-name">${c.name}</span><span class="mcx-country-dial">${c.dial}</span>`;
      row.addEventListener('click', () => {
        selectedCountry = c;
        updateBtn();
        closeDropdown();
        input.focus();
      });
      list.appendChild(row);
    });
  }

  dropdown.appendChild(search);
  dropdown.appendChild(list);

  function openDropdown(): void {
    dropdownOpen = true;
    dropdown.style.display = 'block';
    search.value = '';
    renderList('');
    setTimeout(() => search.focus(), 0);
  }

  function closeDropdown(): void {
    dropdownOpen = false;
    dropdown.style.display = 'none';
  }

  countryBtn.addEventListener('click', () => {
    if (dropdownOpen) closeDropdown(); else openDropdown();
  });

  search.addEventListener('input', () => renderList(search.value));

  search.addEventListener('keydown', (e) => {
    const rows = list.querySelectorAll<HTMLDivElement>('.mcx-country-row');
    if (!rows.length) return;
    const highlighted = list.querySelector<HTMLDivElement>('.mcx-country-row--highlighted');
    let hIdx = -1;
    rows.forEach((r, i) => { if (r === highlighted) hIdx = i; });
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (highlighted) highlighted.classList.remove('mcx-country-row--highlighted');
      hIdx = (hIdx + 1) % rows.length;
      rows[hIdx].classList.add('mcx-country-row--highlighted');
      rows[hIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (highlighted) highlighted.classList.remove('mcx-country-row--highlighted');
      hIdx = hIdx <= 0 ? rows.length - 1 : hIdx - 1;
      rows[hIdx].classList.add('mcx-country-row--highlighted');
      rows[hIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (highlighted) highlighted.click();
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (dropdownOpen && !wrapper.contains(e.target as Node)) closeDropdown();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropdownOpen) closeDropdown();
  });

  wrapper.appendChild(countryBtn);
  wrapper.appendChild(input);
  wrapper.appendChild(dropdown);
  inputRow.appendChild(label);
  inputRow.appendChild(wrapper);

  const errorEl = document.createElement('div');
  errorEl.className = 'mcx-form-error';
  errorEl.style.display = 'none';

  container.appendChild(inputRow);
  container.appendChild(errorEl);

  function setError(msg: string | null): void {
    if (msg) {
      wrapper.classList.add('mcx-field-error');
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    } else {
      wrapper.classList.remove('mcx-field-error');
      errorEl.style.display = 'none';
    }
  }

  return { container, input, wrapper, getSelectedCountry: () => selectedCountry, setError, errorEl };
}

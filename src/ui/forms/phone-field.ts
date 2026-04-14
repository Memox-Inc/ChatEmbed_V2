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

  const container = document.createElement('div');
  container.className = 'mcx-form-field';

  const label = document.createElement('label');
  label.className = 'mcx-form-label';
  label.textContent = 'Phone:*';

  const inputRow = document.createElement('div');
  inputRow.className = 'mcx-form-input-row';

  const wrapper = document.createElement('div');
  wrapper.className = 'mcx-phone-wrapper';

  // Country code selector — native select hidden, styled button trigger
  const codeWrap = document.createElement('div');
  codeWrap.className = 'mcx-code-wrap';

  const codeLabel = document.createElement('span');
  codeLabel.className = 'mcx-code-label';
  codeLabel.textContent = selectedCountry.dial;

  const codeArrow = document.createElement('span');
  codeArrow.className = 'mcx-code-arrow';
  codeArrow.textContent = '\u25BE';

  const countrySelect = document.createElement('select');
  countrySelect.className = 'mcx-country-select';
  COUNTRY_CODES.forEach((c, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${c.flag} ${c.name} (${c.dial})`;
    if (i === 0) opt.selected = true;
    countrySelect.appendChild(opt);
  });

  countrySelect.addEventListener('change', () => {
    selectedCountry = COUNTRY_CODES[Number(countrySelect.value)];
    codeLabel.textContent = selectedCountry.dial;
    input.focus();
  });

  codeWrap.appendChild(codeLabel);
  codeWrap.appendChild(codeArrow);
  codeWrap.appendChild(countrySelect);

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

  wrapper.appendChild(codeWrap);
  wrapper.appendChild(input);
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

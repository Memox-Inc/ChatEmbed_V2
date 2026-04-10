import type { ChatEmbedConfig } from '../../config/types';
import { sanitizeInput } from '../../utils/dom';
import { validateName, validateEmail, validatePhone, validateZip, normalizePhoneE164 } from './validation';
import { createPhoneField } from './phone-field';

export interface LeadData {
  name: string;
  email: string;
  phone: string;
  zip: string;
  timestamp: string;
  userAgent: string;
  platform: string;
  url: string;
  language: string;
  referrer: string;
}

export function createLeadCaptureForm(
  config: ChatEmbedConfig,
  onComplete: (lead: LeadData | null) => void,
): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'mcx-lead-form';

  // Helper text
  const helperConf = config.leadFormHelperText || {};
  const helper = document.createElement('div');
  helper.className = 'mcx-lead-helper';
  helper.textContent = helperConf.text || 'To help us provide you with better service and personalized assistance, please share your details below.';
  wrapper.appendChild(helper);

  const form = document.createElement('div');
  form.className = 'mcx-lead-fields';

  // --- Name ---
  const nameField = createSimpleField('Full Name:*', 'text', 'Full name');
  form.appendChild(nameField.container);

  // --- Email ---
  const emailField = createSimpleField('Email:*', 'email', 'Email');
  form.appendChild(emailField.container);

  // --- Phone ---
  const phoneField = createPhoneField();
  form.appendChild(phoneField.container);

  // --- Zip ---
  const zipField = createSimpleField('Zip Code:*', 'text', 'Zip code');
  form.appendChild(zipField.container);

  wrapper.appendChild(form);

  // Submit button
  const submitBtn = document.createElement('button');
  submitBtn.className = 'mcx-lead-submit';
  submitBtn.textContent = 'Start Chat';
  wrapper.appendChild(submitBtn);

  // Validation and submit
  function submit(): void {
    const nameVal = nameField.input.value.trim();
    const emailVal = emailField.input.value.trim();
    const phoneVal = phoneField.input.value.trim();
    const zipVal = zipField.input.value.trim();
    let hasErrors = false;

    // Name
    const nameErr = validateName(nameVal);
    nameField.setError(nameErr);
    if (nameErr) hasErrors = true;

    // Email
    const emailErr = validateEmail(emailVal);
    emailField.setError(emailErr);
    if (emailErr) hasErrors = true;

    // Phone
    const phoneErr = validatePhone(phoneVal, phoneField.getSelectedCountry());
    phoneField.setError(phoneErr);
    if (phoneErr) hasErrors = true;

    // Zip
    const zipErr = validateZip(zipVal);
    zipField.setError(zipErr);
    if (zipErr) hasErrors = true;

    if (hasErrors) {
      if (nameErr) nameField.input.focus();
      else if (emailErr) emailField.input.focus();
      else if (phoneErr) phoneField.input.focus();
      else if (zipErr) zipField.input.focus();
      return;
    }

    const lead: LeadData = {
      name: sanitizeInput(nameVal),
      email: sanitizeInput(emailVal),
      phone: normalizePhoneE164(phoneVal, phoneField.getSelectedCountry().dial),
      zip: sanitizeInput(zipVal),
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      url: window.location.href,
      language: navigator.language,
      referrer: document.referrer,
    };

    onComplete(lead);
  }

  submitBtn.addEventListener('click', submit);

  // Enter key on any field submits
  [nameField.input, emailField.input, phoneField.input, zipField.input].forEach((inp) => {
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
  });

  // Focus first field
  setTimeout(() => nameField.input.focus(), 100);

  return wrapper;
}

interface SimpleFieldRefs {
  container: HTMLDivElement;
  input: HTMLInputElement;
  setError: (msg: string | null) => void;
}

function createSimpleField(labelText: string, type: string, placeholder: string): SimpleFieldRefs {
  const container = document.createElement('div');
  container.className = 'mcx-form-field';

  const row = document.createElement('div');
  row.className = 'mcx-form-input-row';

  const label = document.createElement('label');
  label.className = 'mcx-form-label';
  label.textContent = labelText;

  const input = document.createElement('input');
  input.type = type;
  input.placeholder = placeholder;
  input.className = 'mcx-form-input';

  input.addEventListener('input', () => {
    if (input.value.trim()) {
      input.classList.remove('mcx-field-error');
      errorEl.style.display = 'none';
    }
  });

  row.appendChild(label);
  row.appendChild(input);

  const errorEl = document.createElement('div');
  errorEl.className = 'mcx-form-error';
  errorEl.style.display = 'none';

  container.appendChild(row);
  container.appendChild(errorEl);

  function setError(msg: string | null): void {
    if (msg) {
      input.classList.add('mcx-field-error');
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    } else {
      input.classList.remove('mcx-field-error');
      errorEl.style.display = 'none';
    }
  }

  return { container, input, setError };
}

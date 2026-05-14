// Lead-capture form (MMX-575 v2).
//
// Now data-driven over the v2 ``leadCaptureConfig``:
//   - Dispatches between multi-step (one field per screen, classic flow) and
//     single-step (all fields on one card with a single submit) variants.
//   - Renders the admin's enabled fields in admin-defined order, with the
//     admin's labels + required flags.
//   - Supports built-in (name/email/phone/zip) AND custom fields
//     (text/email/phone/number with a custom label).
//   - Phone fields use the new ``createPhoneInput`` component (curated
//     country picker, strictness-aware validation).
//
// Back-compat: if no ``leadCaptureConfig`` is present, default to the
// classic 4-step multi-step form so older self-hosted callers that pass
// just ``leadCapture: true`` keep working.

import type {
  ChatEmbedConfig,
  LeadCaptureConfig,
  LeadCaptureField,
  PhoneFieldOptions,
} from '../../config/types';
import { sanitizeInput } from '../../utils/dom';
import { validateField, normalizePhoneE164 } from './validation';
import { createPhoneInput, type PhoneInputHandle } from './phone-input';
import { countryByCode } from './country-data';

export interface LeadData {
  /** Free-form bag of submitted values keyed by field key. Backwards-
   *  compatible aliases for ``name``/``email``/``phone``/``zip`` are
   *  also set as top-level keys when those built-ins are enabled. */
  name: string;
  email: string;
  phone: string;
  zip: string;
  values: Record<string, string>;
  timestamp: string;
  userAgent: string;
  platform: string;
  url: string;
  language: string;
  referrer: string;
}

const DEFAULT_PHONE_OPTIONS: PhoneFieldOptions = {
  allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL',
                      'BR', 'MX', 'IN', 'JP', 'SG', 'AE'],
  default_country: 'US',
  validation: 'strict',
};

function defaultV2Config(): LeadCaptureConfig {
  return {
    enabled: true,
    variant: 'multi_step',
    fields: [
      { key: 'name',  label: 'Your name', type: 'text',  enabled: true, required: true,  custom: false },
      { key: 'email', label: 'Email',     type: 'email', enabled: true, required: true,  custom: false },
      { key: 'phone', label: 'Phone',     type: 'phone', enabled: true, required: true,  custom: false,
        phone_options: { ...DEFAULT_PHONE_OPTIONS } },
      { key: 'zip',   label: 'Zip code',  type: 'number', enabled: true, required: true, custom: false },
    ],
  };
}

/**
 * Pull the effective ``LeadCaptureConfig`` from the embed config. Reads
 * ``config.leadCaptureConfig`` first (server-driven v2), falls back to
 * legacy boolean ``config.leadCapture`` and synthesizes a default v2.
 */
function resolveConfig(config: ChatEmbedConfig): LeadCaptureConfig {
  const v2 = config.leadCaptureConfig;
  if (v2 && Array.isArray(v2.fields)) return v2;
  if (typeof config.leadCapture === 'object' && config.leadCapture && Array.isArray((config.leadCapture as LeadCaptureConfig).fields)) {
    return config.leadCapture as LeadCaptureConfig;
  }
  // Legacy boolean true (or undefined → default to enabled multi-step).
  return defaultV2Config();
}

/**
 * Main entry — picks the right variant renderer and returns the form DOM.
 * The widget mounts the returned node and calls back with the captured
 * lead (or ``null`` on cancel/error).
 */
export function createLeadCaptureForm(
  config: ChatEmbedConfig,
  onComplete: (lead: LeadData | null) => void,
): HTMLDivElement {
  const cfg = resolveConfig(config);
  const fields = cfg.fields.filter(f => f.enabled);
  if (cfg.variant === 'single_step') {
    return createSingleStepLeadForm(config, fields, onComplete);
  }
  return createMultiStepLeadForm(config, fields, onComplete);
}

// ============================================================================
// Multi-step variant — classic chat-bubble flow (one field per screen)
// ============================================================================

function createMultiStepLeadForm(
  config: ChatEmbedConfig,
  fields: LeadCaptureField[],
  onComplete: (lead: LeadData | null) => void,
): HTMLDivElement {
  const collected: Record<string, string> = {};
  const phoneHandles: Map<string, PhoneInputHandle> = new Map();
  let currentStep = 0;

  const wrapper = document.createElement('div');
  wrapper.className = 'mcx-lead-conv';

  const dotsRow = document.createElement('div');
  dotsRow.className = 'mcx-lead-dots';
  for (let i = 0; i < fields.length; i++) {
    const dot = document.createElement('div');
    dot.className = 'mcx-lead-dot' + (i === 0 ? ' mcx-lead-dot--active' : '');
    dotsRow.appendChild(dot);
  }
  wrapper.appendChild(dotsRow);

  const msgsArea = document.createElement('div');
  msgsArea.className = 'mcx-lead-msgs';
  wrapper.appendChild(msgsArea);

  const inputArea = document.createElement('div');
  inputArea.className = 'mcx-lead-input-area';
  wrapper.appendChild(inputArea);

  function updateDots(): void {
    const dots = dotsRow.querySelectorAll('.mcx-lead-dot');
    dots.forEach((d, i) => {
      d.classList.remove('mcx-lead-dot--active', 'mcx-lead-dot--done');
      if (i < currentStep) d.classList.add('mcx-lead-dot--done');
      else if (i === currentStep) d.classList.add('mcx-lead-dot--active');
    });
  }

  function addBotBubble(text: string): void {
    const theme = config.theme || {};
    const strokeColor = theme.botAvatarSvgColor || theme.primary || '#6366f1';
    const group = document.createElement('div');
    group.className = 'mcx-msg-group';
    group.innerHTML = `
      <div class="mcx-avatar mcx-avatar--bot">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2.2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
        </svg>
      </div>
      <div class="mcx-msg-stack"><div class="mcx-bubble mcx-bubble--bot">${sanitizeInput(text)}</div></div>
    `;
    msgsArea.appendChild(group);
    msgsArea.scrollTop = msgsArea.scrollHeight;
  }

  function addUserBubble(text: string): void {
    const group = document.createElement('div');
    group.className = 'mcx-msg-group mcx-msg-group--user';
    const initial = (text.charAt(0) || '?').toUpperCase();
    group.innerHTML = `
      <div class="mcx-avatar mcx-avatar--user">${initial}</div>
      <div class="mcx-msg-stack mcx-msg-stack--user"><div class="mcx-bubble mcx-bubble--user">${sanitizeInput(text)}</div></div>
    `;
    msgsArea.appendChild(group);
    msgsArea.scrollTop = msgsArea.scrollHeight;
  }

  function promptFor(field: LeadCaptureField): string {
    // Conversational templates for built-ins; admin-set label otherwise.
    if (field.key === 'name')  return '\u{1F44B} Welcome! I need a few quick details to get started. What\'s your name?';
    if (field.key === 'email') {
      const name = collected.name || '';
      return name ? `Nice to meet you, ${name}! What's your email?` : `What's your email?`;
    }
    if (field.key === 'phone') return 'Great! What\'s your phone number?';
    if (field.key === 'zip')   return 'Almost done! What\'s your zip code?';
    return `${field.label}?`;
  }

  function renderInputForStep(field: LeadCaptureField): void {
    inputArea.innerHTML = '';

    const labelEl = document.createElement('div');
    labelEl.className = 'mcx-lead-field-label';
    labelEl.innerHTML = `${sanitizeInput(field.label)}${field.required ? ' <span style="color:var(--err)">*</span>' : ' <span class="mcx-lead-optional">optional</span>'}`;
    inputArea.appendChild(labelEl);

    let inputEl: HTMLInputElement;
    let phoneHandle: PhoneInputHandle | null = null;
    if (field.type === 'phone') {
      const opt = field.phone_options ?? DEFAULT_PHONE_OPTIONS;
      phoneHandle = createPhoneInput(opt);
      phoneHandles.set(field.key, phoneHandle);
      inputArea.appendChild(phoneHandle.container);
      inputEl = phoneHandle.input;
    } else {
      inputEl = document.createElement('input');
      inputEl.type = field.type === 'email' ? 'email' : (field.type === 'number' ? 'tel' : 'text');
      if (field.type === 'number') inputEl.inputMode = 'numeric';
      inputEl.placeholder = field.label;
      inputEl.className = 'mcx-form-input';
      inputArea.appendChild(inputEl);
    }

    const errorEl = document.createElement('div');
    errorEl.className = 'mcx-lead-field-error';
    inputArea.appendChild(errorEl);

    const isLast = currentStep === fields.length - 1;
    const btn = document.createElement('button');
    btn.className = 'mcx-lead-submit';
    btn.textContent = isLast ? 'Get Started →' : 'Continue →';
    inputArea.appendChild(btn);

    const helpEl = document.createElement('div');
    helpEl.className = 'mcx-lead-help';
    helpEl.textContent = `Step ${currentStep + 1} of ${fields.length}`;
    inputArea.appendChild(helpEl);

    function submit(): void {
      const val = inputEl.value.trim();
      const selectedCountry = phoneHandle ? phoneHandle.getSelectedCountry() : undefined;
      const err = validateField(field, val, selectedCountry);
      if (err) {
        if (phoneHandle) phoneHandle.setError(err);
        else {
          errorEl.textContent = err;
          errorEl.style.display = 'block';
          inputEl.classList.add('mcx-field-error');
        }
        inputEl.classList.add('mcx-shake');
        setTimeout(() => inputEl.classList.remove('mcx-shake'), 400);
        return;
      }

      errorEl.style.display = 'none';
      inputEl.classList.remove('mcx-field-error');
      if (phoneHandle && val) phoneHandle.setValid(true);

      // Store collected value.
      if (phoneHandle && val) {
        collected[field.key] = normalizePhoneE164(val, phoneHandle.getSelectedCountry().dial);
      } else {
        collected[field.key] = val;
      }
      addUserBubble(val || '(skipped)');

      currentStep++;
      updateDots();

      if (currentStep >= fields.length) {
        // Done — show success splash, then call back.
        // Tear down any open picker overlay before swapping the form area.
        phoneHandles.forEach(h => h.closePicker());
        inputArea.innerHTML = '';
        const success = document.createElement('div');
        success.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;text-align:center';
        success.innerHTML = `
          <div style="width:44px;height:44px;border-radius:50%;background:rgba(5,150,105,.12);display:flex;align-items:center;justify-content:center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div style="font-size:14px;font-weight:600;color:#0F172A">You're all set!</div>
          <div style="font-size:12px;color:#64748B">Starting your chat now...</div>
        `;
        inputArea.appendChild(success);
        setTimeout(() => onComplete(buildLead(collected, fields)), 1200);
        return;
      }

      addBotBubble(promptFor(fields[currentStep]));
      renderInputForStep(fields[currentStep]);
    }

    btn.addEventListener('click', submit);
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    inputEl.addEventListener('input', () => {
      inputEl.classList.remove('mcx-field-error');
      errorEl.style.display = 'none';
      if (phoneHandle) phoneHandle.setError(null);
    });
    setTimeout(() => inputEl.focus(), 100);
  }

  if (fields.length === 0) {
    // Edge case: admin enabled lead capture but disabled every field.
    // Treat as "no form needed" — emit empty lead and let the widget continue.
    setTimeout(() => onComplete(buildLead({}, [])), 0);
    return wrapper;
  }
  addBotBubble(promptFor(fields[0]));
  renderInputForStep(fields[0]);

  return wrapper;
}

// ============================================================================
// Single-step variant — all fields on one card, one CTA
// ============================================================================

function createSingleStepLeadForm(
  config: ChatEmbedConfig,
  fields: LeadCaptureField[],
  onComplete: (lead: LeadData | null) => void,
): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'mcx-lead-conv mcx-lead-conv--single';

  const head = document.createElement('div');
  head.className = 'mcx-lead-single-head';
  head.innerHTML = `
    <h3 class="mcx-lead-single-title">Let's get started</h3>
    <p class="mcx-lead-single-sub">Tell us a bit about you so we can help right away.</p>
  `;
  wrapper.appendChild(head);

  const fieldsBox = document.createElement('div');
  fieldsBox.className = 'mcx-lead-single-fields';
  wrapper.appendChild(fieldsBox);

  // Track per-field input refs + phone handles so we can read values + show
  // errors on the single click.
  const refs: Array<{
    field: LeadCaptureField;
    input: HTMLInputElement;
    phone?: PhoneInputHandle;
    error: HTMLDivElement;
  }> = [];

  for (const f of fields) {
    const block = document.createElement('div');
    block.className = 'mcx-lead-single-block';

    const label = document.createElement('div');
    label.className = 'mcx-lead-field-label';
    label.innerHTML = `${sanitizeInput(f.label)}${f.required ? ' <span style="color:var(--p,#8349ff)">*</span>' : ' <span class="mcx-lead-optional">optional</span>'}`;
    block.appendChild(label);

    let input: HTMLInputElement;
    let phone: PhoneInputHandle | undefined;
    if (f.type === 'phone') {
      phone = createPhoneInput(f.phone_options ?? DEFAULT_PHONE_OPTIONS);
      block.appendChild(phone.container);
      input = phone.input;
    } else {
      input = document.createElement('input');
      input.type = f.type === 'email' ? 'email' : (f.type === 'number' ? 'tel' : 'text');
      if (f.type === 'number') input.inputMode = 'numeric';
      input.placeholder = '';
      input.className = 'mcx-form-input';
      block.appendChild(input);
    }
    const errEl = document.createElement('div');
    errEl.className = 'mcx-lead-field-error';
    block.appendChild(errEl);

    fieldsBox.appendChild(block);
    refs.push({ field: f, input, phone, error: errEl });

    input.addEventListener('input', () => {
      input.classList.remove('mcx-field-error');
      errEl.style.display = 'none';
      if (phone) phone.setError(null);
    });
  }

  const submitRow = document.createElement('div');
  submitRow.className = 'mcx-lead-single-submit-row';
  const btn = document.createElement('button');
  btn.className = 'mcx-lead-submit';
  btn.textContent = 'Get started →';
  submitRow.appendChild(btn);
  const helper = document.createElement('div');
  helper.className = 'mcx-lead-help';
  helper.textContent = 'By continuing you agree to our terms.';
  submitRow.appendChild(helper);
  wrapper.appendChild(submitRow);

  function submit(): void {
    let anyError = false;
    const collected: Record<string, string> = {};

    for (const r of refs) {
      const val = r.input.value.trim();
      const country = r.phone ? r.phone.getSelectedCountry() : undefined;
      const err = validateField(r.field, val, country);
      if (err) {
        anyError = true;
        if (r.phone) r.phone.setError(err);
        else {
          r.error.textContent = err;
          r.error.style.display = 'block';
          r.input.classList.add('mcx-field-error');
        }
        r.input.classList.add('mcx-shake');
        setTimeout(() => r.input.classList.remove('mcx-shake'), 400);
        continue;
      }
      if (r.phone && val) r.phone.setValid(true);
      collected[r.field.key] = r.phone && val
        ? normalizePhoneE164(val, r.phone.getSelectedCountry().dial)
        : val;
    }
    if (anyError) {
      // Focus the first error for screen readers + ease of correction.
      const firstBadInput = wrapper.querySelector<HTMLInputElement>('.mcx-field-error, .mcx-phone-combo--error input');
      firstBadInput?.focus();
      return;
    }
    refs.forEach(r => r.phone?.closePicker());
    btn.disabled = true;
    btn.textContent = 'Starting your chat...';
    setTimeout(() => onComplete(buildLead(collected, fields)), 600);
  }

  btn.addEventListener('click', submit);
  wrapper.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault();
      submit();
    }
  });

  if (fields.length === 0) {
    setTimeout(() => onComplete(buildLead({}, [])), 0);
  }
  return wrapper;
}

// ============================================================================
// Shared lead-payload builder
// ============================================================================

function buildLead(collected: Record<string, string>, fields: LeadCaptureField[]): LeadData {
  // Map collected values back to the top-level back-compat aliases for
  // the four built-ins so existing PostHog events / CRM ingestion that
  // reads ``lead.name``, ``lead.email``, etc. keep working unchanged.
  const builtin = (key: string): string => sanitizeInput(collected[key] ?? '');
  void countryByCode; // silence unused-import warning when phone fields disabled

  return {
    name: builtin('name'),
    email: builtin('email'),
    phone: collected.phone ?? '',
    zip: builtin('zip'),
    values: { ...collected },
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    platform: (navigator as any).platform || '',
    url: window.location.href,
    language: navigator.language,
    referrer: document.referrer,
  };
  // ``fields`` reserved for future per-field analytics (e.g. drop-off stats).
  void fields;
}

import type { ChatEmbedConfig } from '../../config/types';
import { sanitizeInput } from '../../utils/dom';
import { validateName, validateEmail, validatePhone, validateZip, normalizePhoneE164 } from './validation';
import { createPhoneField } from './phone-field';
import type { CountryEntry } from './country-data';

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

interface StepDef {
  field: string;
  botQuestion: string;
  label: string;
  type: string;
  placeholder: string;
  buttonText: string;
  helpText: string;
  validate: (val: string, extra?: unknown) => string | null;
  isPhone?: boolean;
}

export function createLeadCaptureForm(
  config: ChatEmbedConfig,
  onComplete: (lead: LeadData | null) => void,
): HTMLDivElement {
  const steps: StepDef[] = [
    {
      field: 'name',
      botQuestion: '\u{1F44B} Welcome! I need a few quick details to get started. What\'s your name?',
      label: 'Full name',
      type: 'text',
      placeholder: 'Full name',
      buttonText: 'Continue \u2192',
      helpText: '\u{1F512} Required to access the chat',
      validate: (v) => validateName(v),
    },
    {
      field: 'email',
      botQuestion: '', // dynamic: "Nice to meet you, {name}! What's your email?"
      label: 'Email address',
      type: 'email',
      placeholder: 'you@company.com',
      buttonText: 'Continue \u2192',
      helpText: '\u{1F512} Required to access the chat',
      validate: (v) => validateEmail(v),
    },
    {
      field: 'phone',
      botQuestion: 'Great! What\'s your phone number?',
      label: 'Phone number',
      type: 'tel',
      placeholder: '(555) 000-0000',
      buttonText: 'Continue \u2192',
      helpText: '\u{1F512} Step 3 of 4',
      validate: (v, extra) => validatePhone(v, extra as CountryEntry),
      isPhone: true,
    },
    {
      field: 'zip',
      botQuestion: 'Almost done! What\'s your zip code?',
      label: 'Zip code',
      type: 'text',
      placeholder: 'e.g. 75201',
      buttonText: 'Get Started \u2192',
      helpText: '\u{1F512} Final step',
      validate: (v) => validateZip(v),
    },
  ];

  let currentStep = 0;
  const collected: Record<string, string> = {};
  let phoneFieldRefs: ReturnType<typeof createPhoneField> | null = null;

  // Root wrapper — fills the messages area as an overlay
  const wrapper = document.createElement('div');
  wrapper.className = 'mcx-lead-conv';

  // Progress dots
  const dotsRow = document.createElement('div');
  dotsRow.className = 'mcx-lead-dots';
  for (let i = 0; i < steps.length; i++) {
    const dot = document.createElement('div');
    dot.className = 'mcx-lead-dot';
    if (i === 0) dot.classList.add('mcx-lead-dot--active');
    dotsRow.appendChild(dot);
  }
  wrapper.appendChild(dotsRow);

  // Messages area (scrollable)
  const msgsArea = document.createElement('div');
  msgsArea.className = 'mcx-lead-msgs';
  wrapper.appendChild(msgsArea);

  // Input area at bottom
  const inputArea = document.createElement('div');
  inputArea.className = 'mcx-lead-input-area';
  wrapper.appendChild(inputArea);

  function updateDots(): void {
    const dots = dotsRow.querySelectorAll('.mcx-lead-dot');
    dots.forEach((dot, i) => {
      dot.classList.remove('mcx-lead-dot--active', 'mcx-lead-dot--done');
      if (i < currentStep) dot.classList.add('mcx-lead-dot--done');
      else if (i === currentStep) dot.classList.add('mcx-lead-dot--active');
    });
  }

  function addBotBubble(text: string): void {
    const group = document.createElement('div');
    group.className = 'mcx-msg-group';
    group.innerHTML = `
      <div class="mcx-avatar mcx-avatar--bot">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
        </svg>
      </div>
      <div class="mcx-msg-stack"><div class="mcx-bubble mcx-bubble--bot">${text}</div></div>
    `;
    msgsArea.appendChild(group);
    msgsArea.scrollTop = msgsArea.scrollHeight;
  }

  function addUserBubble(text: string): void {
    const group = document.createElement('div');
    group.className = 'mcx-msg-group mcx-msg-group--user';
    const initial = text.charAt(0).toUpperCase();
    group.innerHTML = `
      <div class="mcx-avatar mcx-avatar--user">${initial}</div>
      <div class="mcx-msg-stack mcx-msg-stack--user"><div class="mcx-bubble mcx-bubble--user">${sanitizeInput(text)}</div></div>
    `;
    msgsArea.appendChild(group);
    msgsArea.scrollTop = msgsArea.scrollHeight;
  }

  function renderInputForStep(step: StepDef): void {
    inputArea.innerHTML = '';
    phoneFieldRefs = null;

    const labelEl = document.createElement('div');
    labelEl.className = 'mcx-lead-field-label';
    labelEl.innerHTML = `${step.label} <span style="color:var(--err)">*</span>`;
    inputArea.appendChild(labelEl);

    let inputEl: HTMLInputElement;

    if (step.isPhone) {
      phoneFieldRefs = createPhoneField();
      inputArea.appendChild(phoneFieldRefs.container);
      inputEl = phoneFieldRefs.input;
    } else {
      inputEl = document.createElement('input');
      inputEl.type = step.type;
      inputEl.placeholder = step.placeholder;
      inputEl.className = 'mcx-form-input';
      inputArea.appendChild(inputEl);
    }

    const errorEl = document.createElement('div');
    errorEl.className = 'mcx-lead-field-error';
    inputArea.appendChild(errorEl);

    const btn = document.createElement('button');
    btn.className = 'mcx-lead-submit';
    btn.textContent = step.buttonText;
    inputArea.appendChild(btn);

    const helpEl = document.createElement('div');
    helpEl.className = 'mcx-lead-help';
    helpEl.textContent = step.helpText;
    inputArea.appendChild(helpEl);

    function submit(): void {
      const val = inputEl.value.trim();
      const extra = step.isPhone && phoneFieldRefs ? phoneFieldRefs.getSelectedCountry() : undefined;
      const err = step.validate(val, extra);
      if (err) {
        if (step.isPhone && phoneFieldRefs) {
          phoneFieldRefs.setError(err);
        } else {
          errorEl.textContent = err;
          errorEl.style.display = 'block';
          inputEl.classList.add('mcx-field-error');
        }
        // Shake animation
        inputEl.classList.add('mcx-shake');
        setTimeout(() => inputEl.classList.remove('mcx-shake'), 400);
        return;
      }

      errorEl.style.display = 'none';
      inputEl.classList.remove('mcx-field-error');

      // Normalize phone to E.164 if phone step
      if (step.isPhone && phoneFieldRefs) {
        collected[step.field] = normalizePhoneE164(val, phoneFieldRefs.getSelectedCountry().dial);
      } else {
        collected[step.field] = val;
      }

      // Show user answer as chat bubble
      addUserBubble(val);

      currentStep++;
      updateDots();

      if (currentStep >= steps.length) {
        // Done — show success, then complete
        inputArea.innerHTML = '';
        const successDiv = document.createElement('div');
        successDiv.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;text-align:center';
        successDiv.innerHTML = `
          <div style="width:44px;height:44px;border-radius:50%;background:rgba(5,150,105,.12);display:flex;align-items:center;justify-content:center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div style="font-size:14px;font-weight:600;color:#0F172A">You're all set!</div>
          <div style="font-size:12px;color:#64748B">Starting your chat now...</div>
        `;
        inputArea.appendChild(successDiv);

        setTimeout(() => {
          const lead: LeadData = {
            name: sanitizeInput(collected.name),
            email: sanitizeInput(collected.email),
            phone: collected.phone,
            zip: sanitizeInput(collected.zip),
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            url: window.location.href,
            language: navigator.language,
            referrer: document.referrer,
          };
          onComplete(lead);
        }, 1200);
        return;
      }

      // Next step
      const nextStep = steps[currentStep];
      let question = nextStep.botQuestion;
      if (nextStep.field === 'email') {
        question = `Nice to meet you, ${sanitizeInput(collected.name)}! What's your email?`;
      }
      addBotBubble(question);
      renderInputForStep(nextStep);
    }

    btn.addEventListener('click', submit);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
    inputEl.addEventListener('input', () => {
      inputEl.classList.remove('mcx-field-error');
      errorEl.style.display = 'none';
      if (step.isPhone && phoneFieldRefs) {
        phoneFieldRefs.setError(null);
      }
    });

    setTimeout(() => inputEl.focus(), 100);
  }

  // Start step 0
  addBotBubble(steps[0].botQuestion);
  renderInputForStep(steps[0]);

  return wrapper;
}

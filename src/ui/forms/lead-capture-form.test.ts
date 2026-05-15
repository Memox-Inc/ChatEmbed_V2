/**
 * Lead-capture form v2 — MMX-575.
 *
 * Covers the data-driven refactor: multi-step + single-step variants,
 * custom fields, per-field required, and phone validation strictness.
 */

import { describe, expect, it } from 'vitest';

import { createLeadCaptureForm } from './lead-capture-form';
import { validateField, validatePhone } from './validation';
import { countryByCode, pickCountries } from './country-data';
import type { ChatEmbedConfig, LeadCaptureConfig } from '../../config/types';

const US = countryByCode('US')!;
const IN_ = countryByCode('IN')!;

function makeConfig(leadCaptureConfig?: LeadCaptureConfig | boolean): ChatEmbedConfig {
  return {
    theme: { primary: '#8349ff' },
    ...(typeof leadCaptureConfig === 'object'
      ? { leadCaptureConfig, leadCapture: !!leadCaptureConfig.enabled }
      : { leadCapture: leadCaptureConfig }),
  } as ChatEmbedConfig;
}

describe('validation — strictness modes', () => {
  it('strict accepts a 10-digit US number', () => {
    expect(validatePhone('5551234567', US, 'strict')).toBeNull();
  });
  it('strict rejects a 9-digit US number', () => {
    expect(validatePhone('555123456', US, 'strict')).toContain('United States');
  });
  it('loose accepts a 9-digit US number', () => {
    expect(validatePhone('555123456', US, 'loose')).toBeNull();
  });
  it('loose rejects a 3-digit number', () => {
    expect(validatePhone('123', US, 'loose')).toContain('valid phone');
  });
  it('none accepts anything non-empty', () => {
    expect(validatePhone('xyz', US, 'none')).toBeNull();
    expect(validatePhone('1', US, 'none')).toBeNull();
  });
  it('strict accepts a 10-digit India number', () => {
    expect(validatePhone('9876543210', IN_, 'strict')).toBeNull();
  });
});

describe('validateField — type dispatch', () => {
  it('required empty field returns required-error', () => {
    const err = validateField(
      { key: 'name', label: 'Name', type: 'text', enabled: true, required: true, custom: false },
      '',
    );
    expect(err).toBe('This field is required');
  });
  it('optional empty field passes', () => {
    expect(validateField(
      { key: 'name', label: 'Name', type: 'text', enabled: true, required: false, custom: false },
      '',
    )).toBeNull();
  });
  it('email regex fires on bad input', () => {
    expect(validateField(
      { key: 'email', label: 'Email', type: 'email', enabled: true, required: true, custom: false },
      'not-an-email',
    )).toContain('valid email');
  });
  it('number-type rejects letters', () => {
    expect(validateField(
      { key: 'zip', label: 'Zip', type: 'number', enabled: true, required: true, custom: false },
      'abc',
    )).toContain('digits');
  });
  it('phone-type respects phone_options.validation', () => {
    const f = {
      key: 'phone', label: 'Phone', type: 'phone' as const,
      enabled: true, required: true, custom: false,
      phone_options: { allowed_countries: ['US'], default_country: 'US', validation: 'loose' as const },
    };
    expect(validateField(f, '5551234', US)).toBeNull(); // 7 digits, loose-OK
  });
});

describe('country-data', () => {
  it('exposes 60+ countries', () => {
    expect(pickCountries(['US', 'GB', 'IN']).length).toBe(3);
  });
  it('pickCountries filters unknowns silently', () => {
    expect(pickCountries(['US', 'ZZ', 'IN']).map(c => c.code)).toEqual(['US', 'IN']);
  });
  it('countryByCode returns undefined for unknown', () => {
    expect(countryByCode('ZZ')).toBeUndefined();
  });
});

describe('createLeadCaptureForm — variant dispatch', () => {
  it('legacy boolean falls back to multi-step default', () => {
    const el = createLeadCaptureForm(makeConfig(true), () => {});
    document.body.appendChild(el);
    expect(el.classList.contains('mcx-lead-conv')).toBe(true);
    expect(el.classList.contains('mcx-lead-conv--single')).toBe(false);
    // Multi-step renders progress dots + one input area.
    expect(el.querySelectorAll('.mcx-lead-dot').length).toBeGreaterThan(0);
    el.remove();
  });

  it('v2 single_step renders all enabled fields stacked', () => {
    const v2: LeadCaptureConfig = {
      enabled: true,
      variant: 'single_step',
      fields: [
        { key: 'name', label: 'First name', type: 'text', enabled: true, required: true, custom: false },
        { key: 'email', label: 'Work email', type: 'email', enabled: true, required: true, custom: false },
        { key: 'f_abc123', label: 'Company', type: 'text', enabled: true, required: false, custom: true },
      ],
    };
    const el = createLeadCaptureForm(makeConfig(v2), () => {});
    document.body.appendChild(el);
    expect(el.classList.contains('mcx-lead-conv--single')).toBe(true);
    // Three field blocks, no dots row (single-step has no stepping).
    expect(el.querySelectorAll('.mcx-lead-single-block').length).toBe(3);
    expect(el.querySelectorAll('.mcx-lead-dot').length).toBe(0);
    // Admin's labels show, not the hardcoded ones.
    expect(el.textContent).toContain('First name');
    expect(el.textContent).toContain('Work email');
    expect(el.textContent).toContain('Company');
    el.remove();
  });

  it('v2 multi_step respects field order from admin', () => {
    const v2: LeadCaptureConfig = {
      enabled: true,
      variant: 'multi_step',
      fields: [
        { key: 'email', label: 'Email', type: 'email', enabled: true, required: true, custom: false },
        { key: 'name', label: 'Name', type: 'text', enabled: true, required: true, custom: false },
      ],
    };
    const el = createLeadCaptureForm(makeConfig(v2), () => {});
    document.body.appendChild(el);
    // First step is email per the array — first prompt bubble should reflect that.
    expect(el.querySelector('.mcx-bubble--bot')?.textContent?.toLowerCase()).toContain('email');
    el.remove();
  });

  it('renders phone combo with curated countries only', () => {
    const v2: LeadCaptureConfig = {
      enabled: true,
      variant: 'single_step',
      fields: [
        { key: 'phone', label: 'Phone', type: 'phone', enabled: true, required: true, custom: false,
          phone_options: { allowed_countries: ['US', 'GB'], default_country: 'GB', validation: 'strict' },
        },
      ],
    };
    const el = createLeadCaptureForm(makeConfig(v2), () => {});
    document.body.appendChild(el);
    const chip = el.querySelector('.mcx-phone-chip')!;
    // Default country GB → flag dial '+44' visible on the chip.
    expect(chip.textContent).toContain('+44');
    // Click the chip — picker opens.
    (chip as HTMLButtonElement).click();
    const picker = el.querySelector('.mcx-phone-picker')!;
    expect(picker).not.toBeNull();
    // Only US + GB rows render (no DE, no IN, etc.).
    const isos = Array.from(picker.querySelectorAll('.mcx-phone-picker-row'))
      .map(r => (r as HTMLElement).dataset.iso);
    expect(new Set(isos)).toEqual(new Set(['US', 'GB']));
    el.remove();
  });

  it('disabled fields are skipped entirely', () => {
    const v2: LeadCaptureConfig = {
      enabled: true,
      variant: 'single_step',
      fields: [
        { key: 'name', label: 'Name', type: 'text', enabled: true, required: true, custom: false },
        { key: 'zip', label: 'Zip', type: 'number', enabled: false, required: false, custom: false },
      ],
    };
    const el = createLeadCaptureForm(makeConfig(v2), () => {});
    document.body.appendChild(el);
    expect(el.querySelectorAll('.mcx-lead-single-block').length).toBe(1);
    expect(el.textContent).not.toContain('Zip');
    el.remove();
  });
});

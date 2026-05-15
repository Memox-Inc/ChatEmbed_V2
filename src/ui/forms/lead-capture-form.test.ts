/**
 * Lead-capture form rendering tests.
 *
 * Specifically: the form must respect the user-defined field order +
 * enabled flag + label overrides from
 * ``config.leadCaptureConfig.fields`` (the v2 server config shape).
 * Bug fixed here was a hardcoded ``steps`` array in
 * ``createLeadCaptureForm`` that ignored the config entirely, so
 * reordering email-above-name in the dashboard never reflected in the
 * live widget preview.
 */
import { describe, expect, it, vi } from 'vitest';
import { createLeadCaptureForm } from './lead-capture-form';
import type { ChatEmbedConfig, LeadCaptureFieldConfig } from '../../config/types';

function fields(...rows: Partial<LeadCaptureFieldConfig>[]): LeadCaptureFieldConfig[] {
  return rows.map((r) => ({
    key: r.key ?? '',
    label: r.label ?? r.key ?? '',
    type: r.type ?? 'text',
    enabled: r.enabled ?? true,
    required: r.required ?? true,
    custom: r.custom ?? false,
    ...(r.phone_options ? { phone_options: r.phone_options } : {}),
  }));
}

function readFirstStepLabel(el: HTMLElement): string | null {
  return el.querySelector('.mcx-lead-field-label')?.textContent?.trim() ?? null;
}

function readDotCount(el: HTMLElement): number {
  return el.querySelectorAll('.mcx-lead-dot').length;
}

describe('createLeadCaptureForm — field order', () => {
  it('falls back to built-in default order when no leadCaptureConfig is provided', () => {
    const config: ChatEmbedConfig = {};
    const el = createLeadCaptureForm(config, vi.fn());

    // Default is 3 visible steps (name → email → phone), zip omitted.
    expect(readDotCount(el)).toBe(3);
    // First field shown should be the name input.
    expect(readFirstStepLabel(el)).toContain('Full name');
  });

  it('honors user-defined field order — email first, then name', () => {
    const config: ChatEmbedConfig = {
      leadCaptureConfig: {
        enabled: true,
        fields: fields(
          { key: 'email', label: 'Your email', type: 'email' },
          { key: 'name', label: 'Your name', type: 'text' },
        ),
      },
    };

    const el = createLeadCaptureForm(config, vi.fn());
    expect(readDotCount(el)).toBe(2);
    // The form starts at step 0 — first rendered input must be email.
    const firstLabel = readFirstStepLabel(el);
    expect(firstLabel).toContain('Your email');
    expect(firstLabel).not.toContain('Your name');
  });

  it('filters out disabled fields from the step sequence', () => {
    const config: ChatEmbedConfig = {
      leadCaptureConfig: {
        enabled: true,
        fields: fields(
          { key: 'name', label: 'Name', type: 'text', enabled: true },
          { key: 'email', label: 'Email', type: 'email', enabled: false },
          { key: 'phone', label: 'Phone', type: 'phone', enabled: true },
        ),
      },
    };

    const el = createLeadCaptureForm(config, vi.fn());
    // 3 fields in config but email is disabled → 2 steps.
    expect(readDotCount(el)).toBe(2);
  });

  it('uses the user-provided label override on a built-in key', () => {
    const config: ChatEmbedConfig = {
      leadCaptureConfig: {
        enabled: true,
        fields: fields({ key: 'name', label: 'Trade name', type: 'text' }),
      },
    };

    const el = createLeadCaptureForm(config, vi.fn());
    expect(readFirstStepLabel(el)).toContain('Trade name');
  });

  it('renders custom (user-defined) fields with their label', () => {
    const config: ChatEmbedConfig = {
      leadCaptureConfig: {
        enabled: true,
        fields: fields({
          key: 'f_company',
          label: 'Company name',
          type: 'text',
          custom: true,
          required: true,
        }),
      },
    };

    const el = createLeadCaptureForm(config, vi.fn());
    expect(readDotCount(el)).toBe(1);
    expect(readFirstStepLabel(el)).toContain('Company name');
  });

  it('emits onComplete(null) instantly when every field is disabled', async () => {
    const onComplete = vi.fn();
    const config: ChatEmbedConfig = {
      leadCaptureConfig: {
        enabled: true,
        fields: fields(
          { key: 'name', label: 'Name', type: 'text', enabled: false },
          { key: 'email', label: 'Email', type: 'email', enabled: false },
        ),
      },
    };

    createLeadCaptureForm(config, onComplete);

    // queueMicrotask fires before the next macrotask — flush via a Promise.
    await Promise.resolve();
    expect(onComplete).toHaveBeenCalledWith(null);
  });
});

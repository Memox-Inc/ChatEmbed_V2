/**
 * Persistent pulse loop attractor — keeps a soft pulse animation on the
 * launcher indefinitely (vs the default 3-iteration intro pulse). Tests
 * cover enable/disable + the suppression case where pulse is implicitly
 * off.
 */
import { describe, expect, it } from 'vitest';
import { applyPulse } from './pulse';
import type { ChatEmbedConfig } from '../../config/types';

function makeButton(): HTMLButtonElement {
  return document.createElement('button');
}

describe('applyPulse', () => {
  it('adds mcx-launcher--pulse class when pulse.enabled=true', () => {
    const btn = makeButton();
    const cfg: ChatEmbedConfig = {
      launcher: { attractors: { pulse: { enabled: true } } },
    };
    applyPulse(btn, cfg);
    expect(btn.classList.contains('mcx-launcher--pulse')).toBe(true);
  });

  it('does not add the class when pulse.enabled=false', () => {
    const btn = makeButton();
    const cfg: ChatEmbedConfig = {
      launcher: { attractors: { pulse: { enabled: false } } },
    };
    applyPulse(btn, cfg);
    expect(btn.classList.contains('mcx-launcher--pulse')).toBe(false);
  });

  it('does not add the class when pulse config is missing', () => {
    const btn = makeButton();
    applyPulse(btn, {});
    expect(btn.classList.contains('mcx-launcher--pulse')).toBe(false);
  });
});

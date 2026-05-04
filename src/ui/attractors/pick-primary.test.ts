/**
 * pickPrimaryAttractor — attractor precedence rules extracted from index.ts.
 *
 * Rules (priority order):
 *   1. persona enabled + has name + has message  → 'persona'
 *   2. pill form factor (no persona)             → null (teaser suppressed)
 *   3. teaser enabled + has text                 → 'teaser'
 *   4. otherwise                                 → null
 *
 * Edge cases:
 *   - persona enabled but missing name/message   → falls through to rule 2/3/4
 *   - teaser enabled but text is empty string    → null
 */
import { describe, expect, it } from 'vitest';
import { pickPrimaryAttractor } from './pick-primary';
import type { LauncherConfig } from '../../config/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function launcher(overrides: Partial<LauncherConfig> = {}): LauncherConfig {
  return { form_factor: 'round', ...overrides };
}

// ── Precedence cases ──────────────────────────────────────────────────────────

describe('pickPrimaryAttractor — precedence rules', () => {
  it('rule 1: persona enabled + name + message → "persona"', () => {
    expect(
      pickPrimaryAttractor(
        launcher({
          attractors: {
            persona: { enabled: true, name: 'Sarah', message: 'Hi there!' },
            teaser: { enabled: true, text: 'Need help?' },
          },
        }),
      ),
    ).toBe('persona');
  });

  it('rule 2: pill form factor (no persona) → null even when teaser is enabled', () => {
    expect(
      pickPrimaryAttractor(
        launcher({
          form_factor: 'pill',
          attractors: {
            teaser: { enabled: true, text: 'Need help?' },
          },
        }),
      ),
    ).toBeNull();
  });

  it('rule 2 exception: pill does NOT suppress persona (rule 1 takes priority)', () => {
    // Pill suppresses teaser only — persona is richer and outranks rule 2.
    expect(
      pickPrimaryAttractor(
        launcher({
          form_factor: 'pill',
          attractors: {
            persona: { enabled: true, name: 'Sarah', message: 'Hi' },
            teaser: { enabled: true, text: 'Need help?' },
          },
        }),
      ),
    ).toBe('persona');
  });

  it('rule 3: round form factor + teaser enabled + text → "teaser"', () => {
    expect(
      pickPrimaryAttractor(
        launcher({
          form_factor: 'round',
          attractors: {
            teaser: { enabled: true, text: 'Need help?' },
          },
        }),
      ),
    ).toBe('teaser');
  });

  it('rule 4: round form factor + no attractors → null', () => {
    expect(pickPrimaryAttractor(launcher({ form_factor: 'round' }))).toBeNull();
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('pickPrimaryAttractor — edge cases', () => {
  it('persona enabled but name missing → falls through (pill → null)', () => {
    expect(
      pickPrimaryAttractor(
        launcher({
          form_factor: 'pill',
          attractors: {
            persona: { enabled: true, name: '', message: 'Hi' },
            teaser: { enabled: true, text: 'Need help?' },
          },
        }),
      ),
    ).toBeNull();
  });

  it('persona enabled but name missing → falls through (round → teaser)', () => {
    expect(
      pickPrimaryAttractor(
        launcher({
          form_factor: 'round',
          attractors: {
            persona: { enabled: true, name: '', message: 'Hi' },
            teaser: { enabled: true, text: 'Need help?' },
          },
        }),
      ),
    ).toBe('teaser');
  });

  it('persona enabled but message missing → falls through (round → teaser)', () => {
    expect(
      pickPrimaryAttractor(
        launcher({
          form_factor: 'round',
          attractors: {
            persona: { enabled: true, name: 'Sarah', message: '' },
            teaser: { enabled: true, text: 'Need help?' },
          },
        }),
      ),
    ).toBe('teaser');
  });

  it('teaser enabled but text is empty string → null', () => {
    expect(
      pickPrimaryAttractor(
        launcher({
          form_factor: 'round',
          attractors: {
            teaser: { enabled: true, text: '' },
          },
        }),
      ),
    ).toBeNull();
  });

  it('returns null when launcher config is undefined', () => {
    expect(pickPrimaryAttractor(undefined)).toBeNull();
  });

  it('returns null when attractors object is absent', () => {
    expect(pickPrimaryAttractor(launcher({}))).toBeNull();
  });

  it('teaser.enabled=false → null even with text set', () => {
    expect(
      pickPrimaryAttractor(
        launcher({
          attractors: { teaser: { enabled: false, text: 'Need help?' } },
        }),
      ),
    ).toBeNull();
  });

  it('persona.enabled=false → falls through to teaser', () => {
    expect(
      pickPrimaryAttractor(
        launcher({
          attractors: {
            persona: { enabled: false, name: 'Sarah', message: 'Hi' },
            teaser: { enabled: true, text: 'Need help?' },
          },
        }),
      ),
    ).toBe('teaser');
  });
});

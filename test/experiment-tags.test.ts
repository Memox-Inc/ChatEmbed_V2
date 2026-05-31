/**
 * Tests for experiment-tag injection into PostHog events.
 *
 * Covers:
 *   (a) setExperimentTags with one valid assignment -> capture includes
 *       memox_experiments and memox_variants.
 *   (b) setExperimentTags with no experiments -> neither key present.
 *   (c) Entry with no variant_label is skipped (defensive coding for
 *       older backends).
 *   (d) Repeated setExperimentTags clears previous tags when called
 *       with empty array.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  init,
  capture,
  setExperimentTags,
  __resetForTesting,
} from '../src/analytics/posthog';

// Minimal helper: parse the request body from a fetch mock call.
function parseCaptureBody(fetchMock: ReturnType<typeof vi.fn>, callIndex = 0): Record<string, unknown> {
  const [, options] = fetchMock.mock.calls[callIndex];
  return JSON.parse((options as RequestInit).body as string);
}

describe('experiment tags on PostHog events', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetForTesting();
    fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    // Bootstrap analytics with a key so capture() is not a no-op.
    init({
      apiKey: 'phc_test_key',
      orgId: 'org_1',
      agentId: 'agent_1',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    __resetForTesting();
  });

  it('(a) one assignment -> capture includes memox_experiments array and memox_variants string', () => {
    setExperimentTags([
      { experiment: 'exp1', variant: 'variant_public_1', variant_label: 'B' },
    ]);

    capture('chat_widget_loaded');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = parseCaptureBody(fetchMock);
    const props = body.properties as Record<string, unknown>;

    expect(props.memox_experiments).toEqual(['exp1']);
    expect(props.memox_variants).toBe('exp1:B');
  });

  it('(b) no experiments set -> neither memox_experiments nor memox_variants present', () => {
    // setExperimentTags never called — both keys must be absent.
    capture('chat_widget_loaded');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = parseCaptureBody(fetchMock);
    const props = body.properties as Record<string, unknown>;

    expect(Object.prototype.hasOwnProperty.call(props, 'memox_experiments')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(props, 'memox_variants')).toBe(false);
  });

  it('(b) empty array -> neither key present', () => {
    setExperimentTags([]);

    capture('chat_widget_loaded');

    const body = parseCaptureBody(fetchMock);
    const props = body.properties as Record<string, unknown>;

    expect(Object.prototype.hasOwnProperty.call(props, 'memox_experiments')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(props, 'memox_variants')).toBe(false);
  });

  it('(c) entry with missing variant_label is skipped', () => {
    // Backend omits variant_label on older deploys — the entry is invalid
    // and must not contribute to either tag.
    setExperimentTags([
      { experiment: 'exp_old', variant: 'v_old' }, // no variant_label
    ]);

    capture('chat_test');

    const body = parseCaptureBody(fetchMock);
    const props = body.properties as Record<string, unknown>;

    expect(Object.prototype.hasOwnProperty.call(props, 'memox_experiments')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(props, 'memox_variants')).toBe(false);
  });

  it('(c) entry with empty-string variant_label is skipped; valid sibling still wins', () => {
    setExperimentTags([
      { experiment: 'exp_bad', variant: 'v_bad', variant_label: '' },
      { experiment: 'exp_good', variant: 'v_good', variant_label: 'A' },
    ]);

    capture('chat_test');

    const body = parseCaptureBody(fetchMock);
    const props = body.properties as Record<string, unknown>;

    expect(props.memox_experiments).toEqual(['exp_good']);
    expect(props.memox_variants).toBe('exp_good:A');
  });

  it('(d) calling setExperimentTags with empty array after assignment clears tags', () => {
    setExperimentTags([{ experiment: 'exp1', variant: 'v1', variant_label: 'B' }]);
    setExperimentTags([]); // clear

    capture('chat_test');

    const body = parseCaptureBody(fetchMock);
    const props = body.properties as Record<string, unknown>;

    expect(Object.prototype.hasOwnProperty.call(props, 'memox_experiments')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(props, 'memox_variants')).toBe(false);
  });

  it('tags are present on every subsequent capture after setExperimentTags', () => {
    setExperimentTags([{ experiment: 'exp1', variant: 'v1', variant_label: 'B' }]);

    capture('chat_widget_loaded');
    capture('chat_opened');
    capture('chat_lead_captured');

    expect(fetchMock).toHaveBeenCalledTimes(3);

    for (let i = 0; i < 3; i++) {
      const props = parseCaptureBody(fetchMock, i).properties as Record<string, unknown>;
      expect(props.memox_experiments).toEqual(['exp1']);
      expect(props.memox_variants).toBe('exp1:B');
    }
  });
});

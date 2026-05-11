import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOrCreateDistinctId } from './distinct-id';

const STORAGE_KEY = 'mmx_chat_distinct_id';

describe('getOrCreateDistinctId', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('returns a string starting with mmx-', () => {
    const id = getOrCreateDistinctId();
    expect(id).toMatch(/^mmx-/);
  });

  it('persists across calls (second call returns same value)', () => {
    const first = getOrCreateDistinctId();
    const second = getOrCreateDistinctId();
    expect(second).toBe(first);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(first);
  });

  it('uses crypto.randomUUID when available', () => {
    const mockUUID = '11111111-2222-4333-a444-555555555555';
    const randomUUIDSpy = vi.fn().mockReturnValue(mockUUID);
    vi.stubGlobal('crypto', { randomUUID: randomUUIDSpy });

    const id = getOrCreateDistinctId();
    expect(randomUUIDSpy).toHaveBeenCalledTimes(1);
    expect(id).toBe(`mmx-${mockUUID}`);
  });

  it('falls back to Math.random when crypto.randomUUID is missing', () => {
    // Remove randomUUID from crypto (keep crypto object but without randomUUID)
    vi.stubGlobal('crypto', {});
    const mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const id = getOrCreateDistinctId();
    expect(id).toMatch(/^mmx-/);
    expect(mathRandomSpy).toHaveBeenCalled();
  });

  it('falls back to Math.random when crypto is undefined', () => {
    vi.stubGlobal('crypto', undefined);
    const mathRandomSpy = vi.spyOn(Math, 'random');

    const id = getOrCreateDistinctId();
    expect(id).toMatch(/^mmx-/);
    expect(mathRandomSpy).toHaveBeenCalled();
  });

  it('returns mmx-fallback-... when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });

    const id = getOrCreateDistinctId();
    expect(id).toMatch(/^mmx-fallback-\d+$/);
  });
});

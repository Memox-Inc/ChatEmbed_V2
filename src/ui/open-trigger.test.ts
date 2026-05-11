/**
 * OpenTriggerStore — tiny stateful cell that holds the pending
 * chat-open trigger between the smart-auto-open callback and handleToggle.
 *
 * Correctness requirements:
 *   - Starts empty (consume returns undefined)
 *   - set() + consume() returns the stored value
 *   - consume() clears the store so a second consume returns undefined
 *     (HARD-6 regression: nextOpenTrigger was never cleared in the
 *      close branch, so every subsequent open was tagged 'auto_open')
 *   - consume() before set() returns undefined (normal close-branch path)
 */
import { describe, expect, it } from 'vitest';
import { createOpenTriggerStore } from './open-trigger';

describe('createOpenTriggerStore', () => {
  it('first consume returns undefined (starts empty)', () => {
    const store = createOpenTriggerStore();
    expect(store.consume()).toBeUndefined();
  });

  it('set + consume returns "auto_open"', () => {
    const store = createOpenTriggerStore();
    store.set('auto_open');
    expect(store.consume()).toBe('auto_open');
  });

  it('set + consume + consume — second consume returns undefined (HARD-6 regression)', () => {
    const store = createOpenTriggerStore();
    store.set('auto_open');
    store.consume(); // first read — clears
    expect(store.consume()).toBeUndefined(); // must be gone
  });

  it('consume without prior set returns undefined (close-branch case)', () => {
    const store = createOpenTriggerStore();
    // simulate: handleToggle called when chat is CLOSING (no auto_open was queued)
    expect(store.consume()).toBeUndefined();
  });

  it('set is idempotent — repeated sets do not corrupt the store', () => {
    const store = createOpenTriggerStore();
    store.set('auto_open');
    store.set('auto_open'); // second set before consume
    expect(store.consume()).toBe('auto_open');
    expect(store.consume()).toBeUndefined();
  });

  it('multiple independent stores do not share state', () => {
    const storeA = createOpenTriggerStore();
    const storeB = createOpenTriggerStore();
    storeA.set('auto_open');
    expect(storeB.consume()).toBeUndefined();
    expect(storeA.consume()).toBe('auto_open');
  });
});

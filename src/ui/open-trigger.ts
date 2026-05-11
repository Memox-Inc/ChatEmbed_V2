/**
 * OpenTriggerStore — a tiny one-slot cell that carries the pending chat-open
 * trigger from the smart-auto-open callback into handleToggle().
 *
 * Background:
 *   The smart-auto-open callback fires when scroll/time thresholds are met and
 *   calls handleToggle(). handleToggle() needs to know whether this open was
 *   automatic (so it can tag the analytics event correctly and skip the
 *   notifyManualOpen() suppression call). Using a module-level variable for
 *   this introduces a subtle bug: if the close branch of handleToggle() is hit
 *   without consuming the trigger, the stale value leaks into the next open
 *   (HARD-6). This store makes the read-and-clear atomic via consume().
 *
 * Usage in index.ts:
 *   const triggerStore = createOpenTriggerStore();
 *
 *   // smart-auto-open callback:
 *   triggerStore.set('auto_open');
 *   handleToggle();
 *
 *   // inside handleToggle:
 *   const trigger = triggerStore.consume(); // reads + clears atomically
 */

export interface OpenTriggerStore {
  /** Queue a trigger to be picked up by the next handleToggle() call. */
  set(t: 'auto_open'): void;
  /** Read the pending trigger and clear the store. Returns undefined if empty. */
  consume(): 'auto_open' | undefined;
}

export function createOpenTriggerStore(): OpenTriggerStore {
  let pending: 'auto_open' | undefined;

  return {
    set(t) {
      pending = t;
    },
    consume() {
      const val = pending;
      pending = undefined;
      return val;
    },
  };
}

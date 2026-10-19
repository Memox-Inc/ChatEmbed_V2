/**
 * MMX-1373 — the "a human has been asked" strip.
 *
 * The behaviour most worth locking down is what the strip does *not* have: no
 * countdown, no spinner, no time language. A parked chat only ends when a rep
 * claims it, so any ETA would assert a deadline nothing enforces — the same
 * false promise MMX-1344 removed.
 */

import { describe, expect, it } from 'vitest';

import { HANDOFF_STATUS_TEXT, createHandoffStatusStrip, shouldShowHandoffStatus } from './handoff-status-strip';

describe('handoff status strip (MMX-1373)', () => {
  it('renders the intent copy, which claims no connection', () => {
    const strip = createHandoffStatusStrip();

    expect(strip.textContent).toContain(HANDOFF_STATUS_TEXT);
    expect(strip.textContent).toContain("I've let the team know");
    // The sentence this whole change exists to remove.
    expect(strip.textContent?.toLowerCase()).not.toContain('connected');
    expect(strip.textContent?.toLowerCase()).not.toContain('has joined');
  });

  it('announces politely rather than interrupting', () => {
    const strip = createHandoffStatusStrip();

    expect(strip.getAttribute('role')).toBe('status');
    expect(strip.getAttribute('aria-live')).toBe('polite');
  });

  it('uses the expected class so the widget styles apply', () => {
    const strip = createHandoffStatusStrip();

    expect(strip.className).toBe('mcx-handoff-status');
  });

  it('treats the copy as text, never as markup', () => {
    const strip = createHandoffStatusStrip('<img src=x onerror=alert(1)>');

    expect(strip.querySelector('img')).toBeNull();
    expect(strip.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  describe('routing (the leak case)', () => {
    const CHAT = 'room-abc';

    it('shows for its own room', () => {
      expect(shouldShowHandoffStatus({ message_type: 'handoff_status', room_name: CHAT }, CHAT)).toBe(true);
    });

    it("ignores another visitor's room", () => {
      expect(shouldShowHandoffStatus({ message_type: 'handoff_status', room_name: 'room-other' }, CHAT)).toBe(false);
    });

    it('ignores a frame with NO room_name', () => {
      // The org group fans out to every visitor socket and the general filter
      // lets room-less frames through, so this is the case that would show a
      // false "team notified" status on other visitors' pages.
      expect(shouldShowHandoffStatus({ message_type: 'handoff_status' }, CHAT)).toBe(false);
    });

    it('ignores a non-handoff frame', () => {
      expect(shouldShowHandoffStatus({ message_type: 'text_message', room_name: CHAT }, CHAT)).toBe(false);
    });

    it('ignores everything when the widget has no chat id yet', () => {
      expect(shouldShowHandoffStatus({ message_type: 'handoff_status', room_name: CHAT }, null)).toBe(false);
    });
  });

  it('carries no countdown or timer language', () => {
    const strip = createHandoffStatusStrip();

    // Guards the design decision, not an implementation detail: if someone adds
    // a countdown here they must first make the backend enforce a deadline.
    expect(strip.textContent).not.toMatch(/\d+\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\b/i);
    expect(strip.textContent).not.toMatch(/shortly|momentarily|in a moment|any minute/i);
  });
});

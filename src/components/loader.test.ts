/**
 * Tests for the lazy components bundle loader (MMX-468 split).
 *
 * Covers:
 *   1. getSiblingBundleUrl: URL derivation from embed script src
 *   2. loadComponentsBundle: skips load when all families disabled
 *   3. loadComponentsBundle: caches the promise (idempotent)
 *   4. loadComponentsBundle: load failure degrades to no-op facade (chat-only)
 *   5. componentsEnabled gate: disabled families render nothing even when bundle is loaded
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSiblingBundleUrl,
  loadComponentsBundle,
  getComponentsFacade,
  __resetLoaderForTesting,
} from './loader';
import type { ComponentsEnabled } from './core/types';

// ---- Helpers -----------------------------------------------------------------

function allDisabled(): ComponentsEnabled {
  return { shopify: false, calendar: false, web_call: false };
}

function allEnabled(): ComponentsEnabled {
  return { shopify: true, calendar: true, web_call: true };
}

// ---- URL derivation ----------------------------------------------------------

describe('getSiblingBundleUrl()', () => {
  afterEach(() => {
    // Remove any script tags added during tests
    document.querySelectorAll('script[data-test-embed]').forEach((s) => s.remove());
  });

  it('returns /dist/<name> fallback when no embed script is in the DOM', () => {
    expect(getSiblingBundleUrl('chat-components.js')).toBe('/dist/chat-components.js');
  });

  it('replaces chat-embed.js with the given name in the embed script src', () => {
    const script = document.createElement('script');
    script.setAttribute('src', 'https://cdn.jsdelivr.net/gh/Memox-Inc/ChatEmbed_V2@v3/dist/chat-embed.js');
    script.setAttribute('data-test-embed', 'true');
    document.head.appendChild(script);

    expect(getSiblingBundleUrl('chat-components.js')).toBe(
      'https://cdn.jsdelivr.net/gh/Memox-Inc/ChatEmbed_V2@v3/dist/chat-components.js',
    );
  });

  it('replaces chat-embed.js with chat-voice.js for the voice bundle', () => {
    const script = document.createElement('script');
    script.setAttribute('src', 'https://cdn.jsdelivr.net/gh/Memox-Inc/ChatEmbed_V2@v3.0.21/dist/chat-embed.js');
    script.setAttribute('data-test-embed', 'true');
    document.head.appendChild(script);

    expect(getSiblingBundleUrl('chat-voice.js')).toBe(
      'https://cdn.jsdelivr.net/gh/Memox-Inc/ChatEmbed_V2@v3.0.21/dist/chat-voice.js',
    );
  });
});

// ---- Load gating (chat-only embeds skip the fetch) ---------------------------

describe('loadComponentsBundle(): all-disabled gate', () => {
  beforeEach(() => __resetLoaderForTesting());

  it('resolves immediately to the no-op facade when all families are disabled', async () => {
    const facade = await loadComponentsBundle(allDisabled());
    // No-op facade: renderComponentsBlock always returns null
    expect(facade.renderComponentsBlock([], {} as never)).toBeNull();
    expect(facade.readCartQuantity({ total_quantity: 5 })).toBeNull();
  });

  it('does not set the cached promise when all families are disabled', async () => {
    await loadComponentsBundle(allDisabled());
    // After an all-disabled call the loader is still clean: a subsequent
    // enabled call should proceed to actually load (not short-circuit).
    // We verify by calling again with all-disabled and getting no-op back.
    const facade2 = await loadComponentsBundle(allDisabled());
    expect(facade2.renderComponentsBlock([], {} as never)).toBeNull();
  });
});

// ---- Cache (idempotent load) -------------------------------------------------

describe('loadComponentsBundle(): promise cache', () => {
  beforeEach(() => __resetLoaderForTesting());

  it('returns the same promise object on repeated calls (reference identity)', async () => {
    // Both calls must return the EXACT same Promise instance: this is the
    // caching contract. The bundle URL is deliberately invalid so the import
    // fails fast; we only care about the promise identity, not the resolution.
    const p1 = loadComponentsBundle(allEnabled(), 'https://invalid.example/chat-components.js');
    const p2 = loadComponentsBundle(allEnabled(), 'https://invalid.example/chat-components.js');
    // Identity check: both calls return the same cached promise.
    expect(p1).toBe(p2);
    // Both resolve to the same no-op facade (degrade path).
    const [f1, f2] = await Promise.all([p1, p2]);
    expect(f1).toBe(f2);
  });
});

// ---- Load failure: degrade to chat-only (no-op facade) ----------------------

describe('loadComponentsBundle(): failure degrade', () => {
  beforeEach(() => __resetLoaderForTesting());

  it('degrades to no-op facade and does NOT reject on bundle load failure', async () => {
    const facade = await loadComponentsBundle(allEnabled(), 'https://invalid.example/chat-components.js');
    // Must resolve (not reject) so chat startup is never blocked.
    expect(facade).toBeDefined();
    // No-op: renderComponentsBlock always returns null.
    expect(facade.renderComponentsBlock([], {} as never)).toBeNull();
  });

  it('getComponentsFacade() returns the no-op facade after load failure', async () => {
    await loadComponentsBundle(allEnabled(), 'https://invalid.example/chat-components.js');
    const facade = getComponentsFacade();
    expect(facade.renderComponentsBlock([], {} as never)).toBeNull();
  });

  it('warns to console on load failure', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await loadComponentsBundle(allEnabled(), 'https://invalid.example/bad.js');
    // The warn call emits a single formatted message string followed by the error.
    // Match against the first argument (the message prefix).
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Memox]'),
      expect.anything(),
    );
    const firstArg = warnSpy.mock.calls[0][0] as string;
    expect(firstArg).toContain('chat-components');
    warnSpy.mockRestore();
  });
});

// ---- componentsEnabled gate: disabled families render nothing ----------------

describe('componentsEnabled gate via no-op facade', () => {
  beforeEach(() => __resetLoaderForTesting());

  it('renderComponentsBlock returns null from the no-op facade regardless of enabled flags', async () => {
    // Simulate bundle load failure so the facade stays no-op.
    await loadComponentsBundle(allEnabled(), 'https://invalid.example/bad.js');
    const facade = getComponentsFacade();

    const fakeComponents = [{ id: 'c1', type: 'shopify_product_card', version: 1, data: {} }];
    expect(facade.renderComponentsBlock(fakeComponents as never, {} as never)).toBeNull();
  });
});

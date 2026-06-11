/**
 * Lazy components bundle loader (MMX-468 split).
 *
 * At init time, if any componentsEnabled family is true, core awaits this
 * loader BEFORE the WebSocket connects. That removes all async-render races:
 * by the time the first WS message arrives the facade is fully populated.
 *
 * Chat-only embeds (all families false, the default) fetch zero extra bytes.
 *
 * Pattern mirrors card.ts getVoiceBundleUrl: locate the embed script tag and
 * derive the sibling bundle URL from it.
 */

import type {
  WireComponent,
  RenderCtx,
  ComponentsEnabled,
  ThemeTokens,
} from './core/types';
import type { ComponentRegistry } from './core/registry';

// ---- Public facade interface -------------------------------------------------

/** The subset of chat-components.js exports that index.ts consumes. */
export interface ComponentsFacade {
  renderComponentsBlock(
    components: WireComponent[],
    ctx: RenderCtx,
    registry?: ComponentRegistry,
    messageId?: string,
  ): HTMLDivElement | null;
  applyComponentUpdate(
    messagesEl: HTMLElement,
    messageId: string,
    componentId: string,
    data: unknown,
    ctx: RenderCtx,
    registry?: ComponentRegistry,
  ): void;
  applyActionResultComponents(
    messagesEl: HTMLElement,
    messageId: string,
    components: WireComponent[],
    ctx: RenderCtx,
    onComponentApplied?: (comp: WireComponent) => void,
    registry?: ComponentRegistry,
  ): void;
  createActionBus(opts: { baseUrl: string; authHeader: string }): {
    dispatch(action: import('./core/types').Action): Promise<import('./core/types').ActionResult>;
    isPending(): boolean;
  };
  createCartChip(
    count: number,
    onClick: () => void,
    primaryColor: string,
    primaryLightColor: string,
  ): HTMLDivElement;
  updateCartChip(chip: HTMLDivElement, count: number): void;
  readCartQuantity(data: unknown): number | null;
  syncCartChipOnComponentUpdate(
    messagesEl: HTMLElement,
    messageId: string,
    componentId: string,
    data: unknown,
    setCount: (n: number) => void,
  ): void;
  componentRegistry: ComponentRegistry;
  familyOf(type: string): keyof ComponentsEnabled | null;
}

// ---- No-op fallbacks (used until bundle loads, or on failure) ----------------

const noopFacade: ComponentsFacade = {
  renderComponentsBlock: () => null,
  applyComponentUpdate: () => undefined,
  applyActionResultComponents: () => undefined,
  createActionBus: (opts) => {
    // Minimal action bus that always returns a network error.
    return {
      dispatch: () => Promise.resolve({ ok: false as const, error: { code: 'COMPONENTS_NOT_LOADED', message: 'Components bundle not loaded.', recoverable: false } }),
      isPending: () => false,
    };
  },
  createCartChip: () => document.createElement('div') as HTMLDivElement,
  updateCartChip: () => undefined,
  readCartQuantity: () => null,
  syncCartChipOnComponentUpdate: () => undefined,
  componentRegistry: {
    register: () => undefined,
    lookup: () => undefined,
    list: () => new Map(),
  },
  familyOf: () => null,
};

// ---- URL derivation ----------------------------------------------------------

/**
 * Derive the URL of a sibling bundle from the embed script src.
 * E.g. getSiblingBundleUrl('chat-components.js') replaces 'chat-embed.js'
 * with 'chat-components.js' in the embed script's src attribute.
 * Falls back to same-origin /dist/<name> for local dev.
 */
export function getSiblingBundleUrl(name: string): string {
  try {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const embedScript = scripts.find(
      (s) => (s as HTMLScriptElement).src.includes('chat-embed'),
    );
    if (embedScript) {
      return (embedScript as HTMLScriptElement).src.replace('chat-embed.js', name);
    }
  } catch { /* ignore — SSR / non-browser context */ }
  return `/dist/${name}`;
}

// ---- Loader state ------------------------------------------------------------

let _loadPromise: Promise<ComponentsFacade> | null = null;
let _facade: ComponentsFacade = noopFacade;

/** Synchronous read of the current facade (populated once bundle loads). */
export function getComponentsFacade(): ComponentsFacade {
  return _facade;
}

/**
 * Load the components bundle if any family is enabled.
 *
 * - If all families are disabled, resolves immediately with the no-op facade
 *   (zero bytes fetched).
 * - Caches the promise so repeated calls are idempotent. The SAME Promise
 *   instance is returned on every call after the first (non-async function so
 *   the reference identity is preserved).
 * - On load failure: logs a warning, degrades to chat-only (no-op facade),
 *   and resolves (does NOT reject) so the caller never blocks chat startup.
 */
export function loadComponentsBundle(
  enabled: ComponentsEnabled,
  bundleUrl?: string,
): Promise<ComponentsFacade> {
  const anyEnabled = enabled.shopify || enabled.calendar || enabled.web_call;
  if (!anyEnabled) {
    return Promise.resolve(noopFacade);
  }

  // Return the cached promise so callers awaiting concurrently all share one load.
  if (_loadPromise) return _loadPromise;

  const url = bundleUrl ?? getSiblingBundleUrl('chat-components.js');

  _loadPromise = (async () => {
    try {
      // @vite-ignore — dynamic URL resolved at runtime from the embed script src
      const mod = await import(/* @vite-ignore */ url) as { MemoxChatComponents?: ComponentsFacade };
      const exported = mod.MemoxChatComponents;
      if (!exported || typeof exported.renderComponentsBlock !== 'function') {
        throw new Error('chat-components.js did not export MemoxChatComponents facade');
      }
      _facade = exported;
      return exported;
    } catch (err) {
      console.warn('[Memox] Failed to load chat-components bundle — chat only mode:', err);
      _facade = noopFacade;
      return noopFacade;
    }
  })();

  return _loadPromise;
}

/**
 * Reset loader state (test-only: lets each test start with a clean loader).
 */
export function __resetLoaderForTesting(): void {
  _loadPromise = null;
  _facade = noopFacade;
}

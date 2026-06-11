/**
 * RenderCtx factory (MMX-468 split). Lives in the LAZY components bundle.
 *
 * Everything here serves only rich-component renderers: theme tokens, the
 * action bus, the dispatch wrapper that applies result.components back to
 * the live DOM, and the date/time formatters. Keeping it in the bundle
 * (instead of index.ts) keeps the core embed under the CI raw-size gate;
 * core passes raw inputs through ComponentsFacade.createRenderCtx().
 */

import type { RenderCtx, ThemeTokens, RenderCtxOptions } from './core/types';
import { createActionBus } from './core/action-bus';
import { applyActionResultComponents } from './core/message-integration';
import { syncCartChipOnComponentUpdate } from './families/shopify/cart-chip';
import { mixWithWhite } from '../utils/format';

export function createRenderCtx(o: RenderCtxOptions): RenderCtx {
  const actionBus = createActionBus({ baseUrl: o.baseUrl, authHeader: o.authHeader });

  // Resolve the primary color first so derived tokens can reference it.
  // allowlist:hex-literal -- customer-overridable default; theme.primary takes precedence
  const primaryColor = o.theme.primary ?? '#8349ff';
  const themeTokens: ThemeTokens = {
    primary: primaryColor,
    // Derived: 90% blend of primary toward white so it scales with any
    // white-label primary override instead of hardcoding a Memox-purple hex.
    // Falls back gracefully for non-6-digit values (mixWithWhite returns base
    // unchanged, which is a valid CSS color even if not tinted).
    primaryLight: mixWithWhite(primaryColor, 0.9),
    text: o.theme.text ?? '#072032', // allowlist:hex-literal -- customer-overridable default
    textMuted: o.theme.timestampColor ?? '#5b6b7a', // allowlist:hex-literal -- customer-overridable default
    border: o.theme.border ?? '#e5e7eb', // allowlist:hex-literal -- customer-overridable default
    surface: o.theme.background ?? '#ffffff', // allowlist:hex-literal -- customer-overridable default
    // Brand-independent neutral: Tailwind gray-50. Not derived from primary
    // because a very light/very dark primary would produce a distracting
    // tinted surface; neutral gray is the safer universal default.
    surfaceSubtle: '#f9fafb', // allowlist:hex-literal -- brand-independent neutral gray
    // Semantic status colors below are brand-independent (red/green/amber).
    // They intentionally do not derive from theme.primary.
    error: '#ef4444', // allowlist:hex-literal -- brand-independent semantic status color
    errorSubtle: '#fee2e2', // allowlist:hex-literal -- brand-independent semantic status color
    success: '#22c55e', // allowlist:hex-literal -- brand-independent semantic status color
    successSubtle: '#dcfce7', // allowlist:hex-literal -- brand-independent semantic status color
    warning: '#d97706', // allowlist:hex-literal -- brand-independent semantic status color
    warningSubtle: '#fffbeb', // allowlist:hex-literal -- brand-independent semantic status color
  };

  const visitorTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const renderCtx: RenderCtx = {
    dispatch: async (action) => {
      const result = await actionBus.dispatch(action);
      // Apply any updated components the server returned in the envelope.
      // Covers slot-conflict re-render (calendar.book) and add_to_cart
      // cart refresh (shopify.add_to_cart). Each component in the array is
      // patched in the live DOM exactly like a component_update WS event,
      // and the cart chip is synced per component (type-gated inside
      // syncCartChipOnComponentUpdate; no-ops for non-cart components).
      const mEl = o.getMessagesEl();
      if (result.ok && result.components?.length && mEl) {
        applyActionResultComponents(mEl, action.message_id, result.components, renderCtx, (comp) => {
          syncCartChipOnComponentUpdate(mEl, action.message_id, comp.id, comp.data, o.onCartCount);
        });
      }
      return result;
    },
    theme: themeTokens,
    visitorTimezone,
    distinctId: o.distinctId,
    enabled: o.enabled,
    formatTime: (iso) => new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit', minute: '2-digit', timeZone: visitorTimezone,
    }),
    formatDate: (d) => {
      // Parse as local date (avoid UTC midnight-shift by appending T00:00:00
      // without a timezone offset, which makes Date parse in local time).
      const dt = new Date(d + 'T00:00:00');
      return {
        weekday: dt.toLocaleDateString(undefined, { weekday: 'short' }),
        day: String(dt.getDate()),
      };
    },
  };
  return renderCtx;
}

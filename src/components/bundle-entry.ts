/**
 * Entry point for dist/chat-components.js (IIFE, global MemoxChatComponents).
 *
 * This bundle is loaded lazily by the core embed (via loader.ts) when any
 * componentsEnabled family is true. It registers all component families and
 * exposes the ComponentsFacade object on window.MemoxChatComponents.
 *
 * NOTE on the window assignment: loader.ts dynamically import()s this file,
 * which executes it in MODULE context. Rollup's IIFE `var MemoxChatComponents`
 * stays module-scoped there (top-level var only becomes a window global in
 * classic-script context), so the explicit window assignment below is the
 * contract loader.ts relies on. Keep it.
 *
 * Kept intentionally thin: no analytics, no config fetch, no chat WebSocket.
 * Pure rendering + action dispatch.
 */

// Register all families into the singleton registry (side-effect import).
import './register';

import {
  renderComponentsBlock,
  applyComponentUpdate,
} from './core/message-integration';
import {
  createCartChip,
  updateCartChip,
  readCartQuantity,
  syncCartChipOnComponentUpdate,
} from './families/shopify/cart-chip';
import { createRenderCtx } from './render-ctx';
import type { ComponentsFacade } from './loader';

/**
 * The facade object loader.ts reads from window.MemoxChatComponents after
 * dynamic import. Exactly the surface core consumes (ComponentsFacade).
 */
const MemoxChatComponents: ComponentsFacade = {
  createRenderCtx,
  renderComponentsBlock,
  applyComponentUpdate,
  createCartChip,
  updateCartChip,
  readCartQuantity,
  syncCartChipOnComponentUpdate,
};

export { MemoxChatComponents };

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).MemoxChatComponents = MemoxChatComponents;
}

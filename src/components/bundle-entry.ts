/**
 * Entry point for dist/chat-components.js (IIFE, global MemoxChatComponents).
 *
 * This bundle is loaded lazily by the core embed (via loader.ts) when any
 * componentsEnabled family is true. It registers all component families and
 * exposes the ComponentsFacade object on window.MemoxChatComponents so the
 * dynamic import in loader.ts can read it.
 *
 * Kept intentionally thin: no analytics, no config, no WebSocket. Pure
 * rendering + action dispatch.
 */

// Register all families into the singleton registry (side-effect import).
import './register';

// Re-export the full facade surface for the IIFE global.
export {
  renderComponentsBlock,
  renderSuggestionPills,
  applyComponentUpdate,
  applyActionResultComponents,
  familyOf,
  findComponentWrapper,
} from './core/message-integration';

export { createActionBus } from './core/action-bus';
export type { ActionBus, ActionBusOptions } from './core/action-bus';

export {
  createCartChip,
  updateCartChip,
  readCartQuantity,
  syncCartChipOnComponentUpdate,
} from './families/shopify/cart-chip';

export { componentRegistry, createRegistry } from './core/registry';

import type { ComponentsEnabled } from './core/types';
import {
  renderComponentsBlock,
  applyComponentUpdate,
  applyActionResultComponents,
  familyOf,
} from './core/message-integration';
import { createActionBus } from './core/action-bus';
import {
  createCartChip,
  updateCartChip,
  readCartQuantity,
  syncCartChipOnComponentUpdate,
} from './families/shopify/cart-chip';
import { componentRegistry } from './core/registry';
import type { ComponentsFacade } from './loader';

/**
 * The facade object exposed as the IIFE return value and on window.MemoxChatComponents.
 * loader.ts reads `mod.MemoxChatComponents` after dynamic import.
 */
const MemoxChatComponents: ComponentsFacade = {
  renderComponentsBlock,
  applyComponentUpdate,
  applyActionResultComponents,
  createActionBus,
  createCartChip,
  updateCartChip,
  readCartQuantity,
  syncCartChipOnComponentUpdate,
  componentRegistry,
  familyOf: (type: string): keyof ComponentsEnabled | null => familyOf(type),
};

export { MemoxChatComponents };

// Make accessible on window for the IIFE wrapper and for loader.ts
// (`mod.MemoxChatComponents` after dynamic import).
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).MemoxChatComponents = MemoxChatComponents;
}

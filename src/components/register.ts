/**
 * Family registration (MMX-468).
 * Import this file once at widget init to populate the singleton registry.
 * Remaining families (shopify_cart, calendar_slots, etc.) will be added in subsequent tasks.
 */
import { componentRegistry } from './core/registry';
import { ShopifyProductCardModule } from './families/shopify/product-card';

componentRegistry.register('shopify_product_card', ShopifyProductCardModule);

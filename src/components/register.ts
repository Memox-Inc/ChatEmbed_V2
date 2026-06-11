/**
 * Family registration (MMX-468).
 * Import this file once at widget init to populate the singleton registry.
 */
import { componentRegistry } from './core/registry';
import { ShopifyProductCardModule } from './families/shopify/product-card';
import { ShopifyCartModule } from './families/shopify/cart';
import { CalendarSlotsModule } from './families/calendar/slots';
import { CalendarBookingConfirmedModule } from './families/calendar/confirmed';

componentRegistry.register('shopify_product_card', ShopifyProductCardModule);
componentRegistry.register('shopify_cart', ShopifyCartModule);
componentRegistry.register('calendar_slots', CalendarSlotsModule);
componentRegistry.register('calendar_booking_confirmed', CalendarBookingConfirmedModule);

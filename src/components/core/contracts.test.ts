/**
 * Contract drift protection (spec 9.4).
 *
 * Schemas are vendored copies of hub-exported JSON Schemas
 * (test/fixtures/contracts/<type>.v1.schema.json). A schema bump on the hub
 * without a matching widget update will fail CI here, which is the point.
 *
 * The hub's Task 10 (JSON Schema export) has not run yet; schemas are authored
 * by hand from the canonical contract shapes in the plan. When Task 10 ships,
 * its CI gate replaces these vendored files, and any drift fails this suite.
 */
import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ajv = new Ajv();

function loadSchema(name: string): object {
  const schemaPath = resolve(
    __dirname,
    `../../../test/fixtures/contracts/${name}.v1.schema.json`,
  );
  return JSON.parse(readFileSync(schemaPath, 'utf-8')) as object;
}

// ---------------------------------------------------------------------------
// Canonical fixtures - represent real payloads the hub will send.
// ---------------------------------------------------------------------------

const productCardFixture = {
  product_id: 'prod_1',
  handle: '20ft-standard',
  title: '20ft Standard Shipping Container',
  image_url: 'https://cdn.shopify.com/img.jpg',
  url: 'https://store.example.com/products/20ft-standard',
  price: { amount: '3150.00', currency: 'USD' },
  compare_at_price: { amount: '3500.00', currency: 'USD' },
  variants: [
    { id: 'v1', title: 'New', available: true, price: { amount: '3150.00', currency: 'USD' } },
    { id: 'v2', title: 'Used', available: false, price: { amount: '2100.00', currency: 'USD' } },
  ],
  selected_variant_id: 'v1',
  available: true,
  badge: 'In Stock',
};

const cartFixture = {
  cart_id: 'cart_abc',
  lines: [
    {
      line_id: 'line_1',
      variant_id: 'v1',
      title: '20ft Standard',
      variant_title: 'New',
      image_url: 'https://cdn.shopify.com/img.jpg',
      quantity: 1,
      line_total: { amount: '3150.00', currency: 'USD' },
    },
  ],
  subtotal: { amount: '3150.00', currency: 'USD' },
  total_quantity: 1,
  discount_codes: [{ code: 'SAVE10', applicable: true }],
  checkout_url: 'https://store.example.com/cart/checkout?token=xyz',
};

const calendarSlotsFixture = {
  duration_minutes: 30,
  timezone: 'America/New_York',
  days: [
    {
      date: '2026-06-11',
      slots: [
        { start_iso: '2026-06-11T14:00:00Z', end_iso: '2026-06-11T14:30:00Z' },
      ],
    },
  ],
  requires_contact: true,
  notice: null,
};

const bookingConfirmedFixture = {
  start_iso: '2026-06-11T14:00:00Z',
  end_iso: '2026-06-11T14:30:00Z',
  timezone: 'America/New_York',
  host_name: 'Jane Smith',
  title: '30-min Product Demo',
  google_calendar_url: 'https://calendar.google.com/calendar/event?eid=xyz',
  ics_url: 'https://hub.memox.io/api/v1/calendar/booking/123/ics/',
};

const webCallIdleFixture = {
  state: 'idle',
  agent_name: 'ContainerOne Assistant',
  max_duration_seconds: 600,
  started_at: null,
  duration_seconds: null,
  error: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Contract fixture validation (ajv)', () => {
  // shopify_product_card
  it('shopify_product_card fixture is valid', () => {
    const validate = ajv.compile(loadSchema('shopify_product_card'));
    expect(validate(productCardFixture)).toBe(true);
  });

  it('shopify_product_card with null compare_at_price is valid', () => {
    const validate = ajv.compile(loadSchema('shopify_product_card'));
    expect(validate({ ...productCardFixture, compare_at_price: null })).toBe(true);
  });

  it('shopify_product_card with null badge is valid', () => {
    const validate = ajv.compile(loadSchema('shopify_product_card'));
    expect(validate({ ...productCardFixture, badge: null })).toBe(true);
  });

  it('shopify_product_card rejects missing title', () => {
    const validate = ajv.compile(loadSchema('shopify_product_card'));
    const { title: _omitted, ...bad } = productCardFixture;
    expect(validate(bad)).toBe(false);
  });

  it('shopify_product_card rejects non-string price.amount', () => {
    const validate = ajv.compile(loadSchema('shopify_product_card'));
    expect(validate({ ...productCardFixture, price: { amount: 3150, currency: 'USD' } })).toBe(false);
  });

  // shopify_cart
  it('shopify_cart fixture is valid', () => {
    const validate = ajv.compile(loadSchema('shopify_cart'));
    expect(validate(cartFixture)).toBe(true);
  });

  it('shopify_cart rejects missing cart_id', () => {
    const validate = ajv.compile(loadSchema('shopify_cart'));
    const { cart_id: _omitted, ...bad } = cartFixture;
    expect(validate(bad)).toBe(false);
  });

  it('shopify_cart rejects line quantity below minimum', () => {
    const validate = ajv.compile(loadSchema('shopify_cart'));
    const bad = {
      ...cartFixture,
      lines: [{ ...cartFixture.lines[0], quantity: 0 }],
    };
    expect(validate(bad)).toBe(false);
  });

  // calendar_slots
  it('calendar_slots fixture is valid', () => {
    const validate = ajv.compile(loadSchema('calendar_slots'));
    expect(validate(calendarSlotsFixture)).toBe(true);
  });

  it('calendar_slots with non-null notice is valid', () => {
    const validate = ajv.compile(loadSchema('calendar_slots'));
    expect(validate({ ...calendarSlotsFixture, notice: 'Book at least 24h in advance.' })).toBe(true);
  });

  it('calendar_slots rejects missing requires_contact', () => {
    const validate = ajv.compile(loadSchema('calendar_slots'));
    const { requires_contact: _omitted, ...bad } = calendarSlotsFixture;
    expect(validate(bad)).toBe(false);
  });

  // calendar_booking_confirmed
  it('calendar_booking_confirmed fixture is valid', () => {
    const validate = ajv.compile(loadSchema('calendar_booking_confirmed'));
    expect(validate(bookingConfirmedFixture)).toBe(true);
  });

  it('calendar_booking_confirmed rejects missing ics_url', () => {
    const validate = ajv.compile(loadSchema('calendar_booking_confirmed'));
    const { ics_url: _omitted, ...bad } = bookingConfirmedFixture;
    expect(validate(bad)).toBe(false);
  });

  // web_call
  it('web_call idle fixture is valid', () => {
    const validate = ajv.compile(loadSchema('web_call'));
    expect(validate(webCallIdleFixture)).toBe(true);
  });

  it('web_call live fixture (started_at + duration_seconds set) is valid', () => {
    const validate = ajv.compile(loadSchema('web_call'));
    expect(validate({
      state: 'live',
      agent_name: 'ContainerOne Assistant',
      max_duration_seconds: 600,
      started_at: '2026-06-11T14:02:00Z',
      duration_seconds: 42,
      error: null,
    })).toBe(true);
  });

  it('web_call rejects invalid state enum', () => {
    const validate = ajv.compile(loadSchema('web_call'));
    expect(validate({ ...webCallIdleFixture, state: 'ringing' })).toBe(false);
  });

  it('web_call rejects missing agent_name', () => {
    const validate = ajv.compile(loadSchema('web_call'));
    const { agent_name: _omitted, ...bad } = webCallIdleFixture;
    expect(validate(bad)).toBe(false);
  });
});

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
 *
 * Adding a sixth component type = drop its .v1.schema.json into
 * test/fixtures/contracts/ and append one entry to CONTRACT_TABLE below.
 */
import { describe, it, expect } from 'vitest';
import Ajv, { type ValidateFunction } from 'ajv';
import draft7 from 'ajv/dist/refs/json-schema-draft-07.json';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Deliberate Ajv posture: strict mode ON (all vendored schemas compile clean
// under it; an unknown keyword is a compile-time error, asserted below). The
// default Ajv v8 instance silently pre-registers the draft-07 meta-schema; we
// instead disable bundled metas (meta: false) and register draft-07 explicitly
// so the dialect each schema file declares via $schema is the one actually
// enforced. A schema declaring any other dialect fails compilation (asserted
// below).
const ajv = new Ajv({ strict: true, meta: false });
ajv.addMetaSchema(draft7);

function loadSchema(name: string): Record<string, unknown> {
  const schemaPath = resolve(
    __dirname,
    `../../../test/fixtures/contracts/${name}.v1.schema.json`,
  );
  return JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
}

function omit(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

// ---------------------------------------------------------------------------
// Canonical fixtures - represent real payloads the hub will send.
// ---------------------------------------------------------------------------

const productCardFixture: Record<string, unknown> = {
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

const cartLineFixture: Record<string, unknown> = {
  line_id: 'line_1',
  variant_id: 'v1',
  title: '20ft Standard',
  variant_title: 'New',
  image_url: 'https://cdn.shopify.com/img.jpg',
  quantity: 1,
  line_total: { amount: '3150.00', currency: 'USD' },
};

const cartFixture: Record<string, unknown> = {
  cart_id: 'cart_abc',
  lines: [cartLineFixture],
  subtotal: { amount: '3150.00', currency: 'USD' },
  total_quantity: 1,
  discount_codes: [{ code: 'SAVE10', applicable: true }],
  checkout_url: 'https://store.example.com/cart/checkout?token=xyz',
};

const calendarSlotsFixture: Record<string, unknown> = {
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

const bookingConfirmedFixture: Record<string, unknown> = {
  start_iso: '2026-06-11T14:00:00Z',
  end_iso: '2026-06-11T14:30:00Z',
  timezone: 'America/New_York',
  host_name: 'Jane Smith',
  title: '30-min Product Demo',
  google_calendar_url: 'https://calendar.google.com/calendar/event?eid=xyz',
  ics_url: 'https://hub.memox.io/api/v1/calendar/booking/123/ics/',
};

const webCallIdleFixture: Record<string, unknown> = {
  state: 'idle',
  agent_name: 'ContainerOne Assistant',
  max_duration_seconds: 600,
  started_at: null,
  duration_seconds: null,
  error: null,
};

const webCallLiveFixture: Record<string, unknown> = {
  state: 'live',
  agent_name: 'ContainerOne Assistant',
  max_duration_seconds: 600,
  started_at: '2026-06-11T14:02:00Z',
  duration_seconds: 42,
  error: null,
};

// ---------------------------------------------------------------------------
// Data-driven contract table. One entry per component type.
// ---------------------------------------------------------------------------

interface FixtureCase {
  label: string;
  fixture: Record<string, unknown>;
}

interface InvalidCase extends FixtureCase {
  reason: string;
}

interface ContractEntry {
  name: string;
  validFixtures: FixtureCase[];
  invalidCases: InvalidCase[];
}

const CONTRACT_TABLE: ContractEntry[] = [
  {
    name: 'shopify_product_card',
    validFixtures: [
      { label: 'canonical fixture', fixture: productCardFixture },
      { label: 'null compare_at_price', fixture: { ...productCardFixture, compare_at_price: null } },
      { label: 'null badge', fixture: { ...productCardFixture, badge: null } },
    ],
    invalidCases: [
      {
        label: 'missing title',
        fixture: omit(productCardFixture, 'title'),
        reason: 'title is required',
      },
      {
        label: 'non-string price.amount',
        fixture: { ...productCardFixture, price: { amount: 3150, currency: 'USD' } },
        reason: 'MoneyV2.amount must be a string',
      },
    ],
  },
  {
    name: 'shopify_cart',
    validFixtures: [
      { label: 'canonical fixture', fixture: cartFixture },
    ],
    invalidCases: [
      {
        label: 'missing cart_id',
        fixture: omit(cartFixture, 'cart_id'),
        reason: 'cart_id is required',
      },
      {
        label: 'line quantity below minimum',
        fixture: { ...cartFixture, lines: [{ ...cartLineFixture, quantity: 0 }] },
        reason: 'quantity has minimum 1',
      },
    ],
  },
  {
    name: 'calendar_slots',
    validFixtures: [
      { label: 'canonical fixture (null notice)', fixture: calendarSlotsFixture },
      { label: 'non-null notice', fixture: { ...calendarSlotsFixture, notice: 'Book at least 24h in advance.' } },
    ],
    invalidCases: [
      {
        label: 'missing requires_contact',
        fixture: omit(calendarSlotsFixture, 'requires_contact'),
        reason: 'requires_contact is required',
      },
    ],
  },
  {
    name: 'calendar_booking_confirmed',
    validFixtures: [
      { label: 'canonical fixture', fixture: bookingConfirmedFixture },
    ],
    invalidCases: [
      {
        label: 'missing ics_url',
        fixture: omit(bookingConfirmedFixture, 'ics_url'),
        reason: 'ics_url is required',
      },
    ],
  },
  {
    name: 'web_call',
    validFixtures: [
      { label: 'idle fixture', fixture: webCallIdleFixture },
      { label: 'live fixture (started_at + duration_seconds set)', fixture: webCallLiveFixture },
    ],
    invalidCases: [
      {
        label: 'invalid state enum',
        fixture: { ...webCallIdleFixture, state: 'ringing' },
        reason: 'state must be one of idle|connecting|live|ended|error',
      },
      {
        label: 'missing agent_name',
        fixture: omit(webCallIdleFixture, 'agent_name'),
        reason: 'agent_name is required',
      },
    ],
  },
];

// Compile each schema exactly once, at module scope.
const schemas = new Map<string, Record<string, unknown>>(
  CONTRACT_TABLE.map(({ name }) => [name, loadSchema(name)]),
);
const validators = new Map<string, ValidateFunction>(
  CONTRACT_TABLE.map(({ name }) => [name, ajv.compile(schemas.get(name)!)]),
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Contract fixture validation (ajv)', () => {
  for (const { name, validFixtures, invalidCases } of CONTRACT_TABLE) {
    describe(name, () => {
      const validate = validators.get(name)!;

      it.each(validFixtures)('$label is valid', ({ fixture }) => {
        const ok = validate(fixture);
        if (!ok) {
          // Surface ajv's error detail on failure for fast diagnosis.
          expect.fail(`expected valid, got: ${JSON.stringify(validate.errors)}`);
        }
        expect(ok).toBe(true);
      });

      it.each(invalidCases)('rejects $label ($reason)', ({ fixture }) => {
        expect(validate(fixture)).toBe(false);
      });
    });
  }

  describe('ajv posture (draft-07 + strict)', () => {
    it('every vendored schema declares the draft-07 dialect and validates against it', () => {
      for (const { name } of CONTRACT_TABLE) {
        const schema = schemas.get(name)!;
        expect(schema.$schema, name).toBe('http://json-schema.org/draft-07/schema#');
        expect(ajv.validateSchema(schema), name).toBe(true);
      }
    });

    it('strict mode rejects a schema with an unknown keyword at compile time', () => {
      // Fresh instance so the bad schema never touches the shared cache.
      const strictAjv = new Ajv({ strict: true, meta: false });
      strictAjv.addMetaSchema(draft7);
      expect(() => strictAjv.compile({ type: 'object', unknownKeyword: true }))
        .toThrowError(/unknown keyword/);
    });

    it('a schema declaring a non-draft-07 dialect fails compilation', () => {
      const strictAjv = new Ajv({ strict: true, meta: false });
      strictAjv.addMetaSchema(draft7);
      expect(() => strictAjv.compile({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
      })).toThrowError(/no schema with key or ref/);
    });
  });
});

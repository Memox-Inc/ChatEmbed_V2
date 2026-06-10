import { describe, it, expect, beforeEach } from 'vitest';
import { createRegistry } from './registry';
import type { ComponentModule } from './types';

const stubModule: ComponentModule = {
  version: 1,
  render: (_data, _ctx) => document.createElement('div'),
};

describe('ComponentRegistry', () => {
  let registry: ReturnType<typeof createRegistry>;

  beforeEach(() => {
    registry = createRegistry();
  });

  it('returns undefined for an unknown type', () => {
    expect(registry.lookup('nonexistent_type')).toBeUndefined();
  });

  it('returns undefined when wire version exceeds supported version', () => {
    registry.register('test_card', stubModule);
    // wire version 2, module supports 1
    expect(registry.lookup('test_card', 2)).toBeUndefined();
  });

  it('returns the module for a matching type and version', () => {
    registry.register('test_card', stubModule);
    expect(registry.lookup('test_card', 1)).toBe(stubModule);
  });

  it('returns the module when version is omitted (tolerant lookup)', () => {
    registry.register('test_card', stubModule);
    expect(registry.lookup('test_card')).toBe(stubModule);
  });

  it('allows registering multiple types independently', () => {
    const modA: ComponentModule = { version: 1, render: () => document.createElement('span') };
    const modB: ComponentModule = { version: 2, render: () => document.createElement('p') };
    registry.register('type_a', modA);
    registry.register('type_b', modB);
    expect(registry.lookup('type_a')).toBe(modA);
    expect(registry.lookup('type_b')).toBe(modB);
    expect(registry.lookup('type_a', 2)).toBeUndefined(); // version mismatch for A
  });
});

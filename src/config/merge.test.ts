/**
 * Security tests for deepMerge — prototype pollution defence.
 *
 * ATTACK SURFACE:
 * JSON.parse('{"__proto__":{"polluted":true}}') creates an object where
 * __proto__ is an OWN enumerable property (not a prototype setter).
 * When deepMerge iterates Object.keys() it encounters '__proto__' and
 * (without the fix) assigns result['__proto__'] = srcVal, which hijacks the
 * prototype of the returned `result` object. The returned config object then
 * silently inherits arbitrary attacker-controlled values.
 *
 * NOTE: Plain object literals `{ __proto__: ... }` set the prototype directly
 * and Object.keys() returns [] — that case is harmless. We test only the
 * JSON.parse vector (real attack vector from HTTP responses).
 */
import { describe, it, expect } from 'vitest';
import { deepMerge } from './merge';

// ---------------------------------------------------------------------------
// Prototype-pollution defence
// ---------------------------------------------------------------------------

describe('deepMerge — prototype-pollution defence', () => {
  it('blocks top-level __proto__ injection (result prototype must not be hijacked)', () => {
    // Without the fix: deepMerge returns an object whose __proto__ is
    // {polluted:true} instead of Object.prototype — the prototype is hijacked.
    const malicious = JSON.parse('{"__proto__":{"polluted":true}}');

    const result = deepMerge({} as Record<string, unknown>, malicious);

    // The fix: result must NOT inherit the injected property.
    expect(result['polluted']).toBeUndefined();
    // And its prototype must remain Object.prototype (not the injected object).
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  it('blocks top-level constructor injection', () => {
    const malicious = JSON.parse('{"constructor":{"prototype":{"injected":true}}}');

    const result = deepMerge({} as Record<string, unknown>, malicious);

    // constructor should not be overwritten with a plain object
    expect(result['injected']).toBeUndefined();
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  it('blocks top-level prototype key injection', () => {
    const malicious = JSON.parse('{"prototype":{"xss":true}}');

    const result = deepMerge({} as Record<string, unknown>, malicious);

    expect(result['xss']).toBeUndefined();
  });

  it('blocks deeply-nested __proto__ injection (result prototype must not be hijacked)', () => {
    // Without fix: at depth 2 the inner deepMerge call hijacks that sub-object's prototype.
    const malicious = JSON.parse('{"a":{"b":{"__proto__":{"polluted":true}}}}');
    const target = { a: { b: {} } } as Record<string, unknown>;

    const result = deepMerge(target, malicious);

    const a = result['a'] as Record<string, unknown>;
    const b = a['b'] as Record<string, unknown>;
    expect(b['polluted']).toBeUndefined();
    expect(Object.getPrototypeOf(b)).toBe(Object.prototype);
  });

  it('blocks deeply-nested constructor injection', () => {
    const malicious = JSON.parse('{"level1":{"level2":{"constructor":{"prototype":{"injected":true}}}}}');
    const target = { level1: { level2: {} } } as Record<string, unknown>;

    const result = deepMerge(target, malicious);

    const l1 = result['level1'] as Record<string, unknown>;
    const l2 = l1['level2'] as Record<string, unknown>;
    expect(l2['injected']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Legitimate merge behaviour — must not regress
// ---------------------------------------------------------------------------

describe('deepMerge — legitimate merges', () => {
  it('copies a top-level scalar from source to result', () => {
    const result = deepMerge({ a: 1 } as Record<string, unknown>, { a: 2 } as Record<string, unknown>);
    expect(result['a']).toBe(2);
  });

  it('keeps target keys that are absent in source', () => {
    const result = deepMerge({ a: 1, b: 2 } as Record<string, unknown>, { a: 99 } as Record<string, unknown>);
    expect(result['b']).toBe(2);
  });

  it('deep-merges nested plain objects', () => {
    const target = { theme: { primary: 'blue', secondary: 'grey' } } as Record<string, unknown>;
    const source = { theme: { primary: 'purple' } } as Record<string, unknown>;
    const result = deepMerge(target, source);

    const theme = result['theme'] as Record<string, unknown>;
    expect(theme['primary']).toBe('purple');
    expect(theme['secondary']).toBe('grey'); // preserved from target
  });

  it('does not mutate the target object', () => {
    const target = { a: 1 } as Record<string, unknown>;
    deepMerge(target, { a: 2 } as Record<string, unknown>);
    expect(target['a']).toBe(1);
  });

  it('ignores undefined source values', () => {
    const result = deepMerge({ a: 1 } as Record<string, unknown>, { a: undefined } as Record<string, unknown>);
    expect(result['a']).toBe(1);
  });

  it('allows safe keys named similarly to dangerous ones', () => {
    // "proto" (without underscores) must not be blocked.
    const result = deepMerge(
      { proto: 'ok' } as Record<string, unknown>,
      { proto: 'still-ok' } as Record<string, unknown>,
    );
    expect(result['proto']).toBe('still-ok');
  });
});

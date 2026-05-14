/**
 * Shadow host idempotency tests (MMX-585).
 *
 * createInlineShadowHost (and its floating sibling) must NOT append a
 * second host element when called twice against the same parent. Two
 * hosts in a flex container produce two side-by-side widget halves —
 * the user-visible symptom of the double-mount race.
 */
import { describe, expect, it } from 'vitest';
import { createInlineShadowHost, createShadowHost } from './shadow-host';

describe('createInlineShadowHost', () => {
  it('creates a host with a closed shadow root on first call', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const { host, root } = createInlineShadowHost(parent);
    expect(host.id).toBe('memox-chat-embed-host');
    expect(parent.children).toHaveLength(1);
    expect(parent.children[0]).toBe(host);
    expect(root).toBeTruthy();
    // The closed shadow root is not retrievable via host.shadowRoot.
    expect(host.shadowRoot).toBeNull();
  });

  it('returns the same host and root when called twice on the same parent', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const first = createInlineShadowHost(parent);
    const second = createInlineShadowHost(parent);
    expect(second.host).toBe(first.host);
    expect(second.root).toBe(first.root);
    expect(parent.children).toHaveLength(1);
  });

  it('creates a fresh host when the parent has no prior memox host', () => {
    const parentA = document.createElement('div');
    const parentB = document.createElement('div');
    document.body.appendChild(parentA);
    document.body.appendChild(parentB);
    const a = createInlineShadowHost(parentA);
    const b = createInlineShadowHost(parentB);
    expect(b.host).not.toBe(a.host);
    expect(parentA.children).toHaveLength(1);
    expect(parentB.children).toHaveLength(1);
  });

  it('does not collide with a sibling host outside the parent', () => {
    // A floating-mode host on document.body must not cause inline mode
    // to skip creating its own host inside its parent.
    const floatingHost = document.createElement('div');
    floatingHost.id = 'memox-chat-embed-host';
    document.body.appendChild(floatingHost);
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const { host } = createInlineShadowHost(parent);
    expect(host).not.toBe(floatingHost);
    expect(parent.children).toHaveLength(1);
    expect(parent.children[0]).toBe(host);
    floatingHost.remove();
  });
});

describe('createShadowHost (floating mode)', () => {
  it('returns the same host on a second call when the prior host is still in document.body', () => {
    const first = createShadowHost();
    document.body.appendChild(first.host);
    const second = createShadowHost();
    expect(second.host).toBe(first.host);
    expect(second.root).toBe(first.root);
    first.host.remove();
  });
});

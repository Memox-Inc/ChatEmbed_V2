/**
 * MMX-1027 — hard-fail on /embed/init failure (embedId mode).
 *
 * Before this change ``fetchInitConfig`` swallowed every failure and returned
 * ``{}``, so ``init()`` merged nothing onto ``defaultConfig`` and mounted a
 * fully generic widget (title "Chat", primary #0078d4). That widget was also
 * inert — ``token``/``session_token``/``org_id``/``agent_id`` all arrive on the
 * init response — so operators saw a plausible-looking chat widget that was
 * neither their configuration nor able to chat.
 *
 * The contract now:
 *   - the default-config widget is NEVER mounted after an init failure;
 *   - every failure emits a console.error;
 *   - inline mode (dashboard preview / playground) renders an actionable
 *     panel naming the blocked host;
 *   - floating mode (customer sites) renders nothing, so end visitors never
 *     see Memox configuration guidance. The backend already logs the
 *     rejection server-side for ops visibility.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchInitConfigMock } = vi.hoisted(() => ({ fetchInitConfigMock: vi.fn() }));

vi.mock('./connection/init', async () => {
  const actual = await vi.importActual<typeof import('./connection/init')>('./connection/init');
  return { ...actual, fetchInitConfig: fetchInitConfigMock };
});

// Suppress network side effects from modules that init() touches.
vi.mock('./analytics/posthog', () => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  group: vi.fn(),
  setExperimentTags: vi.fn(),
  __resetForTesting: vi.fn(),
}));

import { EmbedInitError } from './connection/init';

/** Import ``./index`` fresh so its module-level bootstrap() runs again. */
async function bootWidget(): Promise<void> {
  vi.resetModules();
  await import('./index');
  // Let the awaited fetchInitConfig rejection propagate through init().
  await Promise.resolve();
  await Promise.resolve();
}

describe('init failure (MMX-1027)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    fetchInitConfigMock.mockReset();
    // Silence the intentional failure logging; asserted on via console.error.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as { MemoxChatConfig?: unknown }).MemoxChatConfig;
    document.body.innerHTML = '';
  });

  it('inline mode: renders an actionable origin error and mounts no widget', async () => {
    const host = document.createElement('div');
    host.setAttribute('data-mcx-preview-host', '');
    document.body.appendChild(host);

    window.MemoxChatConfig = {
      embedId: 'emb_4cefe9c127e5',
      mode: 'inline',
      parentSelector: '[data-mcx-preview-host]',
    } as unknown as typeof window.MemoxChatConfig;

    fetchInitConfigMock.mockRejectedValue(
      new EmbedInitError('init failed: 403', 'origin', 403),
    );

    await bootWidget();

    const panel = host.querySelector('.mcx-embed-error');
    expect(panel).not.toBeNull();

    const text = panel?.textContent ?? '';
    // Must name the blocked host and point at the exact setting to change.
    expect(text).toContain(window.location.origin);
    expect(text).toMatch(/allowed origins/i);

    // The generic default-config widget must NOT have been mounted.
    expect(document.getElementById('memox-chat-embed-host')).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('floating mode: renders nothing at all but still logs', async () => {
    window.MemoxChatConfig = {
      embedId: 'emb_4cefe9c127e5',
    } as unknown as typeof window.MemoxChatConfig;

    fetchInitConfigMock.mockRejectedValue(
      new EmbedInitError('init failed: 403', 'origin', 403),
    );

    await bootWidget();

    // Visitors on a customer site must never see internal config guidance.
    expect(document.querySelector('.mcx-embed-error')).toBeNull();
    expect(document.getElementById('memox-chat-embed-host')).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('inline mode: a 404 explains the embed ID rather than the origin', async () => {
    const host = document.createElement('div');
    host.setAttribute('data-mcx-preview-host', '');
    document.body.appendChild(host);

    window.MemoxChatConfig = {
      embedId: 'emb_does_not_exist',
      mode: 'inline',
      parentSelector: '[data-mcx-preview-host]',
    } as unknown as typeof window.MemoxChatConfig;

    fetchInitConfigMock.mockRejectedValue(
      new EmbedInitError('init failed: 404', 'not_found', 404),
    );

    await bootWidget();

    const text = host.querySelector('.mcx-embed-error')?.textContent ?? '';
    expect(text).toMatch(/embed id/i);
    expect(text).not.toMatch(/allowed origins/i);
  });

  it('inline mode: a network failure reports connectivity, not misconfiguration', async () => {
    const host = document.createElement('div');
    host.setAttribute('data-mcx-preview-host', '');
    document.body.appendChild(host);

    window.MemoxChatConfig = {
      embedId: 'emb_4cefe9c127e5',
      mode: 'inline',
      parentSelector: '[data-mcx-preview-host]',
    } as unknown as typeof window.MemoxChatConfig;

    fetchInitConfigMock.mockRejectedValue(
      new EmbedInitError('Network error', 'network'),
    );

    await bootWidget();

    const text = host.querySelector('.mcx-embed-error')?.textContent ?? '';
    expect(text).toMatch(/couldn't reach|could not reach/i);
    expect(text).not.toMatch(/allowed origins/i);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { applyComponentUpdate } from './message-integration';
import type { RenderCtx } from './types';
import { componentRegistry } from './registry';

function makeCtx(): RenderCtx {
  return {
    dispatch: vi.fn().mockResolvedValue({ ok: true }),
    theme: {
      primary: '#8349ff', primaryLight: '#f0ebff', text: '#072032',
      textMuted: '#5b6b7a', border: '#e5e7eb', surface: '#fff',
      surfaceSubtle: '#f9fafb', error: '#ef4444', errorSubtle: '#fee2e2',
      success: '#22c55e', successSubtle: '#dcfce7', warning: '#d97706', warningSubtle: '#fffbeb',
    },
    visitorTimezone: 'UTC', distinctId: 'id',
    enabled: { shopify: true, calendar: true, web_call: true },
    formatTime: (iso) => iso,
    formatDate: () => ({ weekday: 'Mon', day: '1' }),
  };
}

describe('applyComponentUpdate() - direct registry (component-update.test)', () => {
  it('does nothing when component wrapper is absent', () => {
    const container = document.createElement('div');
    expect(() => applyComponentUpdate(container, 'msg_1', 'cmp_missing', {}, makeCtx())).not.toThrow();
  });

  it('calls mod.update() when the module defines one', () => {
    const updateFn = vi.fn();
    componentRegistry.register('update_widget_b', {
      version: 1,
      render: () => { const d = document.createElement('div'); d.textContent = 'init'; return d; },
      update: updateFn,
    });
    const messagesEl = document.createElement('div');
    const msgWrap = document.createElement('div');
    msgWrap.setAttribute('data-message-id', 'msg_42');
    const cmpWrap = document.createElement('div');
    cmpWrap.setAttribute('data-component-id', 'cmp_42');
    cmpWrap.setAttribute('data-component-type', 'update_widget_b');
    const inner = document.createElement('div');
    cmpWrap.appendChild(inner);
    msgWrap.appendChild(cmpWrap);
    messagesEl.appendChild(msgWrap);
    applyComponentUpdate(messagesEl, 'msg_42', 'cmp_42', { state: 'live' }, makeCtx());
    expect(updateFn).toHaveBeenCalledWith(inner, { state: 'live' });
  });

  it('re-renders in place when module has no update()', () => {
    componentRegistry.register('rerender_widget_b', {
      version: 1,
      render: (data) => {
        const d = document.createElement('div');
        d.setAttribute('data-val', String((data as { val: number }).val));
        return d;
      },
    });
    const messagesEl = document.createElement('div');
    const msgWrap = document.createElement('div');
    msgWrap.setAttribute('data-message-id', 'msg_99');
    const cmpWrap = document.createElement('div');
    cmpWrap.setAttribute('data-component-id', 'cmp_99');
    cmpWrap.setAttribute('data-component-type', 'rerender_widget_b');
    cmpWrap.appendChild(document.createElement('div'));
    msgWrap.appendChild(cmpWrap);
    messagesEl.appendChild(msgWrap);
    applyComponentUpdate(messagesEl, 'msg_99', 'cmp_99', { val: 42 }, makeCtx());
    expect(cmpWrap.querySelector('[data-val="42"]')).not.toBeNull();
  });
});

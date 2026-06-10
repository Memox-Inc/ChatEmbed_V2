import { describe, it, expect, vi } from 'vitest';
import { renderComponentsBlock, renderSuggestionPills } from './message-integration';
import type { WireComponent, RenderCtx, ThemeTokens } from './types';
import { componentRegistry } from './registry';

const theme: ThemeTokens = {
  primary: '#8349ff', primaryLight: '#f0ebff', text: '#072032',
  textMuted: '#5b6b7a', border: '#e5e7eb', surface: '#fff',
  surfaceSubtle: '#f9fafb', error: '#ef4444', errorSubtle: '#fee2e2',
  success: '#22c55e', successSubtle: '#dcfce7', warning: '#d97706', warningSubtle: '#fffbeb',
};

function makeCtx(overrides: Partial<RenderCtx> = {}): RenderCtx {
  return {
    dispatch: vi.fn().mockResolvedValue({ ok: true }),
    theme,
    visitorTimezone: 'America/New_York',
    distinctId: 'test-id',
    enabled: { shopify: true, calendar: true, web_call: true },
    formatTime: (iso) => new Date(iso).toLocaleTimeString(),
    formatDate: () => ({ weekday: 'Mon', day: '10' }),
    ...overrides,
  };
}

describe('renderComponentsBlock()', () => {
  it('returns null for an empty array', () => {
    expect(renderComponentsBlock([], makeCtx())).toBeNull();
  });

  it('skips unknown component types silently', () => {
    const components: WireComponent[] = [
      { id: 'c1', type: 'unknown_future_type_99', version: 99, data: {} },
    ];
    expect(renderComponentsBlock(components, makeCtx())).toBeNull();
  });

  it('renders a registered component', () => {
    componentRegistry.register('test_widget_a', {
      version: 1,
      render: () => {
        const d = document.createElement('div');
        d.setAttribute('data-testid', 'test-widget-a');
        return d;
      },
    });
    const components: WireComponent[] = [{ id: 'c1', type: 'test_widget_a', version: 1, data: {} }];
    const container = renderComponentsBlock(components, makeCtx());
    expect(container).not.toBeNull();
    expect(container!.querySelector('[data-testid="test-widget-a"]')).not.toBeNull();
  });

  it('skips a component with wire version exceeding supported', () => {
    componentRegistry.register('versioned_widget_a', {
      version: 1,
      render: () => document.createElement('div'),
    });
    const components: WireComponent[] = [{ id: 'c1', type: 'versioned_widget_a', version: 2, data: {} }];
    expect(renderComponentsBlock(components, makeCtx())).toBeNull();
  });

  it('stamps data-component-id on each wrapper', () => {
    componentRegistry.register('stamp_test_a', {
      version: 1,
      render: () => document.createElement('section'),
    });
    const components: WireComponent[] = [{ id: 'cmp_xyz', type: 'stamp_test_a', version: 1, data: {} }];
    const container = renderComponentsBlock(components, makeCtx());
    const wrapper = container!.querySelector('[data-component-id="cmp_xyz"]');
    expect(wrapper).not.toBeNull();
  });
});

describe('renderSuggestionPills()', () => {
  it('returns null for an empty array', () => {
    expect(renderSuggestionPills([], vi.fn(), theme)).toBeNull();
  });

  it('renders one pill per suggestion', () => {
    const container = renderSuggestionPills(['Option A', 'Option B'], vi.fn(), theme);
    expect(container).not.toBeNull();
    const pills = container!.querySelectorAll('button');
    expect(pills).toHaveLength(2);
    expect(pills[0].textContent).toBe('Option A');
    expect(pills[1].textContent).toBe('Option B');
  });

  it('calls onSelect with the clicked suggestion text', () => {
    const onSelect = vi.fn();
    const container = renderSuggestionPills(['Ask me anything'], onSelect, theme);
    (container!.querySelector('button') as HTMLButtonElement).click();
    expect(onSelect).toHaveBeenCalledWith('Ask me anything');
  });
});

import { describe, it, expect, vi } from 'vitest';
import {
  renderComponentsBlock,
  applyComponentUpdate,
  applyActionResultComponents,
  familyOf,
} from './message-integration';
import { renderSuggestionPills } from '../suggestion-pills';
import type { WireComponent, RenderCtx, ThemeTokens, ComponentModule, ShopifyProductCardData } from './types';
import { createRegistry } from './registry';
import { ShopifyProductCardModule } from '../families/shopify/product-card';
import { createCartChip, updateCartChip, syncCartChipOnComponentUpdate } from '../families/shopify/cart-chip';

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

function makeModule(overrides: Partial<ComponentModule> = {}): ComponentModule {
  return {
    version: 1,
    render: () => document.createElement('div'),
    ...overrides,
  };
}

function productCard(id: string, version = 1): WireComponent {
  return { id, type: 'shopify_product_card', version, data: { title: id } };
}

describe('renderComponentsBlock()', () => {
  it('returns null for an empty array', () => {
    expect(renderComponentsBlock([], makeCtx(), createRegistry())).toBeNull();
  });

  it('skips unknown component types silently', () => {
    const components: WireComponent[] = [
      { id: 'c1', type: 'unknown_future_type_99', version: 99, data: {} },
    ];
    expect(renderComponentsBlock(components, makeCtx(), createRegistry())).toBeNull();
  });

  it('renders a registered component', () => {
    const registry = createRegistry();
    registry.register('test_widget', makeModule({
      render: () => {
        const d = document.createElement('div');
        d.setAttribute('data-testid', 'test-widget');
        return d;
      },
    }));
    const components: WireComponent[] = [{ id: 'c1', type: 'test_widget', version: 1, data: {} }];
    const container = renderComponentsBlock(components, makeCtx(), registry);
    expect(container).not.toBeNull();
    expect(container!.querySelector('[data-testid="test-widget"]')).not.toBeNull();
  });

  it('skips a component with wire version exceeding supported', () => {
    const registry = createRegistry();
    registry.register('versioned_widget', makeModule({ version: 1 }));
    const components: WireComponent[] = [{ id: 'c1', type: 'versioned_widget', version: 2, data: {} }];
    expect(renderComponentsBlock(components, makeCtx(), registry)).toBeNull();
  });

  it('stamps data-component-id on each wrapper', () => {
    const registry = createRegistry();
    registry.register('stamp_test', makeModule({ render: () => document.createElement('section') }));
    const components: WireComponent[] = [{ id: 'cmp_xyz', type: 'stamp_test', version: 1, data: {} }];
    const container = renderComponentsBlock(components, makeCtx(), registry);
    const wrapper = container!.querySelector('[data-component-id="cmp_xyz"]');
    expect(wrapper).not.toBeNull();
  });

  it('groups consecutive product cards into a carousel with per-card data-component-id wrappers', () => {
    const registry = createRegistry();
    registry.register('shopify_product_card', makeModule());
    const container = renderComponentsBlock(
      [productCard('c1'), productCard('c2'), productCard('c3')],
      makeCtx(),
      registry,
    );
    const carousel = container!.querySelector('[data-carousel="true"]');
    expect(carousel).not.toBeNull();
    // The carousel container itself carries NO component id.
    expect(carousel!.hasAttribute('data-component-id')).toBe(false);
    // Each card has its own wrapper stamped with its individual id.
    const wrappers = carousel!.querySelectorAll('[data-component-id]');
    expect(wrappers).toHaveLength(3);
    expect(Array.from(wrappers).map((w) => w.getAttribute('data-component-id')))
      .toEqual(['c1', 'c2', 'c3']);
    wrappers.forEach((w) => {
      expect(w.getAttribute('data-component-type')).toBe('shopify_product_card');
    });
  });

  it('renders a multi-card run with the real product-card module: one carousel, one title per card', () => {
    function realProduct(id: string, title: string): WireComponent {
      const data: ShopifyProductCardData = {
        product_id: id, handle: id, title,
        image_url: 'https://cdn.shopify.com/img.jpg',
        url: 'https://store.example.com/products/x',
        price: { amount: '100.00', currency: 'USD' },
        compare_at_price: null,
        variants: [{ id: 'v1', title: 'Default', available: true, price: { amount: '100.00', currency: 'USD' } }],
        selected_variant_id: 'v1', available: true, badge: null,
      };
      return { id, type: 'shopify_product_card', version: 1, data };
    }
    const registry = createRegistry();
    registry.register('shopify_product_card', ShopifyProductCardModule);
    const container = renderComponentsBlock(
      [realProduct('c1', 'First Product'), realProduct('c2', 'Second Product')],
      makeCtx(),
      registry,
    );
    const carousel = container!.querySelector('[data-carousel="true"]');
    expect(carousel).not.toBeNull();
    const titles = Array.from(carousel!.querySelectorAll('[data-part="product-title"]'))
      .map((t) => t.textContent);
    expect(titles).toEqual(['First Product', 'Second Product']);
  });

  it('passes each renderer a per-component ctx carrying its own componentId and the messageId', () => {
    const seen: Array<{ componentId?: string; messageId?: string }> = [];
    const probeRender = (_d: unknown, ctx: RenderCtx): HTMLElement => {
      seen.push({ componentId: ctx.componentId, messageId: ctx.messageId });
      return document.createElement('div');
    };
    const registry = createRegistry();
    registry.register('shopify_product_card', makeModule({ render: probeRender }));
    registry.register('ctx_probe', makeModule({ render: probeRender }));
    renderComponentsBlock(
      [productCard('c1'), productCard('c2'), { id: 'p1', type: 'ctx_probe', version: 1, data: {} }],
      makeCtx(),
      registry,
      'msg_7',
    );
    expect(seen).toEqual([
      { componentId: 'c1', messageId: 'msg_7' },
      { componentId: 'c2', messageId: 'msg_7' },
      { componentId: 'p1', messageId: 'msg_7' },
    ]);
  });

  it('does not merge non-consecutive product cards into one carousel', () => {
    const registry = createRegistry();
    registry.register('shopify_product_card', makeModule());
    registry.register('calendar_slots', makeModule());
    const container = renderComponentsBlock(
      [productCard('c1'), { id: 's1', type: 'calendar_slots', version: 1, data: {} }, productCard('c2')],
      makeCtx(),
      registry,
    );
    // Singles do not get a carousel container.
    expect(container!.querySelector('[data-carousel]')).toBeNull();
    // Three independent wrappers, in wire order.
    const wrappers = container!.querySelectorAll('[data-component-id]');
    expect(Array.from(wrappers).map((w) => w.getAttribute('data-component-id')))
      .toEqual(['c1', 's1', 'c2']);
  });
});

describe('applyComponentUpdate()', () => {
  function renderIntoMessage(
    components: WireComponent[],
    ctx: RenderCtx,
    registry: ReturnType<typeof createRegistry>,
    messageId = 'msg_1',
  ): HTMLElement {
    const messagesEl = document.createElement('div');
    const msgWrapper = document.createElement('div');
    msgWrapper.setAttribute('data-message-id', messageId);
    messagesEl.appendChild(msgWrapper);
    const block = renderComponentsBlock(components, ctx, registry);
    if (block) msgWrapper.appendChild(block);
    return messagesEl;
  }

  it('updates the middle card of a 3-card carousel by its own component id', () => {
    const registry = createRegistry();
    const update = vi.fn();
    registry.register('shopify_product_card', makeModule({ update }));
    const ctx = makeCtx();
    const messagesEl = renderIntoMessage(
      [productCard('c1'), productCard('c2'), productCard('c3')],
      ctx,
      registry,
    );

    const newData = { title: 'updated' };
    applyComponentUpdate(messagesEl, 'msg_1', 'c2', newData, ctx, registry);

    const wrapper = messagesEl.querySelector('[data-component-id="c2"]')!;
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(wrapper.firstElementChild, newData);
  });

  it('re-renders in place when the module has no update()', () => {
    const registry = createRegistry();
    registry.register('rerender_widget', makeModule({
      render: (data) => {
        const d = document.createElement('div');
        d.textContent = String((data as { label: string }).label);
        return d;
      },
    }));
    const ctx = makeCtx();
    const messagesEl = renderIntoMessage(
      [{ id: 'c1', type: 'rerender_widget', version: 1, data: { label: 'before' } }],
      ctx,
      registry,
    );

    applyComponentUpdate(messagesEl, 'msg_1', 'c1', { label: 'after' }, ctx, registry);

    const wrapper = messagesEl.querySelector('[data-component-id="c1"]')!;
    expect(wrapper.textContent).toBe('after');
  });

  it('re-render path passes a per-component ctx carrying the message and component ids', () => {
    const seen: Array<{ componentId?: string; messageId?: string }> = [];
    const registry = createRegistry();
    registry.register('rerender_widget', makeModule({
      render: (_d, ctx) => {
        seen.push({ componentId: ctx.componentId, messageId: ctx.messageId });
        return document.createElement('div');
      },
    }));
    const ctx = makeCtx();
    const messagesEl = renderIntoMessage(
      [{ id: 'c1', type: 'rerender_widget', version: 1, data: {} }],
      ctx,
      registry,
    );
    seen.length = 0;

    applyComponentUpdate(messagesEl, 'msg_1', 'c1', {}, ctx, registry);

    expect(seen).toEqual([{ componentId: 'c1', messageId: 'msg_1' }]);
  });

  it('is a graceful no-op when the component id is not in the DOM', () => {
    const registry = createRegistry();
    registry.register('shopify_product_card', makeModule());
    const ctx = makeCtx();
    const messagesEl = renderIntoMessage([productCard('c1')], ctx, registry);

    expect(() => {
      applyComponentUpdate(messagesEl, 'msg_1', 'missing_id', {}, ctx, registry);
    }).not.toThrow();
  });

  it('is a graceful no-op when component id contains a newline (hostile id)', () => {
    const registry = createRegistry();
    registry.register('shopify_product_card', makeModule());
    const ctx = makeCtx();
    const messagesEl = renderIntoMessage([productCard('c1')], ctx, registry);

    // A raw newline in a CSS attribute selector throws SyntaxError in real browsers;
    // applyComponentUpdate must absorb it silently rather than propagating.
    expect(() => {
      applyComponentUpdate(messagesEl, 'msg_1', 'cmp\nmalicious', {}, ctx, registry);
    }).not.toThrow();
  });

  it('is a graceful no-op when message id contains a control character', () => {
    const registry = createRegistry();
    registry.register('shopify_product_card', makeModule());
    const ctx = makeCtx();
    const messagesEl = renderIntoMessage([productCard('c1')], ctx, registry);

    expect(() => {
      applyComponentUpdate(messagesEl, 'msg\x01bad', 'c1', {}, ctx, registry);
    }).not.toThrow();
  });
});

describe('familyOf()', () => {
  it('maps shopify_* types to shopify', () => {
    expect(familyOf('shopify_product_card')).toBe('shopify');
    expect(familyOf('shopify_cart')).toBe('shopify');
  });

  it('maps calendar_* types to calendar', () => {
    expect(familyOf('calendar_slots')).toBe('calendar');
    expect(familyOf('calendar_booking_confirmed')).toBe('calendar');
  });

  it('maps web_call to web_call', () => {
    expect(familyOf('web_call')).toBe('web_call');
  });

  it('returns null for unknown family types (ungated)', () => {
    expect(familyOf('unknown_future_type_99')).toBeNull();
    expect(familyOf('test_widget')).toBeNull();
  });
});

describe('renderComponentsBlock() componentsEnabled gate', () => {
  it('renders nothing for a disabled shopify family (returns null)', () => {
    const registry = createRegistry();
    registry.register('shopify_product_card', makeModule());
    const ctx = makeCtx({ enabled: { shopify: false, calendar: true, web_call: true } });
    expect(renderComponentsBlock([productCard('c1')], ctx, registry)).toBeNull();
  });

  it('renders nothing for a disabled calendar family (returns null)', () => {
    const registry = createRegistry();
    registry.register('calendar_slots', makeModule());
    const ctx = makeCtx({ enabled: { shopify: true, calendar: false, web_call: true } });
    expect(renderComponentsBlock(
      [{ id: 's1', type: 'calendar_slots', version: 1, data: {} }], ctx, registry,
    )).toBeNull();
  });

  it('renders nothing for a disabled web_call family (returns null)', () => {
    const registry = createRegistry();
    registry.register('web_call', makeModule());
    const ctx = makeCtx({ enabled: { shopify: true, calendar: true, web_call: false } });
    expect(renderComponentsBlock(
      [{ id: 'w1', type: 'web_call', version: 1, data: {} }], ctx, registry,
    )).toBeNull();
  });

  it('renders the component when its family is enabled', () => {
    const registry = createRegistry();
    registry.register('shopify_product_card', makeModule());
    const ctx = makeCtx({ enabled: { shopify: true, calendar: false, web_call: false } });
    const container = renderComponentsBlock([productCard('c1')], ctx, registry);
    expect(container).not.toBeNull();
    expect(container!.querySelector('[data-component-id="c1"]')).not.toBeNull();
  });

  it('unknown-family types are ungated -- render even with all families disabled', () => {
    const registry = createRegistry();
    registry.register('test_widget', makeModule());
    const ctx = makeCtx({ enabled: { shopify: false, calendar: false, web_call: false } });
    const container = renderComponentsBlock(
      [{ id: 'u1', type: 'test_widget', version: 1, data: {} }], ctx, registry,
    );
    expect(container).not.toBeNull();
    expect(container!.querySelector('[data-component-id="u1"]')).not.toBeNull();
  });

  it('mixed payload: disabled-family components skip silently, enabled ones render', () => {
    const registry = createRegistry();
    registry.register('shopify_product_card', makeModule());
    registry.register('calendar_slots', makeModule());
    const ctx = makeCtx({ enabled: { shopify: false, calendar: true, web_call: false } });
    const container = renderComponentsBlock(
      [
        productCard('c1'),
        { id: 's1', type: 'calendar_slots', version: 1, data: {} },
        productCard('c2'),
      ],
      ctx,
      registry,
    );
    expect(container).not.toBeNull();
    const wrappers = container!.querySelectorAll('[data-component-id]');
    expect(Array.from(wrappers).map((w) => w.getAttribute('data-component-id'))).toEqual(['s1']);
  });
});

describe('applyActionResultComponents()', () => {
  function renderIntoMessage(
    components: WireComponent[],
    ctx: RenderCtx,
    registry: ReturnType<typeof createRegistry>,
    messageId = 'msg_1',
  ): HTMLElement {
    const messagesEl = document.createElement('div');
    const msgWrapper = document.createElement('div');
    msgWrapper.setAttribute('data-message-id', messageId);
    messagesEl.appendChild(msgWrapper);
    const block = renderComponentsBlock(components, ctx, registry);
    if (block) msgWrapper.appendChild(block);
    return messagesEl;
  }

  it('applies each result component via the module update path', () => {
    const registry = createRegistry();
    const update = vi.fn();
    registry.register('shopify_product_card', makeModule({ update }));
    const ctx = makeCtx();
    const messagesEl = renderIntoMessage([productCard('c1'), productCard('c2')], ctx, registry);

    applyActionResultComponents(
      messagesEl, 'msg_1',
      [
        { id: 'c1', type: 'shopify_product_card', version: 1, data: { title: 'u1' } },
        { id: 'c2', type: 'shopify_product_card', version: 1, data: { title: 'u2' } },
      ],
      ctx,
      undefined,
      registry,
    );

    expect(update).toHaveBeenCalledTimes(2);
  });

  it('invokes onComponentApplied for every component in the result', () => {
    const registry = createRegistry();
    registry.register('shopify_product_card', makeModule({ update: vi.fn() }));
    const ctx = makeCtx();
    const messagesEl = renderIntoMessage([productCard('c1')], ctx, registry);
    const seen: string[] = [];

    applyActionResultComponents(
      messagesEl, 'msg_1',
      [{ id: 'c1', type: 'shopify_product_card', version: 1, data: {} }],
      ctx,
      (comp) => seen.push(comp.id),
      registry,
    );

    expect(seen).toEqual(['c1']);
  });

  it('dispatch result carrying a shopify_cart update bumps the chip count', () => {
    // End-to-end of the index.ts dispatch-wrapper wiring: a cart component
    // is rendered in the DOM, a dispatch result envelope carries an updated
    // shopify_cart, and the chip badge reflects the new total_quantity.
    const registry = createRegistry();
    registry.register('shopify_cart', makeModule({ update: vi.fn() }));
    const ctx = makeCtx();
    const messagesEl = renderIntoMessage(
      [{ id: 'cart_1', type: 'shopify_cart', version: 1, data: { total_quantity: 1 } }],
      ctx, registry,
    );
    const chip = createCartChip(1, vi.fn(), '#8349ff', '#f0ebff');

    applyActionResultComponents(
      messagesEl, 'msg_1',
      [{ id: 'cart_1', type: 'shopify_cart', version: 1, data: { total_quantity: 7 } }],
      ctx,
      (comp) => syncCartChipOnComponentUpdate(
        messagesEl, 'msg_1', comp.id, comp.data, (n) => updateCartChip(chip, n),
      ),
      registry,
    );

    expect(chip.querySelector('[data-part="chip-badge"]')?.textContent?.trim()).toBe('7');
  });
});

describe('renderSuggestionPills()', () => {
  it('returns null for an empty array', () => {
    expect(renderSuggestionPills([], vi.fn())).toBeNull();
  });

  it('renders one pill per suggestion', () => {
    const container = renderSuggestionPills(['Option A', 'Option B'], vi.fn());
    expect(container).not.toBeNull();
    const pills = container!.querySelectorAll('button');
    expect(pills).toHaveLength(2);
    expect(pills[0].textContent).toBe('Option A');
    expect(pills[1].textContent).toBe('Option B');
  });

  it('calls onSelect with the clicked suggestion text', () => {
    const onSelect = vi.fn();
    const container = renderSuggestionPills(['Ask me anything'], onSelect);
    (container!.querySelector('button') as HTMLButtonElement).click();
    expect(onSelect).toHaveBeenCalledWith('Ask me anything');
  });
});

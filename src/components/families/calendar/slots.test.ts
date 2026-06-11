import { describe, it, expect, vi } from 'vitest';
import { CalendarSlotsModule } from './slots';
import { renderComponentsBlock } from '../../core/message-integration';
import { createRegistry } from '../../core/registry';
import type { CalendarSlotsData, RenderCtx, ThemeTokens } from '../../core/types';

const theme: ThemeTokens = {
  primary: '#8349ff', primaryLight: '#f0ebff', text: '#072032',
  textMuted: '#5b6b7a', border: '#e5e7eb', surface: '#fff',
  surfaceSubtle: '#f9fafb', error: '#ef4444', errorSubtle: '#fee2e2',
  success: '#22c55e', successSubtle: '#dcfce7', warning: '#d97706', warningSubtle: '#fffbeb',
};

function makeCtx(overrides: Partial<RenderCtx> = {}): RenderCtx {
  return {
    dispatch: vi.fn().mockResolvedValue({ ok: true }),
    theme, visitorTimezone: 'America/New_York', distinctId: 'id',
    enabled: { shopify: true, calendar: true, web_call: true },
    formatTime: (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' }),
    formatDate: (d) => {
      const dt = new Date(d + 'T00:00:00');
      return { weekday: dt.toLocaleDateString('en-US', { weekday: 'short' }), day: String(dt.getDate()) };
    },
    ...overrides,
  };
}

const slotsFixture: CalendarSlotsData = {
  duration_minutes: 30, timezone: 'America/New_York',
  days: [
    { date: '2026-06-11', slots: [
      { start_iso: '2026-06-11T14:00:00Z', end_iso: '2026-06-11T14:30:00Z' },
      { start_iso: '2026-06-11T16:00:00Z', end_iso: '2026-06-11T16:30:00Z' },
    ]},
    { date: '2026-06-12', slots: [
      { start_iso: '2026-06-12T13:00:00Z', end_iso: '2026-06-12T13:30:00Z' },
    ]},
  ],
  requires_contact: false,
  notice: null,
};

describe('CalendarSlotsModule', () => {
  it('renders a date pill for each day', () => {
    const el = CalendarSlotsModule.render(slotsFixture, makeCtx());
    const datePills = el.querySelectorAll('[data-part="date-pill"]');
    expect(datePills).toHaveLength(2);
  });

  it('renders time pills for the first day by default', () => {
    const el = CalendarSlotsModule.render(slotsFixture, makeCtx());
    const timePills = el.querySelectorAll('[data-part="time-pill"]');
    expect(timePills).toHaveLength(2);
  });

  it('shows time pills in visitor timezone', () => {
    const el = CalendarSlotsModule.render(slotsFixture, makeCtx());
    const timePills = el.querySelectorAll('[data-part="time-pill"]');
    // 14:00 UTC = 10:00 AM EDT
    expect(timePills[0].textContent).toContain('10:00');
  });

  it('switches slot list when a different date pill is clicked', () => {
    const el = CalendarSlotsModule.render(slotsFixture, makeCtx());
    const datePills = el.querySelectorAll('[data-part="date-pill"]');
    (datePills[1] as HTMLElement).click();
    const timePills = el.querySelectorAll('[data-part="time-pill"]');
    expect(timePills).toHaveLength(1);
  });

  it('shows contact form when requires_contact is true and a slot is selected', () => {
    const contactFixture = { ...slotsFixture, requires_contact: true };
    const el = CalendarSlotsModule.render(contactFixture, makeCtx());
    const timePill = el.querySelector('[data-part="time-pill"]') as HTMLElement;
    timePill.click();
    const nameInput = el.querySelector('[data-part="contact-name"]');
    expect(nameInput).not.toBeNull();
  });

  it('dispatches calendar.book with name+email when requires_contact form is submitted', async () => {
    const dispatch = vi.fn().mockResolvedValue({ ok: true });
    const contactFixture = { ...slotsFixture, requires_contact: true };
    const el = CalendarSlotsModule.render(contactFixture, makeCtx({ dispatch }));
    (el.querySelector('[data-part="time-pill"]') as HTMLElement).click();
    (el.querySelector('[data-part="contact-name"]') as HTMLInputElement).value = 'Alice';
    (el.querySelector('[data-part="contact-email"]') as HTMLInputElement).value = 'alice@example.com';
    (el.querySelector('[data-part="book-btn"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 10));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      action_type: 'calendar.book',
      payload: expect.objectContaining({ name: 'Alice', email: 'alice@example.com' }),
    }));
  });

  it('does not dispatch and flags the email field when the email fails the light regex', async () => {
    const dispatch = vi.fn().mockResolvedValue({ ok: true });
    const contactFixture = { ...slotsFixture, requires_contact: true };
    const el = CalendarSlotsModule.render(contactFixture, makeCtx({ dispatch }));
    (el.querySelector('[data-part="time-pill"]') as HTMLElement).click();
    (el.querySelector('[data-part="contact-name"]') as HTMLInputElement).value = 'Alice';
    const emailInput = el.querySelector('[data-part="contact-email"]') as HTMLInputElement;
    emailInput.value = 'a@';
    (el.querySelector('[data-part="book-btn"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 10));
    expect(dispatch).not.toHaveBeenCalled();
    expect(emailInput.style.borderColor).not.toBe('');
  });

  it('shows amber notice when notice field is set', () => {
    const withNotice = { ...slotsFixture, notice: 'All times are tentative.' };
    const el = CalendarSlotsModule.render(withNotice, makeCtx());
    const notice = el.querySelector('[data-part="slots-notice"]');
    expect(notice?.textContent).toContain('All times are tentative.');
  });

  it('disables the book button and shows a pending label while dispatch is in flight', async () => {
    let resolveDispatch!: (r: { ok: boolean }) => void;
    const dispatch = vi.fn().mockImplementation(
      () => new Promise((resolve) => { resolveDispatch = resolve; }),
    );
    const el = CalendarSlotsModule.render(slotsFixture, makeCtx({ dispatch }));
    (el.querySelector('[data-part="time-pill"]') as HTMLElement).click();
    const btn = el.querySelector('[data-part="book-btn"]') as HTMLButtonElement;
    btn.click();
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('Booking...');
    resolveDispatch({ ok: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(btn.textContent).toBe('Booked!');
  });

  it('renders the error envelope message and re-enables the button on ok:false', async () => {
    const dispatch = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'SLOT_TAKEN', message: 'That time was just booked.', recoverable: true },
    });
    const el = CalendarSlotsModule.render(slotsFixture, makeCtx({ dispatch }));
    (el.querySelector('[data-part="time-pill"]') as HTMLElement).click();
    const btn = el.querySelector('[data-part="book-btn"]') as HTMLButtonElement;
    btn.click();
    await new Promise((r) => setTimeout(r, 10));
    const err = el.querySelector('[data-part="action-error"]') as HTMLElement;
    expect(err.style.display).not.toBe('none');
    expect(err.textContent).toBe('That time was just booked.');
    expect(btn.disabled).toBe(false);
  });

  it('toggles aria-pressed on date pills when switching days', () => {
    const el = CalendarSlotsModule.render(slotsFixture, makeCtx());
    const pills = el.querySelectorAll('[data-part="date-pill"]');
    expect(pills[0].getAttribute('aria-pressed')).toBe('true');
    expect(pills[1].getAttribute('aria-pressed')).toBe('false');
    (pills[1] as HTMLElement).click();
    expect(pills[0].getAttribute('aria-pressed')).toBe('false');
    expect(pills[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('dispatches calendar.book with the real component id and message id from the rendered wrapper', async () => {
    const dispatch = vi.fn().mockResolvedValue({ ok: true });
    const registry = createRegistry();
    registry.register('calendar_slots', CalendarSlotsModule);
    const block = renderComponentsBlock(
      [{ id: 'cmp_cal_1', type: 'calendar_slots', version: 1, data: slotsFixture }],
      makeCtx({ dispatch }),
      registry,
      'msg_42',
    );
    expect(block).not.toBeNull();
    expect(block!.querySelector('[data-component-id="cmp_cal_1"]')).not.toBeNull();
    (block!.querySelector('[data-part="time-pill"]') as HTMLElement).click();
    (block!.querySelector('[data-part="book-btn"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 10));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      action_type: 'calendar.book',
      message_id: 'msg_42',
      component_id: 'cmp_cal_1',
    }));
  });
});

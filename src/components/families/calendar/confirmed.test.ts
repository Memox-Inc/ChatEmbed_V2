import { describe, it, expect, vi } from 'vitest';
import { CalendarBookingConfirmedModule } from './confirmed';
import type { CalendarBookingConfirmedData, RenderCtx, ThemeTokens } from '../../core/types';

const theme: ThemeTokens = {
  primary: '#8349ff', primaryLight: '#f0ebff', text: '#072032',
  textMuted: '#5b6b7a', border: '#e5e7eb', surface: '#fff',
  surfaceSubtle: '#f9fafb', error: '#ef4444', errorSubtle: '#fee2e2',
  success: '#22c55e', successSubtle: '#dcfce7', warning: '#d97706', warningSubtle: '#fffbeb',
};

function makeCtx(): RenderCtx {
  return {
    dispatch: vi.fn().mockResolvedValue({ ok: true }),
    theme, visitorTimezone: 'America/New_York', distinctId: 'id',
    enabled: { shopify: true, calendar: true, web_call: true },
    formatTime: (iso) => iso, formatDate: () => ({ weekday: 'Wed', day: '11' }),
  };
}

const fixture: CalendarBookingConfirmedData = {
  start_iso: '2026-06-11T14:00:00Z', end_iso: '2026-06-11T14:30:00Z',
  timezone: 'America/New_York', host_name: 'Jane Smith',
  title: '30-min Product Demo',
  google_calendar_url: 'https://calendar.google.com/calendar/event?eid=xyz',
  ics_url: 'https://hub.memox.io/api/v1/calendar/booking/123/ics/',
};

describe('CalendarBookingConfirmedModule', () => {
  it('renders host name', () => {
    const el = CalendarBookingConfirmedModule.render(fixture, makeCtx());
    expect(el.textContent).toContain('Jane Smith');
  });

  it('renders booking title', () => {
    const el = CalendarBookingConfirmedModule.render(fixture, makeCtx());
    expect(el.textContent).toContain('30-min Product Demo');
  });

  it('renders Add to Google Calendar link with correct href', () => {
    const el = CalendarBookingConfirmedModule.render(fixture, makeCtx());
    const link = el.querySelector('[data-part="gcal-link"]') as HTMLAnchorElement | null;
    expect(link?.href).toContain('calendar.google.com');
    expect(link?.target).toBe('_blank');
  });

  it('renders ICS download link', () => {
    const el = CalendarBookingConfirmedModule.render(fixture, makeCtx());
    const ics = el.querySelector('[data-part="ics-link"]') as HTMLAnchorElement | null;
    expect(ics?.href).toContain('/ics/');
  });

  it('renders the full date with month in the visitor timezone', () => {
    // 2026-06-11T14:00:00Z in America/New_York is Thursday, June 11.
    const el = CalendarBookingConfirmedModule.render(fixture, makeCtx());
    const line = el.querySelector('[data-part="confirmed-datetime"]');
    expect(line?.textContent).toContain('Jun 11');
    expect(line?.textContent).toContain('Thu');
  });

  it('uses the visitor timezone for the date when the instant crosses midnight UTC', () => {
    // 02:00Z on Jun 12 is still 10:00 PM Jun 11 in America/New_York.
    const crossing = { ...fixture, start_iso: '2026-06-12T02:00:00Z', end_iso: '2026-06-12T02:30:00Z' };
    const el = CalendarBookingConfirmedModule.render(crossing, makeCtx());
    const line = el.querySelector('[data-part="confirmed-datetime"]');
    expect(line?.textContent).toContain('Jun 11');
  });
});

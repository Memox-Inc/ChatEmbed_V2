/**
 * Calendar booking confirmed renderer (MMX-468, Task 8).
 *
 * render(data, ctx) takes ONE raw CalendarBookingConfirmedData payload,
 * exactly as message-integration.ts calls it.
 *
 * No actions dispatched; this is a read-only confirmation card.
 *
 * All colors from ctx.theme. Zero hex literals.
 * All DOM via el()/svg()/text() from core/dom.ts. No innerHTML with data.
 */

import type { ComponentModule, RenderCtx, CalendarBookingConfirmedData } from '../../core/types';
import { el, svg, text } from '../../core/dom';
import { isSafeHttpsUrl } from '../../../utils/url';

// ---- SVG icons ---------------------------------------------------------------

function checkCircleIcon(): SVGSVGElement {
  return svg('svg', { width: '28', height: '28', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    svg('path', { d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' }),
    svg('polyline', { points: '22 4 12 14.01 9 11.01' }),
  ]);
}

function calendarPlusIcon(): SVGSVGElement {
  return svg('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    svg('rect', { x: '3', y: '4', width: '18', height: '18', rx: '2', ry: '2' }),
    svg('line', { x1: '16', y1: '2', x2: '16', y2: '6' }),
    svg('line', { x1: '8', y1: '2', x2: '8', y2: '6' }),
    svg('line', { x1: '3', y1: '10', x2: '21', y2: '10' }),
    svg('line', { x1: '12', y1: '15', x2: '12', y2: '19' }),
    svg('line', { x1: '10', y1: '17', x2: '14', y2: '17' }),
  ]);
}

function downloadIcon(): SVGSVGElement {
  return svg('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    svg('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
    svg('polyline', { points: '7 10 12 15 17 10' }),
    svg('line', { x1: '12', y1: '15', x2: '12', y2: '3' }),
  ]);
}

// ---- renderer ----------------------------------------------------------------

/**
 * Full date label ("Thu, Jun 11") in the VISITOR's timezone. ctx.formatDate
 * returns only { weekday, day } (no month), which reads ambiguously on this
 * standalone card, so the month comes from Intl directly. Using the iso
 * instant + visitor timezone (not the UTC date part) keeps the date correct
 * for bookings that cross midnight in the visitor's timezone.
 */
function formatFullDate(iso: string, visitorTimezone: string): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  try {
    return new Date(iso).toLocaleDateString('en-US', { ...opts, timeZone: visitorTimezone });
  } catch {
    // Invalid/hostile timezone string: fall back to the environment default.
    return new Date(iso).toLocaleDateString('en-US', opts);
  }
}

function renderConfirmed(data: CalendarBookingConfirmedData, ctx: RenderCtx): HTMLElement {
  const t = ctx.theme;

  // ---- root ----
  const root = el('div', { 'data-part': 'calendar-confirmed' });
  applyRootStyles(root, t);

  // ---- success icon + heading ----
  const heroArea = el('div', { 'data-part': 'confirmed-hero' });
  applyHeroStyles(heroArea, t);

  const iconWrap = el('div', { 'data-part': 'confirmed-icon' });
  iconWrap.style.cssText = `color:${t.success};display:flex;align-items:center;justify-content:center;`;
  iconWrap.appendChild(checkCircleIcon());

  const heading = el('div', { 'data-part': 'confirmed-heading' }, [text('Booking confirmed!')]);
  applyHeadingStyles(heading, t);

  heroArea.appendChild(iconWrap);
  heroArea.appendChild(heading);
  root.appendChild(heroArea);

  // ---- details card ----
  const details = el('div', { 'data-part': 'confirmed-details' });
  applyDetailsStyles(details, t);

  // Date / time line: "Thu, Jun 11, 10:00 AM to 10:30 AM"
  const dateLabel = formatFullDate(data.start_iso, ctx.visitorTimezone);
  const startTime = ctx.formatTime(data.start_iso);
  const endTime = ctx.formatTime(data.end_iso);
  const dateTimeStr = `${dateLabel}, ${startTime} to ${endTime}`;

  const dateTimeEl = el('div', { 'data-part': 'confirmed-datetime' }, [text(dateTimeStr)]);
  applyDetailLineStyles(dateTimeEl, t, true);
  details.appendChild(dateTimeEl);

  // Meeting title
  const titleEl = el('div', { 'data-part': 'confirmed-title' }, [text(data.title)]);
  applyDetailLineStyles(titleEl, t, false);
  titleEl.style.fontWeight = '600';
  details.appendChild(titleEl);

  // Host name
  const hostEl = el('div', { 'data-part': 'confirmed-host' }, [text(`with ${data.host_name}`)]);
  applyDetailLineStyles(hostEl, t, false);
  hostEl.style.cssText += `;color:${t.textMuted};`;
  details.appendChild(hostEl);

  root.appendChild(details);

  // ---- calendar links ----
  const linksArea = el('div', { 'data-part': 'confirmed-links' });
  applyLinksAreaStyles(linksArea);

  if (isSafeHttpsUrl(data.google_calendar_url)) {
    const gcalLink = el('a', {
      'data-part': 'gcal-link',
      href: data.google_calendar_url,
      target: '_blank',
      rel: 'noopener noreferrer',
    }) as HTMLAnchorElement;
    applyLinkStyles(gcalLink, t);

    const gcalIcon = el('span');
    gcalIcon.style.cssText = 'display:inline-flex;align-items:center;';
    gcalIcon.appendChild(calendarPlusIcon());
    gcalLink.appendChild(gcalIcon);
    gcalLink.appendChild(document.createTextNode(' Add to Google Calendar'));
    linksArea.appendChild(gcalLink);
  }

  if (isSafeHttpsUrl(data.ics_url)) {
    const icsLink = el('a', {
      'data-part': 'ics-link',
      href: data.ics_url,
      download: '',
      rel: 'noopener noreferrer',
    }) as HTMLAnchorElement;
    applyLinkStyles(icsLink, t);

    const icsIcon = el('span');
    icsIcon.style.cssText = 'display:inline-flex;align-items:center;';
    icsIcon.appendChild(downloadIcon());
    icsLink.appendChild(icsIcon);
    icsLink.appendChild(document.createTextNode(' Download .ics'));
    linksArea.appendChild(icsLink);
  }

  root.appendChild(linksArea);

  return root;
}

// ---- style helpers -----------------------------------------------------------

function applyRootStyles(root: HTMLElement, t: RenderCtx['theme']): void {
  root.style.cssText = [
    `background:${t.surface}`,
    `border:1px solid ${t.border}`,
    'border-radius:10px',
    'overflow:hidden',
    'max-width:320px',
    'width:100%',
  ].join(';');
}

function applyHeroStyles(hero: HTMLElement, t: RenderCtx['theme']): void {
  hero.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:10px',
    'padding:14px 16px 12px',
    `background:${t.successSubtle}`,
    `border-bottom:1px solid ${t.border}`,
  ].join(';');
}

function applyHeadingStyles(heading: HTMLElement, t: RenderCtx['theme']): void {
  heading.style.cssText = `font-size:15px;font-weight:700;color:${t.text};`;
}

function applyDetailsStyles(details: HTMLElement, t: RenderCtx['theme']): void {
  details.style.cssText = [
    'padding:12px 16px',
    'display:flex',
    'flex-direction:column',
    'gap:4px',
    `border-bottom:1px solid ${t.border}`,
  ].join(';');
}

function applyDetailLineStyles(el: HTMLElement, t: RenderCtx['theme'], first: boolean): void {
  el.style.cssText = [
    'font-size:13px',
    `color:${t.text}`,
    first ? 'margin-bottom:2px' : '',
  ].filter(Boolean).join(';');
}

function applyLinksAreaStyles(area: HTMLElement): void {
  area.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'gap:2px',
    'padding:10px 16px 12px',
  ].join(';');
}

function applyLinkStyles(a: HTMLAnchorElement, t: RenderCtx['theme']): void {
  a.style.cssText = [
    'font-size:13px',
    `color:${t.primary}`,
    'text-decoration:none',
    'display:inline-flex',
    'align-items:center',
    'gap:5px',
    'padding:4px 0',
    'background:none',
    'border:none',
    'cursor:pointer',
  ].join(';');
}

// ---- module export -----------------------------------------------------------

export const CalendarBookingConfirmedModule: ComponentModule = {
  version: 1,

  render(data: unknown, ctx: RenderCtx): HTMLElement {
    return renderConfirmed(data as CalendarBookingConfirmedData, ctx);
  },

  /**
   * DEAD UNTIL TASK 10: component_update events are currently a NO-OP for
   * this component. Nothing sets _ctx on the rendered element yet, so the
   * guard below always returns early. And because this module DEFINES
   * update(), applyComponentUpdate's re-render fallback never fires either.
   * Task 10 must set _ctx during render wiring to bring live updates to
   * life. Grep for "DEAD UNTIL TASK 10" to find every module with this
   * constraint.
   */
  update(el: HTMLElement, data: unknown): void {
    const ctx = (el as HTMLElement & { _ctx?: RenderCtx })._ctx;
    if (!ctx) return;
    const rendered = renderConfirmed(data as CalendarBookingConfirmedData, ctx);
    (rendered as HTMLElement & { _ctx?: RenderCtx })._ctx = ctx;
    el.replaceWith(rendered);
  },
};

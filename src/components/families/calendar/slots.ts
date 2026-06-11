/**
 * Calendar slots renderer (MMX-468, Task 8).
 *
 * render(data, ctx) takes ONE raw CalendarSlotsData payload, exactly as
 * message-integration.ts calls it (mod.render(component.data, ctx)).
 *
 * CONTRACT (immutable):
 *   dispatch action_type = "calendar.book"
 *   payload = { start_iso: string; end_iso: string; name?: string; email?: string }
 *
 * UX:
 *   - Date strip of [data-part="date-pill"] buttons, one per day.
 *   - Time grid: 3-col grid of [data-part="time-pill"] buttons for the selected day.
 *   - Times displayed in visitor timezone via ctx.formatTime(slot.start_iso).
 *   - [data-part="tz-note"] shows timezone name.
 *   - If data.notice is non-null, amber [data-part="slots-notice"] strip renders above the grid.
 *   - Slot selection:
 *     - requires_contact === false: Book button visible immediately on slot select.
 *     - requires_contact === true:  Inline contact form expands after slot select.
 *   - Pending/error states on the book button.
 *
 * All colors from ctx.theme. Zero hex literals.
 * All DOM via el()/svg()/text() from core/dom.ts. No innerHTML with data.
 */

import type { ComponentModule, RenderCtx, CalendarSlotsData, CalendarSlot } from '../../core/types';
import { el, svg, text } from '../../core/dom';

// ---- SVG icons ---------------------------------------------------------------

function calendarIcon(): SVGSVGElement {
  return svg('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    svg('rect', { x: '3', y: '4', width: '18', height: '18', rx: '2', ry: '2' }),
    svg('line', { x1: '16', y1: '2', x2: '16', y2: '6' }),
    svg('line', { x1: '8', y1: '2', x2: '8', y2: '6' }),
    svg('line', { x1: '3', y1: '10', x2: '21', y2: '10' }),
  ]);
}

function clockIcon(): SVGSVGElement {
  return svg('svg', { width: '12', height: '12', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    svg('circle', { cx: '12', cy: '12', r: '10' }),
    svg('polyline', { points: '12 6 12 12 16 14' }),
  ]);
}

// ---- main renderer -----------------------------------------------------------

interface SlotsState {
  selectedDayIndex: number;
  selectedSlot: CalendarSlot | null;
}

function renderSlots(data: CalendarSlotsData, ctx: RenderCtx): HTMLElement {
  const t = ctx.theme;

  const state: SlotsState = {
    selectedDayIndex: 0,
    selectedSlot: null,
  };

  // ---- root ----
  const root = el('div', { 'data-part': 'calendar-slots' });
  applyRootStyles(root, t);

  // ---- header bar ----
  const header = el('div', { 'data-part': 'slots-header' });
  applyHeaderStyles(header, t);

  const iconWrap = el('span');
  iconWrap.style.cssText = `color:${t.primary};display:flex;align-items:center;`;
  iconWrap.appendChild(calendarIcon());

  const titleEl = el('span', { 'data-part': 'slots-title' }, [text('Available Times')]);
  applyHeaderTitleStyles(titleEl, t);

  header.appendChild(iconWrap);
  header.appendChild(titleEl);
  root.appendChild(header);

  // ---- notice strip (amber) ----
  if (data.notice) {
    const notice = el('div', { 'data-part': 'slots-notice' }, [text(data.notice)]);
    applyNoticeStyles(notice, t);
    root.appendChild(notice);
  }

  // ---- date strip ----
  const dateStrip = el('div', { 'data-part': 'date-strip' });
  applyDateStripStyles(dateStrip);

  const datePillEls: HTMLButtonElement[] = [];

  for (let i = 0; i < data.days.length; i++) {
    const day = data.days[i];
    const { weekday, day: dayNum } = ctx.formatDate(day.date);
    const isSelected = i === state.selectedDayIndex;

    const pill = el('button', {
      'data-part': 'date-pill',
      'data-day-index': String(i),
      'aria-pressed': isSelected ? 'true' : 'false',
      type: 'button',
    }) as HTMLButtonElement;

    const wdEl = el('span', { 'data-part': 'date-pill-weekday' }, [text(weekday)]);
    const dayEl = el('span', { 'data-part': 'date-pill-day' }, [text(dayNum)]);
    wdEl.style.cssText = 'display:block;font-size:11px;';
    dayEl.style.cssText = 'display:block;font-size:15px;font-weight:700;';
    pill.appendChild(wdEl);
    pill.appendChild(dayEl);

    applyDatePillStyles(pill, isSelected, t);
    datePillEls.push(pill);
    dateStrip.appendChild(pill);
  }

  root.appendChild(dateStrip);

  // ---- time grid (container, rebuilt when day changes) ----
  const timeGridWrap = el('div', { 'data-part': 'time-grid-wrap' });
  root.appendChild(timeGridWrap);

  // ---- timezone note ----
  const tzNote = el('div', { 'data-part': 'tz-note' });
  applyTzNoteStyles(tzNote, t);

  const tzClockWrap = el('span');
  tzClockWrap.style.cssText = `color:${t.textMuted};display:inline-flex;align-items:center;margin-right:4px;vertical-align:middle;`;
  tzClockWrap.appendChild(clockIcon());
  tzNote.appendChild(tzClockWrap);
  tzNote.appendChild(document.createTextNode(ctx.visitorTimezone));
  root.appendChild(tzNote);

  // ---- action area (confirm button or contact form) ----
  const actionArea = el('div', { 'data-part': 'action-area' });
  root.appendChild(actionArea);

  // ---- error div ----
  const errorDiv = el('div', { 'data-part': 'action-error' });
  applyErrorDivStyles(errorDiv, t);
  errorDiv.style.display = 'none';
  root.appendChild(errorDiv);

  // ---- helpers ----

  function buildTimeGrid(dayIndex: number): void {
    // Clear existing
    while (timeGridWrap.firstChild) timeGridWrap.removeChild(timeGridWrap.firstChild);

    const dayData = data.days[dayIndex];
    if (!dayData || dayData.slots.length === 0) {
      const empty = el('div', {}, [text('No slots available.')]);
      empty.style.cssText = `font-size:13px;color:${t.textMuted};padding:8px 0;`;
      timeGridWrap.appendChild(empty);
      return;
    }

    const grid = el('div', { 'data-part': 'time-grid' });
    applyTimeGridStyles(grid);

    for (const slot of dayData.slots) {
      const timeLabel = ctx.formatTime(slot.start_iso);
      const isSelected = state.selectedSlot !== null &&
        state.selectedSlot.start_iso === slot.start_iso &&
        state.selectedSlot.end_iso === slot.end_iso;

      const timePill = el('button', {
        'data-part': 'time-pill',
        'data-start-iso': slot.start_iso,
        'data-end-iso': slot.end_iso,
        'aria-pressed': isSelected ? 'true' : 'false',
        type: 'button',
      }, [text(timeLabel)]) as HTMLButtonElement;

      applyTimePillStyles(timePill, isSelected, t);

      timePill.addEventListener('click', () => {
        state.selectedSlot = { start_iso: slot.start_iso, end_iso: slot.end_iso };
        buildTimeGrid(state.selectedDayIndex);
        buildActionArea();
      });

      grid.appendChild(timePill);
    }

    timeGridWrap.appendChild(grid);
  }

  function buildActionArea(): void {
    // Clear existing
    while (actionArea.firstChild) actionArea.removeChild(actionArea.firstChild);
    errorDiv.style.display = 'none';

    if (!state.selectedSlot) return;

    const slot = state.selectedSlot;

    if (!data.requires_contact) {
      // Simple confirm button
      const bookBtn = el('button', {
        'data-part': 'book-btn',
        type: 'button',
      }, [text(`Book ${ctx.formatTime(slot.start_iso)}`)]) as HTMLButtonElement;
      applyBookBtnStyles(bookBtn, false, t);

      bookBtn.addEventListener('click', () => {
        if (bookBtn.disabled) return;
        bookBtn.disabled = true;
        bookBtn.textContent = 'Booking...';

        ctx.dispatch({
          message_id: ctx.messageId ?? '',
          component_id: ctx.componentId ?? '',
          action_type: 'calendar.book',
          payload: { start_iso: slot.start_iso, end_iso: slot.end_iso },
        }).then((result) => {
          // TODO(Task 10): consume result.components: a slot-conflict
          // response carries fresh slots that should re-render this component;
          // nothing handles them yet (known deferral, they are dropped here).
          if (result.ok) {
            bookBtn.textContent = 'Booked!';
          } else {
            const msg = result.error?.message ?? 'Could not book. Please try again.';
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
            bookBtn.textContent = `Book ${ctx.formatTime(slot.start_iso)}`;
            bookBtn.disabled = false;
            if (result.error?.recoverable) {
              applyBookBtnStyles(bookBtn, false, t);
            }
          }
        }).catch(() => {
          errorDiv.textContent = 'Could not connect. Please try again.';
          errorDiv.style.display = 'block';
          bookBtn.textContent = `Book ${ctx.formatTime(slot.start_iso)}`;
          bookBtn.disabled = false;
        });
      });

      actionArea.appendChild(bookBtn);
    } else {
      // Contact form
      const form = el('div', { 'data-part': 'contact-form' });
      applyContactFormStyles(form, t);

      const nameInput = el('input', {
        'data-part': 'contact-name',
        type: 'text',
        placeholder: 'Your name',
      }) as HTMLInputElement;
      applyInputStyles(nameInput, t);

      const emailInput = el('input', {
        'data-part': 'contact-email',
        type: 'email',
        placeholder: 'Email address',
      }) as HTMLInputElement;
      applyInputStyles(emailInput, t);

      const bookBtn = el('button', {
        'data-part': 'book-btn',
        type: 'button',
      }, [text(`Confirm ${ctx.formatTime(slot.start_iso)}`)]) as HTMLButtonElement;
      applyBookBtnStyles(bookBtn, false, t);

      bookBtn.addEventListener('click', () => {
        if (bookBtn.disabled) return;
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();

        // Light client-side validation; server is authoritative
        if (!name) {
          nameInput.style.borderColor = t.error;
          nameInput.focus();
          return;
        }
        if (!email) {
          emailInput.style.borderColor = t.error;
          emailInput.focus();
          return;
        }

        bookBtn.disabled = true;
        bookBtn.textContent = 'Booking...';

        ctx.dispatch({
          message_id: ctx.messageId ?? '',
          component_id: ctx.componentId ?? '',
          action_type: 'calendar.book',
          payload: { start_iso: slot.start_iso, end_iso: slot.end_iso, name, email },
        }).then((result) => {
          // TODO(Task 10): consume result.components: see the no-contact
          // book path above; slot-conflict re-render payloads are dropped.
          if (result.ok) {
            bookBtn.textContent = 'Booked!';
          } else {
            const msg = result.error?.message ?? 'Could not book. Please try again.';
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
            bookBtn.textContent = `Confirm ${ctx.formatTime(slot.start_iso)}`;
            bookBtn.disabled = false;
          }
        }).catch(() => {
          errorDiv.textContent = 'Could not connect. Please try again.';
          errorDiv.style.display = 'block';
          bookBtn.textContent = `Confirm ${ctx.formatTime(slot.start_iso)}`;
          bookBtn.disabled = false;
        });
      });

      form.appendChild(nameInput);
      form.appendChild(emailInput);
      form.appendChild(bookBtn);
      actionArea.appendChild(form);
    }
  }

  // ---- date pill click handlers ----
  for (let i = 0; i < datePillEls.length; i++) {
    const pill = datePillEls[i];
    pill.addEventListener('click', () => {
      state.selectedDayIndex = i;
      state.selectedSlot = null;

      // Update pill selected states
      for (let j = 0; j < datePillEls.length; j++) {
        const p = datePillEls[j];
        const sel = j === i;
        p.setAttribute('aria-pressed', sel ? 'true' : 'false');
        applyDatePillStyles(p, sel, t);
      }

      buildTimeGrid(i);
      buildActionArea();
    });
  }

  // ---- initial render ----
  buildTimeGrid(0);

  return root;
}

// ---- style helpers -----------------------------------------------------------

function applyRootStyles(root: HTMLElement, t: RenderCtx['theme']): void {
  root.style.cssText = [
    `background:${t.surface}`,
    `border:1px solid ${t.border}`,
    'border-radius:10px',
    'overflow:hidden',
    'display:flex',
    'flex-direction:column',
    'gap:0',
    'max-width:320px',
    'width:100%',
  ].join(';');
}

function applyHeaderStyles(header: HTMLElement, t: RenderCtx['theme']): void {
  header.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:8px',
    'padding:12px 14px 10px',
    `border-bottom:1px solid ${t.border}`,
  ].join(';');
}

function applyHeaderTitleStyles(el: HTMLElement, t: RenderCtx['theme']): void {
  el.style.cssText = `font-size:14px;font-weight:600;color:${t.text};`;
}

function applyNoticeStyles(notice: HTMLElement, t: RenderCtx['theme']): void {
  notice.style.cssText = [
    'font-size:12px',
    `color:${t.warning}`,
    `background:${t.warningSubtle}`,
    'padding:6px 14px',
    `border-bottom:1px solid ${t.border}`,
  ].join(';');
}

function applyDateStripStyles(strip: HTMLElement): void {
  strip.style.cssText = [
    'display:flex',
    'gap:6px',
    'padding:10px 14px',
    'overflow-x:auto',
    'flex-wrap:wrap',
  ].join(';');
}

function applyDatePillStyles(pill: HTMLButtonElement, selected: boolean, t: RenderCtx['theme']): void {
  pill.style.cssText = [
    'padding:6px 10px',
    'border-radius:8px',
    'cursor:pointer',
    'border:none',
    'text-align:center',
    'min-width:48px',
    selected ? `background:${t.primary}` : `background:${t.surfaceSubtle}`,
    selected ? `color:${t.surface}` : `color:${t.text}`,
  ].join(';');
}

function applyTimeGridStyles(grid: HTMLElement): void {
  grid.style.cssText = [
    'display:grid',
    'grid-template-columns:repeat(3, 1fr)',
    'gap:6px',
    'padding:0 14px 10px',
  ].join(';');
}

function applyTimePillStyles(pill: HTMLButtonElement, selected: boolean, t: RenderCtx['theme']): void {
  pill.style.cssText = [
    'padding:7px 4px',
    'border-radius:6px',
    'font-size:12px',
    'font-weight:500',
    'cursor:pointer',
    'text-align:center',
    selected ? `border:1.5px solid ${t.primary}` : `border:1px solid ${t.border}`,
    selected ? `background:${t.primaryLight}` : `background:${t.surface}`,
    selected ? `color:${t.primary}` : `color:${t.text}`,
  ].join(';');
}

function applyTzNoteStyles(note: HTMLElement, t: RenderCtx['theme']): void {
  note.style.cssText = [
    'font-size:11px',
    `color:${t.textMuted}`,
    'padding:0 14px 10px',
    'display:flex',
    'align-items:center',
  ].join(';');
}

function applyContactFormStyles(form: HTMLElement, t: RenderCtx['theme']): void {
  form.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'gap:8px',
    'padding:10px 14px 0',
    `border-top:1px solid ${t.border}`,
  ].join(';');
}

function applyInputStyles(input: HTMLInputElement, t: RenderCtx['theme']): void {
  input.style.cssText = [
    'width:100%',
    'padding:8px 10px',
    `border:1px solid ${t.border}`,
    'border-radius:6px',
    'font-size:13px',
    `color:${t.text}`,
    `background:${t.surface}`,
    'box-sizing:border-box',
  ].join(';');
}

function applyBookBtnStyles(btn: HTMLButtonElement, disabled: boolean, t: RenderCtx['theme']): void {
  btn.style.cssText = [
    'width:calc(100% - 28px)',
    'margin:10px 14px',
    'padding:9px 14px',
    disabled ? `background:${t.primaryLight}` : `background:${t.primary}`,
    `color:${t.surface}`,
    'border:none',
    'border-radius:7px',
    'font-size:13px',
    'font-weight:600',
    disabled ? 'cursor:not-allowed;opacity:0.7' : 'cursor:pointer',
  ].join(';');
}

function applyErrorDivStyles(div: HTMLElement, t: RenderCtx['theme']): void {
  div.style.cssText = [
    'font-size:12px',
    `color:${t.error}`,
    `background:${t.errorSubtle}`,
    'padding:5px 14px',
    'margin:0 14px 8px',
    'border-radius:5px',
  ].join(';');
}

// ---- module export -----------------------------------------------------------

export const CalendarSlotsModule: ComponentModule = {
  version: 1,

  render(data: unknown, ctx: RenderCtx): HTMLElement {
    return renderSlots(data as CalendarSlotsData, ctx);
  },

  update(el: HTMLElement, data: unknown): void {
    const ctx = (el as HTMLElement & { _ctx?: RenderCtx })._ctx;
    if (!ctx) return;
    const rendered = renderSlots(data as CalendarSlotsData, ctx);
    (rendered as HTMLElement & { _ctx?: RenderCtx })._ctx = ctx;
    el.replaceWith(rendered);
  },
};

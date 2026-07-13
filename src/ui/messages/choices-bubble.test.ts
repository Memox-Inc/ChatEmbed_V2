/**
 * MMX-894 — handover fallback-choice buttons. The widget renders a
 * ``handover_choices`` frame as an accessible button group; picking one
 * fires the callback with the chosen id/label and disables the group so
 * a session can't pick twice.
 */

import { describe, expect, it, vi } from 'vitest';
import { createChoicesBubble } from './choices-bubble';
import type { StoredMessage } from '../../config/types';

function makeMessage(overrides: Partial<StoredMessage> = {}): StoredMessage {
  return {
    text: 'I could not reach anyone right now.',
    sender: 'system',
    choices: [
      { id: 'leave_message', label: 'Leave a message' },
      { id: 'talk_to_someone_else', label: 'Talk to someone else' },
    ],
    created_at: '12:30',
    ...overrides,
  };
}

describe('handover choices bubble (MMX-894)', () => {
  it('renders one button per choice with the choice label + id', () => {
    const el = createChoicesBubble(makeMessage(), vi.fn());
    const buttons = el.querySelectorAll<HTMLButtonElement>('.mcx-choice-btn');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toBe('Leave a message');
    expect(buttons[0].dataset.choiceId).toBe('leave_message');
    expect(buttons[1].dataset.choiceId).toBe('talk_to_someone_else');
    // All buttons are type=button so they never submit a parent form.
    expect(buttons[0].type).toBe('button');
  });

  it('renders the prompt text and an accessible group', () => {
    const el = createChoicesBubble(makeMessage(), vi.fn());
    const prompt = el.querySelector('.mcx-choices-prompt');
    expect(prompt?.textContent).toBe('I could not reach anyone right now.');
    const group = el.querySelector('.mcx-choices-group');
    expect(group?.getAttribute('role')).toBe('group');
  });

  it('fires onChoice with the right id + label when a button is clicked', () => {
    const onChoice = vi.fn();
    const el = createChoicesBubble(makeMessage(), onChoice);
    const buttons = el.querySelectorAll<HTMLButtonElement>('.mcx-choice-btn');
    buttons[1].click();
    expect(onChoice).toHaveBeenCalledTimes(1);
    expect(onChoice).toHaveBeenCalledWith({
      id: 'talk_to_someone_else',
      label: 'Talk to someone else',
    });
  });

  it('disables all buttons after a pick and marks the chosen one', () => {
    const el = createChoicesBubble(makeMessage(), vi.fn());
    const buttons = el.querySelectorAll<HTMLButtonElement>('.mcx-choice-btn');
    buttons[0].click();
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);
    expect(buttons[0].classList.contains('mcx-choice-btn--picked')).toBe(true);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('does not fire onChoice a second time once a pick is made', () => {
    const onChoice = vi.fn();
    const el = createChoicesBubble(makeMessage(), onChoice);
    const buttons = el.querySelectorAll<HTMLButtonElement>('.mcx-choice-btn');
    buttons[0].click();
    buttons[1].click();
    buttons[0].click();
    expect(onChoice).toHaveBeenCalledTimes(1);
  });

  it('renders already-disabled with the picked button marked when choicePicked is set', () => {
    const el = createChoicesBubble(
      makeMessage({ choicePicked: 'leave_message' }),
      vi.fn(),
    );
    const buttons = el.querySelectorAll<HTMLButtonElement>('.mcx-choice-btn');
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);
    expect(buttons[0].classList.contains('mcx-choice-btn--picked')).toBe(true);
  });
});

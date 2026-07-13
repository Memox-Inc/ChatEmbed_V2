import type { StoredMessage } from '../../config/types';

/**
 * MMX-894 — fallback-choice buttons for the handover orchestrator.
 *
 * When the backend can't connect the visitor to a rep it emits a
 * ``handover_choices`` frame (e.g. "leave a message" / "talk to someone
 * else"). We render those as an accessible button group: a status line
 * (``msg.text``) followed by one ``<button.mcx-choice-btn>`` per choice.
 *
 * ``onChoice`` fires with the chosen ``{id, label}`` when a button is
 * clicked. Once a pick is made (either live, via the click handler, or
 * on re-render when ``msg.choicePicked`` is already set) every button is
 * disabled so a session can't fire the same choice twice.
 */
export function createChoicesBubble(
  msg: StoredMessage,
  onChoice: (choice: { id: string; label: string }) => void,
): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'mcx-choices-wrap';

  if (msg.text) {
    const prompt = document.createElement('div');
    prompt.className = 'mcx-choices-prompt';
    // Plain text only — set via textContent, never innerHTML.
    prompt.textContent = msg.text;
    wrapper.appendChild(prompt);
  }

  const group = document.createElement('div');
  group.className = 'mcx-choices-group';
  group.setAttribute('role', 'group');
  if (msg.text) group.setAttribute('aria-label', msg.text);

  const buttons: HTMLButtonElement[] = [];
  const alreadyPicked = Boolean(msg.choicePicked);

  const choices = msg.choices || [];
  for (const choice of choices) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mcx-choice-btn';
    btn.textContent = choice.label;
    btn.dataset.choiceId = choice.id;

    if (alreadyPicked) {
      btn.disabled = true;
      if (msg.choicePicked === choice.id) {
        btn.classList.add('mcx-choice-btn--picked');
        btn.setAttribute('aria-pressed', 'true');
      }
    }

    btn.addEventListener('click', () => {
      // First terminal pick wins — guard against double-clicks and any
      // button in the group being re-activated.
      if (buttons.some((b) => b.disabled)) return;
      for (const b of buttons) b.disabled = true;
      btn.classList.add('mcx-choice-btn--picked');
      btn.setAttribute('aria-pressed', 'true');
      onChoice({ id: choice.id, label: choice.label });
    });

    buttons.push(btn);
    group.appendChild(btn);
  }

  wrapper.appendChild(group);
  return wrapper;
}

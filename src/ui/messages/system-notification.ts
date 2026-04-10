import type { StoredMessage } from '../../config/types';

export function createSystemNotification(
  msg: StoredMessage,
  handoverNotificationBg?: string,
  handoverNotificationText?: string,
  handoverNotificationBorder?: string,
): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'mcx-sys-notification-wrap';

  const notif = document.createElement('div');
  notif.className = 'mcx-sys-notification';

  if (msg.notificationType === 'session_closed') {
    notif.classList.add('mcx-sys-notification--closed');
    notif.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  } else if (msg.notificationType === 'joined') {
    notif.classList.add('mcx-sys-notification--joined');
    if (handoverNotificationBg) notif.style.background = handoverNotificationBg;
    if (handoverNotificationText) notif.style.color = handoverNotificationText;
    if (handoverNotificationBorder) notif.style.borderColor = handoverNotificationBorder;
    const icon = document.createElement('span');
    icon.textContent = '\uD83D\uDC4B'; // wave emoji
    icon.style.fontSize = '16px';
    notif.appendChild(icon);
  } else {
    const icon = document.createElement('span');
    icon.textContent = '\uD83D\uDCAC'; // speech balloon
    icon.style.fontSize = '16px';
    notif.appendChild(icon);
  }

  notif.appendChild(document.createTextNode(msg.text));
  wrapper.appendChild(notif);
  return wrapper;
}

import widgetCss from '../styles/widget.css?inline';

export function createShadowHost(): { host: HTMLElement; root: ShadowRoot } {
  const host = document.createElement('div');
  host.id = 'memox-chat-embed-host';
  host.style.all = 'initial';
  host.style.position = 'fixed';
  host.style.zIndex = '9999';
  host.style.bottom = '0';
  host.style.right = '0';
  host.style.fontFamily = 'sans-serif';

  const root = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = widgetCss;
  root.appendChild(style);

  return { host, root };
}

export function createInlineShadowHost(parent: HTMLElement): { host: HTMLElement; root: ShadowRoot } {
  const host = document.createElement('div');
  host.id = 'memox-chat-embed-host';
  host.style.all = 'initial';
  host.style.display = 'flex';
  host.style.flexDirection = 'column';
  host.style.width = '100%';
  host.style.height = '100%';
  host.style.minHeight = '0';
  host.style.overflow = 'hidden';
  host.style.fontFamily = 'sans-serif';

  const root = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = widgetCss;
  root.appendChild(style);

  parent.appendChild(host);
  return { host, root };
}

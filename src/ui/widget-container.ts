import type { ChatEmbedConfig } from '../config/types';

export function createWidgetContainer(config: ChatEmbedConfig): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'mcx-widget';

  if (config.mode === 'inline') {
    container.classList.add('mcx-widget--inline');
  } else {
    container.classList.add('mcx-widget--floating');
    if (config.position === 'left') {
      container.classList.add('mcx-widget--left');
    }
  }

  return container;
}

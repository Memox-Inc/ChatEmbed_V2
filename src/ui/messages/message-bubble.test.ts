/**
 * MMX-551 — sales-rep avatar must render the assigned rep's actual
 * profile photo (signed R2/S3 URL) when one is supplied, and fall
 * back to the default colored circle when it isn't.
 */

import { describe, expect, it } from 'vitest';
import { createMessageBubble } from './message-bubble';
import type { ChatEmbedConfig, StoredMessage } from '../../config/types';

const config: ChatEmbedConfig = {
  socketUrl: 'wss://example.com',
  baseUrl: 'https://example.com/api/v1/',
  token: 't',
  org_id: '1',
  agent_id: '1',
  theme: {},
};

function makeMessage(overrides: Partial<StoredMessage> = {}): StoredMessage {
  return {
    text: 'Hi, jumping in to help!',
    sender: 'sales_rep',
    senderName: 'Alice',
    created_at: '12:30',
    ...overrides,
  };
}

describe('sales-rep avatar rendering (MMX-551)', () => {
  it('falls back to the default SVG when no photo URL is supplied', () => {
    const { container } = createMessageBubble(makeMessage(), config, false);
    const avatar = container.querySelector('.mcx-avatar--sales_rep') as HTMLElement;
    expect(avatar).not.toBeNull();
    // No <img>, the SVG fallback is the only inner content.
    expect(avatar.querySelector('img')).toBeNull();
    expect(avatar.querySelector('svg')).not.toBeNull();
  });

  it('renders an <img> overlay when senderPhotoUrl is set', () => {
    const url = 'https://example.r2.cloudflarestorage.com/bucket/media/user_photos/user_2/abc.png?sig=x';
    const { container } = createMessageBubble(
      makeMessage({ senderPhotoUrl: url }),
      config,
      false,
    );
    const avatar = container.querySelector('.mcx-avatar--sales_rep') as HTMLElement;
    const img = avatar.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toBe(url);
    // SVG fallback remains in the DOM so an onError silently reveals
    // it without leaving an empty circle.
    expect(avatar.querySelector('svg')).not.toBeNull();
  });

  it('ignores unsafe (javascript:) photo URLs', () => {
    const { container } = createMessageBubble(
      makeMessage({ senderPhotoUrl: 'javascript:alert(1)' }),
      config,
      false,
    );
    const avatar = container.querySelector('.mcx-avatar--sales_rep') as HTMLElement;
    expect(avatar.querySelector('img')).toBeNull();
    expect(avatar.querySelector('svg')).not.toBeNull();
  });

  it('does not render <img> for non-rep senders even when senderPhotoUrl is set', () => {
    // Photo URLs are scoped to sales rep messages; bot/user/system
    // bubbles must ignore the field entirely.
    const { container } = createMessageBubble(
      makeMessage({ sender: 'user', senderPhotoUrl: 'https://example.com/img.png' }),
      config,
      false,
    );
    const avatar = container.querySelector('.mcx-avatar--user') as HTMLElement;
    expect(avatar.querySelector('img')).toBeNull();
  });
});

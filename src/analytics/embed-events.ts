// Posts a single analytics event to memox-hub. Fire-and-forget, never
// blocks the widget. Mirrors the PostHog capture call's resilience —
// any failure is swallowed.

export type EmbedEventType = 'chat_opened' | 'form_submitted';

export interface PostEmbedEventOptions {
  baseUrl: string;
  embedId: string;
  eventType: EmbedEventType;
  distinctId?: string;
  visitorId?: number | null;
  metadata?: Record<string, unknown>;
}

export async function postEmbedEvent(opts: PostEmbedEventOptions): Promise<void> {
  try {
    const url = `${opts.baseUrl.replace(/\/$/, '')}/embed/events/`;
    const body: Record<string, unknown> = {
      embed_id: opts.embedId,
      event_type: opts.eventType,
    };
    if (opts.distinctId) body.distinct_id = opts.distinctId;
    if (opts.visitorId != null) body.visitor_id = opts.visitorId;
    if (opts.metadata) body.metadata = opts.metadata;

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // swallow; analytics must never break the widget
  }
}

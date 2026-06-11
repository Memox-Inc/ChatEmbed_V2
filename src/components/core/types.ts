/** One component instance as it arrives on the wire. */
export interface WireComponent {
  id: string;
  type: string;
  version: number;
  data: unknown;
}

export interface MoneyV2 {
  amount: string;
  currency: string;
}

// Shopify product card
export interface ShopifyVariant {
  id: string;
  title: string;
  available: boolean;
  price: MoneyV2;
}

export interface ShopifyProductCardData {
  product_id: string;
  handle: string;
  title: string;
  image_url: string;
  url: string;
  price: MoneyV2;
  compare_at_price: MoneyV2 | null;
  variants: ShopifyVariant[];
  selected_variant_id: string;
  available: boolean;
  badge: string | null;
}

// Shopify cart
export interface CartLine {
  line_id: string;
  variant_id: string;
  title: string;
  variant_title: string;
  image_url: string;
  quantity: number;
  line_total: MoneyV2;
}

export interface ShopifyCartData {
  cart_id: string;
  lines: CartLine[];
  subtotal: MoneyV2;
  total_quantity: number;
  discount_codes: Array<{ code: string; applicable: boolean }>;
  checkout_url: string;
}

// Calendar slots
export interface CalendarSlot {
  start_iso: string;
  end_iso: string;
}

export interface CalendarDay {
  date: string;
  slots: CalendarSlot[];
}

export interface CalendarSlotsData {
  duration_minutes: number;
  timezone: string;
  days: CalendarDay[];
  requires_contact: boolean;
  notice: string | null;
}

// Calendar booking confirmed
export interface CalendarBookingConfirmedData {
  start_iso: string;
  end_iso: string;
  timezone: string;
  host_name: string;
  title: string;
  google_calendar_url: string;
  ics_url: string;
}

// Web call
export type WebCallState = 'idle' | 'connecting' | 'live' | 'ended' | 'error';

export interface WebCallData {
  state: WebCallState;
  agent_name: string;
  max_duration_seconds: number;
  started_at: string | null;
  duration_seconds: number | null;
  error: string | null;
}

// Action / result
export interface Action {
  message_id: string;
  component_id: string;
  action_type: string;
  payload: Record<string, unknown>;
}

export interface ErrorEnvelope {
  code: string;
  message: string;
  recoverable: boolean;
}

export interface ActionResult {
  ok: boolean;
  components?: WireComponent[];
  message?: unknown;
  checkout_url?: string | null;
  error?: ErrorEnvelope;
}

// Theme tokens
export interface ThemeTokens {
  primary: string;       // #8349ff
  primaryLight: string;  // #f0ebff
  text: string;          // #072032
  textMuted: string;     // #5b6b7a
  border: string;        // #e5e7eb
  surface: string;       // #ffffff
  surfaceSubtle: string; // #f9fafb
  error: string;         // #ef4444
  errorSubtle: string;   // #fee2e2
  success: string;       // #22c55e
  successSubtle: string; // #dcfce7
  warning: string;       // #d97706
  warningSubtle: string; // #fffbeb
}

export interface ComponentsEnabled {
  shopify: boolean;
  calendar: boolean;
  web_call: boolean;
}

export interface RenderCtx {
  dispatch(action: Action): Promise<ActionResult>;
  theme: ThemeTokens;
  visitorTimezone: string;
  distinctId: string;
  enabled: ComponentsEnabled;
  formatTime(isoString: string): string;
  formatDate(dateString: string): { weekday: string; day: string };
  /**
   * Per-component identity, stamped by renderComponentsBlock (and the
   * applyComponentUpdate re-render path) so every dispatch carries the real
   * wire ids. The hub ownership policy 403s any action whose component_id
   * does not belong to the claimed message, so renderers must send
   * ctx.messageId / ctx.componentId, never blanks. Optional because bare
   * module-level tests may render without the wrapper pipeline.
   */
  messageId?: string;
  componentId?: string;
}

// Module interface
export interface ComponentModule {
  /** Maximum version this module understands. Wire version > this -> skip. */
  version: number;
  render(data: unknown, ctx: RenderCtx): HTMLElement;
  update?(el: HTMLElement, data: unknown): void;
}

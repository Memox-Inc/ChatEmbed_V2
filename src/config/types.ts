export interface LogoStyle {
  logoUrl?: string;
  logoWidth?: string;
  logoHeight?: string;
  borderRadius?: string;
}

export interface HeaderStyle {
  backgroundColor?: string;
  textColor?: string;
  fontWeight?: string;
  fontFamily?: string;
  fontSize?: string;
  height?: string;
  padding?: string;
  borderRadius?: string;
  logoStyle?: LogoStyle;
  logoUrl?: string;
  logoWidth?: string;
  logoHeight?: string;
}

export interface CloseBtnIconStyle {
  display?: string;
}

export interface ScrollButtonStyle {
  iconColor?: string;
  backgroundColor?: string;
  hoverColor?: string;
  position?: {
    right?: string;
    bottom?: string;
  };
}

export interface InputStyle {
  border?: string;
  outline?: string;
  transition?: string;
  borderOnFocus?: string;
  boxShadowOnFocus?: string;
  borderOnBlur?: string;
  boxShadowOnBlur?: string;
}

export interface InputContainerStyle {
  padding?: string;
  borderTop?: string;
  inputStyle?: InputStyle;
}

export interface BotIcon {
  svgWidth?: string;
  svgHeight?: string;
  width?: string;
  height?: string;
  objectFit?: string;
  botAvatarUrl?: string | null;
  botIconAvatarWidth?: string;
  botIconAvatarHeight?: string;
  botIconAvatarDisplay?: string;
  botMessageWidth?: string;
}

export interface UserIcon {
  userIconAvatarWidth?: string;
  userIconAvatarHeight?: string;
  userIconAvatarDisplay?: string;
  userMessageWidth?: string;
}

export interface Theme {
  primary?: string;
  userBubble?: string;
  botBubble?: string;
  userText?: string;
  botText?: string;
  background?: string;
  containerBg?: string;
  containerBorderStyle?: string;
  messagesBg?: string;
  messagesContainerPadding?: string;
  inputContainerBg?: string;
  border?: string;
  text?: string;
  width?: string;
  maxWidth?: string;
  minWidth?: string;
  borderRadius?: string;
  fontFamily?: string;
  zIndex?: number;
  inputBg?: string;
  inputText?: string;
  sendBtnBg?: string;
  sendBtnText?: string;
  sendBtnSvgColor?: string;
  sendBtnHover?: string;
  shadow?: string;
  salesRepBubble?: string;
  salesRepText?: string;
  salesRepAvatar?: string;
  userAvatar?: string;
  botAvatar?: string;
  userAvatarSvgColor?: string;
  botAvatarSvgColor?: string;
  salesRepAvatarSvgColor?: string;
  userAvatarBorder?: string;
  botAvatarBorder?: string;
  salesRepAvatarBorder?: string;
  timestampColor?: string;
  messageFontFamily?: string;
  handoverNotificationBg?: string;
  handoverNotificationText?: string;
  handoverNotificationBorder?: string;
  closeBtnIconStyle?: CloseBtnIconStyle;
  headerStyle?: HeaderStyle;
  scrollButtonStyle?: ScrollButtonStyle;
  inputContainerStyle?: InputContainerStyle;
  headerBg?: string;
  headerText?: string;
  botIcon?: BotIcon;
  userIcon?: UserIcon;
}

export interface WelcomeMessageStyle {
  lineHeight?: string;
  body?: { marginTop?: string; color?: string };
  closing?: { marginTop?: string };
}

export interface LeadFormHelperText {
  text?: string;
  fontSize?: string;
  lineHeight?: string;
  textAlign?: string;
  padding?: string;
  marginBottom?: string;
  border?: string;
  background?: string;
  color?: string;
  fontStyle?: string;
  borderRadius?: string;
}

// Launcher attractor system — mirrors the Pydantic LauncherConfig in
// memox-hub/memox_hub/embed_app/launcher_config.py. Field names match
// the wire format (snake_case) so a config fetched from /embed/init can
// be merged into the widget config without a normalisation step.

export interface TeaserAttractor {
  enabled?: boolean;
  text?: string;
  show_after_seconds?: number;
  dismissible?: boolean;
}

export interface PersonaAttractor {
  enabled?: boolean;
  name?: string;
  message?: string;
  show_chips?: boolean;
}

export interface PulseAttractor {
  enabled?: boolean;
}

export interface BadgeAttractor {
  enabled?: boolean;
}

export interface SmartAutoOpenAttractor {
  enabled?: boolean;
  time_seconds?: number;
  scroll_percent?: number;
}

export interface Attractors {
  teaser?: TeaserAttractor;
  persona?: PersonaAttractor;
  pulse?: PulseAttractor;
  badge?: BadgeAttractor;
  smart_auto_open?: SmartAutoOpenAttractor;
}

export type LauncherFormFactor = 'round' | 'pill';
export type LauncherIconType = 'bubble' | 'custom' | 'photo';

export interface LauncherConfig {
  form_factor?: LauncherFormFactor;
  pill_text?: string | null;
  icon_type?: LauncherIconType;
  custom_icon_url?: string | null;
  photo_url?: string | null;
  attractors?: Attractors;
}

// ───────────────── Lead capture v2 — MMX-575 ─────────────────
// These mirror memox-hub's Pydantic LeadCaptureConfig (memox_hub/embed_app/
// lead_capture_config.py) so the wire format is one-to-one. The server
// validates against the same shape; the widget renders from it.

export type LeadFieldType = 'text' | 'email' | 'phone' | 'number';
export type LeadFormVariant = 'multi_step' | 'single_step';
export type PhoneValidationMode = 'strict' | 'loose' | 'none';

export interface PhoneFieldOptions {
  /** ISO 3166-1 alpha-2 codes the visitor can pick from. Non-empty. */
  allowed_countries: string[];
  /** Pre-selected ISO code. Must be present in ``allowed_countries``. */
  default_country: string;
  /**
   * Validation strictness:
   *   - ``strict`` (default): must be a valid number for the selected country
   *     (min/max digit length enforced).
   *   - ``loose``: 5-15 digit total, no per-country rules.
   *   - ``none``: only checked for emptiness if ``required``.
   */
  validation?: PhoneValidationMode;
}

export interface LeadCaptureField {
  /** ``name``/``email``/``phone``/``zip`` for built-ins; ``f_<nanoid>`` for custom. */
  key: string;
  label: string;
  type: LeadFieldType;
  enabled: boolean;
  required: boolean;
  custom: boolean;
  /** Required when ``type === 'phone'``; forbidden otherwise. */
  phone_options?: PhoneFieldOptions;
}

export interface LeadCaptureConfig {
  enabled: boolean;
  variant: LeadFormVariant;
  fields: LeadCaptureField[];
}

export interface ChatEmbedConfig {
  title?: string;
  customIcon?: string | null;
  botIcon?: BotIcon;
  botMessageWidth?: string;
  userIcon?: UserIcon;
  theme?: Theme;
  apiUrl?: string;
  socketUrl?: string;
  baseUrl?: string;
  token?: string;
  /**
   * Per-session embed token issued by ``POST /api/v1/embed/init/``.
   * When present, REST calls send ``Authorization: EmbedToken <sessionToken>``
   * instead of the legacy global ``Token <token>`` — which is org-scoped
   * server-side via the embed config, so a leaked widget bundle can only
   * see/modify visitors in its own org. Falls back to the legacy
   * ``token`` if the server omits it (older backend, OSS deploys).
   *
   * Phase B PR3 of the embed-token-leak fix will drop ``token`` from
   * the init response, making this the only auth path.
   */
  sessionToken?: string;
  org_id?: string | number;
  agent_id?: string;
  welcomeMessage?: string | null;
  welcomeMessageStyle?: WelcomeMessageStyle;
  /**
   * Lead-capture form gate. Accepts:
   *   - ``boolean`` (legacy) — true shows the multi-step default form,
   *     false skips the form entirely.
   *   - ``LeadCaptureConfig`` (v2) — full data-driven config with
   *     variant (multi/single step) + per-field labels, types, and
   *     required flags. MMX-575.
   * The server's ``/embed/init`` response always ships v2; legacy
   * boolean is preserved for self-hosted/OSS callers that don't talk
   * to a Memox backend.
   */
  leadCapture?: boolean | LeadCaptureConfig;
  /**
   * v2 server-driven config object. Populated by ``normalizeServerConfig``
   * alongside the legacy ``leadCapture`` boolean for backward compat.
   * Readers should prefer this when present — it's the source of truth
   * for variant + fields.
   */
  leadCaptureConfig?: LeadCaptureConfig;
  leadFormHelperText?: LeadFormHelperText;
  quickQuestions?: string[];
  quickQuestionsPermanent?: boolean;
  position?: 'left' | 'right';
  ngrok?: boolean;
  isMobileDevice?: boolean;
  mode?: 'floating' | 'inline';
  /**
   * CSS selector for the element to mount the widget inside when
   * ``mode === 'inline'``. The widget appends its shadow host to the
   * matched element. Falls back to ``#memox-chat-container``, then to
   * the parent of the loading ``<script>`` tag, then to ``document.body``
   * if none of those resolve.
   */
  parentSelector?: string;
  /**
   * localStorage prefix. Defaults to ``simple-chat``. Set this to a
   * unique string per embed instance when more than one chat widget
   * may run on the same origin (e.g. ``simple-chat-website`` for the
   * marketing site widget vs ``simple-chat-demo-outbound-sales`` for
   * a per-persona demo embed). Without it, the two instances share
   * messages/session/visitor across the whole origin.
   */
  storageNamespace?: string;
  /**
   * In ``floating`` mode, close the chat panel when the visitor clicks
   * outside of it (and outside the launcher button). Defaults to true.
   * Has no effect in ``inline`` mode — the demo page mounts the panel
   * inside the page layout and shouldn't react to outside clicks.
   */
  closeOnOutsideClick?: boolean;
  /**
   * Per-embed identifier ("emb_..."). When set, the widget fetches its
   * launcher + attractor config from ``/api/v1/embed/init/`` at startup
   * and merges it on top of any locally-supplied config. When unset
   * (e.g. self-hosted/OSS deployments without a Memox backend), the
   * widget skips the fetch and uses the local config as-is.
   */
  embedId?: string | null;
  /**
   * Backend base URL for the embed init fetch. Defaults to
   * ``apiUrl`` derived value if unset. Hostname only — no trailing slash.
   */
  apiBase?: string;
  /**
   * Memox-owned PostHog project key for widget analytics. Injected by
   * memox-hub's /embed/init response as ``memox_posthog_api_key`` and
   * auto-aliased to camelCase by normalizeServerConfig. Namespaced under
   * ``memox`` so customers who set their own ``posthogApiKey`` for THEIR
   * own analytics aren't accidentally overridden by mergeConfig precedence
   * (see merge.ts:20-22 — server wins on truthy values). MMX-598.
   * When unset, all analytics calls are no-ops — self-hosted/OSS deployments
   * don't need PostHog.
   */
  memoxPosthogApiKey?: string;

  /** Optional override of PostHog ingest host (e.g. EU region). Defaults to https://us.i.posthog.com. */
  memoxPosthogHost?: string;
  /**
   * Consent/CMP hook (L4). When set to ``true`` by the site owner's embed
   * snippet, the widget:
   *   - Omits ``distinct_id`` from the ``/embed/init`` POST body so the
   *     backend skips bandit resolution and the visitor is not bucketed.
   *   - Sends ``disable_experiments: true`` in the init body to let the
   *     server know no A/B variant should be assigned.
   *   - Skips the PostHog ``identify`` and ``group`` calls after lead capture.
   * Regular ``capture()`` calls (anonymous usage events) are unaffected —
   * only the identity-linking / experiment-bucketing paths are gated.
   * Default (absent/false): normal behaviour.
   */
  disableExperiments?: boolean;
  /**
   * Launcher form-factor + attractor system. Snake_case matches the
   * /embed/init wire format so server-fetched values can be merged in
   * without translation. See ``LauncherConfig`` for fields.
   */
  launcher?: LauncherConfig;
}

export interface StoredMessage {
  text: string;
  sender: 'user' | 'bot' | 'ai' | 'sales_rep' | 'system';
  isWelcomeMessage?: boolean;
  isSystemNotification?: boolean;
  notificationType?: 'joined' | 'session_closed' | string;
  isStreaming?: boolean;
  messageId?: string;
  senderName?: string | { name?: string };
  // MMX-551: backend serves a freshly-signed R2/S3 URL for the sales
  // rep's profile photo on handover_message and post-handover text
  // frames. When present we render it as the sales-rep avatar `<img>`
  // overlay; absent / empty falls back to the default colored circle.
  senderPhotoUrl?: string;
  created_at?: string;
  lastChunkTime?: number;
}

export interface VisitorInfo {
  id: string | number;
  name: string;
}

export interface BrowserMetadata {
  userAgent: string;
  platform: string;
  language: string;
  referrer: string;
  url: string;
  timestamp: string;
  screenResolution: string;
  timezone: string;
  cookiesEnabled: boolean;
}

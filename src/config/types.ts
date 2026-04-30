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
  org_id?: string | number;
  agent_id?: string;
  welcomeMessage?: string | null;
  welcomeMessageStyle?: WelcomeMessageStyle;
  leadCapture?: boolean;
  leadFormHelperText?: LeadFormHelperText;
  quickQuestions?: string[];
  quickQuestionsPermanent?: boolean;
  position?: 'left' | 'right';
  ngrok?: boolean;
  isMobileDevice?: boolean;
  mode?: 'floating' | 'inline';
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

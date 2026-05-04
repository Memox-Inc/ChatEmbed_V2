# ChatEmbed_V2

Embeddable chat widget for the Memox platform. Distributes via jsDelivr CDN. Pinned by URL on the consumer side.

## V1 vs V3 Source Layout

The repo contains two parallel implementations. They are NOT both maintained.

### V3 — current, the only one shipped to new customers

- **Source:** TypeScript under `src/`, built by Vite into `dist/chat-embed.js` (IIFE, single file, no code-splitting).
- **CDN URL pattern:** `https://cdn.jsdelivr.net/gh/Memox-Inc/ChatEmbed_V2@vX.Y.Z/dist/chat-embed.js` (note the `/dist/` segment).
- **Release:** `gh workflow run release.yml -f version=X.Y.Z -f set_active=true`
- All new features and bug fixes go here.

### V1 — deprecated, frozen

- **Files:** `chat-embed.js` and `chat-embed-min.js` at the repo root.
- Kept only so older customer integrations that pin to URLs without the `/dist/` segment continue to work.
- Do not add features here. If a feature exists in V1 but not in V3, port it into `src/`.
- **Stop check:** if you are editing root `chat-embed.js`, you are in the wrong file.

## Build & Release

```bash
# Local dev — Vite dev server, opens test/index.html
npm run dev

# Production build — outputs dist/chat-embed.js
npm run build        # calls vite (see vite.config.ts)

# Vite preview of built bundle
npm run preview

# Unit tests (vitest)
npm test             # single run
npm run test:watch   # watch mode

# Minify V1 root file (rarely needed — V1 is frozen)
npm run build        # note: package.json "build" script currently points to terser for V1
```

> Note: `package.json` `"build"` script is wired to the terser minifier for the legacy V1 file.
> The V3 Vite build is invoked via `vite build` directly (the `release.yml` workflow runs `npm run build`
> which in CI context builds the V3 bundle via `vite`). Confirm current script targets before assuming.

### Release workflow

1. `gh workflow run release.yml -f version=X.Y.Z -f set_active=true`
2. The workflow: sets version in `package.json`, runs `npm run build` (Vite), checks bundle size,
   updates `latest.json`, commits `dist/chat-embed.js` + `package.json` + `latest.json`, tags `vX.Y.Z`, creates a GitHub Release.
3. jsDelivr serves the tagged `dist/chat-embed.js` immediately after the tag is pushed.

**Versioning:** SemVer. Patch for fixes, minor for features, major for breaking embed-API changes.

## Architecture (V3)

```
src/
├── index.ts                  # Entry point — init(), window.SimpleChatEmbedConfig / MemoxChatConfig
├── config/
│   ├── types.ts              # ChatEmbedConfig, Theme, StoredMessage, etc.
│   ├── defaults.ts           # Default config values
│   └── merge.ts              # Deep-merge user config onto defaults
├── connection/
│   ├── websocket-manager.ts  # WebSocket lifecycle, heartbeat, reconnect
│   └── api-client.ts         # REST: validateSession, createVisitor
├── session/
│   └── session-store.ts      # localStorage wrapper, supports storageNamespace
├── analytics/
│   └── posthog.ts            # PostHog fire-and-forget (no SDK bundled — raw fetch /capture/)
├── ui/
│   ├── shadow-host.ts        # Shadow DOM host for style isolation (floating + inline modes)
│   ├── widget-container.ts   # Outer widget shell
│   ├── header.ts             # Chat header bar
│   ├── launcher.ts           # Floating launcher button
│   ├── scroll-button.ts      # Scroll-to-bottom affordance
│   ├── messages/
│   │   ├── message-bubble.ts       # Individual message bubble
│   │   ├── message-list.ts         # Scrollable message list
│   │   ├── streaming-renderer.ts   # Token-by-token streaming updates
│   │   ├── markdown-renderer.ts    # marked + DOMPurify for bot messages
│   │   ├── system-notification.ts  # Handover / session-closed banners
│   │   └── thinking-indicator.ts   # Animated "thinking" dots
│   ├── input/
│   │   ├── input-bar.ts            # Message compose + send
│   │   └── quick-questions.ts      # Pre-set question chips
│   └── forms/
│       ├── lead-capture-form.ts    # Lead form (name / email / phone)
│       └── validation.ts           # E.164 phone normalization, field validators
└── utils/
    ├── dom.ts                # sanitizeInput, DOM helpers
    ├── timestamp.ts          # formatTimeStamp
    └── uuid.ts               # generateChatId
```

Key design choices:
- **Vanilla DOM** — no React/Vue runtime. Keeps the bundle small for landing-page includes.
- **Single IIFE bundle** — `vite.config.ts` sets `formats: ['iife']`, `inlineDynamicImports: true`, `cssCodeSplit: false`. One `<script>` tag, no dynamic chunks.
- **Shadow DOM** — widget renders inside a shadow root so host-page CSS cannot bleed in.
- **WebSocket** — persistent connection to memox-hub for real-time chat and streaming.
- **Markdown rendering** — `marked` + `DOMPurify` (both bundled; DOMPurify sanitizes before DOM insertion).
- **PostHog** — no SDK; events posted directly to `/capture/` via `fetch` with `keepalive: true`. No-op when `posthogApiKey` is unset.

## Embed Config

The widget reads from `window.MemoxChatConfig` (preferred) or `window.SimpleChatEmbedConfig` (legacy alias).

Key config fields (`ChatEmbedConfig` in `src/config/types.ts`):

| Field | Purpose |
|---|---|
| `socketUrl` | WebSocket URL for memox-hub (e.g. `wss://hub.memox.io`) |
| `baseUrl` | REST base URL (e.g. `https://hub.memox.io/api/v1/`) |
| `token` | Agent auth token |
| `org_id` | Organization ID |
| `agent_id` | Agent ID |
| `mode` | `'floating'` (default) or `'inline'` |
| `storageNamespace` | localStorage prefix — set a unique value when multiple widgets share an origin |
| `posthogApiKey` | PostHog project key — omit to disable analytics |
| `posthogHost` | PostHog host (default: `https://us.i.posthog.com`) |
| `theme` | Full theme object (colors, fonts, dimensions) |
| `leadCapture` | Show lead form before chat starts (default: `true`) |
| `quickQuestions` | Pre-set question chips |
| `closeOnOutsideClick` | Close floating panel on outside click (default: `true`) |

Default theme: white background (`#fff`), `#8349ff` accent.

## Message Types

Inbound WebSocket messages use a `message_type` discriminator:

| `message_type` | Handling |
|---|---|
| `text` / streaming tokens | Rendered via `StreamingRenderer` |
| `error_message` | Displays error bubble |
| `handover_message` | Shows handover notification |
| `unread_message` / `handover_requested` | Silently ignored |
| `heartbeat` | Sent by client to keep connection alive |

The IR Bot sends structured `rich_content` messages from the `feature/rich-components` branch. That branch adds 9 component renderers (vanilla HTML) and an `InlineChart` SVG renderer. Those renderers are not on `main` yet — they live on `feature/rich-components`.

## TypeScript

Type checking is wired via the workspace TypeScript LSP plugin. Run `npm run build` (or `npx tsc --noEmit`) to surface type errors before pushing.

## Testing

- **Unit tests:** `vitest` in `test/` directory — `npm test`
- **Manual browser test pages:** `test/index.html`, `test/floating-test.html`, `test/inline-test.html`, `test/icon-options.html`, `test/playground-preview.html` — load directly in a browser
- **E2E tests:** Playwright suite at `../memox-hub/tests/e2e/` (cross-cutting suite driven from the backend repo, not this repo)
- **IR Bot DOM assertion pages:** `test-ir-components.html`, `test-ir-edge-cases.html` (on `feature/rich-components` branch)

## Pointers

- Workspace rules (git/JIRA branching, kebab-case, model routing, Research-Plan-Execute loop) — `../../CLAUDE.md`
- IR Bot backend (FMP tools, rich content protocol) — `../memox-hub/CLAUDE.md` (or workspace CLAUDE.md IR Bot section)
- Voice/chat dashboard frontend — `../mmx-unified-chat/CLAUDE.md`

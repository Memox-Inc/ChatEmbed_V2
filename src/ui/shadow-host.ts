import widgetCss from '../styles/widget.css?inline';

// Closed shadow roots are not retrievable from outside the call site that
// created them — there is no DOM API to re-open one. So we stash the
// ShadowRoot on the host element via a non-enumerable property and use it
// for idempotent reuse. This is the only safe way to honour "call again,
// get the same host back" for closed-mode shadow DOM.
const SHADOW_ROOT_REF = '__memoxChatEmbedShadowRoot';

interface HostWithCachedRoot extends HTMLElement {
  [SHADOW_ROOT_REF]?: ShadowRoot;
}

function attachStyledRoot(host: HTMLElement): ShadowRoot {
  const root = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = widgetCss;
  root.appendChild(style);
  (host as HostWithCachedRoot)[SHADOW_ROOT_REF] = root;
  return root;
}

function findExistingHostIn(parent: ParentNode): HostWithCachedRoot | null {
  // We append the host as a direct child of ``parent`` (or document.body
  // for floating mode), so a linear scan of ``children`` is enough and
  // avoids relying on ``:scope`` (which jsdom-based unit tests don't
  // implement consistently across versions). querySelector would also
  // match descendants, which is too loose — a host page can legitimately
  // have its own ``#memox-chat-embed-host`` lower in the tree (e.g. a
  // nested iframe content document we don't own).
  for (const child of Array.from(parent.children) as HostWithCachedRoot[]) {
    if (child.id === 'memox-chat-embed-host') return child;
  }
  return null;
}

export function createShadowHost(): { host: HTMLElement; root: ShadowRoot } {
  // Floating mode mounts to ``document.body`` elsewhere in init() — if a
  // previous bootstrap already left a host there, reuse it so a second
  // init() (host page double-mounts the script tag, SPA-nav races,
  // marketing widget + per-page widget overlapping) does not produce a
  // second floating launcher.
  const existing = findExistingHostIn(document.body);
  if (existing && existing[SHADOW_ROOT_REF]) {
    return { host: existing, root: existing[SHADOW_ROOT_REF]! };
  }

  const host = document.createElement('div');
  host.id = 'memox-chat-embed-host';
  host.style.all = 'initial';
  host.style.position = 'fixed';
  host.style.zIndex = '9999';
  host.style.bottom = '0';
  host.style.right = '0';
  host.style.fontFamily = 'sans-serif';

  const root = attachStyledRoot(host);
  return { host, root };
}

export function createInlineShadowHost(parent: HTMLElement): {
  host: HTMLElement;
  root: ShadowRoot;
} {
  // Idempotent: if init() runs twice against the same parent (e.g. a host
  // page's React effect re-fires after the chat-embed.js network load was
  // already in flight, so two scripts complete and both call init()), we
  // must NOT append a second host. Two hosts in a flex container split
  // the row and render two side-by-side widget halves. See MMX-585.
  const existing = findExistingHostIn(parent);
  if (existing && existing[SHADOW_ROOT_REF]) {
    return { host: existing, root: existing[SHADOW_ROOT_REF]! };
  }

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

  const root = attachStyledRoot(host);
  parent.appendChild(host);
  return { host, root };
}

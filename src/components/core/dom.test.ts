import { describe, it, expect } from 'vitest';
import { el, svg, text, append } from './dom';

describe('el() builder', () => {
  it('creates an element with the given tag', () => {
    const div = el('div');
    expect(div.tagName).toBe('DIV');
  });

  it('sets className via attrs', () => {
    const d = el('div', { className: 'foo bar' });
    expect(d.className).toBe('foo bar');
  });

  it('sets arbitrary attributes', () => {
    const d = el('div', { 'data-state': 'idle' });
    expect(d.getAttribute('data-state')).toBe('idle');
  });

  it('appends child nodes', () => {
    const child = el('span');
    const parent = el('div', {}, [child]);
    expect(parent.firstChild).toBe(child);
  });

  it('renders malicious server string as literal text, not parsed HTML', () => {
    // XSS guarantee: data from the server must never become parsed markup.
    const malicious = '<img src=x onerror=alert(1)>';
    const d = el('div', {}, [text(malicious)]);
    expect(d.textContent).toBe(malicious);
    expect(d.querySelector('img')).toBeNull();
  });

  it('does NOT expose an innerHTML shortcut key in attrs', () => {
    // Passing a title attribute containing markup-like content must
    // set the attribute verbatim, not parse HTML into the document.
    const evil = '<script>evil</scr' + 'ipt>';
    const d = el('div', { title: evil });
    expect(d.getAttribute('title')).toBe(evil);
    expect(d.querySelector('script')).toBeNull();
  });

  it('throws on onclick attribute (string handlers execute when clicked)', () => {
    expect(() => el('div', { onclick: 'evil()' })).toThrow(/onclick/);
  });

  it('throws on onerror attribute', () => {
    expect(() => el('img', { onerror: 'evil()' })).toThrow(/onerror/);
  });

  it('throws on ONCLICK attribute (guard is case-insensitive)', () => {
    expect(() => el('div', { ONCLICK: 'evil()' })).toThrow(/ONCLICK/);
  });

  it('allows attribute names merely containing "on" elsewhere', () => {
    const d = el('div', { 'data-once': 'true' });
    expect(d.getAttribute('data-once')).toBe('true');
  });

  it('allows attribute values equal to "on"', () => {
    const d = el('div', { 'aria-label': 'on' });
    expect(d.getAttribute('aria-label')).toBe('on');
  });

  it('allows the bare attribute name "on" (not an event handler prefix)', () => {
    // "on" alone does not match /^on.+/i, it has no char after "on".
    const d = el('div', { on: 'x' });
    expect(d.getAttribute('on')).toBe('x');
  });

  it('renders mixed children: raw strings interleaved with elements', () => {
    const span = el('span');
    const parent = el('div', {}, ['raw string', span]);
    expect(parent.childNodes[0].textContent).toBe('raw string');
    expect(parent.childNodes[1]).toBe(span);
  });

  it('supports nested composition: el wrapping el wrapping text()', () => {
    const bold = el('strong', {}, [text('bold')]);
    const para = el('p', {}, [bold]);
    expect(para.querySelector('strong')?.textContent).toBe('bold');
  });
});

describe('svg() builder', () => {
  it('creates an SVG element in the SVG namespace', () => {
    const s = svg('svg', { viewBox: '0 0 24 24' });
    expect(s.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(s.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('appends nested SVG children', () => {
    const path = svg('path', { d: 'M0 0' });
    const root = svg('svg', {}, [path]);
    expect(root.firstChild).toBe(path);
  });

  it('throws on onclick attribute (string handlers execute when clicked)', () => {
    expect(() => svg('svg', { onclick: 'evil()' })).toThrow(/onclick/);
  });

  it('throws on onerror attribute', () => {
    expect(() => svg('svg', { onerror: 'evil()' })).toThrow(/onerror/);
  });

  it('throws on ONCLICK attribute (guard is case-insensitive)', () => {
    expect(() => svg('svg', { ONCLICK: 'evil()' })).toThrow(/ONCLICK/);
  });

  it('allows attribute names merely containing "on" elsewhere', () => {
    const s = svg('svg', { 'data-once': 'true' });
    expect(s.getAttribute('data-once')).toBe('true');
  });
});

describe('text() helper', () => {
  it('creates a Text node', () => {
    const t = text('hello');
    expect(t.nodeType).toBe(Node.TEXT_NODE);
    expect(t.textContent).toBe('hello');
  });
});

describe('append() helper', () => {
  it('appends mixed Node and raw-string children without parsing HTML', () => {
    const parent = el('div');
    const span = el('span');
    append(parent, 'raw <b>text</b>', span);
    // Raw string becomes a text node (not parsed as markup).
    expect(parent.childNodes[0].textContent).toBe('raw <b>text</b>');
    expect(parent.childNodes[1]).toBe(span);
  });
});

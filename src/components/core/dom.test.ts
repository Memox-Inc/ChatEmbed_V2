import { describe, it, expect } from 'vitest';
import { el, svg, text } from './dom';

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
});

describe('text() helper', () => {
  it('creates a Text node', () => {
    const t = text('hello');
    expect(t.nodeType).toBe(Node.TEXT_NODE);
    expect(t.textContent).toBe('hello');
  });
});

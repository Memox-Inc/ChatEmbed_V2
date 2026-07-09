import { describe, it, expect } from 'vitest';
import { markdownToHtml } from './markdown-renderer';

describe('markdownToHtml paragraph spacing (MMX-918)', () => {
  it('renders blank-line-separated blocks as separate paragraphs', () => {
    const text =
      'Here are some options:\n\n• 40ft container, price: $4,240\n\n• 40ft Double Door, price: $4,929';
    const html = markdownToHtml(text);
    const paragraphs = html.match(/<p /g) ?? [];
    expect(paragraphs.length).toBe(3);
  });

  it('does not force margin:0 inline on paragraphs (stylesheet controls spacing)', () => {
    const html = markdownToHtml('First paragraph.\n\nSecond paragraph.');
    expect(html).toContain('<p ');
    expect(html).not.toMatch(/<p[^>]*margin\s*:\s*0/);
  });

  it('keeps inherited typography styles on paragraphs', () => {
    const html = markdownToHtml('Hello.');
    expect(html).toMatch(/<p[^>]*font-size:inherit/);
  });
});

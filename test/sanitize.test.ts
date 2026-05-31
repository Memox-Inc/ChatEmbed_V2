import { describe, expect, it } from 'vitest';
import { sanitizeText } from '../src/ui/sanitize';

describe('sanitizeText', () => {
  it('strips <script> tags', () => {
    const result = sanitizeText('<script>alert("xss")</script>hello');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    expect(result).toBe('hello');
  });

  it('strips <img> with onerror handler', () => {
    const result = sanitizeText('<img src="x" onerror="alert(1)">text');
    expect(result).not.toContain('<img');
    expect(result).not.toContain('onerror');
    expect(result).toBe('text');
  });

  it('strips <iframe> tags', () => {
    const result = sanitizeText('<iframe src="https://evil.com"></iframe>content');
    expect(result).not.toContain('<iframe');
    expect(result).toBe('content');
  });

  it('preserves plain text unchanged', () => {
    expect(sanitizeText('Need help? Chat with us!')).toBe('Need help? Chat with us!');
    expect(sanitizeText('Hi, I am Sarah')).toBe('Hi, I am Sarah');
  });

  it('returns empty string for null', () => {
    expect(sanitizeText(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(sanitizeText(undefined)).toBe('');
  });

  it('returns empty string for empty string input', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('strips nested/mixed tag injection', () => {
    const result = sanitizeText('<b onmouseover="alert()">bold</b> text');
    expect(result).not.toContain('<b');
    expect(result).not.toContain('onmouseover');
    expect(result).toContain('bold');
    expect(result).toContain('text');
  });

  // Entity-decoding assertions — FIX for HTML-entity-encodes-plain-text bug.
  // DOMPurify with ALLOWED_TAGS:[] encodes angle brackets and ampersands as
  // HTML entities. These tests confirm we decode them back to true plain text
  // so callers rendering via .textContent see "Save <50% today" not
  // "Save &lt;50% today".

  it('preserves angle brackets in plain text (no HTML tag)', () => {
    // "Save <50% today" contains a lone "<" — not a tag — and must be
    // returned verbatim so it reads correctly when set via .textContent.
    expect(sanitizeText('Save <50% today')).toBe('Save <50% today');
  });

  it('preserves ampersands in plain text', () => {
    // "Tom & Jerry" must not be encoded to "Tom &amp; Jerry".
    expect(sanitizeText('Tom & Jerry')).toBe('Tom & Jerry');
  });

  it('still strips tags AND decodes entities in mixed input', () => {
    // The tag is stripped first; the remaining plain text entities are decoded.
    const result = sanitizeText('<b>Bold</b> & <50% off');
    expect(result).not.toContain('<b>');
    expect(result).toContain('Bold');
    expect(result).toContain('& <50% off');
  });

  it('strips <script> tag even when inner text looks like an entity', () => {
    // Confirm the tag-strip still fires before entity decode.
    const result = sanitizeText('<script>alert(1)</script>&lt;safe&gt;');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    // The literal "&lt;safe&gt;" text outside the script is decoded to "<safe>".
    expect(result).toBe('<safe>');
  });

  it('strips <img onerror> and decodes remaining plain text entities', () => {
    const result = sanitizeText('<img src="x" onerror="alert(1)">Tom &amp; Jerry');
    expect(result).not.toContain('<img');
    expect(result).not.toContain('onerror');
    // After tag strip, "&amp;" is decoded to "&".
    expect(result).toBe('Tom & Jerry');
  });
});

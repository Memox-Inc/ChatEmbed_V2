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
});

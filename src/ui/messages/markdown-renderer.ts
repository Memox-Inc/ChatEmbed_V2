import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { escapeHtml } from '../../utils/dom';

// Configure marked
marked.setOptions({ breaks: true, gfm: true });

export function markdownToHtml(text: string, botTextColor?: string): string {
  if (!text) return '';
  try {
    let result = marked.parse(text) as string;

    // Style paragraphs
    result = result.replace(
      /<p>/g,
      '<p style="font-size:inherit;line-height:inherit;font-family:inherit;font-weight:inherit;margin:0;">',
    );

    // Style links
    const linkColor = botTextColor || '#4a4e69';
    result = result.replace(
      /<a\s+href="([^"]*)"([^>]*)>([^<]*)<\/a>/g,
      (_m, href, _attrs, txt) =>
        `<a href="${href}" target="_blank" style="font-weight:bold;color:${linkColor};text-decoration:underline;cursor:pointer;">${txt}</a>`,
    );

    // Style lists
    result = result.replace(/<ul>/g, '<ul style="margin:8px 0;padding-left:24px;">');
    result = result.replace(/<ol>/g, '<ol style="margin:8px 0;padding-left:24px;">');
    result = result.replace(/<li>/g, '<li style="margin:4px 0;">');

    // Style code blocks
    result = result.replace(
      /<pre><code>/g,
      '<pre style="background:#f6f8fa;border:1px solid #e1e4e8;border-radius:6px;padding:16px;margin:8px 0;overflow-x:auto;font-family:ui-monospace,SFMono-Regular,\'SF Mono\',Consolas,\'Liberation Mono\',Menlo,monospace;font-size:13px;line-height:1.45;"><code>',
    );
    result = result.replace(
      /<code>/g,
      '<code style="background:#f6f8fa;border-radius:3px;padding:2px 4px;font-family:ui-monospace,SFMono-Regular,\'SF Mono\',Consolas,\'Liberation Mono\',Menlo,monospace;font-size:85%;">',
    );

    // Style emphasis
    result = result.replace(/<strong>/g, '<strong style="font-weight:600;">');
    result = result.replace(/<em>/g, '<em style="font-style:italic;">');

    return DOMPurify.sanitize(result, {
      ADD_ATTR: ['target', 'style'],
    });
  } catch (error) {
    console.error('Markdown parsing error:', error);
    return escapeHtml(text).replace(/\n/g, '<br>');
  }
}

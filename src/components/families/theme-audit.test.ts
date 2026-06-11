/**
 * Theme token enforcement (spec 9.4 + DRY inventory).
 *
 * No renderer file in src/components/families/ may hardcode hex color literals.
 * All colors must come from ctx.theme tokens so they respond to the per-embed
 * theme config (white-label support).
 *
 * Also scans the renderCtx themeTokens block in src/index.ts: any new hardcoded
 * brand hex added there must carry an explicit "allowlist:hex-literal" comment on
 * the same line, or this test fails CI.
 *
 * Allowlist mechanism: add the comment token "allowlist:hex-literal" anywhere on
 * the same line as the hex literal. This signals that the literal is intentional
 * (e.g. brand-independent status color, customer-overridable default) and has been
 * reviewed. See the themeTokens block in src/index.ts for examples.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';

// ── File collection ───────────────────────────────────────────────────────────

/**
 * Recursively collect non-test TypeScript source files under `dir`.
 */
function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = `${dir}/${entry}`;
    if (statSync(full).isDirectory()) {
      results.push(...collectSourceFiles(full));
    } else if (
      full.endsWith('.ts') &&
      !full.endsWith('.test.ts') &&
      !full.endsWith('.spec.ts')
    ) {
      results.push(full);
    }
  }
  return results;
}

const FAMILIES_DIR = resolve(__dirname, './');
const INDEX_TS = resolve(__dirname, '../../index.ts');

// ── Hex-literal detection ─────────────────────────────────────────────────────

/**
 * A 3-digit or 6-digit CSS hex color literal.
 * Excludes:
 *   - plain word characters before "#" (e.g. "id#42" is not a CSS hex)
 *   - digits after the hex group (prevents partial matches inside longer tokens)
 * The lookbehind avoids matching hex values inside strings like "rgba(..." but
 * does match the canonical forms "#rgb" and "#rrggbb".
 */
const HEX_PATTERN = /(?<![a-zA-Z0-9_])#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g;

const ALLOWLIST_MARKER = 'allowlist:hex-literal';

/**
 * Returns every hex-literal violation in `content`:
 * lines that contain a hex color literal but do NOT carry the allowlist marker.
 */
function findViolations(filePath: string, content: string): string[] {
  const violations: string[] = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (!line.includes(ALLOWLIST_MARKER)) {
      const matches = line.match(HEX_PATTERN);
      if (matches) {
        violations.push(
          `${filePath}:${idx + 1}  ${matches.join(', ')}  →  ${line.trim()}`,
        );
      }
    }
  });
  return violations;
}

// ── Index.ts theme block extraction ──────────────────────────────────────────

/**
 * Extracts only the themeTokens block from src/index.ts so the audit does
 * not flag hex literals in comments, test helpers, or unrelated code outside
 * the RenderCtx construction area. The block spans from the `themeTokens`
 * declaration to the closing brace of the object literal.
 *
 * Falls back to the full file if the markers are not found (makes the test
 * fail loudly if index.ts is significantly restructured rather than silently
 * passing on an empty range).
 */
function extractThemeBlock(content: string): { block: string; lineOffset: number } {
  const lines = content.split('\n');
  // Find the line that declares themeTokens (the resolution of primaryColor
  // immediately precedes it but we anchor on themeTokens itself).
  const startIdx = lines.findIndex((l) => /const\s+themeTokens\s*:\s*ThemeTokens\s*=/.test(l));
  if (startIdx === -1) {
    // Fallback: return full file so violations are still caught.
    return { block: content, lineOffset: 0 };
  }
  // Walk forward to find the closing `};` of the ThemeTokens object literal.
  // We look for a line that matches `  };` (indented one level).
  let depth = 0;
  let endIdx = startIdx;
  for (let i = startIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { endIdx = i; break; }
      }
    }
    if (depth === 0 && i > startIdx) { endIdx = i; break; }
  }
  return {
    block: lines.slice(startIdx, endIdx + 1).join('\n'),
    lineOffset: startIdx,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Theme token enforcement', () => {
  it('no families renderer hardcodes a hex color literal', () => {
    const files = collectSourceFiles(FAMILIES_DIR);
    expect(files.length, 'at least one families source file must be found').toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      violations.push(...findViolations(file, content));
    }

    if (violations.length > 0) {
      console.error(
        '\nHex literal violations in families/ renderers:\n' +
          violations.join('\n') +
          '\n\nAdd a ctx.theme token instead, or mark with "// allowlist:hex-literal -- <reason>".',
      );
    }
    expect(violations).toHaveLength(0);
  });

  it('src/index.ts themeTokens block: no unallowlisted brand hex literals', () => {
    const content = readFileSync(INDEX_TS, 'utf-8');
    const { block, lineOffset } = extractThemeBlock(content);

    // The block must contain at least the primaryColor line as a sanity check
    // that we actually found it (guards against silent extraction failures).
    expect(block, 'themeTokens block must be found and non-trivial').toMatch(/primaryColor/);

    const rawViolations = findViolations(INDEX_TS, block);
    // Adjust line numbers back to file-relative for readability.
    const violations = rawViolations.map((v) => {
      // Pattern: "path:LINE  ...", rebase the line number.
      return v.replace(/:(\d+)\s/, (_, n) => `:${parseInt(n) + lineOffset}  `);
    });

    if (violations.length > 0) {
      console.error(
        '\nUnallowlisted hex literals in src/index.ts themeTokens block:\n' +
          violations.join('\n') +
          '\n\nIf this is a brand-independent constant or customer-overridable default,' +
          ' mark it with "// allowlist:hex-literal -- <reason>".' +
          ' Otherwise derive the value from an existing theme token.',
      );
    }
    expect(violations).toHaveLength(0);
  });
});

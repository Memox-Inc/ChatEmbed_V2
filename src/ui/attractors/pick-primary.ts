/**
 * Attractor precedence — determines which ONE primary attractor (teaser or
 * persona card) should be mounted next to the launcher. Only one may render
 * at a time; this function encodes the canonical priority order so the rules
 * live in a single, testable place.
 *
 * Priority order (first match wins):
 *   1. persona enabled + has name + has message  → 'persona'
 *   2. pill form factor (no persona)             → null (teaser is redundant next to pill text)
 *   3. teaser enabled + has text                 → 'teaser'
 *   4. otherwise                                 → null
 *
 * Note: pill suppresses ONLY the teaser (rule 2). Persona is richer than the
 * pill's inline label text and outranks rule 2 via rule 1.
 *
 * To add a future attractor: insert a new rule in this function in the right
 * priority order. Do NOT add suppression checks inside individual attractor
 * modules.
 */

import type { LauncherConfig } from '../../config/types';

export type PrimaryAttractor = 'persona' | 'teaser' | null;

export function pickPrimaryAttractor(launcher: LauncherConfig | undefined): PrimaryAttractor {
  const personaCfg = launcher?.attractors?.persona;
  const teaserCfg = launcher?.attractors?.teaser;

  // Rule 1: persona takes priority over everything else.
  if (personaCfg?.enabled && personaCfg.name && personaCfg.message) return 'persona';

  // Rule 2: pill form factor — teaser is redundant alongside the pill's label.
  if (launcher?.form_factor === 'pill') return null;

  // Rule 3: teaser when there is text to show.
  if (teaserCfg?.enabled && teaserCfg.text) return 'teaser';

  // Rule 4: no primary attractor.
  return null;
}

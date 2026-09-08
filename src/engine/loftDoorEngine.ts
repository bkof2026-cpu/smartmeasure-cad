// ─────────────────────────────────────────────────────────────────────────────
// Shared Loft door-count / door-width engine — the ONE calculation used by
// every product that has a Loft (Wardrobe + Loft, the standalone Loft Box /
// Separate Loft, and any future product with a Loft "Extra Measurement"),
// per the user's own explicit instruction: "Use one reusable Loft
// calculation engine so the same rules work for... Do not make separate
// formulas." Only the SOURCE of the initial usable width/height differs per
// product — this file owns the actual math, once.
//
// Real, verified rules (all from the user's own spec, not invented):
// - A door's real manufacturing standard is 310–400mm wide.
// - Each door has a real 2mm gap deduction.
// - The recommended Door Count starts from usableWidth / 400 (NOT /100 —
//   that would conflict with the 310–400mm standard), then the engine tests
//   nearby whole-number counts and picks the one whose resulting One Door
//   Width is valid (310–400mm) and closest to the 400mm target without
//   exceeding it.
// - The Door Count stays editable — this engine only supplies the STARTING
//   recommendation; recalculating One Door Width for a user-edited count is
//   the same formula, just called again with that count.
// ─────────────────────────────────────────────────────────────────────────────

export const LOFT_DOOR_GAP_MM = 2;
export const LOFT_DOOR_MIN_WIDTH_MM = 310;
export const LOFT_DOOR_MAX_WIDTH_MM = 400;
// The recommendation search starts from usableWidth/400 and is the target
// the engine tries to land close to (never exceeding it) — per the user's
// explicit "closest to the 400mm target without exceeding it" rule.
const RECOMMEND_TARGET_WIDTH_MM = 400;

/** One Door Width = (usableWidth − doorCount × 2mm) / doorCount — the exact
 * formula from the spec, used everywhere a door width is shown (drawing
 * label, cutlist, PDF). Never rounds internally — only the DISPLAYED value
 * is rounded, matching the same "keep full precision, round for display
 * only" convention already used by loftShutterWidth() in loftBoxGeometry.ts
 * (this function is the generalized replacement for that one — same math,
 * shared by every product now instead of duplicated). */
export function loftOneDoorWidth(usableWidth: number, doorCount: number): number {
  const count = Math.max(1, Math.round(doorCount) || 1);
  const totalGap = count * LOFT_DOOR_GAP_MM;
  const netWidth = usableWidth - totalGap;
  return netWidth / count;
}

export type LoftDoorWidthStatus = 'valid' | 'below-min' | 'above-max';

/** Classifies a real (already-computed) One Door Width against the
 * 310–400mm manufacturing standard — used both by the recommendation
 * search below and by the UI to show "✓ Within Standard" / a warning when
 * the user manually edits Door Count into an out-of-range value. */
export function loftDoorWidthStatus(oneDoorWidth: number): LoftDoorWidthStatus {
  if (oneDoorWidth < LOFT_DOOR_MIN_WIDTH_MM) return 'below-min';
  if (oneDoorWidth > LOFT_DOOR_MAX_WIDTH_MM) return 'above-max';
  return 'valid';
}

/** The full automatic recommendation algorithm from the spec (§16/§19):
 * 1. Calculate an initial recommendation from usableWidth / 400.
 * 2. Test nearby whole-number door counts.
 * 3. Calculate One Door Width for each.
 * 4. Select a count producing a valid 310–400mm width.
 * 5. Prefer the count whose resulting width is closest to 400mm without
 *    exceeding it.
 * 6. If no nearby count produces a valid width (a genuinely extreme usable
 *    width), fall back to whichever nearby count's width is LEAST invalid
 *    (closest to the valid range) rather than returning something the
 *    caller can't reasonably act on.
 *
 * Returns the recommended count plus its own resolved width/status, so the
 * caller (UI) can show both immediately without a second calculation. */
export function recommendLoftDoorCount(usableWidth: number): { doorCount: number; oneDoorWidth: number; status: LoftDoorWidthStatus } {
  if (!Number.isFinite(usableWidth) || usableWidth <= 0) {
    return { doorCount: 1, oneDoorWidth: 0, status: 'below-min' };
  }

  const initial = Math.max(1, Math.round(usableWidth / RECOMMEND_TARGET_WIDTH_MM) || 1);
  // Search a real neighbourhood around the initial estimate — wide enough
  // to reliably find a valid count for any sane room width, never assuming
  // the naive round() already landed on it (e.g. 1800/400 = 4.5 rounds to
  // 4 or 5 depending on the engine, but only one of those two might
  // actually produce a valid 310–400mm door — see the spec's own §14/§20
  // examples, both of which resolve to 5 despite 4.5 rounding to either).
  const searchRadius = 6;
  const candidates: { count: number; width: number; status: LoftDoorWidthStatus }[] = [];
  for (let count = Math.max(1, initial - searchRadius); count <= initial + searchRadius; count++) {
    const width = loftOneDoorWidth(usableWidth, count);
    candidates.push({ count, width, status: loftDoorWidthStatus(width) });
  }

  const valid = candidates.filter((c) => c.status === 'valid');
  if (valid.length > 0) {
    // Closest to the 400mm target WITHOUT exceeding it, per the spec —
    // among valid candidates this just means the smallest (width <= 400
    // for all of them already), so the one with the largest width is the
    // closest-without-exceeding pick.
    const best = valid.reduce((a, b) => (b.width > a.width ? b : a));
    return { doorCount: best.count, oneDoorWidth: best.width, status: best.status };
  }

  // No candidate in the search radius produced a valid width (e.g. an
  // extremely narrow or extremely wide usable width) — fall back to
  // whichever candidate's width is closest to the valid [310,400] range,
  // so the UI always has a real, explainable starting point rather than
  // silently defaulting to count=1.
  const distanceFromRange = (w: number) => (w < LOFT_DOOR_MIN_WIDTH_MM ? LOFT_DOOR_MIN_WIDTH_MM - w : w - LOFT_DOOR_MAX_WIDTH_MM);
  const fallback = candidates.reduce((a, b) => (distanceFromRange(b.width) < distanceFromRange(a.width) ? b : a));
  return { doorCount: fallback.count, oneDoorWidth: fallback.width, status: fallback.status };
}

/** Fix Patti positions — matches the spec's own dropdown exactly. */
export type FixPattiPosition = 'none' | 'left' | 'right' | 'both';

export interface FixPattiInput {
  position: FixPattiPosition;
  leftHeightMm: number;
  leftWidthMm: number;
  rightHeightMm: number;
  rightWidthMm: number;
}

/** Total Fix Patti Width — the exact deduction rules from the spec (§8/§12):
 * None → 0, Left → left width, Right → right width, Both → sum. This is
 * the ONLY thing subtracted from Room/Total Width before the Loft door
 * calculation — Side Panel width is explicitly NOT part of this (§19),
 * per the user's own repeated, explicit correction. */
export function totalFixPattiWidth(fixPatti: FixPattiInput): number {
  switch (fixPatti.position) {
    case 'left': return Math.max(0, fixPatti.leftWidthMm);
    case 'right': return Math.max(0, fixPatti.rightWidthMm);
    case 'both': return Math.max(0, fixPatti.leftWidthMm) + Math.max(0, fixPatti.rightWidthMm);
    default: return 0;
  }
}

/** Usable Loft Door Width = Room/Total Width − Total Fix Patti Width — the
 * exact formula from the spec (§8/§12), never allowed to go negative (an
 * over-wide Fix Patti relative to the room is a real data-entry error, not
 * something to silently wrap to a negative usable width). */
export function usableLoftDoorWidth(totalWidth: number, fixPatti: FixPattiInput): number {
  return Math.max(0, totalWidth - totalFixPattiWidth(fixPatti));
}

// ─────────────────────────────────────────────────────────────────────────────
// Khacha — a real, separate component from Fix Patti (spec §16/§17/§50: "Do
// not merge their data"). Same None/Left/Right/Both shape and the same kind
// of width deduction from the usable Loft door area, but tracked completely
// independently — a Loft can have Fix Patti AND Khacha at the same time, on
// the same or different sides, and both widths are deducted together
// (§17's own worked example: Wall=2500, FixPatti=100, Khacha=150 → usable
// door width = 2250, i.e. both deductions stack, they don't replace each
// other).
// ─────────────────────────────────────────────────────────────────────────────

/** Khacha positions — same shape as Fix Patti Position, tracked separately. */
export type KhachaPosition = 'none' | 'left' | 'right' | 'both';

export interface KhachaInput {
  position: KhachaPosition;
  leftHeightMm: number;
  leftWidthMm: number;
  rightHeightMm: number;
  rightWidthMm: number;
}

/** Total Khacha Width — same None/Left/Right/Both deduction shape as Fix
 * Patti, computed independently (never combined into the same fields). */
export function totalKhachaWidth(khacha: KhachaInput): number {
  switch (khacha.position) {
    case 'left': return Math.max(0, khacha.leftWidthMm);
    case 'right': return Math.max(0, khacha.rightWidthMm);
    case 'both': return Math.max(0, khacha.leftWidthMm) + Math.max(0, khacha.rightWidthMm);
    default: return 0;
  }
}

/** Usable Loft Door Width with BOTH Fix Patti and Khacha deducted together
 * (spec §17: "if Khacha occupies part of the Loft door area, its applicable
 * Width must be deducted from the usable door width" — stacking with, not
 * replacing, the Fix Patti deduction). This is the generalized version of
 * usableLoftDoorWidth() above for callers that also carry a Khacha input;
 * the two-arg version above stays for callers with no Khacha concept yet
 * (e.g. the standalone Loft Box, which has no Khacha in this spec). */
export function usableLoftDoorWidthWithKhacha(totalWidth: number, fixPatti: FixPattiInput, khacha: KhachaInput): number {
  return Math.max(0, totalWidth - totalFixPattiWidth(fixPatti) - totalKhachaWidth(khacha));
}

/** Loft Height for a Wardrobe + Loft product — the exact formula from the
 * spec (§17/§21): Total Height − Wardrobe Height − 10mm fixed gap. Never
 * negative (a Wardrobe Height that already exceeds Total Height is a real
 * data-entry error the caller's own validation should flag separately —
 * this just avoids handing back a nonsensical negative height to draw). */
export const LOFT_WARDROBE_GAP_MM = 10;
export function loftHeightForWardrobe(totalHeight: number, wardrobeHeight: number): number {
  return Math.max(0, totalHeight - wardrobeHeight - LOFT_WARDROBE_GAP_MM);
}

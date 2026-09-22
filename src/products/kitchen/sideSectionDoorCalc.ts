import type { IShapeKitchenConfig } from '../../store/types';
import type { ClearSegment } from './iShapeKitchenGeometry';

// ─────────────────────────────────────────────────────────────────────────────
// Side Section Door engine — the plain cabinet door(s) filling an OUTER
// Clear-Width section (the section between the actual room wall and the
// first/last Kadappa — never the section the Trolley sits in). Per the
// user's own explicit spec:
//
//   DOOR COUNT — auto-recommended, user-editable (same "resolved upstream,
//   drawn here" pattern as the Loft's own doorCount):
//     section width <= 600mm  -> 1 door
//     section width >= 600mm  -> 2 doors
//
//   DOOR WIDTH:
//     1 door:  sectionWidth - innerKadappaDeduction(2mm)
//                            - wallDeduction(3mm if a Wall Side Kadappa
//                              exists on that side, else 2mm)
//     N doors: (sectionWidth - innerKadappaDeduction(2mm)
//                            - wallDeduction(2 or 3mm)
//                            - (N-1) * doorGap(2mm)) / N
//
//   The "inner Kadappa" deduction is always 2mm (the section's boundary
//   against the Inner Kadappa next to it) — the wall-side deduction is the
//   ONLY one that varies (2mm plain wall, 3mm when a real Wall Side
//   Kadappa sits there), per the user's own worked examples.
// ─────────────────────────────────────────────────────────────────────────────

export const SIDE_DOOR_INNER_KADAPPA_DEDUCTION_MM = 2;
export const SIDE_DOOR_WALL_NO_KADAPPA_DEDUCTION_MM = 2;
export const SIDE_DOOR_WALL_WITH_KADAPPA_DEDUCTION_MM = 3;
export const SIDE_DOOR_GAP_MM = 2;
export const SIDE_DOOR_TWO_DOOR_THRESHOLD_MM = 600;

export type SideSectionSide = 'left' | 'right';

export interface SideSectionDoorResult {
  /** Which outer section this is — 'left' = the section against the Left
   * Wall (fromLetter === null), 'right' = against the Right Wall
   * (toLetter === null). */
  side: SideSectionSide;
  sectionWidth: number;
  hasWallKadappa: boolean;
  wallDeductionMm: number;
  recommendedDoorCount: 1 | 2;
  /** The door count actually used — equals recommendedDoorCount unless the
   * caller passed an explicit override (the user-editable part of the
   * spec). */
  doorCount: number;
  /** Real, unrounded per-door width — every door in this section shares
   * the same width. */
  doorWidth: number;
  valid: boolean;
  invalidReason: string | null;
}

/** The auto-recommended door count from the section's own width alone — the STARTING recommendation; a caller may still override it (spec: "auto-recommended but editable"). */
export function recommendSideSectionDoorCount(sectionWidth: number): 1 | 2 {
  return sectionWidth >= SIDE_DOOR_TWO_DOOR_THRESHOLD_MM ? 2 : 1;
}

/** Real, unrounded per-door width for this section — the exact formula from the spec, generalized to N doors (N=1 collapses to the single-door formula exactly, since the (N-1)*gap term is 0). */
export function calcSideSectionDoorWidth(sectionWidth: number, hasWallKadappa: boolean, doorCount: number): number {
  const count = Math.max(1, Math.round(doorCount) || 1);
  const wallDeduction = hasWallKadappa ? SIDE_DOOR_WALL_WITH_KADAPPA_DEDUCTION_MM : SIDE_DOOR_WALL_NO_KADAPPA_DEDUCTION_MM;
  const totalGaps = (count - 1) * SIDE_DOOR_GAP_MM;
  const usable = sectionWidth - SIDE_DOOR_INNER_KADAPPA_DEDUCTION_MM - wallDeduction - totalGaps;
  return usable / count;
}

/**
 * Resolves one outer (wall-adjacent) Clear Segment's door count + width.
 * `doorCountOverride`, when set, replaces the auto-recommended count (the
 * user-editable part of the spec) — the width formula is always
 * recalculated for whichever count is actually used.
 */
export function calculateSideSectionDoors(
  iShape: IShapeKitchenConfig,
  segment: ClearSegment,
  side: SideSectionSide,
  doorCountOverride: number | null,
): SideSectionDoorResult {
  const sectionWidth = Math.max(0, iShape.clearWidths[segment.index] ?? 0);
  const hasWallKadappa = side === 'left'
    ? iShape.wallSideKadappa === 'Left' || iShape.wallSideKadappa === 'Both'
    : iShape.wallSideKadappa === 'Right' || iShape.wallSideKadappa === 'Both';
  const wallDeductionMm = hasWallKadappa ? SIDE_DOOR_WALL_WITH_KADAPPA_DEDUCTION_MM : SIDE_DOOR_WALL_NO_KADAPPA_DEDUCTION_MM;
  const recommendedDoorCount = recommendSideSectionDoorCount(sectionWidth);
  const doorCount = doorCountOverride && doorCountOverride > 0 ? Math.round(doorCountOverride) : recommendedDoorCount;
  const doorWidth = calcSideSectionDoorWidth(sectionWidth, hasWallKadappa, doorCount);
  const valid = sectionWidth > 0 && doorWidth > 0;
  return {
    side, sectionWidth, hasWallKadappa, wallDeductionMm, recommendedDoorCount, doorCount, doorWidth,
    valid,
    invalidReason: valid ? null : `Side Section Door width resolved to <= 0mm for the ${side} section (${Math.round(sectionWidth)}mm wide) — check the section's Clear Width and Kadappa configuration.`,
  };
}

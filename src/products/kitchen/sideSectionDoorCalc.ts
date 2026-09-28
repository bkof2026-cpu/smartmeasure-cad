import type { IShapeKitchenConfig } from '../../store/types';
import type { ClearSegment } from './iShapeKitchenGeometry';

// ─────────────────────────────────────────────────────────────────────────────
// Side Section Door engine — the plain cabinet door(s) filling a Clear-Width
// section that has no Trolley in it. Originally scoped to OUTER sections
// only (the section between the actual room wall and the first/last
// Kadappa); per the user's explicit follow-up ("in no trolley kitchen we
// have to give only door"), this now covers ANY non-Trolley Clear-Width
// section, including an INNER one sitting between two Kadappa with no wall
// on either side — same formula shape, just with each boundary's own
// deduction read independently instead of assuming exactly one wall side.
//
//   DOOR COUNT — auto-recommended, user-editable (same "resolved upstream,
//   drawn here" pattern as the Loft's own doorCount):
//     section width <= 600mm  -> 1 door
//     section width >= 600mm  -> 2 doors
//
//   DOOR WIDTH:
//     1 door:  sectionWidth - leftBoundaryDeduction - rightBoundaryDeduction
//     N doors: (sectionWidth - leftBoundaryDeduction - rightBoundaryDeduction
//                            - (N-1) * doorGap(2mm)) / N
//
//   Each boundary's own deduction is 3mm when a real Wall-Side Kadappa sits
//   there, 2mm otherwise (a real room wall OR an Inner Kadappa — the
//   original spec's "inner Kadappa deduction is always 2mm" and "wall
//   deduction is 2mm for a plain wall" turn out to be the SAME 2mm value,
//   so one shared rule covers a real wall, an Inner Kadappa, AND an outer
//   section's non-Kadappa wall boundary — only an actual Wall-Side Kadappa
//   ever bumps a boundary's own deduction up to 3mm). An outer section has
//   exactly one such boundary (the other is the room wall itself, handled
//   the same as "no Kadappa there" = 2mm); an inner section has two real
//   Kadappa boundaries, each independently checked.
// ─────────────────────────────────────────────────────────────────────────────

export const SIDE_DOOR_INNER_KADAPPA_DEDUCTION_MM = 2;
export const SIDE_DOOR_WALL_NO_KADAPPA_DEDUCTION_MM = 2;
export const SIDE_DOOR_WALL_WITH_KADAPPA_DEDUCTION_MM = 3;
export const SIDE_DOOR_GAP_MM = 2;
export const SIDE_DOOR_TWO_DOOR_THRESHOLD_MM = 600;

export type SideSectionSide = 'left' | 'right' | 'inner';

export interface SideSectionDoorResult {
  /** 'left'/'right' = one of the two OUTER sections (against a real room
   * wall); 'inner' = a section between two Kadappa, no wall on either side. */
  side: SideSectionSide;
  sectionWidth: number;
  /** Kept for outer sections' own existing formula-string convention
   * (whether a real Wall-Side Kadappa sits on THIS section's wall-facing
   * boundary) — always true for an inner section, since both of its
   * boundaries are real Kadappa. */
  hasWallKadappa: boolean;
  /** The two boundaries' own independent deductions — for an outer
   * section, leftDeductionMm/rightDeductionMm are (Kadappa-boundary,
   * wall-boundary) in left-to-right order; for an inner section both are
   * real Kadappa-boundary deductions. wallDeductionMm is kept (mirrors the
   * legacy single-wall-deduction field) for the existing formula-string
   * callers still reading it. */
  leftDeductionMm: number;
  rightDeductionMm: number;
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

/** Real, unrounded per-door width for a section whose two boundaries may
 * have DIFFERENT deductions (an outer section: one real Kadappa boundary +
 * one wall boundary; an inner section: two real Kadappa boundaries) —
 * generalizes the original single-`hasWallKadappa` formula so both cases
 * share one calculation. N=1 collapses to the single-door formula exactly,
 * since the (N-1)*gap term is 0. */
export function calcSideSectionDoorWidthGeneral(sectionWidth: number, leftDeductionMm: number, rightDeductionMm: number, doorCount: number): number {
  const count = Math.max(1, Math.round(doorCount) || 1);
  const totalGaps = (count - 1) * SIDE_DOOR_GAP_MM;
  const usable = sectionWidth - leftDeductionMm - rightDeductionMm - totalGaps;
  return usable / count;
}

/** Real, unrounded per-door width for an OUTER section — kept for existing
 * callers/tests; now a thin wrapper over calcSideSectionDoorWidthGeneral
 * with the inner-Kadappa boundary fixed at 2mm and only the wall boundary
 * varying by hasWallKadappa (this function's original, still-correct
 * behavior — unchanged output for every existing outer-section call site). */
export function calcSideSectionDoorWidth(sectionWidth: number, hasWallKadappa: boolean, doorCount: number): number {
  const wallDeduction = hasWallKadappa ? SIDE_DOOR_WALL_WITH_KADAPPA_DEDUCTION_MM : SIDE_DOOR_WALL_NO_KADAPPA_DEDUCTION_MM;
  return calcSideSectionDoorWidthGeneral(sectionWidth, SIDE_DOOR_INNER_KADAPPA_DEDUCTION_MM, wallDeduction, doorCount);
}

/**
 * Resolves one OUTER (wall-adjacent) Clear Segment's door count + width —
 * unchanged behavior from before this feature's inner-section extension.
 * `doorCountOverride`, when set, replaces the auto-recommended count (the
 * user-editable part of the spec) — the width formula is always
 * recalculated for whichever count is actually used.
 */
export function calculateSideSectionDoors(
  iShape: IShapeKitchenConfig,
  segment: ClearSegment,
  side: 'left' | 'right',
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
  // For an outer section, the "left"/"right" deduction pair mirrors which
  // side the wall actually is on — kept consistent with the general
  // formula above even though this function's own signature never exposed
  // it before.
  const leftDeductionMm = side === 'left' ? wallDeductionMm : SIDE_DOOR_INNER_KADAPPA_DEDUCTION_MM;
  const rightDeductionMm = side === 'right' ? wallDeductionMm : SIDE_DOOR_INNER_KADAPPA_DEDUCTION_MM;
  return {
    side, sectionWidth, hasWallKadappa, leftDeductionMm, rightDeductionMm, wallDeductionMm, recommendedDoorCount, doorCount, doorWidth,
    valid,
    invalidReason: valid ? null : `Side Section Door width resolved to <= 0mm for the ${side} section (${Math.round(sectionWidth)}mm wide) — check the section's Clear Width and Kadappa configuration.`,
  };
}

/**
 * Resolves one INNER (between-two-Kadappa) Clear Segment's door count +
 * width — new, per the user's explicit "no trolley kitchen -> only door"
 * correction: a Clear-Width section that isn't the Trolley section and
 * isn't adjacent to a real room wall previously got nothing drawn at all.
 * Both of an inner section's boundaries are real Kadappa (Wall-Side or
 * Inner — doesn't matter which, the deduction is the same 2mm either way,
 * since only an actual physical Wall-Side Kadappa bumps a boundary to 3mm,
 * and a Wall-Side Kadappa can never be adjacent to an INNER section by
 * definition — it always borders an outer one). `doorCountOverride`, when
 * set, replaces the auto-recommended count, same editable-count convention
 * as the outer-section function above.
 */
export function calculateInnerSectionDoors(
  iShape: IShapeKitchenConfig,
  segment: ClearSegment,
  doorCountOverride: number | null,
): SideSectionDoorResult {
  const sectionWidth = Math.max(0, iShape.clearWidths[segment.index] ?? 0);
  const recommendedDoorCount = recommendSideSectionDoorCount(sectionWidth);
  const doorCount = doorCountOverride && doorCountOverride > 0 ? Math.round(doorCountOverride) : recommendedDoorCount;
  const doorWidth = calcSideSectionDoorWidthGeneral(sectionWidth, SIDE_DOOR_INNER_KADAPPA_DEDUCTION_MM, SIDE_DOOR_INNER_KADAPPA_DEDUCTION_MM, doorCount);
  const valid = sectionWidth > 0 && doorWidth > 0;
  return {
    side: 'inner', sectionWidth, hasWallKadappa: true,
    leftDeductionMm: SIDE_DOOR_INNER_KADAPPA_DEDUCTION_MM, rightDeductionMm: SIDE_DOOR_INNER_KADAPPA_DEDUCTION_MM,
    wallDeductionMm: SIDE_DOOR_INNER_KADAPPA_DEDUCTION_MM,
    recommendedDoorCount, doorCount, doorWidth, valid,
    invalidReason: valid ? null : `Side Section Door width resolved to <= 0mm for this inner section (${Math.round(sectionWidth)}mm wide) — check the section's Clear Width.`,
  };
}

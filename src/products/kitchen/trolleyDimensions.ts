import type { IShapeKitchenConfig } from '../../store/types';
import type { ClearSegment } from './iShapeKitchenGeometry';

// ─────────────────────────────────────────────────────────────────────────────
// Trolley Dimension Calculation — the ONE shared source of truth for the
// final Trolley Height × Width × Depth, used by the Trolley Dimensions UI
// frame, the CAD drawing, and (later) the PDF. Never compute these values
// a second way anywhere else in the app.
//
//   Trolley Height = Total Kitchen Height − Pani Patti Height
//                     − Floor Ceiling Patti Height (editable, default 10)
//                     − HEIGHT_CLEARANCE_MM (30)
//   Trolley Width  = Selected Section's real Inside/Clear Width (manual,
//                     never auto-calculated) − WIDTH_FIT_MM (30)
//   Trolley Depth  = Total Kitchen Depth − depthDeduction (editable, 20 default)
//
// Each of the three may be manually overridden by the user; the override
// is stored separately and never silently cleared by an unrelated change.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_FLOOR_CEILING_PATTI_MM = 10;
export const HEIGHT_CLEARANCE_MM = 30;
export const WIDTH_FIT_MM = 30;
export const DEFAULT_DEPTH_DEDUCTION_MM = 20;

export interface TrolleyDimensionResult {
  /** Calculated Height before any manual override. */
  calculatedHeight: number;
  /** Calculated Width before any manual override — null when no section is
   * selected/resolved yet (nothing to base the calculation on). */
  calculatedWidth: number | null;
  /** Calculated Depth before any manual override. */
  calculatedDepth: number;
  /** Final Height actually used by the drawing — the override if set,
   * otherwise the calculated value. */
  finalHeight: number;
  /** Final Width actually used by the drawing — null when no section is
   * selected (the Outer Panel then reports NOT_CONFIGURED, same as
   * before this feature existed). */
  finalWidth: number | null;
  /** Final Depth actually used by the drawing. */
  finalDepth: number;
  /** The resolved section's real Inside/Clear Width (manual site
   * measurement) — the Width calculation's own source value, shown
   * separately in the UI so the deduction is never hidden. */
  sectionInsideWidth: number | null;
  heightValid: boolean;
  widthValid: boolean;
  depthValid: boolean;
  widthInvalidReason: string | null;
  depthInvalidReason: string | null;
}

/** Pure calculation — no state, no side effects. Takes the resolved
 * section (or null if none) so callers don't need to re-derive it. */
export function calculateTrolleyDimensions(
  iShape: IShapeKitchenConfig,
  resolvedSection: ClearSegment | null,
): TrolleyDimensionResult {
  const floorCeilingPattiHeight = iShape.floorCeilingPattiHeight ?? DEFAULT_FLOOR_CEILING_PATTI_MM;
  const calculatedHeight = iShape.height - iShape.paniPattiHeight - floorCeilingPattiHeight - HEIGHT_CLEARANCE_MM;

  const sectionInsideWidth = resolvedSection ? (iShape.clearWidths[resolvedSection.index] ?? 0) : null;
  const calculatedWidth = sectionInsideWidth !== null ? sectionInsideWidth - WIDTH_FIT_MM : null;

  const depthDeduction = iShape.depthDeduction || DEFAULT_DEPTH_DEDUCTION_MM;
  const calculatedDepth = iShape.depth - depthDeduction;

  const finalHeight = iShape.trolleyHeightOverride ?? calculatedHeight;
  const finalWidth = iShape.trolleyWidthOverride ?? calculatedWidth;
  const finalDepth = iShape.trolleyDepthOverride ?? calculatedDepth;

  const heightValid = finalHeight > 0;
  const widthValid = sectionInsideWidth === null ? true : sectionInsideWidth > WIDTH_FIT_MM;
  const depthValid = iShape.depth > depthDeduction;

  return {
    calculatedHeight,
    calculatedWidth,
    calculatedDepth,
    finalHeight,
    finalWidth,
    finalDepth,
    sectionInsideWidth,
    heightValid,
    widthValid,
    depthValid,
    widthInvalidReason: widthValid ? null : 'Trolley cannot fit in this section.',
    depthInvalidReason: depthValid ? null : 'Invalid Trolley Depth.',
  };
}

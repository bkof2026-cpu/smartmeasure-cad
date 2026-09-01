// ─────────────────────────────────────────────────────────────────────────────
// Shared, product-agnostic engine types.
// Every product's design/component/dimension logic is built from these types —
// see docs/PRODUCT_STANDARDS.md and docs/FORMULA_TRACEABILITY.md for the real,
// verified source data these are populated from.
// ─────────────────────────────────────────────────────────────────────────────

/** Where a resolved value came from — never invented, always traceable. */
export interface ComponentSource {
  /** Human-readable formula string, e.g. "W - WARD_TB_DEDUCT(36)". */
  formula: string;
  /** Names of CLEARANCE_MASTER constants used, for the Drawing Inspector. */
  constants: string[];
  /** True when this size is a fixed value in the verified sheet, not derived from W/H/D. */
  fixed?: boolean;
  /** True when the source data itself flags this as unverified / needs shop-floor check. */
  needsVerification?: boolean;
  /** Free-text note carried straight from the CALC_* sheet's NOTES column. */
  note?: string;
}

/** A real furniture construction part, resolved to actual mm geometry for one view. */
export interface ComponentSpec {
  id: string;
  /** Real component name, e.g. "LEFT_SIDE_400", "HEAD_BOARD", "WARDROBE_DOOR". */
  type: string;
  label: string;
  /** World position in mm, top-left origin, for the view this was resolved for. */
  x: number;
  y: number;
  /** Cut/installed width and height in mm for this view. */
  width: number;
  height: number;
  /** Optional real depth in mm (for plan/side views). */
  depth?: number;
  qty: number;
  visible: boolean;
  source: ComponentSource;
}

export type DimensionEdge = 'top' | 'bottom' | 'left' | 'right';

export interface DimensionLine {
  id: string;
  axis: 'h' | 'v';
  /** World mm coordinates of the measured span (not yet offset for display). */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  valueMm: number;
  label: string;
  edge: DimensionEdge;
  /** Offset tier assigned by the collision engine — 0 = closest to the drawing. */
  tier: number;
  /** Which component(s) this dimension measures, for traceability. */
  componentIds: string[];
  source: ComponentSource;
  /** Defaults to the shared dimension red if unset. Set to match the
   * measured component's own box colour, so a viewer can visually pair a
   * dimension with the exact component it belongs to at a glance. */
  color?: string;
}

export type ValidationSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  code: string;
  message: string;
}

export type FormulaStatus = 'verified' | 'not_verified' | 'not_configured';

/**
 * A simple annotation line — door swing indication, track lines, centerlines
 * — real technical-drawing convention that isn't a measured component or a
 * dimension, just a construction/behaviour marker on the plan.
 */
export interface AnnotationLine {
  x1: number; y1: number; x2: number; y2: number;
  dashed?: boolean;
  color?: string;
  /** Defaults to a thin 0.8 if unset — set higher (e.g. 2.5) to draw a
   * genuinely bold line, distinct from the usual thin annotation strokes
   * (e.g. a Side Panel called out more prominently once a Loft sits above
   * it and the two would otherwise read as the same weight of line). */
  strokeWidth?: number;
  /** Optional leader-line caption, drawn near (x2, y2) — e.g. a diagonal
   * corner callout for a value that has no natural edge to dimension
   * against in this view (real hand-sketch convention, not a measured
   * axis-aligned DimensionLine). */
  label?: string;
  /** Draws a real arrowhead at (x1, y1) — the same marker used for real
   * DimensionLines — for annotation leaders that should read as pointing
   * AT the thing they label (e.g. "Side Panel" pointing at its own edge),
   * rather than a plain unmarked line. Defaults to no arrowhead. */
  arrowAtStart?: boolean;
}

/** Everything needed to draw one view of one resolved design. */
export interface ResolvedDrawing {
  view: string;
  productType: string;
  designId: string;
  designName: string;
  worldWidth: number;
  worldHeight: number;
  components: ComponentSpec[];
  dimensions: DimensionLine[];
  issues: ValidationIssue[];
  formulaStatus: FormulaStatus;
  lines?: AnnotationLine[];
}

/** Numeric measurement inputs, keyed by field key (W, H, D, thk, doorQty, ...). */
export type MeasurementValues = Record<string, number>;

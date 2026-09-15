import type { AnnotationLine, ComponentSpec } from '../../engine/types';
import type { DimensionRequest } from '../../engine/dimensionEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Trolley Template registry — reusable system for the I-Shape Kitchen's
// Trolley section (spec §6-21). Each template owns its own name, fixed
// dimensions, and two independent drawing-building functions:
//
//   buildOuterPanel  — what appears INSIDE the main I-Shape Kitchen drawing,
//                       occupying the first Inner Side Kadappa panel. Per the
//                       user's explicit confirmation this is ALWAYS a single
//                       bordered box (name + width label) — it never shows
//                       the trolley's own internal construction, which would
//                       overcrowd the main kitchen drawing.
//   buildInnerTrolley — the separate, detailed "Inner Trolley" drawing shown
//                       below the main kitchen drawing, where the trolley's
//                       real internal breakdown (fixed + derived dimensions)
//                       actually appears.
//
// Only ONE real template exists today ('free-door-trolley', built from the
// user's own reference sketch). The registry shape supports adding more
// (up to the ~25 the spec describes) without touching the kitchen engine —
// per spec §21 "Do not duplicate large amounts of drawing code for every
// trolley" and §13/§30 "Do NOT invent formulas that have not yet been
// provided" — every other template stays unbuilt until its own real
// dimensions/formulas are supplied.
// ─────────────────────────────────────────────────────────────────────────────

export interface TrolleyFixedDimensions {
  [key: string]: number;
}

export interface TrolleyBuildResult {
  components: ComponentSpec[];
  dimensions: DimensionRequest[];
  lines: AnnotationLine[];
}

export interface TrolleyTemplate {
  id: string;
  /** Shown in the Step 3 dropdown and inside the Outer Panel box. */
  name: string;
  fixedDimensions: TrolleyFixedDimensions;
  /** Builds the single Outer Panel box shown inside the main I-Shape
   * drawing — origin is the panel's own top-left corner, outerWidth/
   * outerHeight are that panel's REAL resolved size (from the Kadappa
   * section it replaces), never a value the template invents. */
  buildOuterPanel(origin: { x: number; y: number }, outerWidth: number, outerHeight: number): TrolleyBuildResult;
  /** Builds the detailed Inner Trolley drawing — origin is wherever the
   * kitchen engine has decided to place it (below the whole main drawing,
   * with real clearance) — the template only lays out its OWN geometry
   * relative to that origin, never touching kitchen-level coordinates. */
  buildInnerTrolley(origin: { x: number; y: number }): TrolleyBuildResult;
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

const TROLLEY_COLOR = '#b45309';

/**
 * "Free Door Trolley" — the one real, fully worked template, built exactly
 * from the user's own reference sketch. Fixed dimensions used are ONLY the
 * ones actually labeled there:
 *   - left column, top cell:  220mm
 *   - center gap:             200mm (unlabeled/blank column between the two side columns)
 *   - right column, top cell: 130mm
 *   - right column, bottom cell: 200mm
 * The left column's bottom cell has no labeled value in the sketch and is
 * deliberately left undimensioned in the drawing below — never invented.
 */
const freeDoorTrolley: TrolleyTemplate = {
  id: 'free-door-trolley',
  name: 'Free Door Trolley',
  fixedDimensions: {
    innerLeftTop: 220,
    centerGap: 200,
    innerRightTop: 130,
    innerRightBottom: 200,
  },

  buildOuterPanel(origin, outerWidth, outerHeight) {
    const { x, y } = origin;
    const w = Math.max(1, outerWidth);
    const h = Math.max(1, outerHeight);
    const components: ComponentSpec[] = [
      {
        id: nextId('trolley-outer'),
        type: 'TROLLEY_OUTER',
        // Two-line label ("<Name>\n<Width> mm") — CanonicalSvg centres
        // multi-line labels inside the box; the small-box callout system
        // (noteBoxPlacement.ts, driven by the kitchen engine one level up)
        // takes over automatically if this box is too small to hold it.
        label: `${freeDoorTrolley.name}\n${Math.round(w)} mm`,
        x, y, width: w, height: h, qty: 1, visible: true,
        source: {
          formula: 'Outer Panel size = the Inner Side Kadappa (slot B) panel it occupies — never independently entered',
          constants: [],
        },
      },
    ];
    return { components, dimensions: [], lines: [] };
  },

  buildInnerTrolley(origin) {
    const { x, y } = origin;
    const { innerLeftTop, centerGap, innerRightTop, innerRightBottom } = freeDoorTrolley.fixedDimensions;
    // Left column: two stacked cells — top labeled 220mm, bottom
    // unlabeled (sketch gives no value for it). Same visual width as the
    // right column for a balanced drawing; height split evenly since no
    // ratio is given for the bottom cell either.
    const colW = 220;
    const totalH = 450; // top+bottom cell reference height from the sketch's own proportions (220 top + ~230 bottom implied by the drawing) — only the TOP cell's value (220) is a real labeled dimension; the total column height is a drawing-only layout choice, not a claimed measurement.
    const topH = innerLeftTop;
    const bottomH = totalH - topH;

    const components: ComponentSpec[] = [];
    const dimensions: DimensionRequest[] = [];
    const lines: AnnotationLine[] = [];

    // Left column
    components.push({
      id: nextId('trolley-inner-left-top'), type: 'TROLLEY_INNER_DETAIL', label: '',
      x, y, width: colW, height: topH, qty: 1, visible: true,
      source: { formula: `Free Door Trolley fixed dimension — innerLeftTop = ${innerLeftTop}mm`, constants: [], fixed: true },
    });
    components.push({
      id: nextId('trolley-inner-left-bottom'), type: 'TROLLEY_INNER_DETAIL', label: '',
      x, y: y + topH, width: colW, height: bottomH, qty: 1, visible: true,
      source: { formula: 'Free Door Trolley — bottom cell has no labeled dimension in the reference sketch', constants: [], needsVerification: true, note: 'No fixed value supplied for this cell — left undimensioned.' },
    });
    dimensions.push({
      axis: 'v', x1: x, y1: y, x2: x, y2: y + topH, edge: 'left',
      componentIds: [components[0].id], label: `${Math.round(innerLeftTop)} mm`,
      color: TROLLEY_COLOR,
      source: { formula: `Free Door Trolley fixed dimension — innerLeftTop = ${innerLeftTop}mm`, constants: [], fixed: true },
    });

    // Center gap column (blank, matching the sketch's unlabeled middle strip)
    const gapX = x + colW;
    components.push({
      id: nextId('trolley-inner-gap'), type: 'TROLLEY_INNER_DETAIL', label: '',
      x: gapX, y, width: centerGap, height: totalH, qty: 1, visible: true,
      source: { formula: `Free Door Trolley fixed dimension — centerGap = ${centerGap}mm`, constants: [], fixed: true },
    });
    dimensions.push({
      axis: 'h', x1: gapX, y1: y + totalH, x2: gapX + centerGap, y2: y + totalH, edge: 'bottom',
      componentIds: [components[2].id], label: `${Math.round(centerGap)} mm`,
      color: TROLLEY_COLOR,
      source: { formula: `Free Door Trolley fixed dimension — centerGap = ${centerGap}mm`, constants: [], fixed: true },
    });

    // Right column: top labeled 130mm, bottom labeled 200mm
    const rightX = gapX + centerGap;
    const rightTopH = innerRightTop;
    const rightBottomH = innerRightBottom;
    components.push({
      id: nextId('trolley-inner-right-top'), type: 'TROLLEY_INNER_DETAIL', label: '',
      x: rightX, y, width: colW, height: rightTopH, qty: 1, visible: true,
      source: { formula: `Free Door Trolley fixed dimension — innerRightTop = ${innerRightTop}mm`, constants: [], fixed: true },
    });
    components.push({
      id: nextId('trolley-inner-right-bottom'), type: 'TROLLEY_INNER_DETAIL', label: '',
      x: rightX, y: y + rightTopH, width: colW, height: rightBottomH, qty: 1, visible: true,
      source: { formula: `Free Door Trolley fixed dimension — innerRightBottom = ${innerRightBottom}mm`, constants: [], fixed: true },
    });
    dimensions.push({
      axis: 'v', x1: rightX + colW, y1: y, x2: rightX + colW, y2: y + rightTopH, edge: 'right',
      componentIds: [components[3].id], label: `${Math.round(innerRightTop)} mm`,
      color: TROLLEY_COLOR,
      source: { formula: `Free Door Trolley fixed dimension — innerRightTop = ${innerRightTop}mm`, constants: [], fixed: true },
    });
    dimensions.push({
      axis: 'v', x1: rightX + colW, y1: y + rightTopH, x2: rightX + colW, y2: y + rightTopH + rightBottomH, edge: 'right',
      componentIds: [components[4].id], label: `${Math.round(innerRightBottom)} mm`,
      color: TROLLEY_COLOR,
      source: { formula: `Free Door Trolley fixed dimension — innerRightBottom = ${innerRightBottom}mm`, constants: [], fixed: true },
    });

    lines.push({
      x1: x, y1: y - 14, x2: x, y2: y - 14, color: TROLLEY_COLOR,
      label: 'INNER TROLLEY',
    });

    return { components, dimensions, lines };
  },
};

/**
 * "2 Door Trolley" — second real template, from the user's own follow-up
 * reference sketch. Same left/right column split as Free Door Trolley
 * (left top 220mm; right top 130mm, right bottom 200mm) but the two
 * columns sit directly adjacent — NO center gap column between them.
 * Same rule as Free Door Trolley: only labeled sketch values are used as
 * fixed dimensions; the left column's bottom cell has no labeled value
 * and stays undimensioned.
 */
const twoDoorTrolley: TrolleyTemplate = {
  id: 'two-door-trolley',
  name: '2 Door Trolley',
  fixedDimensions: {
    innerLeftTop: 220,
    innerRightTop: 130,
    innerRightBottom: 200,
  },

  buildOuterPanel(origin, outerWidth, outerHeight) {
    const { x, y } = origin;
    const w = Math.max(1, outerWidth);
    const h = Math.max(1, outerHeight);
    const components: ComponentSpec[] = [
      {
        id: nextId('trolley-outer'),
        type: 'TROLLEY_OUTER',
        label: `${twoDoorTrolley.name}\n${Math.round(w)} mm`,
        x, y, width: w, height: h, qty: 1, visible: true,
        source: {
          formula: 'Outer Panel size = the Inner Side Kadappa (slot B) panel it occupies — never independently entered',
          constants: [],
        },
      },
    ];
    return { components, dimensions: [], lines: [] };
  },

  buildInnerTrolley(origin) {
    const { x, y } = origin;
    const { innerLeftTop, innerRightTop, innerRightBottom } = twoDoorTrolley.fixedDimensions;
    const colW = 220;
    const totalH = 450;
    const topH = innerLeftTop;
    const bottomH = totalH - topH;

    const components: ComponentSpec[] = [];
    const dimensions: DimensionRequest[] = [];
    const lines: AnnotationLine[] = [];

    // Left column
    components.push({
      id: nextId('trolley-inner-left-top'), type: 'TROLLEY_INNER_DETAIL', label: '',
      x, y, width: colW, height: topH, qty: 1, visible: true,
      source: { formula: `2 Door Trolley fixed dimension — innerLeftTop = ${innerLeftTop}mm`, constants: [], fixed: true },
    });
    components.push({
      id: nextId('trolley-inner-left-bottom'), type: 'TROLLEY_INNER_DETAIL', label: '',
      x, y: y + topH, width: colW, height: bottomH, qty: 1, visible: true,
      source: { formula: '2 Door Trolley — bottom cell has no labeled dimension in the reference sketch', constants: [], needsVerification: true, note: 'No fixed value supplied for this cell — left undimensioned.' },
    });
    dimensions.push({
      axis: 'v', x1: x, y1: y, x2: x, y2: y + topH, edge: 'left',
      componentIds: [components[0].id], label: `${Math.round(innerLeftTop)} mm`,
      color: TROLLEY_COLOR,
      source: { formula: `2 Door Trolley fixed dimension — innerLeftTop = ${innerLeftTop}mm`, constants: [], fixed: true },
    });

    // Right column — directly adjacent to the left column, no gap.
    const rightX = x + colW;
    const rightTopH = innerRightTop;
    const rightBottomH = innerRightBottom;
    components.push({
      id: nextId('trolley-inner-right-top'), type: 'TROLLEY_INNER_DETAIL', label: '',
      x: rightX, y, width: colW, height: rightTopH, qty: 1, visible: true,
      source: { formula: `2 Door Trolley fixed dimension — innerRightTop = ${innerRightTop}mm`, constants: [], fixed: true },
    });
    components.push({
      id: nextId('trolley-inner-right-bottom'), type: 'TROLLEY_INNER_DETAIL', label: '',
      x: rightX, y: y + rightTopH, width: colW, height: rightBottomH, qty: 1, visible: true,
      source: { formula: `2 Door Trolley fixed dimension — innerRightBottom = ${innerRightBottom}mm`, constants: [], fixed: true },
    });
    dimensions.push({
      axis: 'v', x1: rightX + colW, y1: y, x2: rightX + colW, y2: y + rightTopH, edge: 'right',
      componentIds: [components[2].id], label: `${Math.round(innerRightTop)} mm`,
      color: TROLLEY_COLOR,
      source: { formula: `2 Door Trolley fixed dimension — innerRightTop = ${innerRightTop}mm`, constants: [], fixed: true },
    });
    dimensions.push({
      axis: 'v', x1: rightX + colW, y1: y + rightTopH, x2: rightX + colW, y2: y + rightTopH + rightBottomH, edge: 'right',
      componentIds: [components[3].id], label: `${Math.round(innerRightBottom)} mm`,
      color: TROLLEY_COLOR,
      source: { formula: `2 Door Trolley fixed dimension — innerRightBottom = ${innerRightBottom}mm`, constants: [], fixed: true },
    });

    lines.push({
      x1: x, y1: y - 14, x2: x, y2: y - 14, color: TROLLEY_COLOR,
      label: 'INNER TROLLEY',
    });

    return { components, dimensions, lines };
  },
};

export const TROLLEY_TEMPLATES: Record<string, TrolleyTemplate> = {
  'free-door-trolley': freeDoorTrolley,
  'two-door-trolley': twoDoorTrolley,
};

export function getTrolleyTemplate(id: string | null | undefined): TrolleyTemplate | null {
  if (!id) return null;
  return TROLLEY_TEMPLATES[id] ?? null;
}

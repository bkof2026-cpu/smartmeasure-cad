import type { AnnotationLine, ComponentSpec } from '../../engine/types';
import type { DimensionRequest } from '../../engine/dimensionEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Trolley Template registry — reusable system for the I-Shape Kitchen's
// Trolley section. Each template owns its own name, fixed dimensions, any
// editable "SPO" cells, and two independent drawing-building functions:
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
// SPO cells: some trolley layouts have one or two cells with NO fixed
// dimension — labeled "SPO" in the user's own reference sketches. These
// become user-editable fields in the wizard (KitchenFlow.tsx Step 2),
// stored in IShapeKitchenConfig.spoValues keyed by TrolleySpoField.key.
// Every SPO field defaults to 200mm EXCEPT 5P-CSPO's two SPO cells, which
// the user's own sketch explicitly range-labels "200/300 (editable)" —
// confirmed as a special case, not a general rule (src/store confirmed via
// direct chat, see project memory).
//
// The user has confirmed the exact box layout + fixed numbers for 8 of the
// 9 known trolley types by walking through their own reference sketches one
// at a time. The 9th ("4 Panel Only Trolley") has NO numeric labels in its
// sketch and is intentionally left as an incomplete stub — do NOT invent
// dimensions for it. The former 'free-door-trolley' / 'two-door-trolley'
// templates (built from an earlier, now-superseded pair of sketches) have
// been removed per the user's explicit instruction.
// ─────────────────────────────────────────────────────────────────────────────

export interface TrolleyFixedDimensions {
  [key: string]: number;
}

/** One editable "SPO" cell a trolley template exposes to the wizard. */
export interface TrolleySpoField {
  /** Stable key into IShapeKitchenConfig.spoValues for this template. */
  key: string;
  /** Shown as the input's label in the wizard, e.g. "SPO (Right)". */
  label: string;
  default: number;
  /** Only set for 5P-CSPO's two SPO cells — the user's sketch explicitly
   * range-labels them "200/300 (editable)". Absent for every other
   * template's SPO field (plain editable number, default 200, no range). */
  min?: number;
  max?: number;
}

export interface TrolleyBuildResult {
  components: ComponentSpec[];
  dimensions: DimensionRequest[];
  lines: AnnotationLine[];
}

export interface TrolleyTemplate {
  id: string;
  /** Shown in the Step 2 dropdown and inside the Outer Panel box. */
  name: string;
  fixedDimensions: TrolleyFixedDimensions;
  /** Empty array = no SPO cells anywhere in this trolley (e.g. 7P-Only,
   * 5P-Only). Populated in physical top-to-bottom, left-to-right order.
   * Every SPO field's value is its column's WIDTH — never a height. SPO's
   * own HEIGHT is always the full Total Trolley Height (see
   * buildInnerTrolley's totalHeight param), never a separate input. */
  spoFields: TrolleySpoField[];
  /** The actual number of vertical pipe/separator lines in this
   * template's own real structure — confirmed per-template by the user,
   * never a generic guess. Pipe Deduction = pipeCount × 20mm. */
  pipeCount: number;
  /** Divisor for the Normal Box Width formula — the number of columns
   * that actually CONTAIN a real empty box (never simply "all non-SPO
   * columns"; a column that is fully fixed-height with no empty box does
   * not count). Every template in the confirmed roster happens to have
   * exactly one empty box per normal column, so this equals "normal
   * column count" in practice — but the divisor's real meaning is empty-
   * box count, confirmed explicitly by the user. Does not include the SPO
   * column, if any (SPO is never counted here). */
  normalColumnCount: number;
  /** True only for the intentionally-incomplete "4 Panel Only Trolley"
   * stub — has no fixed dimensions at all yet, pending real values from
   * the user. buildOuterPanel/buildInnerTrolley still exist but draw only
   * a placeholder, never invented numbers. */
  incomplete?: boolean;
  /** Builds the single Outer Panel box shown inside the main I-Shape
   * drawing — origin is the panel's own top-left corner, outerWidth/
   * outerHeight are that panel's REAL resolved size (from the Kadappa
   * section it replaces), never a value the template invents. */
  buildOuterPanel(origin: { x: number; y: number }, outerWidth: number, outerHeight: number): TrolleyBuildResult;
  /** Builds the detailed Inner Trolley drawing — origin is wherever the
   * kitchen engine has decided to place it (below the whole main drawing,
   * with real clearance) — the template only lays out its OWN geometry
   * relative to that origin, never touching kitchen-level coordinates.
   * `spoValues` are the user's current edited SPO WIDTH values for THIS
   * template (already defaulted — see getSpoValue below). `totalHeight`
   * is the real Total Trolley Height every full-height column (including
   * SPO) is drawn against. `normalColumnWidth` is the calculated width
   * (via calculateNormalColumnWidth below) every non-SPO column/box uses
   * for its physical width — replaces the old COL_W placeholder. */
  buildInnerTrolley(origin: { x: number; y: number }, spoValues: Record<string, number>, totalHeight: number, normalColumnWidth: number): TrolleyBuildResult;
}

export const PIPE_WIDTH_MM = 20;

export interface NormalColumnWidthResult {
  pipeDeduction: number;
  spoWidth: number;
  /** The calculated width for every normal (non-SPO) column/box —
   * Math.max(1, ...) floor applied so a pathological input never produces
   * a zero/negative box; validity is reported separately via `valid`. */
  normalColumnWidth: number;
  valid: boolean;
  invalidReason: string | null;
}

/**
 * The ONE shared width-calculation engine every trolley template uses —
 * per the spec's own "reusable calculation engine" requirement.
 *
 *   Normal Box Width = (Trolley Width − pipeCount×20mm − SPO Width if
 *                        present) ÷ normalColumnCount
 *
 * SPO Width is deducted only when the template actually has an SPO field;
 * it is never itself sized by this formula (SPO Width stays the
 * template's own editable value).
 */
export function calculateNormalColumnWidth(
  template: Pick<TrolleyTemplate, 'pipeCount' | 'normalColumnCount' | 'spoFields'>,
  trolleyWidth: number,
  spoValues: Record<string, number>,
): NormalColumnWidthResult {
  const pipeDeduction = template.pipeCount * PIPE_WIDTH_MM;
  const spoWidth = template.spoFields.length > 0 ? getSpoValue(template.spoFields[0], spoValues) : 0;
  const available = trolleyWidth - pipeDeduction - spoWidth;
  const columnCount = Math.max(1, template.normalColumnCount);
  const normalColumnWidth = available / columnCount;

  const valid = normalColumnWidth > 0;
  return {
    pipeDeduction,
    spoWidth,
    normalColumnWidth: Math.max(1, normalColumnWidth),
    valid,
    invalidReason: valid ? null : `Trolley Width (${Math.round(trolleyWidth)}mm) is too small for this template's pipe deduction (${Math.round(pipeDeduction)}mm)${spoWidth > 0 ? ` + SPO Width (${Math.round(spoWidth)}mm)` : ''} — normal column width would be ${Math.round(normalColumnWidth)}mm.`,
  };
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

const TROLLEY_COLOR = '#b45309';
const SPO_COLOR = '#9333ea'; // distinct colour for editable SPO cells, so they read as different from fixed dimensions at a glance

/** Reads a template's current SPO value, falling back to its field default
 * when the user hasn't edited it yet (or the value was cleared to 0/undefined). */
function getSpoValue(field: TrolleySpoField, spoValues: Record<string, number>): number {
  const v = spoValues[field.key];
  return v && v > 0 ? v : field.default;
}

const COL_W = 220; // shared drawing-only column width for the Inner Trolley detail (a layout choice, not a claimed measurement — matches the pre-existing Free Door Trolley convention)

/** Builds a plain "Name\nWidth mm" single-box Outer Panel — identical
 * shape/label convention for every trolley template. */
function buildSimpleOuterPanel(name: string, origin: { x: number; y: number }, outerWidth: number, outerHeight: number): TrolleyBuildResult {
  const { x, y } = origin;
  const w = Math.max(1, outerWidth);
  const h = Math.max(1, outerHeight);
  return {
    components: [{
      id: nextId('trolley-outer'),
      type: 'TROLLEY_OUTER',
      label: `${name}\n${Math.round(w)} mm`,
      x, y, width: w, height: h, qty: 1, visible: true,
      source: {
        formula: 'Outer Panel size = the Inner Side Kadappa (slot B) panel it occupies — never independently entered',
        constants: [],
      },
    }],
    dimensions: [],
    lines: [],
  };
}

function innerTrolleyTitleLine(x: number, y: number): AnnotationLine {
  return { x1: x, y1: y - 14, x2: x, y2: y - 14, color: TROLLEY_COLOR, label: 'INNER TROLLEY' };
}

/** Pushes one stacked FIXED-HEIGHT cell into a column, plus its own
 * vertical dimension line for the HEIGHT (a real vertical quantity, drawn
 * as a vertical dimension on the box's edge — correct CAD convention), and
 * an in-box "{width}(W)" text label for the WIDTH (a horizontal quantity,
 * shown as plain text inside the box, matching the reference drawing's own
 * "445(W) / 220(H)" convention — never a rotated dimension line). Returns
 * the Y position right after this cell. */
function pushFixedCell(
  components: ComponentSpec[], dimensions: DimensionRequest[],
  opts: { x: number; y: number; width: number; height: number; edge: 'left' | 'right'; color: string; formula: string },
): number {
  const { x, y, width, height, edge, color, formula } = opts;
  const id = nextId('trolley-inner-fixed');
  components.push({
    id, type: 'TROLLEY_INNER_DETAIL', label: `${Math.round(width)}(W)`,
    x, y, width, height, qty: 1, visible: true,
    source: { formula, constants: [], fixed: true },
  });
  const dimX = edge === 'left' ? x : x + width;
  dimensions.push({
    axis: 'v', x1: dimX, y1: y, x2: dimX, y2: y + height, edge,
    componentIds: [id], label: `${Math.round(height)} mm`, color,
    source: { formula, constants: [], fixed: true },
  });
  return y + height;
}

/** Pushes an EMPTY BOX — a real structural cell whose HEIGHT is not yet
 * defined (a future formula will size it — height stays undimensioned,
 * per the explicit "do not invent its height formula" instruction). Its
 * WIDTH, however, is now a real known value (the calculated Normal Column
 * Width it inherits from its parent column), so it IS labeled — as plain
 * HORIZONTAL text sitting inside the box (matching the reference drawing's
 * own "445(W)" convention, same as a fixed box's "220(H)" label), never as
 * a rotated/vertical dimension line on the box's edge. */
function pushEmptyBox(
  components: ComponentSpec[],
  opts: { x: number; y: number; width: number; bottomY: number; note: string },
): void {
  const { x, y, width, bottomY, note } = opts;
  const height = Math.max(1, bottomY - y);
  const id = nextId('trolley-inner-empty');
  components.push({
    id, type: 'TROLLEY_INNER_EMPTY', label: `${Math.round(width)}(W)`,
    x, y, width, height, qty: 1, visible: true,
    source: { formula: `Empty Box Width = calculated Normal Column Width = ${Math.round(width)}mm (Height: DERIVED DIMENSION — FORMULA TO BE PROVIDED)`, constants: [], needsVerification: true, note },
  });
}

/** Pushes one real 20mm-wide vertical PIPE — a physical structural
 * separator, not a subtraction-only number. Drawn as its own thin filled
 * component spanning the full Total Trolley Height, at the given x
 * position. Returns x + PIPE_WIDTH_MM (the x position immediately after
 * the pipe), so callers can chain pipe → column → pipe → column left to
 * right without manual arithmetic at each call site. */
function pushPipe(
  components: ComponentSpec[],
  opts: { x: number; y: number; totalHeight: number },
): number {
  const { x, y, totalHeight } = opts;
  components.push({
    id: nextId('trolley-inner-pipe'), type: 'TROLLEY_INNER_PIPE', label: '',
    x, y, width: PIPE_WIDTH_MM, height: Math.max(1, totalHeight), qty: 1, visible: true,
    source: { formula: `Structural pipe — fixed ${PIPE_WIDTH_MM}mm width`, constants: [], fixed: true },
  });
  return x + PIPE_WIDTH_MM;
}

/** Pushes a full-height SPO column — height is ALWAYS totalHeight (never a
 * separate input), width is the template's own editable SPO field value.
 * Draws one continuous box, never split, with a horizontal WIDTH
 * dimension below it (never a vertical/height dimension, since SPO's
 * height is derived from the shared Total Trolley Height, not its own
 * measured value). */
function pushSpoColumn(
  components: ComponentSpec[], dimensions: DimensionRequest[],
  opts: { x: number; y: number; width: number; totalHeight: number; bottomLabelY: number; formula: string },
): void {
  const { x, y, width, totalHeight, bottomLabelY, formula } = opts;
  const id = nextId('trolley-inner-spo');
  components.push({
    id, type: 'TROLLEY_INNER_SPO', label: 'SPO',
    x, y, width, height: Math.max(1, totalHeight), qty: 1, visible: true,
    source: { formula, constants: [], needsVerification: false, note: 'SPO — Height = Total Trolley Height (not a manual input). Width/Breadth is the editable value shown below.' },
  });
  dimensions.push({
    axis: 'h', x1: x, y1: bottomLabelY, x2: x + width, y2: bottomLabelY, edge: 'bottom',
    componentIds: [id], label: `${Math.round(width)} mm (SPO Width)`, color: SPO_COLOR,
    source: { formula, constants: [] },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 7P-Only Trolley — 3 columns, no SPO, 3 empty boxes (one per column).
//    Left: fixed 220mm box + Empty Box below. Middle: fixed 130mm + fixed
//    200mm stacked + Empty Box below. Right: fixed 220mm box + Empty Box
//    below (mirrors left). Corrected structure — every column reaches down
//    to the real Total Trolley Height via its own empty box, matching the
//    user's own reference drawing exactly (3 empty boxes -> divisor 3 in
//    the Normal Box Width formula).
// ─────────────────────────────────────────────────────────────────────────────
const sevenPanelOnly: TrolleyTemplate = {
  id: '7p-only',
  name: '7P-Only Trolley',
  fixedDimensions: { left: 220, middleTop: 130, middleBottom: 200, right: 220 },
  spoFields: [],
  pipeCount: 4,
  normalColumnCount: 3,
  buildOuterPanel: (origin, w, h) => buildSimpleOuterPanel('7P-Only Trolley', origin, w, h),
  buildInnerTrolley(origin, _spoValues, totalHeight, normalColumnWidth) {
    const { x: originX, y } = origin;
    const { left, middleTop, middleBottom, right } = this.fixedDimensions;
    const components: ComponentSpec[] = [];
    const dimensions: DimensionRequest[] = [];
    const bottomY = y + Math.max(1, totalHeight);

    // 4 real pipes: left outer edge, left|middle, middle|right, right outer edge.
    let x = pushPipe(components, { x: originX, y, totalHeight });
    const afterLeft = pushFixedCell(components, dimensions, { x, y, width: normalColumnWidth, height: left, edge: 'left', color: TROLLEY_COLOR, formula: `7P-Only Trolley fixed — left top box = ${left}mm` });
    pushEmptyBox(components, { x, y: afterLeft, width: normalColumnWidth, bottomY, note: 'Empty Box below the 220mm fixed box — height not yet defined.' });

    const midX = pushPipe(components, { x: x + normalColumnWidth, y, totalHeight });
    let midY = pushFixedCell(components, dimensions, { x: midX, y, width: normalColumnWidth, height: middleTop, edge: 'right', color: TROLLEY_COLOR, formula: `7P-Only Trolley fixed — middle top = ${middleTop}mm` });
    midY = pushFixedCell(components, dimensions, { x: midX, y: midY, width: normalColumnWidth, height: middleBottom, edge: 'right', color: TROLLEY_COLOR, formula: `7P-Only Trolley fixed — middle bottom = ${middleBottom}mm` });
    pushEmptyBox(components, { x: midX, y: midY, width: normalColumnWidth, bottomY, note: 'Empty Box below the 130+200mm fixed boxes — height not yet defined.' });

    const rightX = pushPipe(components, { x: midX + normalColumnWidth, y, totalHeight });
    const afterRight = pushFixedCell(components, dimensions, { x: rightX, y, width: normalColumnWidth, height: right, edge: 'right', color: TROLLEY_COLOR, formula: `7P-Only Trolley fixed — right top box = ${right}mm` });
    pushEmptyBox(components, { x: rightX, y: afterRight, width: normalColumnWidth, bottomY, note: 'Empty Box below the 220mm fixed box — height not yet defined.' });
    pushPipe(components, { x: rightX + normalColumnWidth, y, totalHeight });

    return { components, dimensions, lines: [innerTrolleyTitleLine(originX, y)] };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. 5P-Only Trolley — 2 columns, no SPO, 2 empty boxes (one per column).
//    Left: fixed 220mm box + Empty Box below. Right: fixed 130mm + fixed
//    200mm stacked + Empty Box below.
// ─────────────────────────────────────────────────────────────────────────────
const fivePanelOnly: TrolleyTemplate = {
  id: '5p-only',
  name: '5P-Only Trolley',
  fixedDimensions: { left: 220, rightTop: 130, rightBottom: 200 },
  spoFields: [],
  pipeCount: 3,
  normalColumnCount: 2,
  buildOuterPanel: (origin, w, h) => buildSimpleOuterPanel('5P-Only Trolley', origin, w, h),
  buildInnerTrolley(origin, _spoValues, totalHeight, normalColumnWidth) {
    const { x: originX, y } = origin;
    const { left, rightTop, rightBottom } = this.fixedDimensions;
    const components: ComponentSpec[] = [];
    const dimensions: DimensionRequest[] = [];
    const bottomY = y + Math.max(1, totalHeight);

    // 3 real pipes: left outer edge, left|right boundary, right outer edge.
    let x = pushPipe(components, { x: originX, y, totalHeight });
    const afterLeft = pushFixedCell(components, dimensions, { x, y, width: normalColumnWidth, height: left, edge: 'left', color: TROLLEY_COLOR, formula: `5P-Only Trolley fixed — left top box = ${left}mm` });
    pushEmptyBox(components, { x, y: afterLeft, width: normalColumnWidth, bottomY, note: 'Empty Box below the 220mm fixed box — height not yet defined.' });

    const rightX = pushPipe(components, { x: x + normalColumnWidth, y, totalHeight });
    let ry = pushFixedCell(components, dimensions, { x: rightX, y, width: normalColumnWidth, height: rightTop, edge: 'right', color: TROLLEY_COLOR, formula: `5P-Only Trolley fixed — right top = ${rightTop}mm` });
    ry = pushFixedCell(components, dimensions, { x: rightX, y: ry, width: normalColumnWidth, height: rightBottom, edge: 'right', color: TROLLEY_COLOR, formula: `5P-Only Trolley fixed — right bottom = ${rightBottom}mm` });
    pushEmptyBox(components, { x: rightX, y: ry, width: normalColumnWidth, bottomY, note: 'Empty Box below the 130+200mm fixed boxes — height not yet defined.' });
    pushPipe(components, { x: rightX + normalColumnWidth, y, totalHeight });

    return { components, dimensions, lines: [innerTrolleyTitleLine(originX, y)] };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. 2P-RSPO — Left column: fixed 220mm box on top + Empty Box below (down
//    to Total Trolley Height). Right column: SPO, full height, editable
//    Width (default 200mm). Confirmed structure — SPO is never split,
//    there is no box below it, and it is not a third column.
// ─────────────────────────────────────────────────────────────────────────────
const twoPanelRspo: TrolleyTemplate = {
  id: '2p-rspo',
  name: '2P-RSPO',
  fixedDimensions: { leftTop: 220 },
  spoFields: [{ key: 'spo', label: 'SPO Width/Breadth', default: 200 }],
  pipeCount: 3,
  normalColumnCount: 1,
  buildOuterPanel: (origin, w, h) => buildSimpleOuterPanel('2P-RSPO', origin, w, h),
  buildInnerTrolley(origin, spoValues, totalHeight, normalColumnWidth) {
    const { x: originX, y } = origin;
    const { leftTop } = this.fixedDimensions;
    const spoW = getSpoValue(this.spoFields[0], spoValues);
    const components: ComponentSpec[] = [];
    const dimensions: DimensionRequest[] = [];
    const bottomY = y + Math.max(1, totalHeight);

    // 3 real pipes: left outer edge, left column|SPO boundary, right outer edge.
    let x = pushPipe(components, { x: originX, y, totalHeight });
    const afterFixed = pushFixedCell(components, dimensions, { x, y, width: normalColumnWidth, height: leftTop, edge: 'left', color: TROLLEY_COLOR, formula: `2P-RSPO fixed — top box = ${leftTop}mm` });
    pushEmptyBox(components, { x, y: afterFixed, width: normalColumnWidth, bottomY, note: 'Empty Box below the 220mm fixed box — height not yet defined.' });

    const rightX = pushPipe(components, { x: x + normalColumnWidth, y, totalHeight });
    pushSpoColumn(components, dimensions, { x: rightX, y, width: spoW, totalHeight, bottomLabelY: bottomY + 30, formula: `2P-RSPO — SPO Width (editable, default 200mm) = ${spoW}mm` });
    pushPipe(components, { x: rightX + spoW, y, totalHeight });

    return { components, dimensions, lines: [innerTrolleyTitleLine(originX, y)] };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. 2P-LSPO — mirror of 2P-RSPO. Left column: SPO, full height, editable
//    Width. Right column: fixed 220mm box on top + Empty Box below.
// ─────────────────────────────────────────────────────────────────────────────
const twoPanelLspo: TrolleyTemplate = {
  id: '2p-lspo',
  name: '2P-LSPO',
  fixedDimensions: { rightTop: 220 },
  spoFields: [{ key: 'spo', label: 'SPO Width/Breadth', default: 200 }],
  pipeCount: 3,
  normalColumnCount: 1,
  buildOuterPanel: (origin, w, h) => buildSimpleOuterPanel('2P-LSPO', origin, w, h),
  buildInnerTrolley(origin, spoValues, totalHeight, normalColumnWidth) {
    const { x: originX, y } = origin;
    const { rightTop } = this.fixedDimensions;
    const spoW = getSpoValue(this.spoFields[0], spoValues);
    const components: ComponentSpec[] = [];
    const dimensions: DimensionRequest[] = [];
    const bottomY = y + Math.max(1, totalHeight);

    // 3 real pipes: left outer edge, SPO|right column boundary, right outer edge.
    let x = pushPipe(components, { x: originX, y, totalHeight });
    pushSpoColumn(components, dimensions, { x, y, width: spoW, totalHeight, bottomLabelY: bottomY + 30, formula: `2P-LSPO — SPO Width (editable, default 200mm) = ${spoW}mm` });

    const rightX = pushPipe(components, { x: x + spoW, y, totalHeight });
    const afterFixed = pushFixedCell(components, dimensions, { x: rightX, y, width: normalColumnWidth, height: rightTop, edge: 'right', color: TROLLEY_COLOR, formula: `2P-LSPO fixed — top box = ${rightTop}mm` });
    pushEmptyBox(components, { x: rightX, y: afterFixed, width: normalColumnWidth, bottomY, note: 'Empty Box below the 220mm fixed box — height not yet defined.' });
    pushPipe(components, { x: rightX + normalColumnWidth, y, totalHeight });

    return { components, dimensions, lines: [innerTrolleyTitleLine(originX, y)] };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. 3P-RSPO — Left: 130 top / 200 bottom (fixed). Right: SPO + 200 fixed bottom.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// 5. 3P-RSPO — Left column: fixed 130mm + fixed 200mm stacked + Empty Box
//    below (down to Total Trolley Height). Right column: SPO, full height,
//    editable Width. No box below SPO.
// ─────────────────────────────────────────────────────────────────────────────
const threePanelRspo: TrolleyTemplate = {
  id: '3p-rspo',
  name: '3P-RSPO',
  fixedDimensions: { leftTop: 130, leftMiddle: 200 },
  spoFields: [{ key: 'spo', label: 'SPO Width/Breadth', default: 200 }],
  pipeCount: 3,
  normalColumnCount: 1,
  buildOuterPanel: (origin, w, h) => buildSimpleOuterPanel('3P-RSPO', origin, w, h),
  buildInnerTrolley(origin, spoValues, totalHeight, normalColumnWidth) {
    const { x: originX, y } = origin;
    const { leftTop, leftMiddle } = this.fixedDimensions;
    const spoW = getSpoValue(this.spoFields[0], spoValues);
    const components: ComponentSpec[] = [];
    const dimensions: DimensionRequest[] = [];
    const bottomY = y + Math.max(1, totalHeight);

    // 3 real pipes: left outer edge, left column|SPO boundary, right outer edge.
    let x = pushPipe(components, { x: originX, y, totalHeight });
    let ly = pushFixedCell(components, dimensions, { x, y, width: normalColumnWidth, height: leftTop, edge: 'left', color: TROLLEY_COLOR, formula: `3P-RSPO fixed — top box = ${leftTop}mm` });
    ly = pushFixedCell(components, dimensions, { x, y: ly, width: normalColumnWidth, height: leftMiddle, edge: 'left', color: TROLLEY_COLOR, formula: `3P-RSPO fixed — middle box = ${leftMiddle}mm` });
    pushEmptyBox(components, { x, y: ly, width: normalColumnWidth, bottomY, note: 'Empty Box below the 130+200mm fixed boxes — height not yet defined.' });

    const rightX = pushPipe(components, { x: x + normalColumnWidth, y, totalHeight });
    pushSpoColumn(components, dimensions, { x: rightX, y, width: spoW, totalHeight, bottomLabelY: bottomY + 30, formula: `3P-RSPO — SPO Width (editable, default 200mm) = ${spoW}mm` });
    pushPipe(components, { x: rightX + spoW, y, totalHeight });

    return { components, dimensions, lines: [innerTrolleyTitleLine(originX, y)] };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. 3P-LSPO — mirror of 3P-RSPO. Left column: SPO, full height, editable
//    Width. Right column: fixed 130mm + fixed 200mm stacked + Empty Box below.
// ─────────────────────────────────────────────────────────────────────────────
const threePanelLspo: TrolleyTemplate = {
  id: '3p-lspo',
  name: '3P-LSPO',
  fixedDimensions: { rightTop: 130, rightMiddle: 200 },
  spoFields: [{ key: 'spo', label: 'SPO Width/Breadth', default: 200 }],
  pipeCount: 3,
  normalColumnCount: 1,
  buildOuterPanel: (origin, w, h) => buildSimpleOuterPanel('3P-LSPO', origin, w, h),
  buildInnerTrolley(origin, spoValues, totalHeight, normalColumnWidth) {
    const { x: originX, y } = origin;
    const { rightTop, rightMiddle } = this.fixedDimensions;
    const spoW = getSpoValue(this.spoFields[0], spoValues);
    const components: ComponentSpec[] = [];
    const dimensions: DimensionRequest[] = [];
    const bottomY = y + Math.max(1, totalHeight);

    // 3 real pipes: left outer edge, SPO|right column boundary, right outer edge.
    let x = pushPipe(components, { x: originX, y, totalHeight });
    pushSpoColumn(components, dimensions, { x, y, width: spoW, totalHeight, bottomLabelY: bottomY + 30, formula: `3P-LSPO — SPO Width (editable, default 200mm) = ${spoW}mm` });

    const rightX = pushPipe(components, { x: x + spoW, y, totalHeight });
    let ry = pushFixedCell(components, dimensions, { x: rightX, y, width: normalColumnWidth, height: rightTop, edge: 'right', color: TROLLEY_COLOR, formula: `3P-LSPO fixed — top box = ${rightTop}mm` });
    ry = pushFixedCell(components, dimensions, { x: rightX, y: ry, width: normalColumnWidth, height: rightMiddle, edge: 'right', color: TROLLEY_COLOR, formula: `3P-LSPO fixed — middle box = ${rightMiddle}mm` });
    pushEmptyBox(components, { x: rightX, y: ry, width: normalColumnWidth, bottomY, note: 'Empty Box below the 130+200mm fixed boxes — height not yet defined.' });
    pushPipe(components, { x: rightX + normalColumnWidth, y, totalHeight });

    return { components, dimensions, lines: [innerTrolleyTitleLine(originX, y)] };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. 5P-CSPO — 3 columns, SPO in the CENTER. Left: fixed 220mm box +
//    Empty Box below. Center: SPO, full height, editable Width (default
//    200mm). Right: fixed 130mm + fixed 200mm stacked + Empty Box below.
//    No box below SPO; the right column's third position is a real Empty
//    Box, not a second SPO.
// ─────────────────────────────────────────────────────────────────────────────
const fivePanelCspo: TrolleyTemplate = {
  id: '5p-cspo',
  name: '5P-CSPO',
  fixedDimensions: { leftTop: 220, rightTop: 130, rightMiddle: 200 },
  spoFields: [{ key: 'spoCenter', label: 'SPO Width/Breadth', default: 200, min: 200, max: 300 }],
  pipeCount: 4,
  normalColumnCount: 2,
  buildOuterPanel: (origin, w, h) => buildSimpleOuterPanel('5P-CSPO', origin, w, h),
  buildInnerTrolley(origin, spoValues, totalHeight, normalColumnWidth) {
    const { x: originX, y } = origin;
    const { leftTop, rightTop, rightMiddle } = this.fixedDimensions;
    const spoW = getSpoValue(this.spoFields[0], spoValues);
    const components: ComponentSpec[] = [];
    const dimensions: DimensionRequest[] = [];
    const bottomY = y + Math.max(1, totalHeight);

    // 4 real pipes: left outer edge, left column|SPO, SPO|right column, right outer edge
    // — matches the user's own confirmed reference drawing exactly.
    let x = pushPipe(components, { x: originX, y, totalHeight });
    const afterLeft = pushFixedCell(components, dimensions, { x, y, width: normalColumnWidth, height: leftTop, edge: 'left', color: TROLLEY_COLOR, formula: `5P-CSPO fixed — left top box = ${leftTop}mm` });
    pushEmptyBox(components, { x, y: afterLeft, width: normalColumnWidth, bottomY, note: 'Empty Box below the 220mm fixed box — height not yet defined.' });

    const midX = pushPipe(components, { x: x + normalColumnWidth, y, totalHeight });
    pushSpoColumn(components, dimensions, { x: midX, y, width: spoW, totalHeight, bottomLabelY: bottomY + 30, formula: `5P-CSPO — center SPO Width (editable, default 200mm, range 200-300) = ${spoW}mm` });

    const rightX = pushPipe(components, { x: midX + spoW, y, totalHeight });
    let ry = pushFixedCell(components, dimensions, { x: rightX, y, width: normalColumnWidth, height: rightTop, edge: 'right', color: TROLLEY_COLOR, formula: `5P-CSPO fixed — right top box = ${rightTop}mm` });
    ry = pushFixedCell(components, dimensions, { x: rightX, y: ry, width: normalColumnWidth, height: rightMiddle, edge: 'right', color: TROLLEY_COLOR, formula: `5P-CSPO fixed — right middle box = ${rightMiddle}mm` });
    pushEmptyBox(components, { x: rightX, y: ry, width: normalColumnWidth, bottomY, note: 'Empty Box below the 130+200mm fixed boxes — height not yet defined.' });
    pushPipe(components, { x: rightX + normalColumnWidth, y, totalHeight });

    return { components, dimensions, lines: [innerTrolleyTitleLine(originX, y)] };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. 5P-LSPO — 3 columns, SPO on the LEFT (full height, editable Width).
//    Middle: fixed 220mm box + Empty Box below. Right: fixed 130mm +
//    fixed 200mm stacked + Empty Box below.
// ─────────────────────────────────────────────────────────────────────────────
const fivePanelLspo: TrolleyTemplate = {
  id: '5p-lspo',
  name: '5P-LSPO',
  fixedDimensions: { middleTop: 220, rightTop: 130, rightMiddle: 200 },
  spoFields: [{ key: 'spo', label: 'SPO Width/Breadth', default: 200 }],
  pipeCount: 4,
  normalColumnCount: 2,
  buildOuterPanel: (origin, w, h) => buildSimpleOuterPanel('5P-LSPO', origin, w, h),
  buildInnerTrolley(origin, spoValues, totalHeight, normalColumnWidth) {
    const { x: originX, y } = origin;
    const { middleTop, rightTop, rightMiddle } = this.fixedDimensions;
    const spoW = getSpoValue(this.spoFields[0], spoValues);
    const components: ComponentSpec[] = [];
    const dimensions: DimensionRequest[] = [];
    const bottomY = y + Math.max(1, totalHeight);

    // 4 real pipes: left outer edge, SPO|middle boundary, middle|right boundary, right outer edge.
    let x = pushPipe(components, { x: originX, y, totalHeight });
    pushSpoColumn(components, dimensions, { x, y, width: spoW, totalHeight, bottomLabelY: bottomY + 30, formula: `5P-LSPO — SPO Width (editable, default 200mm) = ${spoW}mm` });

    const midX = pushPipe(components, { x: x + spoW, y, totalHeight });
    const afterMid = pushFixedCell(components, dimensions, { x: midX, y, width: normalColumnWidth, height: middleTop, edge: 'left', color: TROLLEY_COLOR, formula: `5P-LSPO fixed — middle top box = ${middleTop}mm` });
    pushEmptyBox(components, { x: midX, y: afterMid, width: normalColumnWidth, bottomY, note: 'Empty Box below the 220mm fixed box — height not yet defined.' });

    const rightX = pushPipe(components, { x: midX + normalColumnWidth, y, totalHeight });
    let ry = pushFixedCell(components, dimensions, { x: rightX, y, width: normalColumnWidth, height: rightTop, edge: 'right', color: TROLLEY_COLOR, formula: `5P-LSPO fixed — right top box = ${rightTop}mm` });
    ry = pushFixedCell(components, dimensions, { x: rightX, y: ry, width: normalColumnWidth, height: rightMiddle, edge: 'right', color: TROLLEY_COLOR, formula: `5P-LSPO fixed — right middle box = ${rightMiddle}mm` });
    pushEmptyBox(components, { x: rightX, y: ry, width: normalColumnWidth, bottomY, note: 'Empty Box below the 130+200mm fixed boxes — height not yet defined.' });
    pushPipe(components, { x: rightX + normalColumnWidth, y, totalHeight });

    return { components, dimensions, lines: [innerTrolleyTitleLine(originX, y)] };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 9. 4 Panel Only Trolley — INCOMPLETE STUB. The user's own reference sketch
//    has NO numeric labels at all. Deliberately left with zero fixed
//    dimensions until the user gives real values or confirms it's fully
//    proportional — per explicit instruction, do not guess or invent, and
//    do not assume it shares 7P/5P-Only's fixed-value style.
// ─────────────────────────────────────────────────────────────────────────────
const fourPanelOnly: TrolleyTemplate = {
  id: '4p-only',
  name: '4 Panel Only Trolley',
  fixedDimensions: {},
  spoFields: [],
  pipeCount: 3,
  normalColumnCount: 2,
  incomplete: true,
  buildOuterPanel: (origin, w, h) => buildSimpleOuterPanel('4 Panel Only Trolley (incomplete)', origin, w, h),
  buildInnerTrolley(origin) {
    const { x, y } = origin;
    return {
      components: [{
        id: nextId('trolley-inner-incomplete'), type: 'TROLLEY_INNER_DETAIL',
        label: '4 Panel Only Trolley\n— dimensions not yet provided —',
        x, y, width: COL_W * 2, height: 300, qty: 1, visible: true,
        source: { formula: 'No fixed dimensions supplied yet for this trolley template', constants: [], needsVerification: true, note: 'Awaiting real measurements or a "fully proportional" confirmation from the user.' },
      }],
      dimensions: [],
      lines: [innerTrolleyTitleLine(x, y)],
    };
  },
};

export const TROLLEY_TEMPLATES: Record<string, TrolleyTemplate> = {
  '7p-only': sevenPanelOnly,
  '5p-only': fivePanelOnly,
  '2p-rspo': twoPanelRspo,
  '2p-lspo': twoPanelLspo,
  '3p-rspo': threePanelRspo,
  '3p-lspo': threePanelLspo,
  '5p-cspo': fivePanelCspo,
  '5p-lspo': fivePanelLspo,
  '4p-only': fourPanelOnly,
};

export function getTrolleyTemplate(id: string | null | undefined): TrolleyTemplate | null {
  if (!id) return null;
  return TROLLEY_TEMPLATES[id] ?? null;
}

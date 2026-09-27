import type { AnnotationLine, ComponentSpec, ValidationIssue } from '../../engine/types';
import { placeNoteBoxes, type CalloutRequest } from '../../engine/noteBoxPlacement';
import type { DimensionRequest } from '../../engine/dimensionEngine';
import type { KitchenWallConfig } from '../../store/types';
import { getTrolleyTemplate, calculateNormalColumnWidth } from './trolleyTemplates';
import { calculateTrolleyDimensions } from './trolleyDimensions';
import { calculateTrolleyPanels } from './trolleyPanelCalc';
import { calculateSideSectionDoors } from './sideSectionDoorCalc';

// ─────────────────────────────────────────────────────────────────────────────
// Kitchen Wall Engine — the reusable "resolve ONE wall's full layout" core
// extracted from what used to be the I-Shape-only geometry file. This is the
// I-Shape engine's own SOURCE OF TRUTH for every kitchen wall rule (Kadappa,
// Clear Width, Trolley, Trolley Panel, Side Section Doors, Fix Patti,
// dimension/label conventions, validation) — L-Shape's Wall A and Wall B
// each call this SAME function independently; nothing here is duplicated or
// reinvented per shape.
//
// resolveKitchenWall works ENTIRELY in its own LOCAL frame: local (0,0) is
// this wall's own top-left starting corner, and it always lays itself out
// left-to-right exactly as I-Shape always has. It has NO knowledge of where
// it will ultimately be positioned/oriented in a real drawing (a fixed
// origin for a standalone I-Shape kitchen, or rotated 90° onto an L-Shape
// corner) — that transform is applied entirely afterward, by
// rotateWallOutput below, over this function's already-finished output.
// This keeps the (considerable) Kadappa/Trolley/Door layout logic exactly
// as-is, with zero coordinate-math changes, while still allowing it to be
// reused for a rotated wall.
// ─────────────────────────────────────────────────────────────────────────────

/** A short "/" diagonal drawn INSIDE a component's own top-left corner —
 * same convention as every other product in this engine (Wardrobe/Bed/Side
 * Table/etc.'s own `insideDiagonal`), used here to show Kitchen Depth and
 * Trolley Depth, neither of which had any on-drawing representation before. */
function insideDiagonal(cornerX: number, cornerY: number, w: number, h: number) {
  const insetX = Math.min(w * 0.18, 70);
  const insetY = Math.min(h * 0.18, 70);
  return { x2: cornerX + insetX, y2: cornerY + insetY };
}

const PANI_PATTI_COLOR = '#7c3aed';
const KADAPPA_COLOR = '#0284c7';
const CLEAR_COLOR = '#059669';
const TOTAL_COLOR = '#dc2626';
const TROLLEY_DIM_COLOR = '#b45309';
const TROLLEY_PANEL_COLOR = '#15803d';
const SIDE_DOOR_COLOR = '#0891b2';
const FIX_PATTI_COLOR = '#16a34a';
// Visual gap drawn between adjacent Trolley Panel columns — a plain layout
// constant for the panel drawing only, unrelated to any Inner Trolley pipe
// width/deduction.
const PANEL_PIPE_GAP_MM = 4;

export interface KadappaSlot {
  letter: string;
  kind: 'wall-left' | 'inner' | 'wall-right';
  /** This Kadappa's own physical Width (mm) — never a distance. */
  width: number;
  innerIndex?: number;
}

/**
 * Left-to-right physical Kadappa sequence with sequential letters — the
 * single source of truth for Kadappa naming (A = Left Wall, then Inner
 * Kadappas B, C, ..., then the Right Wall Kadappa takes the next letter),
 * shared by this engine AND KitchenFlow.tsx's Step 3 (which needs the same
 * sequence to know how many per-slot width inputs to render, in the same
 * order). A component that does not exist gets no slot and no letter —
 * letters are never reserved/skipped for a missing component (§18).
 */
export function buildKadappaSequence(iShape: KitchenWallConfig): KadappaSlot[] {
  const slots: KadappaSlot[] = [];
  if (iShape.wallSideKadappa === 'Left' || iShape.wallSideKadappa === 'Both') {
    slots.push({ kind: 'wall-left', letter: '', width: iShape.leftWallKadappaWidth });
  }
  if (iShape.hasInnerKadappa) {
    for (let i = 0; i < iShape.innerKadappaCount; i++) {
      slots.push({ kind: 'inner', letter: '', width: iShape.innerKadappaWidths[i] ?? 0, innerIndex: i });
    }
  }
  if (iShape.wallSideKadappa === 'Right' || iShape.wallSideKadappa === 'Both') {
    slots.push({ kind: 'wall-right', letter: '', width: iShape.rightWallKadappaWidth });
  }
  slots.forEach((s, i) => { s.letter = String.fromCharCode(65 + i); }); // A, B, C, D...
  return slots;
}

export interface ClearSegment {
  /** Index into iShape.clearWidths — the single source of truth for how
   * many segments exist and in what order, kept in sync by the wizard
   * whenever the Kadappa configuration changes. */
  index: number;
  /** Human label, e.g. "Wall → A", "A → B", "C → Wall". */
  label: string;
  /** Letter of the component immediately to the left of this segment, or
   * null when the segment starts at the actual left room wall. */
  fromLetter: string | null;
  /** Letter of the component immediately to the right of this segment, or
   * null when the segment ends at the actual right room wall. */
  toLetter: string | null;
}

/**
 * Builds the ordered list of Clear-Width segments for the given Kadappa
 * sequence — one segment for every gap between consecutive physical
 * boundaries (§9-§17): a wall with no Kadappa contributes a leading/
 * trailing Wall→component segment; a wall WITH a Kadappa does not (the
 * Kadappa sits flush against it); every pair of consecutive Kadappa
 * contributes exactly one segment between them.
 */
export function buildClearSegments(iShape: KitchenWallConfig, sequence: KadappaSlot[]): ClearSegment[] {
  const segments: ClearSegment[] = [];
  let idx = 0;

  const hasLeftWallKadappa = sequence.length > 0 && sequence[0].kind === 'wall-left';
  const hasRightWallKadappa = sequence.length > 0 && sequence[sequence.length - 1].kind === 'wall-right';

  if (sequence.length === 0) {
    // No Kadappa anywhere — a single Wall→Wall Clear Width (§10).
    segments.push({ index: idx++, label: 'Wall → Wall (Clear Width)', fromLetter: null, toLetter: null });
    return segments;
  }

  // Leading segment: Left Wall → first component, ONLY if the first
  // component is not itself the Left Wall Kadappa (§11 vs §12/§14).
  if (!hasLeftWallKadappa) {
    segments.push({ index: idx++, label: `Wall → ${sequence[0].letter}`, fromLetter: null, toLetter: sequence[0].letter });
  }

  // Between every consecutive pair of components.
  for (let i = 0; i < sequence.length - 1; i++) {
    segments.push({ index: idx++, label: `${sequence[i].letter} → ${sequence[i + 1].letter}`, fromLetter: sequence[i].letter, toLetter: sequence[i + 1].letter });
  }

  // Trailing segment: last component → Right Wall, ONLY if the last
  // component is not itself the Right Wall Kadappa.
  if (!hasRightWallKadappa) {
    const last = sequence[sequence.length - 1];
    segments.push({ index: idx++, label: `${last.letter} → Wall`, fromLetter: last.letter, toLetter: null });
  }

  return segments;
}

/**
 * The Trolley Section a User must explicitly choose — every ClearSegment
 * IS a candidate Kitchen "section" per this spec's §2/§26 definition (the
 * open space between two consecutive physical boundaries). Resolves to:
 *   - iShape.trolleySectionId, if it still names a real, currently-valid
 *     segment (the Kadappa configuration may have changed since it was
 *     picked — an index that no longer exists is treated as unselected).
 *   - the ONLY segment, when exactly one exists (no real ambiguity —
 *     §30 permits auto-selecting this case).
 *   - null otherwise (multiple sections exist and none has been picked —
 *     §29/§31/§32: never guess).
 */
export function resolveTrolleySectionId(iShape: KitchenWallConfig, clearSegments: ClearSegment[]): number | null {
  if (clearSegments.length === 0) return null;
  if (clearSegments.length === 1) return clearSegments[0].index;
  const picked = iShape.trolleySectionId;
  if (picked !== null && clearSegments.some((seg) => seg.index === picked)) return picked;
  return null;
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

const INNER_TROLLEY_GAP = 220; // real vertical clearance below the whole main drawing

export interface ResolvedWallLocal {
  components: ComponentSpec[];
  dimensionRequests: DimensionRequest[];
  lines: AnnotationLine[];
  calloutRequests: CalloutRequest[];
  issues: ValidationIssue[];
  /** Real local extent this wall's own content occupies (post-layout,
   * pre-translation) — for corner + merge math. */
  bounds: { left: number; top: number; right: number; bottom: number };
  /** This wall's own two physical ends, in ITS OWN local frame. Always
   * (0, rowCenterY) and (localWidth, rowCenterY) since resolveKitchenWall
   * always lays itself out left-to-right starting at local x=0. */
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
}

export interface KitchenWallDrawingInputs {
  iShape: KitchenWallConfig;
}

/**
 * Resolves ONE kitchen wall's complete local layout — Kadappa, Clear Width,
 * Trolley (template/panel), Side Section Doors, Fix Patti, Pani Patti,
 * dimensions, and validation. Always works in its own local coordinate
 * frame starting at local (0, 0); never positioned/rotated here (see
 * rotateWallOutput below) — this is a pure function of `wallConfig` alone.
 *
 * `issuePrefix` is prepended to every validation message (e.g. "Wall A: ")
 * — empty string for a standalone I-Shape kitchen (single wall, no prefix
 * needed) so its existing issue text stays byte-identical.
 *
 * `cornerEnd` names which of THIS wall's own local ends (if any) is an
 * L-Shape corner — suppresses that one end's Side-Section-Door eligibility
 * (a real room wall's corner never gets a door; see sideSectionDoorCalc
 * usage below). `null` (the default, used by I-Shape) leaves both ends'
 * door eligibility exactly as before this parameter existed.
 */
export function resolveKitchenWall(
  iShape: KitchenWallConfig,
  issuePrefix: string = '',
  cornerEnd: 'left' | 'right' | null = null,
  /** Overrides where the Inner Trolley detail drawing is placed, in THIS
   * wall's own local coordinates — null (the default, used by I-Shape) means
   * "directly below my own main drawing" (this wall's existing, unchanged
   * behavior). L-Shape passes an explicit origin instead, because after two
   * walls are merged and one is rotated 90° onto a shared corner, a wall's
   * own "space below my own main drawing" can land on top of the OTHER
   * wall's now-perpendicular body — there is no single fixed local offset
   * that is guaranteed clear post-merge, so the L-Shape resolver computes a
   * real shared free-space origin only once both walls' final on-canvas
   * extents are known, and hands it in here. */
  innerTrolleyOriginOverride: { x: number; y: number } | null = null,
): ResolvedWallLocal {
  const prefix = issuePrefix ? `${issuePrefix}: ` : '';
  const leaderMargin = 60;

  // The Trolley Panel (see calculateTrolleyPanels below) is correctly
  // WIDER than the section bay it's centered on — confirmed by the user:
  // its side-panel formula deliberately adds back the neighbouring Kadappa
  // Width, so the panel visually extends out over the Kadappa beside it
  // (matching real cabinetry, which sits flush against/over the adjacent
  // Kadappa box) rather than being shrunk to fit inside the open gap
  // alone. That means it can extend to the LEFT of the kitchen's own left
  // edge — extra left margin must be reserved up front so that never goes
  // negative (a negative X is off-canvas, not just "extending outward").
  // Computed via a provisional pass at margin=leaderMargin, since the
  // panel's own column widths don't depend on kitchenX at all — only its
  // final on-canvas position does.
  const extraLeftMarginForPanel = (() => {
    if (!iShape.trolleyTemplateId) return 0;
    const template = getTrolleyTemplate(iShape.trolleyTemplateId);
    if (!template || template.incomplete) return 0;
    const provisionalSequence = buildKadappaSequence(iShape);
    const provisionalClearSegments = buildClearSegments(iShape, provisionalSequence);
    const provisionalSectionId = resolveTrolleySectionId(iShape, provisionalClearSegments);
    const provisionalSection = provisionalClearSegments.find((seg) => seg.index === provisionalSectionId) ?? null;
    if (!provisionalSection) return 0;
    const provisionalDims = calculateTrolleyDimensions(iShape, provisionalSection);
    const panelResult = calculateTrolleyPanels(iShape, template, provisionalSequence, provisionalSection, provisionalDims);
    if (!panelResult.valid || panelResult.columns.length === 0) return 0;
    const totalPanelWidth = panelResult.columns.reduce((sum, c) => sum + c.width, 0) + Math.max(0, panelResult.columns.length - 1) * PANEL_PIPE_GAP_MM;
    // Mirrors the real centering formula below exactly, but only needs the
    // bay's WIDTH (not its absolute X) to know how far left of the bay's
    // own left edge the centered block would start.
    const provisionalBayWidth = Math.max(1, iShape.clearWidths[provisionalSection.index] ?? 1);
    const overshootLeft = Math.max(0, (totalPanelWidth - provisionalBayWidth) / 2);
    return overshootLeft;
  })();
  // Fix Patti — a real vertical panel attached to the OUTSIDE of the
  // kitchen box, on the chosen side(s). A Left/Both Fix Patti sits fully
  // to the left of the kitchen's own left edge, so its own Width must be
  // reserved as extra left margin up front (same reasoning as the Trolley
  // Panel's own margin above) — otherwise it would draw at a negative,
  // off-canvas X.
  const fixPattiLeftActive = iShape.fixPattiPosition === 'left' || iShape.fixPattiPosition === 'both';
  const fixPattiRightActive = iShape.fixPattiPosition === 'right' || iShape.fixPattiPosition === 'both';
  const fixPattiLeftW = fixPattiLeftActive ? Math.max(1, iShape.fixPattiLeftWidth || 40) : 0;
  const fixPattiRightW = fixPattiRightActive ? Math.max(1, iShape.fixPattiRightWidth || 40) : 0;
  const kitchenX = leaderMargin + extraLeftMarginForPanel + fixPattiLeftW;
  const kitchenY = 90; // room above for the Pani Patti's own leader label

  const components: ComponentSpec[] = [];
  const dimReqs: DimensionRequest[] = [];
  const lines: AnnotationLine[] = [];
  const calloutRequests: CalloutRequest[] = [];
  const issues: ValidationIssue[] = [];

  const sequence = buildKadappaSequence(iShape);
  const clearSegments = buildClearSegments(iShape, sequence);

  const paniPattiWidth = iShape.width;
  const paniPattiH = Math.max(1, iShape.paniPattiHeight);
  const kadappaY = kitchenY + paniPattiH;
  const kadappaH = Math.max(1, iShape.height);
  const kitchenBottomY = kadappaY + kadappaH;
  // Per the user's explicit correction: every "Width on top" plain-text
  // label (Kadappa Width, Trolley Panel Width, Door Width) must sit
  // clearly ABOVE the Pani Patti bar, never inside/overlapping it — Pani
  // Patti's own box spans kitchenY..kadappaY, so this tier sits just above
  // its own top edge. Total Kitchen Width (a separate, outermost
  // dimension) sits one tier further up still, so the two never collide.
  const widthLabelAboveY = kitchenY - 12;
  const totalWidthY = kitchenY - 32;

  // Kitchen Depth — "/" diagonal leader at the Kitchen box's own top-left
  // corner, same convention as every other product's Depth diagonal
  // (Wardrobe/Bed/Side Table/etc.) — the only representation of Depth on
  // this drawing, since Depth runs front-to-back and can't be a straight
  // dimension in a plan view.
  {
    const diag = insideDiagonal(kitchenX, kitchenY, Math.max(1, iShape.width), Math.max(1, paniPattiH + kadappaH));
    lines.push({ x1: kitchenX, y1: kitchenY, x2: diag.x2, y2: diag.y2, color: TOTAL_COLOR, label: `${Math.round(iShape.depth)} mm (D)` });
  }

  // ── Real component boundaries — the SAME positions drive the drawing,
  // the dimensions, and (via the returned ResolvedDrawing) the PDF, per
  // "drawing and measurement must come from the same model" (§43 / the
  // Kadappa-position-fix spec's §24).
  //
  // WALL SIDE Kadappa are ANCHORED to the Kitchen's own outer edges —
  // never positioned by walking the manual clear-width chain, which can
  // drift away from the wall if the entered clear widths don't happen to
  // sum exactly to the remaining space (this was the reported bug: a
  // Right Wall Kadappa floating with a large unwanted gap before the
  // actual kitchen wall). Only INNER Kadappa are positioned by walking
  // the manual clear-width chain from the left anchor.
  const kitchenRightX = kitchenX + Math.max(1, iShape.width);
  const componentLeftX: number[] = new Array(sequence.length);
  const componentRightX: number[] = new Array(sequence.length);
  {
    let cursor = kitchenX;
    let segIdx = 0;
    const hasLeftWallKadappa = sequence.length > 0 && sequence[0].kind === 'wall-left';
    if (sequence.length > 0 && !hasLeftWallKadappa) {
      cursor += Math.max(0, iShape.clearWidths[segIdx] ?? 0);
      segIdx++;
    }
    // Walk every component EXCEPT a trailing wall-right slot (handled
    // separately below, anchored to the wall instead of the cursor).
    const walkCount = sequence.length > 0 && sequence[sequence.length - 1].kind === 'wall-right'
      ? sequence.length - 1
      : sequence.length;
    for (let i = 0; i < walkCount; i++) {
      componentLeftX[i] = cursor;
      cursor += Math.max(0, sequence[i].width);
      componentRightX[i] = cursor;
      if (i < sequence.length - 1) {
        cursor += Math.max(0, iShape.clearWidths[segIdx] ?? 0);
        segIdx++;
      }
    }
    // Right Wall Kadappa — ALWAYS flush against the kitchen's real right
    // edge, regardless of where the cumulative clear-width walk landed.
    if (sequence.length > 0 && sequence[sequence.length - 1].kind === 'wall-right') {
      const lastIdx = sequence.length - 1;
      componentRightX[lastIdx] = kitchenRightX;
      componentLeftX[lastIdx] = kitchenRightX - Math.max(0, sequence[lastIdx].width);
    }
  }
  const lastComponentRight = componentRightX.length > 0 ? componentRightX[componentRightX.length - 1] : kitchenX;
  const totalComponentSpan = sequence.length > 0 ? lastComponentRight - kitchenX : Math.max(0, iShape.clearWidths[0] ?? 0);

  // ONE single kitchen body rectangle spanning the full entered Total
  // Kitchen Width/Height — never replaced by the clear/derived span.
  components.push({
    id: 'kitchen-body', type: 'KITCHEN_BODY', label: '',
    x: kitchenX, y: kadappaY, width: Math.max(1, iShape.width), height: kadappaH, qty: 1, visible: true,
    source: { formula: 'Kitchen body = Total Kitchen Width × Total Kitchen Height (entered)', constants: [] },
  });

  // Fix Patti — a real vertical panel attached to the OUTSIDE of the
  // kitchen box on the chosen side(s), per the user's explicit spec:
  // Height defaults to Total Kitchen Height, Width defaults to 40mm, both
  // manually entered/editable, never derived. Bottom-aligned with the
  // kitchen floor (a real fixed panel standing on the same floor line),
  // its own top edge free to sit above/below Pani Patti depending on its
  // own entered Height relative to the kitchen's.
  const drawFixPatti = (side: 'left' | 'right') => {
    const width = side === 'left' ? fixPattiLeftW : fixPattiRightW;
    const enteredHeight = side === 'left' ? iShape.fixPattiLeftHeight : iShape.fixPattiRightHeight;
    const height = Math.max(1, enteredHeight || iShape.height);
    const x = side === 'left' ? kitchenX - width : kitchenRightX;
    const y = kitchenBottomY - height;
    const id = `fix-patti-${side}`;
    components.push({
      id, type: 'FIX_PATTI', label: '',
      x, y, width, height, qty: 1, visible: true,
      source: { formula: `Fix Patti (${side === 'left' ? 'Left' : 'Right'}) — Height × Width both entered (default Height = Total Kitchen Height, default Width = 40mm) = ${Math.round(height)} × ${Math.round(width)}mm`, constants: [] },
    });
    // No name/measurement text drawn ON or INSIDE the box itself — per
    // the user's explicit correction, Fix Patti is indicated ONLY by a
    // real leader arrow ("------>") pointing at the box, ending in a
    // small callout box that carries the name "Fix Patti" and its own
    // H × W — same collision-free leader/callout mechanism every other
    // small component in this drawing already uses (placeNoteBoxes).
    calloutRequests.push({
      id, componentBounds: { x, y, w: width, h: height },
      title: 'Fix Patti',
      lines: [`H: ${Math.round(height)}mm`, `W: ${Math.round(width)}mm`],
      color: FIX_PATTI_COLOR,
    });
  };
  if (fixPattiLeftActive) drawFixPatti('left');
  if (fixPattiRightActive) drawFixPatti('right');

  // Pani Patti — thin bar spanning the full kitchen width, drawn regardless
  // of Kadappa configuration. Width always equals Total Kitchen Width.
  components.push({
    id: 'pani-patti', type: 'PANI_PATTI', label: '',
    x: kitchenX, y: kitchenY, width: Math.max(1, paniPattiWidth), height: paniPattiH, qty: 1, visible: true,
    source: { formula: 'Pani Patti Width = Total Kitchen Width (always, never independently entered); Height = entered Pani Patti Height', constants: [] },
  });
  // (The old vertical/diagonal "Pani Patti" leader that used to live here
  // is removed — per the user's explicit correction, Pani Patti gets
  // exactly ONE label: the plain horizontal "Pani Patti <H>mm" text
  // pushed further down, next to its own box — never a second, rotated
  // leader duplicating the same name.)

  // Trolley's Outer Panel fills the USER-SELECTED section only — never
  // assumed. `resolveTrolleySectionId` auto-resolves ONLY when exactly
  // one section exists (no real ambiguity); otherwise the user's explicit
  // iShape.trolleySectionId is required.
  //
  // The panel drawn INSIDE the kitchen section shows the trolley's real
  // internal structure (same layout as the separate Inner Trolley detail
  // drawing below) via buildInnerTrolley — but with its dimension lines
  // stripped (components only): the section copy is a structural preview,
  // never a second, possibly-conflicting source of the trolley's own
  // measurements (those stay on the Inner Trolley detail drawing and the
  // Trolley Dimensions panel). Bottom-aligned to the section (a trolley
  // sits on the floor), never stretched to the full Kitchen Height.
  const trolleyTemplate = getTrolleyTemplate(iShape.trolleyTemplateId);
  const resolvedSectionId = resolveTrolleySectionId(iShape, clearSegments);
  const resolvedSectionForOuterPanel = clearSegments.find((seg) => seg.index === resolvedSectionId) ?? null;
  const outerPanelTrolleyDims = calculateTrolleyDimensions(iShape, resolvedSectionForOuterPanel);
  if (iShape.trolleyTemplateId && !trolleyTemplate) {
    issues.push({ id: nextId('val'), severity: 'CRITICAL' as const, code: 'UNKNOWN_TROLLEY_TEMPLATE', message: `${prefix}Selected Trolley Type "${iShape.trolleyTemplateId}" has no matching template.` });
  } else if (trolleyTemplate) {
    const section = clearSegments.find((seg) => seg.index === resolvedSectionId);
    if (!section) {
      issues.push({
        id: nextId('val'), severity: 'CRITICAL' as const, code: 'TROLLEY_SECTION_NOT_SELECTED',
        message: clearSegments.length > 1
          ? `${prefix}Please select the Kitchen section where the Trolley will be installed.`
          : `${prefix}No open Kitchen section is available to place the Trolley in.`,
      });
    } else {
      const bayX = section.fromLetter ? componentRightX[sequence.findIndex((s) => s.letter === section.fromLetter)] : kitchenX;
      const bayRight = section.toLetter ? componentLeftX[sequence.findIndex((s) => s.letter === section.toLetter)] : kitchenX + iShape.width;
      const bayWidth = Math.max(1, bayRight - bayX);
      if (trolleyTemplate.incomplete) {
        const built = trolleyTemplate.buildOuterPanel({ x: bayX, y: kadappaY }, bayWidth, kadappaH);
        components.push(...built.components);
      } else {
        // TROLLEY PANELS — a second, independent geometry layer from the
        // Inner Trolley (never mutates its H×W×D). Each column's own
        // calculated Panel Width/Height controls the actual drawn
        // rectangle, laid out left-to-right as a block centered in the
        // section bay. Per the user's own explicit confirmation, the
        // panel's real formula width (side columns adding back Outer
        // Pipe + Inner Pipe Allowance + Side Recovery + Kadappa) is
        // CORRECT and is allowed to be wider than the section's own Clear
        // Width — it's meant to visually extend out over the Kadappa
        // beside it, matching real cabinetry. The real formula value is
        // always shown and drawn, NEVER scaled down to force-fit the bay
        // (an earlier version of this did that; the user reversed it once
        // they confirmed the wider number was the correct one).
        // The panel's own segments are sized against the FULL Kitchen
        // Height — no gap is reserved below Pani Patti (per the user's
        // explicit correction reversing the earlier top-gap fix); the
        // panel sits flush with Pani Patti above and the kitchen floor
        // below, same as the plain Kadappa boxes beside it.
        const panelResult = calculateTrolleyPanels(iShape, trolleyTemplate, sequence, section, outerPanelTrolleyDims);
        if (!panelResult.valid) {
          issues.push({ id: nextId('val'), severity: 'WARNING' as const, code: 'TROLLEY_PANEL_INVALID', message: `${prefix}${panelResult.invalidReason ?? 'Trolley Panel geometry is invalid.'}` });
        }
        const totalPanelWidth = panelResult.columns.reduce((sum, c) => sum + c.width, 0) + Math.max(0, panelResult.columns.length - 1) * PANEL_PIPE_GAP_MM;
        let colX = bayX + (bayWidth - totalPanelWidth) / 2;
        const panelBottomY = kadappaY + kadappaH;
        const colBottomAlignShift = Math.max(0, kadappaH - panelResult.kitchenHeight);
        const colTopY = kadappaY + colBottomAlignShift;
        // Templates with NO center column at all (e.g. 4P-Only — just two
        // side columns) draw BOTH side columns as real bordered boxes,
        // per the user's explicit correction — the Trolley Panel should
        // look like the real Trolley (Inner Trolley) drawing, including
        // the vertical pipe line dividing the two columns, which only
        // exists as a byproduct of each column having its own real
        // border. Templates that DO have a center column (7P-Only,
        // 5P-CSPO, 5P-LSPO) keep the original rule: only the center
        // column is bordered, sides stay plain text.
        const hasCenterColumn = panelResult.columns.some((c) => c.side === 'center');

        panelResult.columns.forEach((col, colDrawIdx) => {
          const isFirstDrawnColumn = colDrawIdx === 0;
          const isLastDrawnColumn = colDrawIdx === panelResult.columns.length - 1;
          // The real, unscaled formula width — ALWAYS what the dimension
          // label shows (never altered), regardless of how the box itself
          // is clipped below.
          const colWidth = col.width;
          // The panel's own formula is deliberately wider than the section
          // bay (it recovers the neighbouring Kadappa's width, confirmed
          // correct) — but per the user's explicit correction, the DRAWN
          // box for the column that is genuinely FIRST/LAST in the row
          // (the one bordering the outer Kadappa) must never visually
          // extend past that Kadappa's own line: Kadappa is the real
          // physical boundary of the Trolley opening, and drawing the
          // panel's box past it produced a visible second/duplicate
          // boundary line right next to the Kadappa's own line. Clipped to
          // the section's own real bay bounds (bayX..bayRight) — same
          // "only first/last column, never by the template's own internal
          // 'left'/'right' naming" rule the internal pipe divider below
          // already uses (a template like 5P-LSPO has its 'left' column
          // sitting in the MIDDLE of the row, so clipping it against bayX
          // would wrongly cut it against nothing). This ONLY changes where
          // the box is drawn — colWidth (the real formula value shown in
          // every label) is completely untouched, and the column's own
          // logical geometry (segments, colX advance for the NEXT column)
          // still uses the real unclipped colWidth so nothing downstream
          // drifts out of sync.
          const drawnX = isFirstDrawnColumn ? Math.max(colX, bayX) : colX;
          const drawnRight = isLastDrawnColumn ? Math.min(colX + colWidth, bayRight) : colX + colWidth;
          const drawnColWidth = Math.max(1, drawnRight - drawnX);
          if (col.isSpo) {
            const seg = col.segments[0];
            const id = nextId('trolley-panel-spo');
            // The SPO box is drawn at the FULL row height (flush with
            // Pani Patti above and the kitchen floor below, zero gap
            // anywhere) — per the user's explicit instruction, same
            // flush-fit convention as the Side Section Door. Its own real
            // calculated Height (Kitchen Height − 15mm SPO allowance)
            // stays the value shown in the label/formula below; only the
            // DRAWN box is stretched to fill the row, not the number.
            const drawnHeight = Math.max(1, kadappaH);
            components.push({
              id, type: 'TROLLEY_PANEL_SPO', label: '',
              x: drawnX, y: colTopY, width: drawnColWidth, height: drawnHeight, qty: 1, visible: true,
              source: { formula: `Trolley Panel SPO — Width = template SPO Width (unchanged) = ${Math.round(col.width)}mm; Height = Kitchen Height − SPO panel allowance = ${Math.round(seg.height)}mm`, constants: [] },
            });
            // Width shown once as plain text ABOVE Pani Patti (never
            // inside/overlapping it — every box in an SPO column is really
            // just the one box, but the label convention matches every
            // other column: a single top-of-column width callout, never a
            // dimension arrow) — per the user's explicit correction.
            // Height shown as plain text ("200(h)") at the box's own
            // centre — a zero-length AnnotationLine (no visible
            // tick/line, per the user's explicit correction), text only.
            // The real calculated Height value (seg.height) is what's
            // shown, even though the box itself is drawn taller. Labels
            // stay centred on the REAL unclipped column span (colX/colWidth)
            // so they never shift off-centre just because the box's own
            // drawn edge was clipped.
            lines.push({ x1: colX + colWidth / 2, y1: widthLabelAboveY, x2: colX + colWidth / 2, y2: widthLabelAboveY, color: TROLLEY_PANEL_COLOR, label: `${Math.round(colWidth)}(W)` });
            {
              const midY = colTopY + drawnHeight / 2;
              lines.push({ x1: colX + colWidth / 2, y1: midY, x2: colX + colWidth / 2, y2: midY, color: TROLLEY_PANEL_COLOR, label: `${Math.round(seg.height)}(h)` });
            }
          } else if (col.side === 'center' || !hasCenterColumn) {
            // Center column — real bordered boxes, one per segment, per
            // the user's own reference sketch (only the center column
            // shows its actual box structure when a template HAS one; the
            // side columns don't). When a template has NO center column
            // at all (e.g. 4P-Only), every side column is drawn this same
            // bordered way instead, per the user's explicit correction —
            // the Trolley Panel should look like the real Trolley (Inner
            // Trolley) drawing, including the vertical pipe line that
            // naturally divides two bordered boxes sitting next to each
            // other.
            col.segments.forEach((seg) => {
              const id = nextId('trolley-panel');
              components.push({
                id, type: 'TROLLEY_PANEL', label: `${Math.round(seg.height)}(h)`,
                x: drawnX, y: colTopY + seg.y, width: drawnColWidth, height: Math.max(1, seg.height), qty: 1, visible: true,
                source: {
                  formula: seg.kind === 'top'
                    ? `Trolley Panel ${seg.label} = source trolley box height + top allowance + Pani Patti Height = ${Math.round(seg.height)}mm`
                    : seg.kind === 'fixed'
                      ? `Trolley Panel ${seg.label} — template fixed height = ${Math.round(seg.height)}mm`
                      : `Trolley Panel ${seg.label} = Kitchen Total Height − everything above it in this column = ${Math.round(seg.height)}mm`,
                  constants: [],
                  fixed: seg.kind === 'fixed',
                },
              });
            });
            // Width shown ONCE as plain text ABOVE Pani Patti — every box
            // in the column shares the same calculated width, so one
            // label covers the whole column, never a per-box arrow.
            // Height shown as plain in-box text on each segment's own
            // component (above), no dimension line/tick.
            lines.push({
              x1: colX + colWidth / 2, y1: widthLabelAboveY, x2: colX + colWidth / 2, y2: widthLabelAboveY,
              color: TROLLEY_PANEL_COLOR, label: `${Math.round(colWidth)}(W)`,
            });
          } else {
            // Left/Right columns — no full box border, per the user's own
            // reference sketch: each segment's own Height is plain text
            // with a short horizontal tick (a real hand-measured site
            // sketch convention), never a bordered rectangle. BUT the real
            // horizontal pipe that physically separates two stacked
            // segments (e.g. the boundary between the top "A" box and the
            // "C" remaining box below it) IS drawn — a real structural
            // divider, same as the one already shown in the center column
            // — at every internal segment boundary (never at the column's
            // own top/bottom edge, which has no pipe). Still a real
            // (invisible) component per segment so it participates in
            // bounds/collision/click-select like everything else — only
            // its own box outline is blank.
            col.segments.forEach((seg, segIdx) => {
              const id = nextId('trolley-panel');
              components.push({
                id, type: 'TROLLEY_PANEL_UNBORDERED', label: '',
                x: drawnX, y: colTopY + seg.y, width: drawnColWidth, height: Math.max(1, seg.height), qty: 1, visible: true,
                source: {
                  formula: seg.kind === 'top'
                    ? `Trolley Panel ${seg.label} = source trolley box height + top allowance + Pani Patti Height = ${Math.round(seg.height)}mm`
                    : seg.kind === 'fixed'
                      ? `Trolley Panel ${seg.label} — template fixed height = ${Math.round(seg.height)}mm`
                      : `Trolley Panel ${seg.label} = Kitchen Total Height − everything above it in this column = ${Math.round(seg.height)}mm`,
                  constants: [],
                  fixed: seg.kind === 'fixed',
                },
              });
              // A real horizontal pipe divider is drawn at this segment's
              // own TOP boundary whenever another segment sits above it
              // (segIdx > 0) — matching the same structural line already
              // shown in the center column at that boundary. The column's
              // own outer top edge (segIdx === 0) has no pipe. Clipped to
              // the same drawnX/drawnRight bounds as the box itself above,
              // so it never visibly runs past the Kadappa's own line either.
              if (segIdx > 0) {
                const pipeY = colTopY + seg.y;
                lines.push({ x1: drawnX, y1: pipeY, x2: drawnRight, y2: pipeY, color: TROLLEY_PANEL_COLOR, strokeWidth: 1.4 });
              }
              // Height shown as plain text at the segment's own centre —
              // a zero-length AnnotationLine (no visible tick/line, per
              // the user's explicit correction), text only. Stays centred
              // on the REAL unclipped column span.
              {
                const midY = colTopY + seg.y + seg.height / 2;
                lines.push({ x1: colX + colWidth / 2, y1: midY, x2: colX + colWidth / 2, y2: midY, color: TROLLEY_PANEL_COLOR, label: `${Math.round(seg.height)}(h)` });
              }
            });
            // Width shown ONCE as plain text ABOVE Pani Patti, same as the
            // center column's own convention.
            lines.push({
              x1: colX + colWidth / 2, y1: widthLabelAboveY, x2: colX + colWidth / 2, y2: widthLabelAboveY,
              color: TROLLEY_PANEL_COLOR, label: `${Math.round(colWidth)}(W)`,
            });
          }
          colX += colWidth + PANEL_PIPE_GAP_MM;
        });
      }
    }
  }

  // Kadappa — drawn as a THICK VERTICAL LINE MARKER inside the kitchen box,
  // never a complete bordered/filled box, per the user's explicit
  // correction (reverting the earlier "real proportional-width box"
  // rendering). The underlying LAYOUT math is completely unchanged: each
  // Kadappa still reserves its own real `slot.width` in the cursor walk
  // above, and every downstream formula that reads a Kadappa's own width
  // (Trolley Panel's "adjacent Kadappa Width" recovery, Side Section
  // Door's wall-deduction check, etc.) keeps reading `slot.width` exactly
  // as before — only the VISUAL representation changes, from a fill+stroke
  // rectangle spanning the whole reserved width to a fixed-thickness solid
  // line (same "real physical marker, own component for click-select"
  // convention already used for TROLLEY_INNER_PIPE).
  //
  // Per the user's explicit correction: the line must sit at whichever edge
  // of the Kadappa's own reserved span faces whatever REAL component
  // actually reaches it — a Trolley Panel (clipped to this exact edge, see
  // above) OR a Side Section Door (whose own box starts exactly at this
  // Kadappa's real componentRightX/componentLeftX, see the Side Section
  // Door loop below) — never centered, which left a visible gap on every
  // side regardless of which neighbor was there. Never just the
  // Trolley-specific case: a Wall-Side Kadappa bordering a plain Side
  // Section Door (no Trolley involved at all) needs exactly the same
  // "face the real neighbor" treatment, per the user's own follow-up
  // report showing the gap on a Kadappa next to a DOOR, not a Trolley.
  //
  //   Wall-Left Kadappa  — its only real neighbor is always on its own
  //     RIGHT (the outer wall is on its left, nothing to touch there) ->
  //     line always on the RIGHT edge.
  //   Wall-Right Kadappa — mirror image -> line always on the LEFT edge.
  //   Inner Kadappa — has a real neighbor on BOTH sides (never a Side
  //     Section Door, which is outer-only) -> line faces whichever side
  //     the resolved Trolley section is actually on; defaults to the
  //     right edge otherwise (an inner Kadappa with no Trolley on either
  //     side has no single component to prioritize, so this just needs to
  //     be a stable, consistent choice).
  const KADAPPA_LINE_THICKNESS_MM = 6;
  sequence.forEach((slot, i) => {
    const x = componentLeftX[i];
    const w = Math.max(1, slot.width);
    const lineThickness = Math.min(KADAPPA_LINE_THICKNESS_MM, w);
    const trolleyIsToTheRight = resolvedSectionForOuterPanel?.fromLetter === slot.letter;
    const trolleyIsToTheLeft = resolvedSectionForOuterPanel?.toLetter === slot.letter;
    const faceRightEdge = slot.kind === 'wall-left' || trolleyIsToTheRight || (slot.kind === 'inner' && !trolleyIsToTheLeft);
    const lineX = faceRightEdge ? x + w - lineThickness : x;
    components.push({
      id: `kadappa-${slot.letter}`, type: 'KADAPPA_LINE', label: `${slot.letter}`,
      x: lineX, y: kadappaY, width: lineThickness, height: kadappaH, qty: 1, visible: true,
      source: { formula: `Kadappa ${slot.letter} — own Width (entered, reserved in layout) = ${Math.round(slot.width)}mm; drawn as a thick line marker at the edge facing its real neighbor (Trolley Panel or Side Section Door), never centered, so that neighbor meets it with no gap; Height = Total Kitchen Height`, constants: [], fixed: true },
    });
    // Each Kadappa's own Width — plain text ABOVE Pani Patti (never
    // inside/overlapping it), same convention as the Trolley Panel/Door
    // Width labels — a zero-length AnnotationLine, no dimension arrow.
    lines.push({
      x1: x + w / 2, y1: widthLabelAboveY, x2: x + w / 2, y2: widthLabelAboveY,
      color: KADAPPA_COLOR, label: `${Math.round(slot.width)}(W)`,
    });
    // A real dashed leader line connecting that floating label down to
    // its OWN Kadappa box's top edge — per the user's explicit request —
    // so it always stays visually linked to the specific box it measures,
    // even though the label itself now sits well above Pani Patti (no
    // arrowhead, no text on this line — it's purely a connector).
    lines.push({
      x1: x + w / 2, y1: widthLabelAboveY + 4, x2: x + w / 2, y2: kadappaY,
      color: KADAPPA_COLOR, dashed: true, strokeWidth: 0.8,
    });
  });

  // Clear-Width segments — each is its own independent, user-entered
  // dimension, drawn on a lower tier than the Kadappa Width dimensions so
  // the two never merge visually (§35: "must not combine these into one
  // measurement").
  clearSegments.forEach((seg) => {
    const segX1 = seg.fromLetter ? componentRightX[sequence.findIndex((s) => s.letter === seg.fromLetter)] : kitchenX;
    const segX2 = seg.toLetter ? componentLeftX[sequence.findIndex((s) => s.letter === seg.toLetter)] : kitchenX + iShape.width;
    const enteredValue = iShape.clearWidths[seg.index] ?? 0;
    const realGap = Math.max(0, segX2 - segX1);
    // The drawn dimension ALWAYS reflects the real geometric gap between
    // the actual component boundaries — never the raw typed value, which
    // can drift from reality once a Right Wall Kadappa is forced flush
    // against the wall (see the Kadappa-wall-anchor fix). A mismatch
    // between what was entered and the real geometry is surfaced via the
    // separate WIDTH_SUM_MISMATCH warning below, never hidden by drawing
    // a dimension line whose own label contradicts its own line.
    dimReqs.push({
      // Moved to the BOTTOM of the row — per the user's explicit
      // correction, Clear Width (the gap BETWEEN two Kadappa) sits below
      // the drawing, while each Kadappa's own Width dimension (pushed
      // separately, above) stays exactly where it always was, on top.
      axis: 'h', x1: segX1, y1: kadappaY + kadappaH, x2: segX2, y2: kadappaY + kadappaH, edge: 'bottom',
      componentIds: seg.fromLetter ? [`kadappa-${seg.fromLetter}`] : seg.toLetter ? [`kadappa-${seg.toLetter}`] : ['kitchen-body'],
      label: `${Math.round(realGap)} mm (${seg.label})`,
      color: CLEAR_COLOR,
      source: {
        formula: `Clear Width ${seg.label} — real geometric gap = ${Math.round(realGap)}mm (entered value was ${Math.round(enteredValue)}mm)`,
        constants: [],
        needsVerification: Math.abs(realGap - enteredValue) > 1,
        note: Math.abs(realGap - enteredValue) > 1 ? 'Real gap differs from the entered clear-width value — see the Total Width reconciliation warning.' : undefined,
      },
    });

    // Side Section Doors — the plain cabinet door(s) filling this section,
    // ONLY for the two OUTER sections (against the actual room wall —
    // seg.fromLetter === null for the left one, seg.toLetter === null for
    // the right one), and never for the section the Trolley itself
    // occupies (that section's own content is the Trolley Panel drawn
    // above, not a plain door). Per the user's explicit spec: door count
    // auto-recommended from this section's own width (<=600mm -> 1,
    // >=600mm -> 2), user-editable via leftSideDoorCountOverride/
    // rightSideDoorCountOverride; door width = section width minus the
    // inner-Kadappa deduction (2mm, always) minus the wall deduction
    // (3mm if a real Wall Side Kadappa sits on that side, else 2mm) minus
    // (doorCount-1) x 2mm gaps between doors, divided by doorCount.
    //
    // `cornerEnd` (L-Shape only) suppresses door eligibility on whichever
    // of THIS wall's own local ends is going to be an L-Shape corner —
    // a real room wall never sits there, so a Side Section Door would be
    // wrong (there is nothing to close against; Wall B/A continues past
    // it). `null` (I-Shape's default) never suppresses either end.
    const isLeftOuterSection = seg.fromLetter === null && cornerEnd !== 'left';
    const isRightOuterSection = seg.toLetter === null && cornerEnd !== 'right';
    const isTrolleySection = seg.index === resolvedSectionId;
    if ((isLeftOuterSection || isRightOuterSection) && !isTrolleySection && realGap > 0) {
      const side = isLeftOuterSection ? 'left' : 'right';
      const override = side === 'left' ? iShape.leftSideDoorCountOverride : iShape.rightSideDoorCountOverride;
      const doors = calculateSideSectionDoors(iShape, seg, side, override);
      if (doors.valid) {
        const doorGapMm = 2;
        let doorX = segX1;
        for (let i = 0; i < doors.doorCount; i++) {
          const doorId = nextId('side-door');
          // For a 2-door pair, each door's own handle sits near the
          // shared boundary BETWEEN the two doors (left door -> handle on
          // its own right edge; right door -> handle on its own left
          // edge) — per the user's explicit correction, matching a real
          // pair of cabinet doors that open away from each other, both
          // reading as "handle in the middle" rather than wherever the
          // generic whole-drawing heuristic happens to place them. A
          // single door keeps the default (unset) heuristic.
          const handleSide: 'left' | 'right' | undefined = doors.doorCount === 2 ? (i === 0 ? 'right' : 'left') : undefined;
          components.push({
            id: doorId, type: 'SIDE_SECTION_DOOR', label: '',
            x: doorX, y: kadappaY, width: Math.max(1, doors.doorWidth), height: kadappaH, qty: 1, visible: true,
            handleSide,
            source: {
              formula: doors.doorCount === 1
                ? `Side Section Door (${side}) — Width = Section Width(${Math.round(doors.sectionWidth)}) − Inner Kadappa(2) − ${doors.hasWallKadappa ? 'Wall Kadappa' : 'Wall'}(${doors.wallDeductionMm}) = ${Math.round(doors.doorWidth)}mm`
                : `Side Section Door ${i + 1} of ${doors.doorCount} (${side}) — Width = [Section Width(${Math.round(doors.sectionWidth)}) − Inner Kadappa(2) − ${doors.hasWallKadappa ? 'Wall Kadappa' : 'Wall'}(${doors.wallDeductionMm}) − Gaps(${(doors.doorCount - 1) * doorGapMm})] / ${doors.doorCount} = ${Math.round(doors.doorWidth)}mm`,
              constants: [],
            },
          });
          // Width shown as plain text ABOVE Pani Patti — same convention
          // as the Trolley Panel's own column width label (a zero-length
          // AnnotationLine, no arrow/line), per the user's explicit
          // correction.
          lines.push({
            x1: doorX + doors.doorWidth / 2, y1: widthLabelAboveY, x2: doorX + doors.doorWidth / 2, y2: widthLabelAboveY,
            color: SIDE_DOOR_COLOR, label: `${Math.round(doors.doorWidth)}(W)`,
          });
          // Height shown as plain text at the BOTTOM of the door box —
          // per the user's explicit instruction, same formula as the SPO
          // panel (Kitchen Height − 15mm) and the same "drawn flush/full
          // height, label shows the real calculated value" convention:
          // the box itself is drawn at the full kadappaH (zero gap to the
          // kitchen floor/Pani Patti), while the label states the real
          // Door Height value.
          {
            const doorHeightValue = Math.max(0, iShape.height - 15);
            lines.push({
              x1: doorX + doors.doorWidth / 2, y1: kadappaY + kadappaH - 16, x2: doorX + doors.doorWidth / 2, y2: kadappaY + kadappaH - 16,
              color: SIDE_DOOR_COLOR, label: `${Math.round(doorHeightValue)}(h)`,
            });
          }
          doorX += doors.doorWidth + doorGapMm;
        }
      } else if (doors.invalidReason) {
        issues.push({ id: nextId('val'), severity: 'WARNING' as const, code: 'SIDE_SECTION_DOOR_INVALID', message: `${prefix}${doors.invalidReason}` });
      }
    }
  });

  // Overall Total Width — moved to the TOP of the drawing (above Pani
  // Patti), per the user's explicit correction — outermost dimension,
  // ALWAYS the full entered envelope, never replaced by the clear/derived
  // span (§39, §48: Total Width ≠ Clear Width). Sits one tier further up
  // than the plain "Width on top" labels (widthLabelAboveY) so the two
  // never collide. Total Height stays a vertical dimension on the left
  // edge, unaffected by this change.
  dimReqs.push({
    axis: 'h', x1: kitchenX, y1: totalWidthY, x2: kitchenX + iShape.width, y2: totalWidthY, edge: 'top',
    componentIds: ['kitchen-body'], label: `${Math.round(iShape.width)} mm (Total Kitchen Width)`,
    color: TOTAL_COLOR,
    source: { formula: 'Total Kitchen Width (entered)', constants: [] },
  });
  dimReqs.push({
    axis: 'v', x1: kitchenX, y1: kitchenY, x2: kitchenX, y2: kitchenBottomY, edge: 'left',
    componentIds: ['kitchen-body'], label: `${Math.round(iShape.height)} mm (Total Kitchen Height)`,
    color: TOTAL_COLOR,
    source: { formula: 'Total Kitchen Height (entered)', constants: [] },
  });

  // Pani Patti — plain HORIZONTAL text showing only its own name +
  // measurement ("Pani Patti 100mm"), per the user's explicit correction
  // — never a rotated/vertical dimension line, and never combined with
  // any other wording. A zero-length AnnotationLine (no arrow/line),
  // centred vertically within Pani Patti's own height band, just to the
  // right of the drawing. Its Width is always the Total Kitchen Width,
  // shown by the drawing's own shape (§3) — never separately dimensioned.
  lines.push({
    x1: kitchenX + paniPattiWidth + 40, y1: kitchenY + paniPattiH / 2, x2: kitchenX + paniPattiWidth + 40, y2: kitchenY + paniPattiH / 2,
    color: PANI_PATTI_COLOR, label: `Pani Patti ${Math.round(paniPattiH)}mm`,
  });

  // Inner Trolley detail drawing — a fully separate region, well clear of
  // the main drawing and its own dimensions. The OUTER bounding box here
  // is the real calculated Trolley H × W (Total Kitchen Height − Pani
  // Patti − 10mm gap − 30mm clearance; selected Section's real Inside
  // Width − 30mm fit) — never the raw section bay or a placeholder. Every
  // internal non-SPO column/box now uses the calculated Normal Column
  // Width (Trolley Width − pipes×20mm − SPO Width) ÷ normal column count
  // — replaces the old COL_W drawing placeholder with the real formula.
  const preMainBottom = kitchenBottomY + 60;
  const trolleyDims = outerPanelTrolleyDims;
  if (trolleyTemplate) {
    const innerOrigin = innerTrolleyOriginOverride ?? { x: kitchenX, y: preMainBottom + INNER_TROLLEY_GAP };
    const normalWidthResult = calculateNormalColumnWidth(trolleyTemplate, trolleyDims.finalWidth ?? 0, iShape.spoValues ?? {});
    if (!normalWidthResult.valid) {
      issues.push({ id: nextId('val'), severity: 'CRITICAL' as const, code: 'TROLLEY_COLUMN_WIDTH_INVALID', message: `${prefix}${normalWidthResult.invalidReason ?? 'Invalid trolley column width.'}` });
    }
    const built = trolleyTemplate.buildInnerTrolley(innerOrigin, iShape.spoValues ?? {}, trolleyDims.finalHeight, normalWidthResult.normalColumnWidth);
    components.push(...built.components);
    dimReqs.push(...built.dimensions);
    lines.push(...built.lines);

    // Real outer Trolley bounding box — wraps whatever the template just
    // drew, sized/labeled at the actual calculated H × W (never the raw
    // section bay). Drawn behind the template content (pushed first would
    // occlude it, so it's added as an unfilled outline via a dedicated
    // component type rendered with no fill in IShapeKitchenDrawing.tsx).
    const contentRight = Math.max(innerOrigin.x, ...built.components.map((c) => c.x + c.width));
    const outerW = trolleyDims.finalWidth !== null ? trolleyDims.finalWidth : contentRight - innerOrigin.x;
    // Geometry-closes-exactly validation (§10/§14): the template's own
    // pipes + columns + SPO must sum to EXACTLY the calculated Trolley
    // Width — any drift means a template's pipe/column math doesn't
    // actually close, which would otherwise silently show as dead space
    // or an overflow inside the outer bound.
    if (Math.abs(contentRight - (innerOrigin.x + outerW)) > 1) {
      issues.push({
        id: nextId('val'), severity: 'WARNING' as const, code: 'TROLLEY_WIDTH_DOES_NOT_CLOSE',
        message: `${prefix}Trolley template content width (${Math.round(contentRight - innerOrigin.x)}mm) does not exactly match the calculated Trolley Width (${Math.round(outerW)}mm) — check the template's pipe/column layout.`,
      });
    }
    components.push({
      id: 'trolley-outer-bound', type: 'TROLLEY_OUTER_BOUND', label: '',
      x: innerOrigin.x, y: innerOrigin.y, width: Math.max(1, outerW), height: Math.max(1, trolleyDims.finalHeight), qty: 1, visible: true,
      source: {
        formula: `Trolley outer bound — Width = ${trolleyDims.sectionInsideWidth !== null ? `${Math.round(trolleyDims.sectionInsideWidth)} (section inside width) − 30 (fit)` : 'no section selected'} = ${Math.round(outerW)}mm; Height = ${Math.round(iShape.height)} − ${Math.round(iShape.paniPattiHeight)} − 10 − 30 = ${Math.round(trolleyDims.finalHeight)}mm`,
        constants: [],
      },
    });
    dimReqs.push({
      axis: 'h', x1: innerOrigin.x, y1: innerOrigin.y + Math.max(1, trolleyDims.finalHeight) + 40, x2: innerOrigin.x + Math.max(1, outerW), y2: innerOrigin.y + Math.max(1, trolleyDims.finalHeight) + 40, edge: 'bottom',
      componentIds: ['trolley-outer-bound'], label: `${Math.round(outerW)} mm (Trolley Width)`,
      color: TROLLEY_DIM_COLOR,
      source: { formula: 'Trolley Width = Section Inside Width − 30mm', constants: [] },
    });
    dimReqs.push({
      axis: 'v', x1: innerOrigin.x - 40, y1: innerOrigin.y, x2: innerOrigin.x - 40, y2: innerOrigin.y + Math.max(1, trolleyDims.finalHeight), edge: 'left',
      componentIds: ['trolley-outer-bound'], label: `${Math.round(trolleyDims.finalHeight)} mm (Trolley Height)`,
      color: TROLLEY_DIM_COLOR,
      source: { formula: 'Trolley Height = Total Kitchen Height − Pani Patti Height − 10mm − 30mm', constants: [] },
    });
    // Trolley Depth — "/" diagonal leader at the Inner Trolley box's own
    // top-left corner, same convention as the main Kitchen box's own Depth
    // diagonal above (and every other product in this engine).
    {
      const trolleyDiag = insideDiagonal(innerOrigin.x, innerOrigin.y, Math.max(1, outerW), Math.max(1, trolleyDims.finalHeight));
      lines.push({ x1: innerOrigin.x, y1: innerOrigin.y, x2: trolleyDiag.x2, y2: trolleyDiag.y2, color: TROLLEY_DIM_COLOR, label: `${Math.round(trolleyDims.finalDepth)} mm (D)` });
    }
    if (!trolleyDims.widthValid && trolleyDims.widthInvalidReason) {
      issues.push({ id: nextId('val'), severity: 'CRITICAL' as const, code: 'TROLLEY_WIDTH_INVALID', message: `${prefix}${trolleyDims.widthInvalidReason}` });
    }
    if (!trolleyDims.depthValid && trolleyDims.depthInvalidReason) {
      issues.push({ id: nextId('val'), severity: 'WARNING' as const, code: 'TROLLEY_DEPTH_INVALID', message: `${prefix}${trolleyDims.depthInvalidReason}` });
    }
  }

  // Sized from the REAL extent of every drawn component rather than a
  // fixed guess.
  const maxComponentRight = Math.max(kitchenX + iShape.width, ...components.map((c) => c.x + c.width));
  const maxComponentBottom = Math.max(preMainBottom, ...components.map((c) => c.y + c.height));

  // Validation §27: sum of Kadappa widths + sum of Clear Widths must equal
  // Total Kitchen Width. Never silently stretch a component to absorb the
  // difference — just report it.
  if (sequence.length > 0 || clearSegments.length > 0) {
    const sumKadappaWidths = sequence.reduce((sum, s) => sum + Math.max(0, s.width), 0);
    const sumClearWidths = clearSegments.reduce((sum, seg) => sum + Math.max(0, iShape.clearWidths[seg.index] ?? 0), 0);
    const computedTotal = sumKadappaWidths + sumClearWidths;
    if (Math.abs(computedTotal - iShape.width) > 1) {
      issues.push({
        id: nextId('val'), severity: 'WARNING' as const, code: 'WIDTH_SUM_MISMATCH',
        message: `${prefix}Sum of Kadappa widths (${Math.round(sumKadappaWidths)}mm) + Clear widths (${Math.round(sumClearWidths)}mm) = ${Math.round(computedTotal)}mm, which does not match the entered Total Kitchen Width (${Math.round(iShape.width)}mm).`,
      });
    }
  }
  void totalComponentSpan;

  return {
    components,
    dimensionRequests: dimReqs,
    lines,
    calloutRequests,
    issues,
    bounds: { left: 0, top: 0, right: maxComponentRight, bottom: maxComponentBottom },
    // The wall's own two FLOOR-LEVEL corners (bottom-left / bottom-right of
    // the Kitchen Body) — not the row's vertical midpoint. This is what
    // lShapeKitchenGeometry.ts's corner-stitching needs: an L-Shape corner
    // is a real physical floor corner where two walls' kitchen bodies meet
    // edge-to-edge, so Wall B's own body must hang from exactly this point
    // (see rotateWallOutput's pivot), not from some point floating mid-wall.
    startPoint: { x: kitchenX, y: kitchenBottomY },
    endPoint: { x: kitchenRightX, y: kitchenBottomY },
  };
}

export type WallOrigin = { x: number; y: number };
// 'vertical-down-cw'/'vertical-down-ccw' are mirror images of each other —
// Wall B hanging from Wall A's RIGHT end vs LEFT end are NOT the same
// rotation direction (Left and Right are mirror images, not just
// translations of one another), so a single fixed rotation handedness
// cannot be correct for both. See resolveLShapeKitchenPlan's own choice of
// which one to use per `wallBPosition`.
export type WallOrientation = 'horizontal' | 'vertical-down-cw' | 'vertical-down-ccw';

export interface ResolvedWall {
  components: ComponentSpec[];
  dimensionRequests: DimensionRequest[];
  lines: AnnotationLine[];
  calloutRequests: CalloutRequest[];
  issues: ValidationIssue[];
  bounds: { left: number; top: number; right: number; bottom: number };
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
}

/**
 * Rotates/translates a wall's LOCAL output into real-world drawing
 * coordinates. This is the ENTIRE orientation mechanism — resolveKitchenWall
 * itself never knows about `origin`/`orientation` at all (see the file
 * header). Geometrically identical to computing every point pre-rotated,
 * but implemented as one small, independently-testable post-processing
 * step instead of threading a transform through ~40 individual coordinate
 * computation sites inside the (considerable) Kadappa/Trolley/Door layout
 * logic above.
 *
 *   'horizontal'   — a PURE TRANSLATE (no rotation at all): local (x, y)
 *                     -> (origin.x + x, origin.y + y). This is what a
 *                     standalone I-Shape kitchen always uses, and what
 *                     Wall A of an L-Shape kitchen always uses (Wall A is
 *                     always the horizontal run) — so this path is trivially
 *                     a no-op change from what resolveIShapeKitchenPlan
 *                     already did before this extraction.
 *
 *   'vertical-down-cw' / 'vertical-down-ccw' — a 90° rotation (around
 *                     `local.startPoint`, see the pivot comment below),
 *                     THEN a translate so that rotated point lands on
 *                     `origin`. Used only for Wall B of an L-Shape kitchen:
 *                     local x (the wall's own "along its own width" axis)
 *                     becomes global Y running DOWN from the corner, and
 *                     local y (the wall's own "row height" axis) becomes a
 *                     global X band immediately next to the corner — on
 *                     the side the chosen handedness puts it. CW and CCW
 *                     are genuine mirror images (see resolveLShapeKitchenPlan
 *                     for which one to use for wallBPosition 'left' vs
 *                     'right') — never assume one direction covers both.
 *
 * A DimensionRequest's own `axis` ('h'/'v') is flipped under rotation too
 * (a request that measured along local-X now measures along global-Y), so
 * buildDimensionLine (dimensionEngine.ts) — which derives valueMm from
 * axis + the already-rotated x1/y1/x2/y2 — keeps producing the correct
 * value with no other change needed.
 */
export function rotateWallOutput(
  local: ResolvedWallLocal,
  origin: WallOrigin,
  orientation: WallOrientation,
): ResolvedWall {
  // resolveKitchenWall's own local frame does NOT start at literal (0,0) —
  // its content begins at (kitchenX, kadappaY-ish), wherever its internal
  // margin constants put it (see e.g. `kitchenX = leaderMargin + ...` in
  // resolveKitchenWall). `local.startPoint` is that wall's own real anchor
  // — the point that must land exactly on `origin` after this transform
  // (a pure translate for 'horizontal', a rotate-then-translate for either
  // vertical orientation). Rotating around raw (0,0) instead of this real
  // anchor would rotate the wall's own margin offset right along with its
  // content, landing the wall nowhere near `origin` — pivoting on
  // `local.startPoint` is what guarantees `startPoint` maps exactly onto
  // `origin` (verified by validateLCorner in lShapeKitchenGeometry.ts).
  const pivot = local.startPoint;
  const isCw = orientation === 'vertical-down-cw';
  const point = (x: number, y: number): { x: number; y: number } => {
    if (orientation === 'horizontal') return { x: origin.x + x, y: origin.y + y };
    const dx = x - pivot.x, dy = y - pivot.y;
    // CW:  (dx,dy) -> (-dy,  dx) — correct when Wall B hangs from Wall A's
    //      LEFT end (its row-thickness band must extend to the RIGHT of
    //      the corner, i.e. INTO the L, per resolveLShapeKitchenPlan).
    // CCW: (dx,dy) -> ( dy, -dx) — the mirror image, correct when Wall B
    //      hangs from Wall A's RIGHT end (its row-thickness band must
    //      extend to the LEFT of the corner instead). Left and Right are
    //      genuine mirror images of each other, not just a translation —
    //      a single fixed rotation handedness can only ever be correct for
    //      one of the two, which is why this function takes an explicit
    //      direction rather than always rotating the same way.
    return isCw ? { x: origin.x - dy, y: origin.y + dx } : { x: origin.x + dy, y: origin.y - dx };
  };

  const components: ComponentSpec[] = local.components.map((c) => {
    if (orientation === 'horizontal') {
      return { ...c, x: origin.x + c.x, y: origin.y + c.y };
    }
    // Rotation (around `pivot`) of a w×h box whose local top-left is
    // (x, y): the box's four corners rotate to a new axis-aligned box with
    // width/height swapped. Which LOCAL corner becomes the rotated box's
    // own top-left differs by rotation direction — CW: the local
    // bottom-left (x, y+h); CCW: the local top-right (x+w, y).
    const topLeft = isCw ? point(c.x, c.y + c.height) : point(c.x + c.width, c.y);
    return { ...c, x: topLeft.x, y: topLeft.y, width: c.height, height: c.width };
  });

  const lines: AnnotationLine[] = local.lines.map((l) => {
    const p1 = point(l.x1, l.y1);
    const p2 = point(l.x2, l.y2);
    return { ...l, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
  });

  const calloutRequests: CalloutRequest[] = local.calloutRequests.map((r) => {
    const cb = r.componentBounds;
    if (orientation === 'horizontal') {
      return {
        ...r,
        componentBounds: { x: origin.x + cb.x, y: origin.y + cb.y, w: cb.w, h: cb.h },
        anchor: r.anchor ? point(r.anchor.x, r.anchor.y) : undefined,
      };
    }
    const topLeft = isCw ? point(cb.x, cb.y + cb.h) : point(cb.x + cb.w, cb.y);
    return {
      ...r,
      componentBounds: { x: topLeft.x, y: topLeft.y, w: cb.h, h: cb.w },
      anchor: r.anchor ? point(r.anchor.x, r.anchor.y) : undefined,
    };
  });

  const dimensionRequests: DimensionRequest[] = local.dimensionRequests.map((d) => {
    const p1 = point(d.x1, d.y1);
    const p2 = point(d.x2, d.y2);
    // A request that measured along local-X ('h') now measures along
    // global-Y once rotated 90° ('v'), and vice versa — buildDimensionLine
    // derives valueMm strictly from `axis` + these same rotated points, so
    // the axis must flip in lockstep with the rotation or valueMm would
    // collapse to ~0 (computed across the now-constant coordinate instead
    // of the one that actually varies). Same flip for both CW and CCW.
    const axis: 'h' | 'v' = orientation === 'horizontal' ? d.axis : (d.axis === 'h' ? 'v' : 'h');
    // `edge` ('top'/'bottom'/'left'/'right') names which side of the
    // measured span the dimension's own offset ticks/label are drawn on.
    // Rotating the compass direction itself by the SAME handedness as the
    // point rotation above keeps the offset on the correct (outward) side
    // in both cases — CW: top->right, right->bottom, bottom->left,
    // left->top. CCW is the inverse mapping.
    const edge = orientation === 'horizontal' ? d.edge : (
      isCw
        ? (d.edge === 'top' ? 'right' : d.edge === 'right' ? 'bottom' : d.edge === 'bottom' ? 'left' : 'top')
        : (d.edge === 'top' ? 'left' : d.edge === 'left' ? 'bottom' : d.edge === 'bottom' ? 'right' : 'top')
    );
    return { ...d, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, axis, edge };
  });

  const bounds = orientation === 'horizontal'
    ? { left: origin.x + local.bounds.left, top: origin.y + local.bounds.top, right: origin.x + local.bounds.right, bottom: origin.y + local.bounds.bottom }
    : (() => {
        const corners = [
          point(local.bounds.left, local.bounds.top),
          point(local.bounds.right, local.bounds.top),
          point(local.bounds.left, local.bounds.bottom),
          point(local.bounds.right, local.bounds.bottom),
        ];
        return {
          left: Math.min(...corners.map((p) => p.x)),
          top: Math.min(...corners.map((p) => p.y)),
          right: Math.max(...corners.map((p) => p.x)),
          bottom: Math.max(...corners.map((p) => p.y)),
        };
      })();

  return {
    components,
    dimensionRequests,
    lines,
    calloutRequests,
    issues: local.issues,
    bounds,
    startPoint: point(local.startPoint.x, local.startPoint.y),
    endPoint: point(local.endPoint.x, local.endPoint.y),
  };
}

// Re-exported so existing importers of iShapeKitchenGeometry.ts (which now
// re-exports these from here) never need to know this extraction happened.
export type { KitchenWallDrawingInputs as _KitchenWallDrawingInputsAlias };

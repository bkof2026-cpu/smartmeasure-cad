import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { placeNoteBoxes, type CalloutRequest } from '../../engine/noteBoxPlacement';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity } from '../../engine/validationEngine';
import type { IShapeKitchenConfig } from '../../store/types';
import { getTrolleyTemplate, calculateNormalColumnWidth } from './trolleyTemplates';
import { calculateTrolleyDimensions } from './trolleyDimensions';

// ─────────────────────────────────────────────────────────────────────────────
// I-Shape Kitchen — Kadappa-based measurement field + dynamic drawing system.
//
// Kadappa are drawn as REAL proportional-width boxes (not thin line
// markers — reversed from an earlier iteration per the user's explicit,
// detailed final spec). Two independent measurements exist per boundary:
//
//   KADAPPA WIDTH  — a component's own physical width (leftWallKadappaWidth,
//                     rightWallKadappaWidth, innerKadappaWidths[i]).
//   CLEAR WIDTH    — the OPEN space between two consecutive physical
//                     boundaries (iShape.clearWidths[i]), user-entered,
//                     completely independent from Kadappa width.
//
// The two must never be conflated. A wall with NO Kadappa contributes a
// Wall→first-component Clear Width segment; a wall WITH a Kadappa has the
// Kadappa sit flush against it (no segment there). Between two consecutive
// Kadappa there is always exactly one Clear Width segment.
//
//   TOTAL KITCHEN WIDTH ≠ CLEAR/INSIDE WIDTH ≠ KADAPPA WIDTH — three
//   distinct concepts, never treated as the same measurement.
// ─────────────────────────────────────────────────────────────────────────────

export interface IShapeKitchenDrawingInputs {
  iShape: IShapeKitchenConfig;
}

const PANI_PATTI_COLOR = '#7c3aed';
const KADAPPA_COLOR = '#0284c7';
const CLEAR_COLOR = '#059669';
const TOTAL_COLOR = '#dc2626';
const TROLLEY_DIM_COLOR = '#b45309';

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
export function buildKadappaSequence(iShape: IShapeKitchenConfig): KadappaSlot[] {
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
export function buildClearSegments(iShape: IShapeKitchenConfig, sequence: KadappaSlot[]): ClearSegment[] {
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
export function resolveTrolleySectionId(iShape: IShapeKitchenConfig, clearSegments: ClearSegment[]): number | null {
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

export function resolveIShapeKitchenPlan(inputs: IShapeKitchenDrawingInputs): ResolvedDrawing {
  const { iShape } = inputs;
  const leaderMargin = 60;
  const kitchenX = leaderMargin;
  const kitchenY = 90; // room above for the Pani Patti's own leader label

  const components: ComponentSpec[] = [];
  const dimReqs: DimensionRequest[] = [];
  const lines: AnnotationLine[] = [];
  const calloutRequests: CalloutRequest[] = [];
  const issues = [];

  const sequence = buildKadappaSequence(iShape);
  const clearSegments = buildClearSegments(iShape, sequence);

  const paniPattiWidth = iShape.width;
  const paniPattiH = Math.max(1, iShape.paniPattiHeight);
  const kadappaY = kitchenY + paniPattiH;
  const kadappaH = Math.max(1, iShape.height);
  const kitchenBottomY = kadappaY + kadappaH;

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

  // Pani Patti — thin bar spanning the full kitchen width, drawn regardless
  // of Kadappa configuration. Width always equals Total Kitchen Width.
  components.push({
    id: 'pani-patti', type: 'PANI_PATTI', label: '',
    x: kitchenX, y: kitchenY, width: Math.max(1, paniPattiWidth), height: paniPattiH, qty: 1, visible: true,
    source: { formula: 'Pani Patti Width = Total Kitchen Width (always, never independently entered); Height = entered Pani Patti Height', constants: [] },
  });
  // Anchored near the RIGHT edge of the Pani Patti bar (never mid-width)
  // so its leader/label never lands above a Kadappa's own Width dimension
  // — those cluster across the full width at kadappaY, and a mid-width
  // anchor collided with whichever Kadappa happened to sit there.
  lines.push({ x1: kitchenX + Math.max(1, paniPattiWidth) - 20, y1: kitchenY - 40, x2: kitchenX + Math.max(1, paniPattiWidth) - 20, y2: kitchenY, color: PANI_PATTI_COLOR, label: 'Pani Patti', labelAtStart: true, arrowAtEnd: true });

  // Trolley's Outer Panel fills the USER-SELECTED section only — never
  // assumed. `resolveTrolleySectionId` auto-resolves ONLY when exactly
  // one section exists (no real ambiguity); otherwise the user's explicit
  // iShape.trolleySectionId is required.
  const trolleyTemplate = getTrolleyTemplate(iShape.trolleyTemplateId);
  const resolvedSectionId = resolveTrolleySectionId(iShape, clearSegments);
  if (iShape.trolleyTemplateId && !trolleyTemplate) {
    issues.push({ id: nextId('val'), severity: 'CRITICAL' as const, code: 'UNKNOWN_TROLLEY_TEMPLATE', message: `Selected Trolley Type "${iShape.trolleyTemplateId}" has no matching template.` });
  } else if (trolleyTemplate) {
    const section = clearSegments.find((seg) => seg.index === resolvedSectionId);
    if (!section) {
      issues.push({
        id: nextId('val'), severity: 'CRITICAL' as const, code: 'TROLLEY_SECTION_NOT_SELECTED',
        message: clearSegments.length > 1
          ? 'Please select the Kitchen section where the Trolley will be installed.'
          : 'No open Kitchen section is available to place the Trolley in.',
      });
    } else {
      const bayX = section.fromLetter ? componentRightX[sequence.findIndex((s) => s.letter === section.fromLetter)] : kitchenX;
      const bayRight = section.toLetter ? componentLeftX[sequence.findIndex((s) => s.letter === section.toLetter)] : kitchenX + iShape.width;
      const bayWidth = Math.max(1, bayRight - bayX);
      const built = trolleyTemplate.buildOuterPanel({ x: bayX, y: kadappaY }, bayWidth, kadappaH);
      components.push(...built.components);
      dimReqs.push(...built.dimensions);
      lines.push(...built.lines);
    }
  }

  // Kadappa boxes — real proportional width, full Kitchen Height, at their
  // real left-to-right positions.
  sequence.forEach((slot, i) => {
    const x = componentLeftX[i];
    const w = Math.max(1, slot.width);
    components.push({
      id: `kadappa-${slot.letter}`, type: 'KADAPPA_BOX', label: `${slot.letter}`,
      x, y: kadappaY, width: w, height: kadappaH, qty: 1, visible: true,
      source: { formula: `Kadappa ${slot.letter} — own Width (entered) = ${Math.round(slot.width)}mm; Height = Total Kitchen Height`, constants: [], fixed: true },
    });
    // Each Kadappa's own Width dimension — a top-tier horizontal dimension
    // directly over its own box, entirely separate from any Clear Width.
    dimReqs.push({
      axis: 'h', x1: x, y1: kadappaY, x2: x + w, y2: kadappaY, edge: 'top',
      componentIds: [`kadappa-${slot.letter}`], label: `${Math.round(slot.width)} mm`,
      color: KADAPPA_COLOR,
      source: { formula: `Kadappa ${slot.letter} own Width (entered)`, constants: [], fixed: true },
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
      axis: 'h', x1: segX1, y1: kadappaY, x2: segX2, y2: kadappaY, edge: 'bottom',
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
  });

  if (sequence.length > 0) {
    const midX = (componentLeftX[0] + lastComponentRight) / 2;
    calloutRequests.push({
      id: 'kadappa-name-callout',
      componentBounds: { x: midX - 20, y: kitchenBottomY, w: 40, h: 1 },
      title: 'Kadappa', lines: [],
      color: KADAPPA_COLOR,
    });
  }

  // Overall Total Width / Total Height — outermost dimensions, ALWAYS the
  // full entered envelope, never replaced by the clear/derived span (§39,
  // §48: Total Width ≠ Clear Width).
  dimReqs.push({
    axis: 'h', x1: kitchenX, y1: kitchenBottomY, x2: kitchenX + iShape.width, y2: kitchenBottomY, edge: 'bottom',
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

  // Pani Patti — ONLY its Height is ever dimensioned; its Width is always
  // the Total Kitchen Width, shown by the drawing's own shape (§3).
  dimReqs.push({
    axis: 'v', x1: kitchenX + paniPattiWidth + 10, y1: kitchenY, x2: kitchenX + paniPattiWidth + 10, y2: kitchenY + paniPattiH, edge: 'right',
    componentIds: ['pani-patti'], label: `${Math.round(paniPattiH)} mm (Pani Patti H)`,
    color: PANI_PATTI_COLOR,
    source: { formula: 'Pani Patti Height (entered)', constants: [] },
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
  const resolvedSectionForTrolley = clearSegments.find((seg) => seg.index === resolvedSectionId) ?? null;
  const trolleyDims = calculateTrolleyDimensions(iShape, resolvedSectionForTrolley);
  if (trolleyTemplate) {
    const innerOrigin = { x: kitchenX, y: preMainBottom + INNER_TROLLEY_GAP };
    const normalWidthResult = calculateNormalColumnWidth(trolleyTemplate, trolleyDims.finalWidth ?? 0, iShape.spoValues ?? {});
    if (!normalWidthResult.valid) {
      issues.push({ id: nextId('val'), severity: 'CRITICAL' as const, code: 'TROLLEY_COLUMN_WIDTH_INVALID', message: normalWidthResult.invalidReason ?? 'Invalid trolley column width.' });
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
        message: `Trolley template content width (${Math.round(contentRight - innerOrigin.x)}mm) does not exactly match the calculated Trolley Width (${Math.round(outerW)}mm) — check the template's pipe/column layout.`,
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
    if (!trolleyDims.widthValid && trolleyDims.widthInvalidReason) {
      issues.push({ id: nextId('val'), severity: 'CRITICAL' as const, code: 'TROLLEY_WIDTH_INVALID', message: trolleyDims.widthInvalidReason });
    }
    if (!trolleyDims.depthValid && trolleyDims.depthInvalidReason) {
      issues.push({ id: nextId('val'), severity: 'WARNING' as const, code: 'TROLLEY_DEPTH_INVALID', message: trolleyDims.depthInvalidReason });
    }
  }

  // Sized from the REAL extent of every drawn component rather than a
  // fixed guess.
  const maxComponentRight = Math.max(kitchenX + iShape.width, ...components.map((c) => c.x + c.width));
  const maxComponentBottom = Math.max(preMainBottom, ...components.map((c) => c.y + c.height));
  const preWorldWidth = maxComponentRight + 60;
  const preWorldHeight = maxComponentBottom + 60;

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
        message: `Sum of Kadappa widths (${Math.round(sumKadappaWidths)}mm) + Clear widths (${Math.round(sumClearWidths)}mm) = ${Math.round(computedTotal)}mm, which does not match the entered Total Kitchen Width (${Math.round(iShape.width)}mm).`,
      });
    }
  }
  void totalComponentSpan;

  const dimensions = resolveDimensions(dimReqs);
  let noteBoxes = placeNoteBoxes(calloutRequests, { components, dimensions, lines, worldWidth: preWorldWidth, worldHeight: preWorldHeight });
  const worldWidth = Math.max(preWorldWidth, ...noteBoxes.map((nb) => nb.x + 190));
  const worldHeight = Math.max(preWorldHeight, ...noteBoxes.map((nb) => nb.y + 80));

  return {
    view: 'plan', productType: 'kitchen', designId: 'i-shape', designName: 'I-Shape Kitchen',
    worldWidth, worldHeight, components, dimensions, lines, noteBoxes,
    issues: [...issues, ...validateComponentBounds(components, worldWidth, worldHeight), ...validateDimensionIntegrity(dimensions)],
    formulaStatus: 'verified',
  };
}

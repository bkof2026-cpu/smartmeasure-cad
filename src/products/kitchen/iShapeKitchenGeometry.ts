import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { placeNoteBoxes, type CalloutRequest } from '../../engine/noteBoxPlacement';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, notConfiguredIssue } from '../../engine/validationEngine';
import type { IShapeKitchenConfig } from '../../store/types';
import { getTrolleyTemplate } from './trolleyTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// I-Shape Kitchen — fixed reference-style drawing engine, rebuilt to match
// the user's own reference sketch exactly:
//
//   ┌──────────────────────────────────────────────┐  ← Pani Patti (thin
//   ├──────────────────────────────────────────────┤    double-line bar)
//   │  |         |                    |         |  │  ← ONE single kitchen
//   │  |         |                    |         |  │    body rectangle;
//   │  |         |                    |         |  │    Kadappa are thin
//   └──┴─────────┴────────────────────┴─────────┴──┘    VERTICAL LINE
//      A         B                    C         D       markers, not boxes
//
// Each Kadappa's own entered value is the DISTANCE from the previous
// Kadappa line (or from the left wall, for the first one) — never a box
// width. The Trolley's Outer Panel, when selected, fills the bay between
// the first two Kadappa lines (never its own box replacing a Kadappa).
// ─────────────────────────────────────────────────────────────────────────────

export interface IShapeKitchenDrawingInputs {
  iShape: IShapeKitchenConfig;
}

const PANI_PATTI_COLOR = '#7c3aed';
const KADAPPA_COLOR = '#0284c7';
const TOTAL_COLOR = '#dc2626';

export interface KadappaSlot {
  letter: string;
  kind: 'wall-left' | 'inner' | 'wall-right';
  /** Distance (mm) from the PREVIOUS Kadappa line (or the left wall, for
   * the first slot) to this Kadappa's own line — never a box width. */
  distance: number;
  innerIndex?: number;
}

/** Left-to-right physical Kadappa sequence with sequential letters — the
 * single source of truth for Kadappa naming (A = Left Wall, then Inner
 * Kadappas B, C, ..., then D = Right Wall), shared by this engine AND
 * KitchenSteps.tsx's Step 2 (which needs the same sequence to know how
 * many per-slot distance inputs to render, in the same order). */
export function buildKadappaSequence(iShape: IShapeKitchenConfig): KadappaSlot[] {
  const slots: KadappaSlot[] = [];
  if (iShape.wallSideKadappa === 'Left' || iShape.wallSideKadappa === 'Both') {
    slots.push({ kind: 'wall-left', letter: '', distance: iShape.leftWallKadappaWidth });
  }
  if (iShape.hasInnerKadappa) {
    for (let i = 0; i < iShape.innerKadappaCount; i++) {
      slots.push({ kind: 'inner', letter: '', distance: iShape.innerKadappaWidths[i] ?? 0, innerIndex: i });
    }
  }
  if (iShape.wallSideKadappa === 'Right' || iShape.wallSideKadappa === 'Both') {
    slots.push({ kind: 'wall-right', letter: '', distance: iShape.rightWallKadappaWidth });
  }
  slots.forEach((s, i) => { s.letter = String.fromCharCode(65 + i); }); // A, B, C, D...
  return slots;
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

const INNER_TROLLEY_GAP = 220; // real vertical clearance below the whole main drawing (spec §22)
const KADAPPA_LINE_WIDTH_PX = 5; // thin marker line drawn as a very narrow real component, not a wide box

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
  // Real left-to-right X position of each Kadappa's own line — a running
  // cumulative sum of each slot's distance-from-previous value.
  const kadappaX: number[] = [];
  let runningX = kitchenX;
  for (const slot of sequence) {
    runningX += Math.max(0, slot.distance);
    kadappaX.push(runningX);
  }
  const totalKadappaDistance = kadappaX.length > 0 ? kadappaX[kadappaX.length - 1] - kitchenX : 0;

  const paniPattiWidth = iShape.width;
  const paniPattiH = Math.max(1, iShape.paniPattiHeight);
  const kadappaY = kitchenY + paniPattiH;
  const kadappaH = Math.max(1, iShape.height);
  const kitchenBottomY = kadappaY + kadappaH;

  // ONE single kitchen body rectangle — Kadappa are line markers inside
  // it, never separate boxes that could visually fragment the kitchen.
  components.push({
    id: 'kitchen-body', type: 'KITCHEN_BODY', label: '',
    x: kitchenX, y: kadappaY, width: Math.max(1, iShape.width), height: kadappaH, qty: 1, visible: true,
    source: { formula: 'Kitchen body = Total Kitchen Width × Total Kitchen Height (entered)', constants: [] },
  });

  // Pani Patti — thin bar spanning the full kitchen width, drawn regardless
  // of whether any Kadappa is configured yet (appears as soon as I-Shape
  // is selected). Width always equals Total Kitchen Width — never an
  // independently entered value.
  components.push({
    id: 'pani-patti', type: 'PANI_PATTI', label: '',
    x: kitchenX, y: kitchenY, width: Math.max(1, paniPattiWidth), height: paniPattiH, qty: 1, visible: true,
    source: { formula: 'Pani Patti Width = Total Kitchen Width (always, never independently entered); Height = entered Pani Patti Height', constants: [] },
  });
  lines.push({ x1: kitchenX + paniPattiWidth * 0.6, y1: kitchenY - 30, x2: kitchenX + paniPattiWidth * 0.6, y2: kitchenY, color: PANI_PATTI_COLOR, label: 'Pani Patti', labelAtStart: true, arrowAtEnd: true });

  // Trolley's Outer Panel fills the bay between the FIRST two Kadappa
  // lines (kadappaX[0] .. kadappaX[1]) — confirmed with the user. Only
  // possible when at least 2 Kadappa lines exist.
  const trolleyTemplate = getTrolleyTemplate(iShape.trolleyTemplateId);
  if (iShape.trolleyTemplateId && !trolleyTemplate) {
    issues.push({ id: nextId('val'), severity: 'CRITICAL' as const, code: 'UNKNOWN_TROLLEY_TEMPLATE', message: `Selected Trolley Type "${iShape.trolleyTemplateId}" has no matching template.` });
  } else if (trolleyTemplate) {
    if (kadappaX.length >= 2) {
      // Inset by half the Kadappa line's own width on each side so the
      // Outer Panel's edges meet the two bounding Kadappa lines' real
      // edges, not their centrelines — otherwise the box grazes/overlaps
      // both lines by half their thickness.
      const bayX = kadappaX[0] + KADAPPA_LINE_WIDTH_PX / 2;
      const bayWidth = (kadappaX[1] - KADAPPA_LINE_WIDTH_PX / 2) - bayX;
      const built = trolleyTemplate.buildOuterPanel({ x: bayX, y: kadappaY }, bayWidth, kadappaH);
      components.push(...built.components);
      dimReqs.push(...built.dimensions);
      lines.push(...built.lines);
    } else {
      issues.push(notConfiguredIssue('kitchen-i-shape-trolley', iShape.trolleyTemplateId ?? ''));
    }
  }

  // Kadappa — thin vertical line markers at their real cumulative X
  // position, each with a small curved leader down to a shared "Kadappa"
  // name label, matching the reference sketch's own convention.
  sequence.forEach((slot, i) => {
    const x = kadappaX[i];
    components.push({
      id: `kadappa-${slot.letter}`, type: 'KADAPPA_LINE', label: '',
      x: x - KADAPPA_LINE_WIDTH_PX / 2, y: kadappaY, width: KADAPPA_LINE_WIDTH_PX, height: kadappaH, qty: 1, visible: true,
      source: { formula: `Kadappa ${slot.letter} — distance from ${i === 0 ? 'left wall' : `Kadappa ${sequence[i - 1].letter}`} (entered) = ${Math.round(slot.distance)}mm`, constants: [] },
    });
    // Distance dimension from the previous Kadappa line (or the left
    // wall) to this one — the ONLY measurement a Kadappa carries; there
    // is no separate "Kadappa width" any more.
    const prevX = i === 0 ? kitchenX : kadappaX[i - 1];
    dimReqs.push({
      axis: 'h', x1: prevX, y1: kadappaY, x2: x, y2: kadappaY, edge: 'top',
      componentIds: [`kadappa-${slot.letter}`], label: `${Math.round(slot.distance)} mm`,
      color: KADAPPA_COLOR,
      source: { formula: `Kadappa ${slot.letter} distance (entered)`, constants: [] },
    });
  });
  if (sequence.length > 0) {
    // One shared "Kadappa" name label below the kitchen body with a
    // leader to each line, matching the sketch's own convergent-arrows
    // convention — placed via the callout system so it never overlaps
    // the kitchen body or any dimension.
    const midX = (kadappaX[0] + kadappaX[kadappaX.length - 1]) / 2;
    calloutRequests.push({
      id: 'kadappa-name-callout',
      componentBounds: { x: midX - 20, y: kitchenBottomY, w: 40, h: 1 },
      title: 'Kadappa', lines: [],
      color: KADAPPA_COLOR,
    });
  }

  // Overall Total Width / Total Height — outermost dimensions, spanning
  // the real kitchen body bounds (never the Kadappa sequence's own
  // extent, which may legitimately fall short of the full Total Width).
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

  // Pani Patti — ONLY its Height is ever dimensioned, per the user's
  // explicit instruction (its Width is always the Total Kitchen Width,
  // shown by the drawing's own shape, never a separate label/dimension).
  dimReqs.push({
    axis: 'v', x1: kitchenX + paniPattiWidth + 10, y1: kitchenY, x2: kitchenX + paniPattiWidth + 10, y2: kitchenY + paniPattiH, edge: 'right',
    componentIds: ['pani-patti'], label: `${Math.round(paniPattiH)} mm (Pani Patti H)`,
    color: PANI_PATTI_COLOR,
    source: { formula: 'Pani Patti Height (entered)', constants: [] },
  });

  // Inner Trolley detail drawing — a fully separate region, well clear of
  // the main drawing and its own dimensions (spec §22).
  const preMainBottom = kitchenBottomY + 60;
  if (trolleyTemplate) {
    const innerOrigin = { x: kitchenX, y: preMainBottom + INNER_TROLLEY_GAP };
    const built = trolleyTemplate.buildInnerTrolley(innerOrigin);
    components.push(...built.components);
    dimReqs.push(...built.dimensions);
    lines.push(...built.lines);
  }

  const preWorldWidth = kitchenX + iShape.width + 60;
  const preWorldHeight = trolleyTemplate
    ? preMainBottom + INNER_TROLLEY_GAP + 500
    : preMainBottom + 60;

  // Validation: the Kadappa sequence's own cumulative distance must not
  // exceed the entered Total Kitchen Width — a Kadappa line can never sit
  // outside the kitchen body.
  if (sequence.length > 0 && totalKadappaDistance > iShape.width + 1) {
    issues.push({
      id: nextId('val'), severity: 'WARNING' as const, code: 'KADAPPA_DISTANCE_EXCEEDS_WIDTH',
      message: `The last Kadappa (${sequence[sequence.length - 1].letter}) sits at ${Math.round(totalKadappaDistance)}mm, past the entered Total Kitchen Width (${Math.round(iShape.width)}mm).`,
    });
  }

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

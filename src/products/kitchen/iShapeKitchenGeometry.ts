import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { placeNoteBoxes, type CalloutRequest } from '../../engine/noteBoxPlacement';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, notConfiguredIssue } from '../../engine/validationEngine';
import type { IShapeKitchenConfig } from '../../store/types';
import { getTrolleyTemplate } from './trolleyTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// I-Shape Kitchen — fixed reference-style drawing engine (spec: "SMARTMEASURE
// CAD — FINAL I-SHAPE KITCHEN UPDATE"). Structure is FIXED per the user's own
// reference sketch and never collapses into a generic dynamic rectangle:
//
//   PANI PATTI (thin bar, full width, top)
//   ───────────────────────────────────────
//   [ A ] [ B ] [ C ] [ D ]   ← Kadappa columns, each its own real width
//     ↑ Left Wall   ↑ Inner Side    ↑ Right Wall
//
// The first Inner Side Kadappa (slot B) hosts the selected Trolley's single
// Outer Panel box, if one is selected — never subdivided in the main
// drawing (per the user's explicit confirmation). The Trolley's own
// detailed breakdown is drawn separately, well below the whole kitchen
// drawing, as its own "Inner Trolley" region.
// ─────────────────────────────────────────────────────────────────────────────

export interface IShapeKitchenDrawingInputs {
  iShape: IShapeKitchenConfig;
}

const PANI_PATTI_COLOR = '#7c3aed';
const KADAPPA_WALL_COLOR = '#0f766e';
const KADAPPA_INNER_COLOR = '#1d4ed8';
const TOTAL_COLOR = '#dc2626';

export interface KadappaSlot {
  letter: string;
  kind: 'wall-left' | 'inner' | 'wall-right';
  width: number;
  innerIndex?: number;
}

/** Left-to-right physical Kadappa sequence with sequential letters — the
 * single source of truth for Kadappa naming (A = Left Wall, then Inner
 * Kadappas B, C, ..., then D = Right Wall), shared by this engine AND
 * KitchenSteps.tsx's Step 2 (which needs the same sequence to know how
 * many per-slot width / gap-width inputs to render, in the same order). */
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

function kadappaSlotName(kind: KadappaSlot['kind']): string {
  if (kind === 'wall-left') return 'Left Side Wall Kadappa';
  if (kind === 'wall-right') return 'Right Side Wall Kadappa';
  return 'Inner Side Kadappa';
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

const INNER_TROLLEY_GAP = 220; // real vertical clearance below the whole main drawing (spec §22)

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
  const totalKadappaWidth = sequence.reduce((sum, s) => sum + Math.max(0, s.width), 0);
  const gapCount = Math.max(0, sequence.length - 1);
  const totalGapWidth = iShape.gapWidths.slice(0, gapCount).reduce((sum, g) => sum + Math.max(0, g), 0);

  // Pani Patti — thin bar spanning the full kitchen width, drawn regardless
  // of whether any Kadappa is configured yet (spec §2: appears as soon as
  // I-Shape is selected).
  const paniPattiWidth = iShape.paniPattiWidth ?? iShape.width;
  const paniPattiH = Math.max(1, iShape.paniPattiHeight);
  components.push({
    id: 'pani-patti', type: 'PANI_PATTI', label: 'Pani Patti',
    x: kitchenX, y: kitchenY, width: Math.max(1, paniPattiWidth), height: paniPattiH, qty: 1, visible: true,
    source: { formula: 'Pani Patti Width = Total Kitchen Width unless independently entered; Height = entered Pani Patti Height', constants: [] },
  });

  // Kadappa columns — each its own real, independently-entered width,
  // never forced equal (spec §4).
  const kadappaY = kitchenY + paniPattiH;
  const kadappaH = Math.max(1, iShape.height);
  let cursorX = kitchenX;
  const slotX: number[] = [];
  const trolleyTemplate = getTrolleyTemplate(iShape.trolleyTemplateId);
  let firstInnerSlotIndex = -1;

  sequence.forEach((slot, i) => {
    slotX.push(cursorX);
    if (slot.kind === 'inner' && firstInnerSlotIndex === -1) firstInnerSlotIndex = i;
    const w = Math.max(1, slot.width);
    const isTrolleyPanel = trolleyTemplate !== null && i === firstInnerSlotIndex;

    if (!isTrolleyPanel) {
      const compType = slot.kind === 'inner' ? 'KADAPPA_INNER' : 'KADAPPA_WALL';
      components.push({
        id: `kadappa-${slot.letter}`, type: compType,
        label: `${kadappaSlotName(slot.kind)}\n(${slot.letter})`,
        x: cursorX, y: kadappaY, width: w, height: kadappaH, qty: 1, visible: true,
        source: { formula: `Kadappa ${slot.letter} Width (entered) — Height = Total Kitchen Height (auto)`, constants: [] },
      });
      dimReqs.push({
        axis: 'h', x1: cursorX, y1: kadappaY + kadappaH, x2: cursorX + w, y2: kadappaY + kadappaH, edge: 'bottom',
        componentIds: [`kadappa-${slot.letter}`], label: `${Math.round(w)} mm`,
        color: slot.kind === 'inner' ? KADAPPA_INNER_COLOR : KADAPPA_WALL_COLOR,
        source: { formula: `Kadappa ${slot.letter} Width (entered)`, constants: [] },
      });
    } else {
      // Trolley's single Outer Panel box replaces this Kadappa section's
      // plain box entirely — per the user's confirmed "one labeled box,
      // never subdivided" rule.
      const built = trolleyTemplate!.buildOuterPanel({ x: cursorX, y: kadappaY }, w, kadappaH);
      components.push(...built.components);
      dimReqs.push(...built.dimensions);
      lines.push(...built.lines);
    }
    cursorX += w;

    // Gap dimension to the NEXT slot (if any) — a genuinely separate
    // measurement from either slot's own width (spec §5/§27).
    if (i < sequence.length - 1) {
      const gap = iShape.gapWidths[i] ?? 0;
      const nextLetter = sequence[i + 1].letter;
      dimReqs.push({
        axis: 'h', x1: cursorX, y1: kadappaY, x2: cursorX + Math.max(0, gap), y2: kadappaY, edge: 'top',
        componentIds: [], label: `${Math.round(gap)} mm (${slot.letter}→${nextLetter})`,
        color: TOTAL_COLOR,
        source: { formula: `Gap between Kadappa ${slot.letter} and ${nextLetter} (entered) — separate from either Kadappa's own Width`, constants: [] },
      });
      cursorX += Math.max(0, gap);
    }
  });

  // If a trolley is selected but there's no Inner Side Kadappa to host its
  // Outer Panel, report it honestly instead of guessing a location.
  if (iShape.trolleyTemplateId && !trolleyTemplate) {
    issues.push({ id: nextId('val'), severity: 'CRITICAL' as const, code: 'UNKNOWN_TROLLEY_TEMPLATE', message: `Selected Trolley Type "${iShape.trolleyTemplateId}" has no matching template.` });
  } else if (trolleyTemplate && firstInnerSlotIndex === -1) {
    issues.push(notConfiguredIssue('kitchen-i-shape-trolley', iShape.trolleyTemplateId ?? ''));
  }

  // Overall Total Width / Total Height — outermost dimensions.
  const kitchenBottomY = kadappaY + kadappaH;
  dimReqs.push({
    axis: 'h', x1: kitchenX, y1: kitchenBottomY, x2: cursorX, y2: kitchenBottomY, edge: 'bottom',
    componentIds: [], label: `${Math.round(iShape.width)} mm (Total Kitchen Width)`,
    color: TOTAL_COLOR,
    source: { formula: 'Total Kitchen Width (entered)', constants: [] },
  });
  dimReqs.push({
    axis: 'v', x1: kitchenX, y1: kitchenY, x2: kitchenX, y2: kitchenBottomY, edge: 'left',
    componentIds: [], label: `${Math.round(iShape.height)} mm (Total Kitchen Height)`,
    color: TOTAL_COLOR,
    source: { formula: 'Total Kitchen Height (entered)', constants: [] },
  });
  lines.push({ x1: cursorX + 40, y1: kitchenY, x2: cursorX + 90, y2: kitchenY - 40, color: PANI_PATTI_COLOR, label: 'Pani Patti', arrowAtStart: true });

  // Inner Trolley detail drawing — a fully separate region, well clear of
  // the main drawing and its own dimensions (spec §22).
  const preMainBottom = kitchenBottomY + 40;
  if (trolleyTemplate) {
    const innerOrigin = { x: kitchenX, y: preMainBottom + INNER_TROLLEY_GAP };
    const built = trolleyTemplate.buildInnerTrolley(innerOrigin);
    components.push(...built.components);
    dimReqs.push(...built.dimensions);
    lines.push(...built.lines);
  }

  const preWorldWidth = Math.max(cursorX + 60, kitchenX + paniPattiWidth + 60);
  const preWorldHeight = trolleyTemplate
    ? preMainBottom + INNER_TROLLEY_GAP + 500
    : preMainBottom + 40;

  // Validation: entered Total Width must equal the sum of every Kadappa's
  // own width plus every gap between them — component-sum-equals-overall
  // identity check, same convention as the Wardrobe engine's own.
  const widthMismatch = Math.abs(totalKadappaWidth + totalGapWidth - iShape.width);
  if (sequence.length > 0 && widthMismatch > 1) {
    issues.push({
      id: nextId('val'), severity: 'WARNING' as const, code: 'KADAPPA_WIDTH_SUM_MISMATCH',
      message: `Kadappa widths (${Math.round(totalKadappaWidth)}mm) + gaps (${Math.round(totalGapWidth)}mm) = ${Math.round(totalKadappaWidth + totalGapWidth)}mm, which does not match the entered Total Kitchen Width (${Math.round(iShape.width)}mm).`,
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

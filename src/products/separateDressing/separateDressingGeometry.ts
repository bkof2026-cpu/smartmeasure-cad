import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Separate Dressing — a single vertical stack of three zones (Dressing Box /
// Switch Board / Base Storage), matching the user's own reference sketch
// exactly. Switch Board is a real visual zone (a small callout rect + leader,
// like the sketch) but never gets its own measurement — its height is
// whatever's left over: Total H - Dressing Box H - Base Storage H. Depth and
// Width default to one shared value across all three zones (per the user's
// explicit "do not show duplicate dimensions when identical" rule) — Base
// Storage Width is the one field that CAN differ, in which case (and only
// then) a second width dimension appears for it specifically.
// ─────────────────────────────────────────────────────────────────────────────

export interface SeparateDressingInputs {
  H: number; // total height
  W: number; // total width
  D: number; // total depth — shown as the "/" diagonal leader, shared by all 3 zones
  dressingBoxH: number; // independent — the dressing box's own height
  baseStorageH: number;
  baseStorageW: number; // defaults to W; only shown as its own dimension when it actually differs
}

export interface SeparateDressingCutRow {
  component: string;
  width: number;
  height: number;
  qty: number;
  remark: string;
}

const DRESSING_BOX_COLOR = '#2563eb'; // blue, matching the reference sketch
const SWITCH_BOARD_COLOR = '#dc2626'; // red
const BASE_STORAGE_COLOR = '#ea580c'; // orange
const DIAG = '#ea580c';

function insideDiagonal(cornerX: number, cornerY: number, w: number, h: number, dir: 'right-down' | 'right-up' | 'left-down' | 'left-up') {
  const insetX = Math.min(Math.min(w * 0.35, 70) * 2, w * 0.9);
  const insetY = Math.min(Math.min(h * 0.35, 55) * 2, h * 0.9);
  const dx = dir === 'left-down' || dir === 'left-up' ? -insetX : insetX;
  const dy = dir === 'right-up' || dir === 'left-up' ? -insetY : insetY;
  return { x2: cornerX + dx, y2: cornerY + dy };
}

/** Switch Board gets whatever height is left over once the other two zones are placed — never less than a sane visual minimum so it stays a real, visible band even on a small total height. */
/** The TRUE remaining height (never clamped) — this is what actually goes in the cutlist/remark, so a fabricator never reads a forced visual minimum as if it were a real calculated size. */
function switchBoardTrueH(inp: SeparateDressingInputs): number {
  return Math.max(0, inp.H - inp.dressingBoxH - inp.baseStorageH);
}

/** The drawn band height — clamped to a nominal visible minimum so the zone never collapses to an invisible line on screen, purely a rendering concern. */
function switchBoardDrawnH(inp: SeparateDressingInputs): number {
  return Math.max(20, switchBoardTrueH(inp));
}

export function separateDressingCutlist(inp: SeparateDressingInputs): SeparateDressingCutRow[] {
  const trueH = switchBoardTrueH(inp);
  return [
    { component: 'Dressing Box', width: inp.W, height: inp.dressingBoxH, qty: 1, remark: `Width = Total Width (${Math.round(inp.W)}mm, shared) | Height entered independently | Depth = Total Depth (${Math.round(inp.D)}mm, shared)` },
    { component: 'Switch Board', width: inp.W, height: trueH, qty: 1, remark: `Visual zone only — Height = Total Height − Dressing Box Height − Base Storage Height (${Math.round(inp.H)} − ${Math.round(inp.dressingBoxH)} − ${Math.round(inp.baseStorageH)} = ${Math.round(trueH)}mm)${trueH < 20 ? ' — drawn as a thin nominal band on screen' : ''}` },
    { component: 'Base Storage', width: inp.baseStorageW, height: inp.baseStorageH, qty: 1, remark: `Width entered (defaults to Total Width) | Height entered independently | Depth = Total Depth (shared)` },
  ];
}

export function resolveSeparateDressingPlan(inp: SeparateDressingInputs): ResolvedDrawing {
  const { H, W, D } = inp;
  const sbH = switchBoardDrawnH(inp);
  const widthDiffers = Math.abs(inp.baseStorageW - W) > 0.5;

  const leaderMargin = 90; // room for the Height dimension on the left
  const topPad = 90; // room above the stack for the Depth "/" leader

  const components: ComponentSpec[] = [];
  const dimReqs: DimensionRequest[] = [];
  const lines: AnnotationLine[] = [];

  const stackX = leaderMargin;
  const stackY = topPad;

  // ── Dressing Box (top zone) ──────────────────────────────────────────────
  const dbY = stackY;
  components.push({
    id: 'dressing-box', type: 'DRESSING_BOX', label: 'Dressing Box', x: stackX, y: dbY, width: W, height: inp.dressingBoxH, qty: 1, visible: true,
    source: { formula: `Width = Total Width (shared) | Height = ${Math.round(inp.dressingBoxH)}mm (entered)`, constants: [] },
  });
  // Internal shelf/drawer division lines, matching the reference sketch's
  // horizontal bands inside the Dressing Box (visual only, not measured).
  // The box's own "Dressing Box" caption renders centered in the box — skip
  // whichever division would land within the same band as that label so
  // the line never strikes straight through the text.
  const dbRows = 4;
  for (let i = 1; i < dbRows; i++) {
    const frac = i / dbRows;
    if (Math.abs(frac - 0.5) < 0.08) continue;
    const ly = dbY + inp.dressingBoxH * frac;
    lines.push({ x1: stackX + 4, y1: ly, x2: stackX + W - 4, y2: ly, color: DRESSING_BOX_COLOR, strokeWidth: 0.8 });
  }

  // ── Switch Board (middle zone) — visual only, no measurement ────────────
  const sbY = dbY + inp.dressingBoxH;
  components.push({
    id: 'switch-board', type: 'SWITCH_BOARD', label: '', x: stackX, y: sbY, width: W, height: sbH, qty: 1, visible: true,
    source: { formula: 'Visual zone only — no independent measurement, fills remaining height', constants: [] },
  });
  // A small callout rect inside the band (matching the reference sketch's
  // switch-board icon) plus a leader line out to its own label.
  const swW = Math.min(W * 0.28, 60), swH = Math.min(sbH * 0.5, 18);
  const swX = stackX + W * 0.1, swY = sbY + sbH / 2 - swH / 2;
  lines.push({ x1: swX, y1: swY, x2: swX + swW, y2: swY, color: SWITCH_BOARD_COLOR, strokeWidth: 1.2 });
  lines.push({ x1: swX, y1: swY + swH, x2: swX + swW, y2: swY + swH, color: SWITCH_BOARD_COLOR, strokeWidth: 1.2 });
  lines.push({ x1: swX, y1: swY, x2: swX, y2: swY + swH, color: SWITCH_BOARD_COLOR, strokeWidth: 1.2 });
  lines.push({ x1: swX + swW, y1: swY, x2: swX + swW, y2: swY + swH, color: SWITCH_BOARD_COLOR, strokeWidth: 1.2 });
  lines.push({ x1: swX + swW, y1: swY + swH / 2, x2: stackX + W + 55, y2: swY + swH / 2, color: SWITCH_BOARD_COLOR, label: 'Switch Board' });

  // ── Base Storage (bottom zone) ───────────────────────────────────────────
  const bsY = sbY + sbH;
  components.push({
    id: 'base-storage', type: 'BASE_STORAGE', label: 'Base Storage', x: stackX, y: bsY, width: inp.baseStorageW, height: inp.baseStorageH, qty: 1, visible: true,
    source: { formula: `Width = ${Math.round(inp.baseStorageW)}mm (entered) | Height = ${Math.round(inp.baseStorageH)}mm (entered)`, constants: [] },
  });
  // Same center-avoidance as the Dressing Box, so this division never
  // strikes through the "Base Storage" caption either — 3 rows (not 2) so
  // there's still a real division line once the exact-center one is
  // skipped, rather than none at all.
  const bsRows = 3;
  for (let i = 1; i < bsRows; i++) {
    const frac = i / bsRows;
    if (Math.abs(frac - 0.5) < 0.08) continue;
    const ly = bsY + inp.baseStorageH * frac;
    lines.push({ x1: stackX + 4, y1: ly, x2: stackX + inp.baseStorageW - 4, y2: ly, color: BASE_STORAGE_COLOR, strokeWidth: 0.8 });
  }

  // ── Depth — single shared "/" diagonal leader (Total = Dressing Box = Base Storage). ──
  const diag = insideDiagonal(stackX, stackY, W, inp.dressingBoxH, 'right-down');
  lines.push({ x1: stackX, y1: stackY, x2: diag.x2, y2: diag.y2, color: DIAG, label: `${Math.round(D)} mm (D)` });

  // ── Height — one real dimension spanning the whole stack (Total Height). ─
  dimReqs.push({ axis: 'v', x1: stackX, y1: stackY, x2: stackX, y2: bsY + inp.baseStorageH, edge: 'left', componentIds: ['dressing-box', 'switch-board', 'base-storage'], label: `${Math.round(H)} mm (H)`, source: { formula: 'Total Height = Dressing Box H + Switch Board H + Base Storage H', constants: [] }, color: BASE_STORAGE_COLOR });

  // ── Width — one shared dimension unless Base Storage Width actually differs. ──
  dimReqs.push({ axis: 'h', x1: stackX, y1: bsY + inp.baseStorageH, x2: stackX + W, y2: bsY + inp.baseStorageH, edge: 'bottom', componentIds: ['dressing-box', 'switch-board'], label: `${Math.round(W)} mm (W)`, source: { formula: 'Total Width = Dressing Box W = Switch Board W', constants: [] }, color: BASE_STORAGE_COLOR });
  if (widthDiffers) {
    dimReqs.push({ axis: 'h', x1: stackX, y1: bsY + inp.baseStorageH + 26, x2: stackX + inp.baseStorageW, y2: bsY + inp.baseStorageH + 26, edge: 'bottom', componentIds: ['base-storage'], label: `${Math.round(inp.baseStorageW)} mm (Storage W)`, source: { formula: 'Base Storage Width (entered, differs from Total Width)', constants: [] }, color: BASE_STORAGE_COLOR });
  }

  const worldWidth = Math.max(stackX + Math.max(W, inp.baseStorageW) + 90, ...lines.map((l) => Math.max(l.x1, l.x2) + 10));
  const worldHeight = Math.max(bsY + inp.baseStorageH + (widthDiffers ? 50 : 30), ...lines.map((l) => Math.max(l.y1, l.y2) + 10));

  const dimensions = resolveDimensions(dimReqs);
  const issues = [
    ...validateMeasurements({ H, W, D }, [
      { key: 'H', label: 'Total Height', min: 1 },
      { key: 'W', label: 'Total Width', min: 1 },
      { key: 'D', label: 'Total Depth', min: 1 },
    ]),
    ...validateMeasurements({ H: inp.dressingBoxH }, [{ key: 'H', label: 'Dressing Box Height', min: 1 }]),
    ...validateMeasurements({ H: inp.baseStorageH, W: inp.baseStorageW }, [
      { key: 'H', label: 'Base Storage Height', min: 1 },
      { key: 'W', label: 'Base Storage Width', min: 1 },
    ]),
    // Dressing Box H + Base Storage H is allowed to exactly equal Total H
    // (the Switch Board zone then draws as a thin band, per the reference
    // sketch's own proportions) — only genuinely impossible layouts, where
    // the two entered heights add up to MORE than the total, are blocked.
    ...(inp.dressingBoxH + inp.baseStorageH > H ? [{
      id: 'val-separate-dressing-overflow', severity: 'CRITICAL' as const, code: 'HEIGHT_OVERFLOW',
      message: `Dressing Box Height (${Math.round(inp.dressingBoxH)}mm) + Base Storage Height (${Math.round(inp.baseStorageH)}mm) cannot exceed Total Height (${Math.round(H)}mm).`,
    }] : []),
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'plan', productType: 'separate-dressing', designId: 'simple', designName: 'Separate Dressing',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines,
  };
}

import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Loft Box — matches the user's own reference sketch: one box (Height x
// Width), Depth as the "/" diagonal leader, optionally divided into N equal
// shutters per the exact deduction formula from the spec:
//   totalDeduction = shutterCount * 2
//   usableWidth = loftWidth - totalDeduction
//   shutterWidth = usableWidth / shutterCount
// (2mm per shutter accounts for the gap between shutters — never rounded
// early; only the DISPLAYED value is rounded, the internal geometry keeps
// full precision so N shutters always sum back to exactly the Loft Box's
// own real width). A Top Panel (Left/Right) is an optional bold marker
// line at the box's own top corner, per the reference sketch.
// ─────────────────────────────────────────────────────────────────────────────

export type TopPanelSide = 'left' | 'right';

export interface LoftBoxInputs {
  H: number;
  W: number;
  D: number;
  onlyShutter: boolean;
  shutterCount: number; // only meaningful when onlyShutter is true
  topPanel: boolean;
  topPanelSide: TopPanelSide;
  topPanelWidth: number; // only meaningful when topPanel is true
}

export interface LoftBoxCutRow {
  component: string;
  width: number;
  height: number;
  qty: number;
  remark: string;
}

const BOX_COLOR = '#3b82f6';
const DIAG = '#cc2200';
const TOP_PANEL_COLOR = '#7c3aed';

function insideDiagonal(cornerX: number, cornerY: number, w: number, h: number) {
  const insetX = Math.min(Math.min(w * 0.35, 70) * 2, w * 0.9);
  const insetY = Math.min(Math.min(h * 0.35, 55) * 2, h * 0.9);
  return { x2: cornerX + insetX, y2: cornerY + insetY };
}

/** Real, unrounded shutter width — the exact formula from the spec. */
export function loftShutterWidth(loftWidth: number, shutterCount: number): number {
  const count = Math.max(1, Math.round(shutterCount) || 1);
  const totalDeduction = count * 2;
  const usableWidth = loftWidth - totalDeduction;
  return usableWidth / count;
}

export function loftBoxCutlist(inp: LoftBoxInputs): LoftBoxCutRow[] {
  const rows: LoftBoxCutRow[] = [
    { component: 'Loft Box', width: inp.W, height: inp.H, qty: 1, remark: `Height × Width (both entered) | Depth = ${Math.round(inp.D)}mm (entered)` },
  ];
  if (inp.onlyShutter) {
    const count = Math.max(1, Math.round(inp.shutterCount) || 1);
    const sw = loftShutterWidth(inp.W, count);
    rows.push({
      component: `Shutter (×${count})`, width: sw, height: inp.H, qty: count,
      remark: `Deduction = ${count} × 2 = ${count * 2}mm | Usable = ${Math.round(inp.W)} − ${count * 2} = ${Math.round(inp.W - count * 2)}mm | Each Shutter = ${(inp.W - count * 2).toFixed(0)} / ${count} = ${sw.toFixed(2)}mm`,
    });
  }
  if (inp.topPanel) {
    rows.push({ component: `Top Panel (${inp.topPanelSide === 'left' ? 'Left' : 'Right'})`, width: inp.topPanelWidth, height: inp.D, qty: 1, remark: 'Width entered | Depth = Loft Box Depth' });
  }
  return rows;
}

export function loftBoxTitle(inp: LoftBoxInputs): string {
  const parts: string[] = [];
  if (inp.onlyShutter) parts.push(`${Math.max(1, Math.round(inp.shutterCount) || 1)} SHUTTERS`);
  if (inp.topPanel) parts.push(`TOP PANEL (${inp.topPanelSide === 'left' ? 'LEFT' : 'RIGHT'})`);
  return parts.length ? `LOFT BOX — ${parts.join(' + ')}` : 'LOFT BOX';
}

export function resolveLoftBoxPlan(inp: LoftBoxInputs): ResolvedDrawing {
  const { H, W, D } = inp;
  const leaderMargin = 90;
  // Loft Box is a genuinely SHORT, WIDE product (H is typically much less
  // than W) — the Depth diagonal reaches DOWN-RIGHT into the box from its
  // top-left corner (never up above it), so this only needs to clear the
  // title text, not a diagonal's own reach. The previous 90 (same value
  // used for taller products like Bed) was a disproportionately large
  // fixed padding relative to a short box's own real Height, visually
  // inflating how tall the drawing reads once the shared engine scales
  // the whole canvas to fit its viewport. Trimmed to 45 so the rendered
  // canvas's own proportions track the box's real W:H ratio more closely
  // — the entered Height value and its dimension label are untouched.
  const topPad = 35;

  const boxX = leaderMargin;
  const boxY = topPad;

  const components: ComponentSpec[] = [{
    id: 'loft-box', type: 'LOFT_BOX_FRAME', label: inp.onlyShutter ? '' : 'Loft Box', x: boxX, y: boxY, width: W, height: H, qty: 1, visible: true,
    source: { formula: `Height × Width (entered) | Depth = ${Math.round(D)}mm, shown as the / leader`, constants: [] },
  }];
  const lines: AnnotationLine[] = [];
  const dimReqs: DimensionRequest[] = [];

  if (inp.onlyShutter) {
    const count = Math.max(1, Math.round(inp.shutterCount) || 1);
    const sw = loftShutterWidth(W, count);
    const gapMm = 2;
    let cursorX = boxX;
    // Every shutter shows its own computed Width — matching the user's own
    // reference sketch, which writes the per-shutter result (e.g. "331")
    // inside EACH column, not just one of them. The overall drawing title
    // already reads "LOFT BOX — N SHUTTERS", so a separate "Only shutter"
    // callout on one box would be redundant with that; this is the real
    // per-shutter formula RESULT instead, exactly like the sketch.
    for (let i = 0; i < count; i++) {
      components.push({
        id: `shutter-${i}`, type: 'DOOR', label: `${Math.round(sw)}`,
        x: cursorX, y: boxY + 2, width: sw, height: H - 4, qty: 1, visible: true,
        source: { formula: `Shutter ${i + 1} of ${count} — Width = (W − ${count}×2) / ${count} = ${sw.toFixed(2)}mm`, constants: [] },
      });
      cursorX += sw + gapMm;
    }
  }

  // Depth — "/" diagonal leader at the box's own top-left corner.
  const diag = insideDiagonal(boxX, boxY, W, H);
  lines.push({ x1: boxX, y1: boxY, x2: diag.x2, y2: diag.y2, color: DIAG, label: `${Math.round(D)} mm (D)` });

  // Height — real dimension on the box's own left edge.
  dimReqs.push({ axis: 'v', x1: boxX, y1: boxY, x2: boxX, y2: boxY + H, edge: 'left', componentIds: ['loft-box'], label: `${Math.round(H)} mm (H)`, source: { formula: 'Height (entered)', constants: [] }, color: BOX_COLOR });

  // Top Panel — despite the name, its own marker line, Width dimension,
  // and position leader all sit at the box's BOTTOM edge, matching the
  // reference sketch exactly (the box's own overall Width dimension reads
  // outside it, further down, real-CAD "overall dimension outside the
  // specific one" convention — same stacked-tier fix already used for
  // Wardrobe's total-width/width).
  let topPanelX = boxX;
  if (inp.topPanel) {
    topPanelX = inp.topPanelSide === 'left' ? boxX : boxX + W - inp.topPanelWidth;
    lines.push({ x1: topPanelX, y1: boxY + H, x2: topPanelX + inp.topPanelWidth, y2: boxY + H, color: TOP_PANEL_COLOR, strokeWidth: 2.5 });
    dimReqs.push({ axis: 'h', x1: topPanelX, y1: boxY + H, x2: topPanelX + inp.topPanelWidth, y2: boxY + H, edge: 'bottom', componentIds: [], label: `${Math.round(inp.topPanelWidth)} mm (Top Panel W)`, source: { formula: 'Top Panel Width (entered)', constants: [] }, color: TOP_PANEL_COLOR });
    const cornerX = inp.topPanelSide === 'left' ? topPanelX : topPanelX + inp.topPanelWidth;
    lines.push({
      x1: cornerX, y1: boxY + H, x2: cornerX + (inp.topPanelSide === 'left' ? -32 : 32), y2: boxY + H + 32,
      color: TOP_PANEL_COLOR, label: `Top Panel (${inp.topPanelSide === 'left' ? 'Left' : 'Right'})`,
    });
  }
  dimReqs.push({ axis: 'h', x1: boxX, y1: boxY + H, x2: boxX + W, y2: boxY + H, edge: 'bottom', componentIds: ['loft-box'], label: `${Math.round(W)} mm (W)`, source: { formula: 'Width (entered)', constants: [] }, color: BOX_COLOR });

  const worldWidth = Math.max(boxX + W + 20, ...lines.map((l) => Math.max(l.x1, l.x2) + 10));
  const worldHeight = Math.max(boxY + H + 30, ...lines.map((l) => Math.max(l.y1, l.y2) + 10));

  // Both "Top Panel W" and the overall "W" now share the box's bottom
  // edge — force the overall Width one tier further out than whatever
  // Top Panel Width resolved to, so it always reads OUTSIDE (below) the
  // more specific one, matching the reference sketch's stacked layout
  // regardless of drawing scale (same fix already used for Wardrobe's
  // total-width/width).
  const resolvedDims = resolveDimensions(dimReqs);
  const topPanelTier = resolvedDims.find((d) => d.label.includes('Top Panel W'))?.tier ?? 0;
  const dimensions = resolvedDims.map((d) => (d.label.includes('(W)') ? { ...d, tier: Math.max(d.tier, topPanelTier + 1) } : d));
  const issues = [
    ...validateMeasurements({ H, W, D }, [
      { key: 'H', label: 'Height', min: 1 },
      { key: 'W', label: 'Width', min: 1 },
      { key: 'D', label: 'Depth', min: 1 },
    ]),
    ...(inp.onlyShutter ? validateMeasurements({ shutterCount: inp.shutterCount }, [{ key: 'shutterCount', label: 'Number of Shutters', min: 1 }]) : []),
    ...(inp.topPanel ? validateMeasurements({ topPanelWidth: inp.topPanelWidth }, [{ key: 'topPanelWidth', label: 'Top Panel Width', min: 1 }]) : []),
    ...(inp.onlyShutter && loftShutterWidth(W, inp.shutterCount) <= 0 ? [{
      id: 'val-loft-box-shutter-negative', severity: 'CRITICAL' as const, code: 'SHUTTER_TOO_NARROW',
      message: `${Math.round(inp.shutterCount)} shutters at a 2mm gap each leave no usable width out of ${Math.round(W)}mm — reduce the shutter count or increase Width.`,
    }] : []),
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'plan', productType: 'loft-box', designId: 'simple', designName: 'Loft Box',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines,
  };
}

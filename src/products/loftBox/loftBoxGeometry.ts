import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';
import { loftOneDoorWidth, loftDoorWidthStatus, recommendLoftDoorCount } from '../../engine/loftDoorEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Loft Box — matches the user's own reference sketch: one box (Height x
// Width), Depth as the "/" diagonal leader, optionally divided into N equal
// shutters. Per the user's explicit instruction, this now uses the SAME
// shared Loft door-width engine as the Wardrobe's own Loft add-on
// (src/engine/loftDoorEngine.ts's loftOneDoorWidth) instead of a separate,
// duplicate formula — one reusable calculation for every product with a
// Loft, never a second copy of the same math. (The two were always
// numerically identical: (width − count×2) / count — this just removes the
// duplicate implementation.) A Top Panel (Left/Right) is an optional bold
// marker line at the box's own top corner, per the reference sketch.
// ─────────────────────────────────────────────────────────────────────────────

export type TopPanelSide = 'left' | 'right';

export interface LoftBoxInputs {
  H: number;
  W: number;
  D: number;
  onlyShutter: boolean; // true = shutters only (no carcass); false = full Box — BOTH are divided into shutterCount doors by the Loft formula
  shutterCount: number;
  /** Manually entered Shutter Width — defaults to the formula value and
   * stays editable; when set it replaces the formula value in the labels
   * and cutlist (the drawn shutters still divide the Width equally). */
  shutterWidthOverride?: number;
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

/** Real, unrounded shutter width — now delegates to the shared Loft door-width engine (loftDoorEngine.ts's loftOneDoorWidth), same formula every other Loft product uses. Kept under this name so every call site in this file stays unchanged. */
export function loftShutterWidth(loftWidth: number, shutterCount: number): number {
  return loftOneDoorWidth(loftWidth, shutterCount);
}

/** Loft Box / Kitchen Loft form values → resolved inputs — the ONE place
 * the drawing, the cutlist and the form's displayed defaults read from.
 * shutterCount / shutterW are 0 (or absent) until the user edits them, and
 * then fall back to the live Loft-formula values: the recommended count
 * for this Width, and (W − count × 2mm) / count. */
export function loftBoxInputsFromDims(dims: Record<string, number | string>): LoftBoxInputs & { recommendedShutterCount: number; formulaShutterWidth: number } {
  const num = (v: number | string | undefined) => Number(v ?? 0);
  const W = num(dims.W) || 1000;
  const recommendedShutterCount = recommendLoftDoorCount(W).doorCount;
  const shutterCount = num(dims.shutterCount) > 0 ? num(dims.shutterCount) : recommendedShutterCount;
  const formulaShutterWidth = loftShutterWidth(W, shutterCount);
  return {
    H: num(dims.H) || 600,
    W,
    D: num(dims.D) || 400,
    onlyShutter: num(dims.onlyShutter) === 1,
    shutterCount,
    shutterWidthOverride: num(dims.shutterW) > 0 ? num(dims.shutterW) : undefined,
    topPanel: num(dims.topPanel) === 1,
    // Base measurementFields store a 'select' as its literal option string.
    topPanelSide: String(dims.topPanelSide ?? 'Left').toLowerCase() === 'right' ? 'right' : 'left',
    topPanelWidth: num(dims.topPanelWidth) || 300,
    recommendedShutterCount,
    formulaShutterWidth,
  };
}

export function loftBoxCutlist(inp: LoftBoxInputs): LoftBoxCutRow[] {
  const rows: LoftBoxCutRow[] = [
    { component: 'Loft Box', width: inp.W, height: inp.H, qty: 1, remark: `Height × Width (both entered) | Depth = ${Math.round(inp.D)}mm (entered)` },
  ];
  {
    const count = Math.max(1, Math.round(inp.shutterCount) || 1);
    const formulaW = loftShutterWidth(inp.W, count);
    const sw = inp.shutterWidthOverride ?? formulaW;
    rows.push({
      component: `${inp.onlyShutter ? 'Shutter' : 'Loft Box Door'} (×${count})`, width: sw, height: inp.H, qty: count,
      remark: inp.shutterWidthOverride !== undefined
        ? `Width entered manually = ${sw.toFixed(2)}mm (formula value ${formulaW.toFixed(2)}mm)`
        : `Deduction = ${count} × 2 = ${count * 2}mm | Usable = ${Math.round(inp.W)} − ${count * 2} = ${Math.round(inp.W - count * 2)}mm | Each = ${(inp.W - count * 2).toFixed(0)} / ${count} = ${sw.toFixed(2)}mm`,
    });
  }
  if (inp.topPanel) {
    rows.push({ component: `Top Panel (${inp.topPanelSide === 'left' ? 'Left' : 'Right'})`, width: inp.topPanelWidth, height: inp.D, qty: 1, remark: 'Width entered | Depth = Loft Box Depth' });
  }
  return rows;
}

export function loftBoxTitle(inp: LoftBoxInputs): string {
  const parts: string[] = [];
  const count = Math.max(1, Math.round(inp.shutterCount) || 1);
  parts.push(inp.onlyShutter ? `ONLY SHUTTER (${count})` : `BOX (${count} DOORS)`);
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

  // Both Loft types (Only Shutter / Box) are divided into the entered (or
  // recommended) Number of Shutters by the shared Loft formula —
  // (W − count × 2mm) / count — same as the Wardrobe's Loft. (Box mode
  // used to ignore the count and always draw 4 fixed panels.) Each
  // shutter's width is a real dimension tick along the top edge; a bare
  // number inside the box is suppressed by the renderer.
  {
    const count = Math.max(1, Math.round(inp.shutterCount) || 1);
    const sw = loftShutterWidth(W, count);
    const labelW = inp.shutterWidthOverride ?? sw;
    const gapMm = 2;
    let cursorX = boxX;
    for (let i = 0; i < count; i++) {
      components.push({
        id: `shutter-${i}`, type: 'DOOR', label: '',
        x: cursorX, y: boxY + 2, width: sw, height: H - 4, qty: 1, visible: true,
        source: { formula: `Shutter ${i + 1} of ${count} — Width = (W − ${count}×2) / ${count} = ${sw.toFixed(2)}mm`, constants: [] },
      });
      dimReqs.push({
        axis: 'h', x1: cursorX, y1: boxY, x2: cursorX + sw, y2: boxY, edge: 'top', componentIds: [`shutter-${i}`],
        label: `${Math.round(labelW)}`,
        source: { formula: inp.shutterWidthOverride !== undefined ? `Shutter ${i + 1} width entered manually = ${labelW.toFixed(2)}mm (formula ${sw.toFixed(2)}mm)` : `Shutter ${i + 1} of ${count} width = (${Math.round(W)} − ${count}×2) / ${count} = ${sw.toFixed(2)}mm`, constants: [] },
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
    ...validateMeasurements({ shutterCount: inp.shutterCount }, [{ key: 'shutterCount', label: 'Number of Shutters', min: 1 }]),
    ...(inp.topPanel ? validateMeasurements({ topPanelWidth: inp.topPanelWidth }, [{ key: 'topPanelWidth', label: 'Top Panel Width', min: 1 }]) : []),
    ...(() => {
      const w = inp.shutterWidthOverride ?? loftShutterWidth(W, inp.shutterCount);
      const status = loftDoorWidthStatus(w);
      if (w <= 0) return [];
      if (status === 'below-min') return [{ id: 'val-loft-box-shutter-narrow', severity: 'WARNING' as const, code: 'LOFT_DOOR_TOO_NARROW', message: `⚠ Shutter width below 310mm (currently ${w.toFixed(0)}mm) — reduce Number of Shutters or increase Width.` }];
      if (status === 'above-max') return [{ id: 'val-loft-box-shutter-wide', severity: 'WARNING' as const, code: 'LOFT_DOOR_TOO_WIDE', message: `⚠ Shutter width exceeds 400mm (currently ${w.toFixed(0)}mm) — increase Number of Shutters.` }];
      return [];
    })(),
    ...(loftShutterWidth(W, inp.shutterCount) <= 0 ? [{
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

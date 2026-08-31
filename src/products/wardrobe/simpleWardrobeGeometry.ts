import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Simplified Wardrobe model — same real site-measurement workflow as the
// simplified Bed (src/products/bed/simpleBedGeometry.ts), applied to the
// Wardrobe per the user's own reference sketches: a plain W x H carcass with
// Depth (D) shown as the "/" diagonal leader (never a straight arrow — same
// convention as Bed's own height), plus optional Side Dressing, Side Panel,
// and a Loft box/door unit on top. The existing 25-design zone system
// (wardrobeFormulas.ts / wardrobeGeometry.ts / WardrobeTechnicalDrawing.tsx)
// is kept intact for a future "fabrication detail" mode — nothing deleted,
// just no longer the mandatory first step for the live Wardrobe product.
// ─────────────────────────────────────────────────────────────────────────────

export type WardrobeSide = 'left' | 'right' | 'both';

export interface WardrobeDressingInput {
  enabled: boolean;
  side: WardrobeSide;
  widthMm: number; // Height is always Wardrobe Height (auto-fetched)
}

export interface WardrobeSidePanelInput {
  enabled: boolean;
  side: WardrobeSide;
  widthMm: number;
  depthMm: number;
}

export type LoftMode = 'door' | 'box';

export interface WardrobeLoftInput {
  enabled: boolean;
  mode: LoftMode;
  widthMm: number; // defaults to the composite total width when not overridden
  heightMm: number;
  depthMm: number; // only meaningful in 'box' mode
  doorCount: number; // only meaningful in 'door' mode
}

export interface SimpleWardrobeInputs {
  W: number; // wardrobe width
  H: number; // wardrobe height
  D: number; // wardrobe depth — shown as a "/" diagonal leader, never a straight arrow
  dressing: WardrobeDressingInput;
  sidePanel: WardrobeSidePanelInput;
  loft: WardrobeLoftInput;
}

export interface SimpleWardrobeCutRow {
  component: string;
  width: number;
  height: number;
  qty: number;
  remark: string;
}

function activeParts(inp: SimpleWardrobeInputs): string[] {
  const parts: string[] = [];
  if (inp.dressing.enabled) parts.push('DRESSING');
  if (inp.sidePanel.enabled) parts.push('SIDE PANEL');
  if (inp.loft.enabled) parts.push(inp.loft.mode === 'box' ? 'LOFT BOX' : 'LOFT');
  return parts;
}

/** "WARDROBE" / "WARDROBE + DRESSING" / "WARDROBE + DRESSING + LOFT" etc., per the active add-ons. */
export function simpleWardrobeTitle(inp: SimpleWardrobeInputs): string {
  const parts = activeParts(inp);
  return parts.length ? `WARDROBE + ${parts.join(' + ')}` : 'WARDROBE';
}

/** Same data used for both the screen and the PDF — single source of truth. */
export function simpleWardrobeCutlist(inp: SimpleWardrobeInputs): SimpleWardrobeCutRow[] {
  const rows: SimpleWardrobeCutRow[] = [
    { component: 'Wardrobe', width: inp.W, height: inp.H, qty: 1, remark: `Width x Height (entered) | Depth = ${Math.round(inp.D)}mm (entered, shown as the / leader)` },
  ];
  if (inp.dressing.enabled) {
    const sideLabel = inp.dressing.side === 'both' ? 'Left + Right' : inp.dressing.side === 'left' ? 'Left' : 'Right';
    const qty = inp.dressing.side === 'both' ? 2 : 1;
    rows.push({ component: `Side Dressing (${sideLabel})`, width: inp.dressing.widthMm, height: inp.H, qty, remark: `Width entered; Height = Wardrobe Height (auto-fetched, ${Math.round(inp.H)}mm)` });
  }
  if (inp.sidePanel.enabled) {
    const sideLabel = inp.sidePanel.side === 'both' ? 'Left + Right' : inp.sidePanel.side === 'left' ? 'Left' : 'Right';
    const qty = inp.sidePanel.side === 'both' ? 2 : 1;
    rows.push({ component: `Side Panel (${sideLabel})`, width: inp.sidePanel.widthMm, height: inp.sidePanel.depthMm, qty, remark: `Width x Depth (both entered) — drawn rotated: Depth horizontal, Width vertical` });
  }
  if (inp.loft.enabled) {
    if (inp.loft.mode === 'door') {
      rows.push({ component: `Loft Door (x${inp.loft.doorCount})`, width: inp.loft.widthMm / Math.max(1, inp.loft.doorCount), height: inp.loft.heightMm, qty: inp.loft.doorCount, remark: `Only-door loft — Width = Loft Width / Door Count | Height entered` });
    } else {
      rows.push({ component: 'Loft Box', width: inp.loft.widthMm, height: inp.loft.heightMm, qty: 1, remark: `Width x Height x Depth (all entered, Depth = ${Math.round(inp.loft.depthMm)}mm, shown as the / leader)` });
    }
  }
  return rows;
}

const DIAG = '#cc2200';

export function resolveSimpleWardrobePlan(inp: SimpleWardrobeInputs): ResolvedDrawing {
  const { W, H, D, dressing, sidePanel, loft } = inp;
  const leaderMargin = 150; // room for the Wardrobe's own Depth "/" leader

  const dressL = dressing.enabled && dressing.side !== 'right' ? dressing.widthMm : 0;
  const dressR = dressing.enabled && dressing.side !== 'left' ? dressing.widthMm : 0;
  // Side Panel is drawn rotated — Depth is its horizontal extent, Width its
  // short vertical extent (a flat horizontal slat, not a tall sliver) — so
  // the horizontal space it reserves in the composite layout is its Depth.
  const panelL = sidePanel.enabled && sidePanel.side !== 'right' ? sidePanel.depthMm : 0;
  const panelR = sidePanel.enabled && sidePanel.side !== 'left' ? sidePanel.depthMm : 0;

  const leftExtra = panelL + dressL;
  const rightExtra = dressR + panelR;
  const wardrobeX = leaderMargin + leftExtra;

  const components: ComponentSpec[] = [];
  const dimReqs: DimensionRequest[] = [];
  const lines: AnnotationLine[] = [];

  // Loft — touches the top of the composite stack directly (no gap; a real
  // loft cabinet is built flush on top of the wardrobe carcass), spanning
  // the full total width (wardrobe + any side panels/dressing), matching
  // the reference sketch's topmost box. topPad reserves room above the
  // topmost element (loft, or the Wardrobe itself if no loft) for its own
  // "/" diagonal leader — never a straight arrow, same convention as the
  // Bed's own height.
  const topPad = 70;
  const totalWidth = leftExtra + W + rightExtra;
  const loftX = leaderMargin;
  let loftH = 0;
  if (loft.enabled) {
    loftH = loft.heightMm;
    const loftY = topPad;
    const loftLabel = loft.mode === 'door'
      ? `Only Shutter Loft — ${Math.round(loft.widthMm)}×${Math.round(loft.heightMm)} (${loft.doorCount} doors)`
      : `Loft Box — ${Math.round(loft.widthMm)}×${Math.round(loft.heightMm)}`;
    components.push({
      id: 'loft', type: 'PLATFORM_TOP', label: loftLabel, x: loftX, y: loftY, width: totalWidth, height: loftH, qty: 1, visible: true,
      source: { formula: loft.mode === 'door' ? `Width = Loft Width | Height entered | split into ${loft.doorCount} doors` : `Width x Height x Depth (all entered)`, constants: [] },
    });
    if (loft.mode === 'door' && loft.doorCount > 1) {
      const doorW = totalWidth / loft.doorCount;
      for (let i = 1; i < loft.doorCount; i++) {
        lines.push({ x1: loftX + doorW * i, y1: loftY + 4, x2: loftX + doorW * i, y2: loftY + loftH - 4, color: '#999' });
      }
    }
    if (loft.mode === 'box') {
      lines.push({ x1: loftX, y1: loftY, x2: loftX - 60, y2: loftY - 40, color: DIAG, label: `${Math.round(loft.depthMm)} mm (D)` });
    }
  }

  const wardrobeY = topPad + loftH;

  // Wardrobe — a plain W x H carcass, Depth shown as the "/" diagonal
  // leader at its own top-left corner.
  components.push({
    id: 'wardrobe', type: 'WARDROBE_BODY', label: `Wardrobe ${Math.round(W)}×${Math.round(H)}`, x: wardrobeX, y: wardrobeY, width: W, height: H, qty: 1, visible: true,
    source: { formula: 'Width x Height (entered) — single carcass, no internal panels', constants: [] },
  });
  // Anchored at the Wardrobe's bottom-left corner rather than top-left —
  // the top-left corner is where Dressing/Side Panel/Loft all converge, so
  // the bottom-left (always open space, nothing else is ever positioned
  // there) keeps this leader clear regardless of which add-ons are active.
  lines.push({ x1: wardrobeX, y1: wardrobeY + H, x2: wardrobeX - 70, y2: wardrobeY + H + 40, color: DIAG, label: `${Math.round(D)} mm (D)` });

  dimReqs.push({ axis: 'h', x1: wardrobeX, y1: wardrobeY + H, x2: wardrobeX + W, y2: wardrobeY + H, edge: 'bottom', componentIds: ['wardrobe'], label: `${Math.round(W)} mm (width)`, source: { formula: 'Wardrobe Width = W', constants: [] } });
  dimReqs.push({ axis: 'v', x1: wardrobeX + W, y1: wardrobeY, x2: wardrobeX + W, y2: wardrobeY + H, edge: 'right', componentIds: ['wardrobe'], label: `${Math.round(H)} mm (height)`, source: { formula: 'Wardrobe Height = H', constants: [] } });

  // "Total width" / "total height" outer dimensions, only shown when a side
  // panel or loft actually changes the overall footprint — matching the
  // reference sketch's "total width (if side panel exist)" label.
  if (leftExtra + rightExtra > 0) {
    dimReqs.push({ axis: 'h', x1: loftX, y1: wardrobeY + H + 40, x2: loftX + totalWidth, y2: wardrobeY + H + 40, edge: 'bottom', componentIds: [], label: `${Math.round(totalWidth)} mm (total width)`, source: { formula: 'Total Width = Side Panel + Dressing + Wardrobe Width + Dressing + Side Panel', constants: [] } });
  }
  if (loftH > 0) {
    dimReqs.push({ axis: 'v', x1: wardrobeX + W + 40, y1: topPad, x2: wardrobeX + W + 40, y2: wardrobeY + H, edge: 'right', componentIds: [], label: `${Math.round(loftH + H)} mm (total height)`, source: { formula: 'Total Height = Loft Height + Wardrobe Height', constants: [] } });
  }

  // Side Dressing — flush against the Wardrobe (or the Side Panel line, if
  // one is also enabled on that side). Width is carried in the caption
  // itself (e.g. "Dressing 400") rather than a top-edge arrow: when a Loft
  // is also active, the Loft sits flush on top with no gap, so there's no
  // clear strip left above the Dressing box for a top dimension line to
  // occupy without cutting into the Loft's own caption — and Height still
  // gets its own real leader since it's the auto-fetched, non-obvious value.
  // The Height leader is pushed clear of the box (not just a few px) and
  // forced to tier 1 — its label is centered ON the line, so a tight
  // same-tier offset let the label's own rendered width dip back into the
  // "Dressing" caption inside the box.
  const dressLeaderGap = 40;
  if (dressL > 0) {
    const dx = wardrobeX - dressL;
    components.push({ id: 'dress-l', type: 'DRESSING', label: `Dressing ${Math.round(dressL)}`, x: dx, y: wardrobeY, width: dressL, height: H, qty: 1, visible: true, source: { formula: `Width = ${Math.round(dressL)}mm (entered) | Height = Wardrobe Height (auto-fetched)`, constants: [] } });
    dimReqs.push({ axis: 'v', x1: dx - dressLeaderGap, y1: wardrobeY, x2: dx - dressLeaderGap, y2: wardrobeY + H, edge: 'left', componentIds: ['dress-l'], label: `${Math.round(H)} mm (H)`, source: { formula: 'Dressing Height = Wardrobe Height (auto-fetched)', constants: [] } });
  }
  if (dressR > 0) {
    const dx = wardrobeX + W;
    components.push({ id: 'dress-r', type: 'DRESSING', label: `Dressing ${Math.round(dressR)}`, x: dx, y: wardrobeY, width: dressR, height: H, qty: 1, visible: true, source: { formula: `Width = ${Math.round(dressR)}mm (entered) | Height = Wardrobe Height (auto-fetched)`, constants: [] } });
    dimReqs.push({ axis: 'v', x1: dx + dressR + dressLeaderGap, y1: wardrobeY, x2: dx + dressR + dressLeaderGap, y2: wardrobeY + H, edge: 'right', componentIds: ['dress-r'], label: `${Math.round(H)} mm (H)`, source: { formula: 'Dressing Height = Wardrobe Height (auto-fetched)', constants: [] } });
  }

  // Side Panel — per the user's own correction: not a box at all, just one
  // real horizontal line (a thin partition marker, real technical-drawing
  // convention for a panel whose thickness isn't worth drawing as a filled
  // rectangle), top-aligned against the Wardrobe/Dressing edge. Its one real
  // dimension — Depth, its length — is called out the same way every other
  // out-of-plan value in this drawing is: a "/" diagonal leader anchored at
  // the line's own left corner, not text sitting directly on the line.
  if (panelL > 0) {
    const px = wardrobeX - dressL - panelL;
    lines.push({ x1: px, y1: wardrobeY, x2: px + panelL, y2: wardrobeY, color: '#222' });
    lines.push({ x1: px, y1: wardrobeY, x2: px - 26, y2: wardrobeY - 26, color: DIAG, label: `${Math.round(panelL)} mm (D)` });
  }
  if (panelR > 0) {
    const px = wardrobeX + W + dressR;
    lines.push({ x1: px, y1: wardrobeY, x2: px + panelR, y2: wardrobeY, color: '#222' });
    lines.push({ x1: px, y1: wardrobeY, x2: px - 26, y2: wardrobeY - 26, color: DIAG, label: `${Math.round(panelR)} mm (D)` });
  }

  const worldWidth = Math.max(loftX + totalWidth, ...lines.map((l) => Math.max(l.x1, l.x2) + 10));
  const worldHeight = Math.max(wardrobeY + H + (leftExtra + rightExtra > 0 ? 70 : 20), ...lines.map((l) => Math.max(l.y1, l.y2) + 10));

  // The Dressing Height leader sits right beside a narrow box whose own
  // "Dressing" caption is centered inside it — the standard tier-0 offset
  // (18px, fixed regardless of drawing scale) is narrower than the label's
  // own rendered width, so its bordered box would clip into the component
  // it's labeling. Forcing it out to tier 1 (36px) is scale-independent —
  // unlike widening dressLeaderGap, which is a world-mm value that shrinks
  // to almost nothing once scaled down for a large composite drawing.
  const dimensions = resolveDimensions(dimReqs).map((d) => {
    const isDressingHeight = (d.componentIds.includes('dress-l') || d.componentIds.includes('dress-r')) && (d.edge === 'left' || d.edge === 'right');
    return isDressingHeight ? { ...d, tier: Math.max(d.tier, 1) } : d;
  });
  const issues = [
    ...validateMeasurements({ W, H, D }, [
      { key: 'W', label: 'Wardrobe Width', min: 1 },
      { key: 'H', label: 'Wardrobe Height', min: 1 },
      { key: 'D', label: 'Wardrobe Depth', min: 1 },
    ]),
    ...(dressing.enabled ? validateMeasurements({ W: dressing.widthMm }, [{ key: 'W', label: 'Dressing Width', min: 1 }]) : []),
    ...(sidePanel.enabled ? validateMeasurements({ W: sidePanel.widthMm, D: sidePanel.depthMm }, [{ key: 'W', label: 'Side Panel Width', min: 1 }, { key: 'D', label: 'Side Panel Depth', min: 1 }]) : []),
    ...(loft.enabled ? validateMeasurements({ W: loft.widthMm, H: loft.heightMm }, [{ key: 'W', label: 'Loft Width', min: 1 }, { key: 'H', label: 'Loft Height', min: 1 }]) : []),
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'plan', productType: 'wardrobe', designId: 'simple', designName: 'Wardrobe',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines,
  };
}

import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Kitchen Cabinet (K.B) — a black-outlined main cabinet divided into N equal
// doors with a FIXED 3mm gap between every adjacent door (never entered by
// the user, per the spec), plus an optional blue Open Box below it (default
// width = the cabinet's own Total Width) with an optional orange Profile
// Light + centered "W × H" callout inside the Open Box when enabled.
//
// Door width formula, exactly as specified (multiply BEFORE subtracting):
//   Door Width = (Total Width − (No. of Doors × 3)) / No. of Doors
// Never rounded internally — only the DISPLAYED per-door label is rounded,
// so N doors always sum back to exactly the cabinet's own real width (same
// convention already used for Loft Box's shutter formula).
// ─────────────────────────────────────────────────────────────────────────────

export interface KitchenCabinetInputs {
  H: number;
  W: number;
  D: number;
  doorCount: number;
  addOpenBox: boolean;
  openBoxH: number;
  openBoxW: number; // defaults to Total Width — see kitchenCabinetOpenBoxWidth()
  profileLight: boolean;
}

export interface KitchenCabinetCutRow {
  component: string;
  width: number;
  height: number;
  qty: number;
  remark: string;
}

const CABINET_COLOR = '#111827'; // black, per spec §18
const OPEN_BOX_COLOR = '#3b82f6'; // blue, per spec §18
const PROFILE_LIGHT_COLOR = '#f59e0b'; // orange, per spec §18
const DIAG = '#cc2200';
const DOOR_GAP_MM = 3; // fixed system value — spec §3, never user-entered

function insideDiagonal(cornerX: number, cornerY: number, w: number, h: number) {
  const insetX = Math.min(Math.min(w * 0.35, 70) * 2, w * 0.9);
  const insetY = Math.min(Math.min(h * 0.35, 55) * 2, h * 0.9);
  return { x2: cornerX + insetX, y2: cornerY + insetY };
}

/** Real, unrounded door width — the exact formula from the spec (§4):
 * multiplication happens BEFORE subtraction, matching the worked example
 * (2000mm, 6 doors → 6×3=18 → 2000−18=1982 → 1982/6=330.33 → shown "331"). */
export function kitchenCabinetDoorWidth(totalWidth: number, doorCount: number): number {
  const count = Math.max(1, Math.round(doorCount) || 1);
  return (totalWidth - count * DOOR_GAP_MM) / count;
}

/** Open Box's real width — defaults to the cabinet's own Total Width (§10),
 * but stays user-editable; only falls back to the default when the field is
 * genuinely unset/non-positive, never silently overriding a real edit. */
export function kitchenCabinetOpenBoxWidth(totalWidth: number, enteredOpenBoxW: number): number {
  return enteredOpenBoxW > 0 ? enteredOpenBoxW : totalWidth;
}

export function kitchenCabinetCutlist(inp: KitchenCabinetInputs): KitchenCabinetCutRow[] {
  const count = Math.max(1, Math.round(inp.doorCount) || 1);
  const dw = kitchenCabinetDoorWidth(inp.W, count);
  const rows: KitchenCabinetCutRow[] = [
    { component: 'Kitchen Cabinet', width: inp.W, height: inp.H, qty: 1, remark: `Height × Width (both entered) | Depth = ${Math.round(inp.D)}mm (entered)` },
    {
      component: `Door (×${count})`, width: dw, height: inp.H, qty: count,
      remark: `Gap = ${count} × ${DOOR_GAP_MM} = ${count * DOOR_GAP_MM}mm | Usable = ${Math.round(inp.W)} − ${count * DOOR_GAP_MM} = ${Math.round(inp.W - count * DOOR_GAP_MM)}mm | Each Door = ${(inp.W - count * DOOR_GAP_MM).toFixed(0)} / ${count} = ${dw.toFixed(2)}mm`,
    },
  ];
  if (inp.addOpenBox) {
    const obW = kitchenCabinetOpenBoxWidth(inp.W, inp.openBoxW);
    rows.push({ component: 'Open Box', width: obW, height: inp.openBoxH, qty: 1, remark: `Height entered | Width ${inp.openBoxW > 0 ? '(entered)' : '= Total Width (default)'}` });
    if (inp.profileLight) {
      rows.push({ component: 'Profile Light', width: obW, height: inp.openBoxH, qty: 1, remark: 'Structural — not independently measured, follows Open Box W × H' });
    }
  }
  return rows;
}

export function kitchenCabinetTitle(inp: KitchenCabinetInputs): string {
  const count = Math.max(1, Math.round(inp.doorCount) || 1);
  const parts: string[] = [`${count} DOOR${count === 1 ? '' : 'S'}`];
  if (inp.addOpenBox) parts.push(inp.profileLight ? 'OPEN BOX + PROFILE LIGHT' : 'OPEN BOX');
  return `KITCHEN CABINET (K.B) — ${parts.join(' + ')}`;
}

export function resolveKitchenCabinetPlan(inp: KitchenCabinetInputs): ResolvedDrawing {
  const { H, W, D } = inp;
  const leaderMargin = 90;
  const topPad = 90;

  const cabX = leaderMargin;
  const cabY = topPad;

  const components: ComponentSpec[] = [{
    id: 'kitchen-cabinet', type: 'CABINET_FRAME', label: '', x: cabX, y: cabY, width: W, height: H, qty: 1, visible: true,
    source: { formula: `Height × Width (entered) | Depth = ${Math.round(D)}mm, shown as the / leader`, constants: [] },
  }];
  const lines: AnnotationLine[] = [];
  const dimReqs: DimensionRequest[] = [];

  // Doors — dynamically divided per §4/§7. Each door is its own real
  // component (not a divider line), named "Box N" (matching the user's
  // own reference sketch's "= width of one box" callout — every door
  // panel reads as its own named box), with its own computed width value
  // right after the name — a single-line label, since the shared engine
  // renders a component's label as one plain SVG <text> node (no line-
  // break support), same convention as every other product's own
  // component labels this session.
  const count = Math.max(1, Math.round(inp.doorCount) || 1);
  const dw = kitchenCabinetDoorWidth(W, count);
  let cursorX = cabX;
  for (let i = 0; i < count; i++) {
    components.push({
      id: `door-${i}`, type: 'DOOR', label: `Box ${i + 1} — ${Math.round(dw)}`,
      x: cursorX, y: cabY + 2, width: dw, height: H - 4, qty: 1, visible: true,
      source: { formula: `Box ${i + 1} of ${count} — Width = (Total Width − ${count}×${DOOR_GAP_MM}) / ${count} = ${dw.toFixed(2)}mm`, constants: [] },
    });
    cursorX += dw + DOOR_GAP_MM;
  }

  // Gap callout — a short leader pointing directly at one of the fixed
  // 3mm gaps between doors, naming the formula the way the reference
  // sketch's own purple leader does ("Total Width − (3mm) / N = width of
  // one box"), so the drawing itself documents where the door-width
  // number comes from, not just the DrawingInspector's traceability panel.
  if (count > 1) {
    const firstGapX = cabX + dw + DOOR_GAP_MM / 2;
    lines.push({
      x1: firstGapX, y1: cabY, x2: firstGapX, y2: cabY - 30,
      color: CABINET_COLOR, label: `Total Width − (${DOOR_GAP_MM}mm) / ${count} = width of one box`, labelAtStart: true,
    });
  }

  // Depth — "/" diagonal leader at the cabinet's own top-left corner.
  const diag = insideDiagonal(cabX, cabY, W, H);
  lines.push({ x1: cabX, y1: cabY, x2: diag.x2, y2: diag.y2, color: DIAG, label: `${Math.round(D)} mm (D)` });

  // Total Height — left edge.
  dimReqs.push({ axis: 'v', x1: cabX, y1: cabY, x2: cabX, y2: cabY + H, edge: 'left', componentIds: ['kitchen-cabinet'], label: `${Math.round(H)} mm (H)`, source: { formula: 'Total Height (entered)', constants: [] }, color: CABINET_COLOR });
  // Total Width — bottom edge.
  dimReqs.push({ axis: 'h', x1: cabX, y1: cabY + H, x2: cabX + W, y2: cabY + H, edge: 'bottom', componentIds: ['kitchen-cabinet'], label: `${Math.round(W)} mm (W)`, source: { formula: 'Total Width (entered)', constants: [] }, color: CABINET_COLOR });

  // Open Box — positioned below the main cabinet, per §11's ASCII layout,
  // sharing the same left edge and a real vertical gap so it never touches
  // the cabinet's own Width dimension line above it.
  let openBoxY = cabY + H;
  if (inp.addOpenBox) {
    const obW = kitchenCabinetOpenBoxWidth(W, inp.openBoxW);
    const obH = inp.openBoxH;
    const gapBelowCabinet = 90; // clears the cabinet's own Width dimension tier
    const boxY = cabY + H + gapBelowCabinet;
    components.push({
      id: 'open-box', type: 'OPEN_BOX_FRAME', label: '', x: cabX, y: boxY, width: obW, height: obH, qty: 1, visible: true,
      source: { formula: `Height (entered) | Width ${inp.openBoxW > 0 ? '(entered)' : '= Total Width (default)'}`, constants: [] },
    });

    // "Open box" — a blue leader from the box's own bottom-left corner,
    // matching the user's own reference sketch's leader naming the blue
    // box directly (distinct from the plain W/H dimension lines, which
    // only give numbers, not the component's name). Anchored below the
    // box's own Height dimension (which occupies the left edge from boxY
    // to boxY+obH) rather than beside it, so the two never collide.
    lines.push({
      x1: cabX, y1: boxY + obH, x2: cabX - 70, y2: boxY + obH + 60,
      color: OPEN_BOX_COLOR, label: 'Open box', arrowAtStart: true,
    });

    // Profile Light — a bold horizontal orange line near the upper portion
    // of the Open Box (§16), strictly inside its bounds, never outside.
    if (inp.profileLight) {
      const lightInsetX = Math.max(10, obW * 0.04);
      const lightY = boxY + Math.max(10, obH * 0.18);
      lines.push({
        x1: cabX + lightInsetX, y1: lightY, x2: cabX + obW - lightInsetX, y2: lightY,
        color: PROFILE_LIGHT_COLOR, strokeWidth: 2.5,
      });
      // W × H measurement, centered inside the Open Box (§17) — a
      // zero-length AnnotationLine at the box's own center renders its
      // label perfectly horizontal (same trick used for Study Table's
      // "Storage" heading), reading as plain centered text, not a leader.
      const centerX = cabX + obW / 2;
      const centerY = boxY + obH / 2;
      lines.push({
        x1: centerX, y1: centerY, x2: centerX, y2: centerY,
        color: PROFILE_LIGHT_COLOR, label: `${Math.round(obW)} × ${Math.round(obH)}`,
      });

      // "Open Box with Profile Light" — a second, orange leader from the
      // box's own bottom-right corner, matching the user's own reference
      // sketch, which names the SAME box with two distinct leaders (blue
      // for the Open Box itself, orange for it "with Profile Light")
      // rather than replacing one label with the other.
      lines.push({
        x1: cabX + obW, y1: boxY + obH, x2: cabX + obW + 70, y2: boxY + obH + 60,
        color: PROFILE_LIGHT_COLOR, label: 'Open Box with Profile Light', arrowAtStart: true,
      });
    }

    // Open Box Height — left edge, own vertical dimension.
    dimReqs.push({ axis: 'v', x1: cabX, y1: boxY, x2: cabX, y2: boxY + obH, edge: 'left', componentIds: ['open-box'], label: `${Math.round(obH)} mm (H)`, source: { formula: 'Open Box Height (entered)', constants: [] }, color: OPEN_BOX_COLOR });
    // Open Box Width — bottom edge, below the box per §12.
    dimReqs.push({ axis: 'h', x1: cabX, y1: boxY + obH, x2: cabX + obW, y2: boxY + obH, edge: 'bottom', componentIds: ['open-box'], label: `${Math.round(obW)} mm (W)`, source: { formula: inp.openBoxW > 0 ? 'Open Box Width (entered)' : 'Open Box Width = Total Width (default)', constants: [] }, color: OPEN_BOX_COLOR });

    openBoxY = boxY + obH;
  }

  const worldWidth = Math.max(cabX + W + 90, ...lines.map((l) => Math.max(l.x1, l.x2) + 10));
  const worldHeight = Math.max(openBoxY + 70, ...lines.map((l) => Math.max(l.y1, l.y2) + 10));

  const dimensions = resolveDimensions(dimReqs);
  const issues = [
    ...validateMeasurements({ H, W, D }, [
      { key: 'H', label: 'Total Height', min: 1 },
      { key: 'W', label: 'Total Width', min: 1 },
      { key: 'D', label: 'Depth', min: 1 },
    ]),
    ...validateMeasurements({ doorCount: inp.doorCount }, [{ key: 'doorCount', label: 'Number of Doors', min: 1 }]),
    ...(dw <= 0 ? [{
      id: 'val-kitchen-cabinet-door-negative', severity: 'CRITICAL' as const, code: 'DOOR_TOO_NARROW',
      message: `${count} doors at a ${DOOR_GAP_MM}mm gap each leave no usable width out of ${Math.round(W)}mm — reduce the door count or increase Total Width.`,
    }] : []),
    // §5/§21 — a WARNING, never a block, and the input is never silently
    // changed. The 400mm ceiling is the spec's own "default/preferred"
    // rule, not a hard validation minimum, so this is intentionally
    // WARNING severity (same tier the shared engine already uses for
    // non-blocking advisories), not CRITICAL/ERROR.
    ...(dw > 400 ? [{
      id: 'val-kitchen-cabinet-door-wide', severity: 'WARNING' as const, code: 'DOOR_WIDTH_EXCEEDS_400',
      message: `Door width exceeds 400 mm (${dw.toFixed(0)}mm). Please increase the number of doors or adjust the total width.`,
    }] : []),
    ...(inp.addOpenBox ? validateMeasurements({ openBoxH: inp.openBoxH }, [{ key: 'openBoxH', label: 'Open Box Height', min: 1 }]) : []),
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'plan', productType: 'kitchen-cabinet', designId: 'simple', designName: 'Kitchen Cabinet (K.B)',
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines,
  };
}

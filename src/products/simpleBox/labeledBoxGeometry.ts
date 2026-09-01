import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements } from '../../engine/validationEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Shared "single labeled box" drawing — T.V., Sofa, and Center Table are all
// the same real-CAD shape (per the user's own spec): one rectangle sized to
// the entered measurements, the product name inside it, straight dimension
// lines on the horizontal/vertical edges, and an optional Depth "/" diagonal
// leader when the product has one. Building this once and configuring it per
// product (rather than three near-identical files) is exactly the reusable
// "Product configuration model" the user's own master spec asked for (§10).
// ─────────────────────────────────────────────────────────────────────────────

export interface LabeledBoxInputs {
  /** Horizontal extent in mm — e.g. Width, or Length for Center Table. */
  primary: number;
  /** Vertical extent in mm — e.g. Height, or Width for Center Table. */
  secondary: number;
  /** Real depth in mm — omit entirely for products with no Depth (T.V., Center Table). Shown as the "/" diagonal leader, never a straight arrow, same convention as every other product. */
  depth?: number;
  primaryLabel: 'W' | 'L';
  secondaryLabel: 'H' | 'W';
}

export interface LabeledBoxConfig {
  productType: string;
  /** Text drawn centered inside the box, e.g. "T.V.", "SOFA", "CENTER TABLE". */
  boxLabel: string;
  title: string;
  color: string;
}

const DIAG = '#cc2200';

function insideDiagonal(cornerX: number, cornerY: number, w: number, h: number) {
  const insetX = Math.min(Math.min(w * 0.35, 70) * 2, w * 0.9);
  const insetY = Math.min(Math.min(h * 0.35, 55) * 2, h * 0.9);
  return { x2: cornerX + insetX, y2: cornerY + insetY };
}

export function resolveLabeledBoxPlan(inp: LabeledBoxInputs, cfg: LabeledBoxConfig): ResolvedDrawing {
  const { primary, secondary, depth } = inp;
  const hasDepth = depth !== undefined && depth > 0;
  const leaderMargin = 90; // room for the vertical (secondary) dimension on the left
  const topPad = hasDepth ? 90 : 40; // extra headroom only needed for the Depth diagonal

  const boxX = leaderMargin;
  const boxY = topPad;

  const components: ComponentSpec[] = [{
    id: 'box', type: 'LABELED_BOX', label: cfg.boxLabel, x: boxX, y: boxY, width: primary, height: secondary, qty: 1, visible: true,
    source: { formula: `${inp.primaryLabel} × ${inp.secondaryLabel} (both entered)${hasDepth ? ` | Depth = ${Math.round(depth!)}mm, shown as the / leader` : ''}`, constants: [] },
  }];

  const lines: AnnotationLine[] = [];
  if (hasDepth) {
    const diag = insideDiagonal(boxX, boxY, primary, secondary);
    lines.push({ x1: boxX, y1: boxY, x2: diag.x2, y2: diag.y2, color: DIAG, label: `${Math.round(depth!)} mm (D)` });
  }

  const dimReqs: DimensionRequest[] = [
    { axis: 'h', x1: boxX, y1: boxY + secondary, x2: boxX + primary, y2: boxY + secondary, edge: 'bottom', componentIds: ['box'], label: `${Math.round(primary)} mm (${inp.primaryLabel})`, source: { formula: `${inp.primaryLabel} (entered)`, constants: [] }, color: cfg.color },
    { axis: 'v', x1: boxX, y1: boxY, x2: boxX, y2: boxY + secondary, edge: 'left', componentIds: ['box'], label: `${Math.round(secondary)} mm (${inp.secondaryLabel})`, source: { formula: `${inp.secondaryLabel} (entered)`, constants: [] }, color: cfg.color },
  ];

  const worldWidth = Math.max(boxX + primary + 20, ...lines.map((l) => Math.max(l.x1, l.x2) + 10));
  const worldHeight = Math.max(boxY + secondary + 30, ...lines.map((l) => Math.max(l.y1, l.y2) + 10));

  const dimensions = resolveDimensions(dimReqs);
  const requiredFields = [
    { key: 'primary', label: inp.primaryLabel === 'L' ? 'Length' : 'Width', min: 1, value: primary },
    { key: 'secondary', label: inp.secondaryLabel === 'H' ? 'Height' : 'Width', min: 1, value: secondary },
  ];
  const issues = [
    ...validateMeasurements(
      Object.fromEntries(requiredFields.map((f) => [f.key, f.value])),
      requiredFields.map((f) => ({ key: f.key, label: f.label, min: f.min })),
    ),
    ...(hasDepth ? validateMeasurements({ depth: depth! }, [{ key: 'depth', label: 'Depth', min: 1 }]) : []),
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'plan', productType: cfg.productType, designId: 'simple', designName: cfg.title,
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines,
  };
}

export interface LabeledBoxCutRow {
  component: string;
  width: number;
  height: number;
  qty: number;
  remark: string;
}

/** Same one-row-per-real-dimension data used for both the screen and the PDF component table. */
export function labeledBoxCutlist(inp: LabeledBoxInputs, cfg: LabeledBoxConfig): LabeledBoxCutRow[] {
  const hasDepth = inp.depth !== undefined && inp.depth > 0;
  return [{
    component: cfg.boxLabel,
    width: inp.primary,
    height: inp.secondary,
    qty: 1,
    remark: `${inp.primaryLabel} × ${inp.secondaryLabel} (both entered)${hasDepth ? ` | Depth = ${Math.round(inp.depth!)}mm (entered)` : ''}`,
  }];
}

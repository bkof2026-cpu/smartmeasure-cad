import type { IShapeKitchenConfig } from '../../store/types';
import type { ClearSegment, KadappaSlot } from './iShapeKitchenGeometry';
import type { TrolleyTemplate } from './trolleyTemplates';
import { calculateNormalColumnWidth } from './trolleyTemplates';
import { getTrolleyPanelConfig, type PanelColumnConfig, type TrolleyPanelConfig } from './trolleyPanelConfig';
import type { TrolleyDimensionResult } from './trolleyDimensions';

// ─────────────────────────────────────────────────────────────────────────────
// Trolley PANEL calculation engine — the second, independent geometry layer
// drawn over/around the Inner Trolley in the Kitchen section. Consumes the
// ALREADY-CALCULATED Inner Trolley H×W (calculateTrolleyDimensions) and the
// selected template's own panel config (trolleyPanelConfig.ts) — never
// recomputes or mutates the Inner Trolley's own numbers.
//
//   PANEL WIDTH (per side) = Trolley Width + outer pipe + inner pipe
//                             allowance + side recovery + applicable
//                             Kadappa Width for that side.
//   PANEL HEIGHT (per column segment) = built from that column's own fixed
//                             trolley box(es) + the template's top
//                             allowance + Pani Patti Height, with a
//                             "remaining" segment soaking up whatever
//                             Kitchen Height is left; an SPO column instead
//                             uses Kitchen Height − its own top/bottom
//                             allowance.
// ─────────────────────────────────────────────────────────────────────────────

export interface PanelSegmentResult {
  label: string;
  kind: 'top' | 'fixed' | 'remaining' | 'spo';
  /** Top-left Y offset from the column's own panel origin (0 = top). */
  y: number;
  height: number;
}

export interface PanelColumnResult {
  side: 'left' | 'right' | 'center' | 'spo';
  /** This column's own panel width — side columns share the mirrored
   * side-panel formula; center/spo use their own independent rule. */
  width: number;
  widthBreakdown: { base: number; outerPipe: number; innerPipeAllowance: number; sideRecovery: number; kadappaWidth: number } | null;
  segments: PanelSegmentResult[];
  /** True for an SPO column — width is the template's OWN SPO width
   * (unchanged from the Inner Trolley), never the side-panel formula. */
  isSpo: boolean;
}

export interface TrolleyPanelResult {
  valid: boolean;
  invalidReason: string | null;
  columns: PanelColumnResult[];
  /** Kitchen Total Height every column's segments are built against —
   * carried here so callers/validation never need to re-derive it. */
  kitchenHeight: number;
}

/** Applicable Kadappa Width for one side of the selected section — the
 * width of whichever Kadappa slot sits immediately at that side's boundary
 * (fromLetter/toLetter), 0 when that boundary is a plain wall with no
 * Kadappa there. Never hardcoded — reads the real configured width so a
 * 40mm/60mm/no-Kadappa section all recover the correct amount (spec §7/§18). */
function kadappaWidthAtLetter(letter: string | null, sequence: KadappaSlot[]): number {
  if (letter === null) return 0;
  const slot = sequence.find((s) => s.letter === letter);
  return slot ? Math.max(0, slot.width) : 0;
}

function calcSidePanelWidth(
  trolleyWidth: number,
  cfg: TrolleyPanelConfig,
  kadappaWidth: number,
): { width: number; breakdown: PanelColumnResult['widthBreakdown'] } {
  const outerPipe = cfg.outerPipeMm;
  const innerPipeAllowance = cfg.innerPipeAllowanceMm;
  const sideRecovery = cfg.sideRecoveryMm;
  const width = trolleyWidth + outerPipe + innerPipeAllowance + sideRecovery + kadappaWidth;
  return { width, breakdown: { base: trolleyWidth, outerPipe, innerPipeAllowance, sideRecovery, kadappaWidth } };
}

/** A CENTER column sits between two other panel columns (never against an
 * outer wall/Kadappa) — per the user's own explicit correction, its width
 * formula is genuinely different from a side column's, not just the side
 * formula with kadappaWidth=0:
 *   Center Panel Width = Trolley Box Width + Inner Pipe Allowance × 2
 *                         (one allowance per side, both sides are pipes)
 * No Outer Pipe (there is no outer edge here), no Side Recovery (that only
 * applies at a real outer/Kadappa boundary), no Kadappa Width (there is
 * none at an internal boundary). */
function calcCenterPanelWidth(
  trolleyWidth: number,
  cfg: TrolleyPanelConfig,
): { width: number; breakdown: PanelColumnResult['widthBreakdown'] } {
  const innerPipeAllowance = cfg.innerPipeAllowanceMm * 2;
  const width = trolleyWidth + innerPipeAllowance;
  return { width, breakdown: { base: trolleyWidth, outerPipe: 0, innerPipeAllowance, sideRecovery: 0, kadappaWidth: 0 } };
}

/** Builds one column's vertical segment stack (spec §3/§5/§6/§9/§10) —
 * pure function of the column config + this template's fixedDimensions +
 * Kitchen Height + Pani Patti Height. Never touches Inner Trolley state. */
function buildColumnSegments(
  column: PanelColumnConfig,
  cfg: TrolleyPanelConfig,
  fixedDimensions: Record<string, number>,
  kitchenHeight: number,
  paniPattiHeight: number,
): PanelSegmentResult[] {
  const segments = column.segments ?? [];
  const result: PanelSegmentResult[] = [];
  let cursorY = 0;
  // Height already consumed by every segment ABOVE the current one, plus
  // one horizontal pipe after each — used to size the trailing "remaining"
  // segment as whatever Kitchen Height is left (spec §6/§9/§10: C/D are
  // never fixed, always the remainder).
  let consumedAboveRemaining = 0;

  segments.forEach((seg, i) => {
    const isLast = i === segments.length - 1;
    if (seg.kind === 'top') {
      const sourceBoxHeight = fixedDimensions[seg.sourceBoxKey] ?? 0;
      const height = sourceBoxHeight + cfg.topAllowanceMm + paniPattiHeight;
      result.push({ label: seg.label, kind: 'top', y: cursorY, height });
      cursorY += height + cfg.horizontalPipeMm;
      consumedAboveRemaining += height + cfg.horizontalPipeMm;
    } else if (seg.kind === 'fixed') {
      result.push({ label: seg.label, kind: 'fixed', y: cursorY, height: seg.height });
      cursorY += seg.height + cfg.horizontalPipeMm;
      consumedAboveRemaining += seg.height + cfg.horizontalPipeMm;
    } else {
      // 'remaining' — always the last segment in a column (spec §10): the
      // horizontal pipe already added after the PRECEDING segment is part
      // of consumedAboveRemaining, so it is not double-subtracted here.
      const height = Math.max(0, kitchenHeight - consumedAboveRemaining);
      result.push({ label: seg.label, kind: 'remaining', y: cursorY, height });
      if (!isLast) cursorY += height + cfg.horizontalPipeMm;
    }
  });

  return result;
}

/**
 * Calculates every panel column's width + height stack for the currently
 * selected trolley template + section. Returns null (via valid: false) when
 * no template/config/section is resolved yet — callers show that as an
 * unconfigured state, never a fabricated zero.
 */
export function calculateTrolleyPanels(
  iShape: IShapeKitchenConfig,
  template: TrolleyTemplate,
  sequence: KadappaSlot[],
  section: ClearSegment,
  trolleyDims: TrolleyDimensionResult,
  /** Usable vertical space the panel's own segments are built against —
   * defaults to the full Total Kitchen Height. The caller (
   * iShapeKitchenGeometry.ts) passes Kitchen Height minus its own
   * TROLLEY_PANEL_TOP_GAP_MM here, so a column's segments always sum to
   * exactly the space actually available below that gap — never the full
   * Kitchen Height, which would push the panel's own bottom edge past the
   * real kitchen floor by the size of the top gap. */
  usableHeight: number = iShape.height,
): TrolleyPanelResult {
  const cfg = getTrolleyPanelConfig(template.id);
  const kitchenHeight = usableHeight;
  const paniPattiHeight = iShape.paniPattiHeight;

  if (!cfg) {
    return { valid: false, invalidReason: `No panel configuration defined yet for trolley template "${template.id}".`, columns: [], kitchenHeight };
  }
  if (trolleyDims.finalWidth === null) {
    return { valid: false, invalidReason: 'Trolley Width is not resolved (no section selected).', columns: [], kitchenHeight };
  }

  const trolleyWidth = trolleyDims.finalWidth;
  const leftKadappaWidth = kadappaWidthAtLetter(section.fromLetter, sequence);
  const rightKadappaWidth = kadappaWidthAtLetter(section.toLetter, sequence);

  // The center column's own width — the only confirmed center structure
  // (spec §10/§11) is "same as the Inner Trolley's own calculated Normal
  // Column Width" for a plain fixed-box center column (7P-Only's B/Fixed/D
  // stack). An SPO center column instead keeps the SPO's own template
  // width untouched, handled in the per-column loop below.
  const normalColumnWidthResult = calculateNormalColumnWidth(template, trolleyWidth, iShape.spoValues ?? {});

  const columns: PanelColumnResult[] = cfg.columns.map((column) => {
    if (column.isSpo) {
      const spoField = template.spoFields[0];
      const spoWidth = spoField ? (iShape.spoValues?.[spoField.key] ?? spoField.default) : 0;
      const spoHeight = Math.max(0, kitchenHeight - (cfg.spoTopBottomAllowanceMm ?? 0));
      return {
        side: 'spo', width: spoWidth, widthBreakdown: null, isSpo: true,
        segments: [{ label: 'SPO', kind: 'spo', y: 0, height: spoHeight }],
      };
    }

    let width: number;
    let widthBreakdown: PanelColumnResult['widthBreakdown'] = null;
    // Every non-SPO column's OWN real box width — per the user's explicit
    // correction, the panel formula's base is this column's own Trolley
    // Box Width (e.g. 443mm), never the whole Trolley Width (e.g. 1410mm).
    // Side and center columns both start from the same per-column base;
    // only the deductions/allowances added on top differ.
    const columnBoxWidth = normalColumnWidthResult.normalColumnWidth;
    if (column.side === 'left') {
      const r = calcSidePanelWidth(columnBoxWidth, cfg, leftKadappaWidth);
      width = r.width; widthBreakdown = r.breakdown;
    } else if (column.side === 'right') {
      const r = calcSidePanelWidth(columnBoxWidth, cfg, rightKadappaWidth);
      width = r.width; widthBreakdown = r.breakdown;
    } else {
      // center — a genuinely different formula from the side columns
      // (calcCenterPanelWidth): Trolley Box Width + Inner Pipe Allowance
      // × 2, no Outer Pipe / Side Recovery / Kadappa (spec §10/§11, per
      // the user's explicit correction).
      const r = calcCenterPanelWidth(columnBoxWidth, cfg);
      width = r.width; widthBreakdown = r.breakdown;
    }

    const segments = buildColumnSegments(column, cfg, template.fixedDimensions, kitchenHeight, paniPattiHeight);
    return { side: column.side, width, widthBreakdown, isSpo: false, segments };
  });

  const invalidColumn = columns.find((c) => c.width <= 0 || c.segments.some((s) => s.height <= 0));
  return {
    valid: !invalidColumn,
    invalidReason: invalidColumn ? `Calculated panel geometry is invalid (a width or height resolved to <= 0mm) — check Kitchen/Pani Patti/Kadappa measurements.` : null,
    columns,
    kitchenHeight,
  };
}

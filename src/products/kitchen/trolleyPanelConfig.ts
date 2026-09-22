// ─────────────────────────────────────────────────────────────────────────────
// Trolley PANEL configuration — a second, independent geometry/calculation
// layer drawn in the Kitchen section over/around the Inner Trolley. Never
// changes the Inner Trolley's own H×W×D, box heights, or SPO values (those
// stay exactly as calculateTrolleyDimensions + buildInnerTrolley produce
// them). Each template below declares its OWN panel structure/constants —
// there is deliberately no single hardcoded formula for every trolley type.
//
//   PANEL WIDTH  (left/right side panels) — the calculated Trolley Width
//   plus back the deductions that were taken out of it, split by side:
//     Trolley Width + outerPipe(20) + innerPipeAllowance(9)
//                    + sideRecovery(15) + applicable Kadappa Width
//   The CENTER column (if any) is a separate, template-declared width rule
//   — never forced to match the side panels.
//
//   PANEL HEIGHT — built per-column from the column's own stack of fixed
//   trolley boxes: the FIRST fixed box in a column becomes a "top panel"
//   (sourceBoxHeight + topAllowance + Pani Patti Height); any additional
//   fixed boxes in that column stay literally fixed (never recalculated);
//   the column always ends with a "remaining" segment that takes whatever
//   Kitchen Height is left after every box above it and every horizontal
//   pipe between them. An SPO column instead gets
//   Kitchen Total Height − spoTopBottomAllowance (its own, different rule
//   from the Inner Trolley SPO's own Height = Total Trolley Height).
// ─────────────────────────────────────────────────────────────────────────────

/** One column's vertical stack of panel segments, top to bottom. */
export type PanelHeightSegment =
  /** sourceBoxHeight (read from the template's own fixedDimensions) +
   * topAllowance + Pani Patti Height — the FIRST box in a column. */
  | { kind: 'top'; label: string; sourceBoxKey: string }
  /** A later fixed box in the same column — kept exactly as configured,
   * never recalculated (e.g. the 200mm fixed center box). */
  | { kind: 'fixed'; label: string; height: number }
  /** Whatever Kitchen Height remains below everything above it in this
   * column, after every horizontal pipe between them — the column's own
   * empty/derived box. Never itself a fixed height. */
  | { kind: 'remaining'; label: string };

export interface PanelColumnConfig {
  /** Which side-width formula this column's panel uses. 'left'/'right' use
   * the side-panel recovery formula (mirrored); 'center' uses the
   * template's own centerPanelWidth (never forced equal to the sides).
   * 'spo' columns use the SPO's own template-defined width, unchanged. */
  side: 'left' | 'right' | 'center' | 'spo';
  /** Present only for side === 'spo' — this column has no calculated
   * fixed/remaining stack, just the one SPO panel box. */
  isSpo?: boolean;
  /** Vertical stack of segments, top to bottom. Ignored when isSpo. */
  segments?: PanelHeightSegment[];
}

export interface TrolleyPanelConfig {
  /** mm added back for the single outer-edge pipe on the side being
   * calculated (spec §4) — same physical PIPE_WIDTH_MM (20) as the Inner
   * Trolley's own pipes, but declared separately here since a future
   * template could use a different outer pipe. */
  outerPipeMm: number;
  /** mm added back for the first inner vertical pipe next to the section
   * boundary (spec §5) — intentionally NOT the full pipe width. */
  innerPipeAllowanceMm: number;
  /** mm recovered per side from the Inner Trolley Width's WIDTH_FIT_MM
   * deduction (spec §6) — HALF of WIDTH_FIT_MM, applied once per side,
   * never the full deduction to one side. */
  sideRecoveryMm: number;
  /** mm added on TOP of a column's first fixed box height + Pani Patti
   * Height when building that column's "top" panel segment (spec §3). */
  topAllowanceMm: number;
  /** Horizontal structural pipe thickness between vertically-stacked panel
   * segments in the same column (spec §13). */
  horizontalPipeMm: number;
  /** Kitchen Total Height − this = an SPO column's own external panel
   * height (spec §15) — distinct from the Inner Trolley SPO's own Height
   * (= Total Trolley Height). Absent when the template has no SPO. */
  spoTopBottomAllowanceMm?: number;
  /** How the CENTER column's panel width is derived, when this template
   * has a center column that isn't SPO (spec §10/§11) — never simply
   * copied from the side panels. `'sameAsInnerColumnWidth'` uses the
   * calculated Normal Column Width the Inner Trolley itself already
   * computed for that column (the only center structure the confirmed
   * templates currently have); a future template could need a different
   * rule, which is why this stays an explicit, named strategy rather than
   * an inline formula. */
  centerPanelWidthStrategy?: 'sameAsInnerColumnWidth';
  /** Left-to-right ordered columns this template's panel drawing has. */
  columns: PanelColumnConfig[];
}

const SIDE_PANEL_DEFAULTS = {
  outerPipeMm: 20,
  innerPipeAllowanceMm: 9,
  sideRecoveryMm: 15,
  topAllowanceMm: 55,
  horizontalPipeMm: 2,
};

// 7P-Only — Left[A,empty] Center[B,fixed200,empty] Right[A,empty] (mirrors
// the spec's own worked example exactly: A=left/right's top fixed box,
// B=center's top fixed box, fixed 200=center's own second fixed box).
const sevenPanelOnlyPanel: TrolleyPanelConfig = {
  ...SIDE_PANEL_DEFAULTS,
  columns: [
    { side: 'left', segments: [{ kind: 'top', label: 'A', sourceBoxKey: 'left' }, { kind: 'remaining', label: 'C' }] },
    { side: 'center', segments: [{ kind: 'top', label: 'B', sourceBoxKey: 'middleTop' }, { kind: 'fixed', label: 'Fixed', height: 200 }, { kind: 'remaining', label: 'D' }] },
    { side: 'right', segments: [{ kind: 'top', label: 'A', sourceBoxKey: 'right' }, { kind: 'remaining', label: 'C' }] },
  ],
  centerPanelWidthStrategy: 'sameAsInnerColumnWidth',
};

// 5P-Only — Left[A,empty] Right[B,fixed200,empty]. Only 2 columns, both
// side panels (no center column at all).
const fivePanelOnlyPanel: TrolleyPanelConfig = {
  ...SIDE_PANEL_DEFAULTS,
  columns: [
    { side: 'left', segments: [{ kind: 'top', label: 'A', sourceBoxKey: 'left' }, { kind: 'remaining', label: 'C' }] },
    { side: 'right', segments: [{ kind: 'top', label: 'B', sourceBoxKey: 'rightTop' }, { kind: 'fixed', label: 'Fixed', height: 200 }, { kind: 'remaining', label: 'D' }] },
  ],
};

// 4P-Only — Left[A,empty] Right[A,empty]. Two symmetric columns, both real
// side panels (no center, no SPO) — derived from the same confirmed
// side-panel Width formula (Trolley Box Width + Outer Pipe + Inner Pipe
// Allowance + Side Recovery + Kadappa) every other template already uses,
// and the same top(fixed)+remaining(empty) Height stack as 7P-Only/5P-Only's
// own side columns — this template's own Inner Trolley structure is
// exactly that shape (one 220mm fixed box + one empty box per column), so
// no new formula is invented here, only the established one applied.
const fourPanelOnlyPanel: TrolleyPanelConfig = {
  ...SIDE_PANEL_DEFAULTS,
  columns: [
    { side: 'left', segments: [{ kind: 'top', label: 'A', sourceBoxKey: 'left' }, { kind: 'remaining', label: 'C' }] },
    { side: 'right', segments: [{ kind: 'top', label: 'A', sourceBoxKey: 'right' }, { kind: 'remaining', label: 'C' }] },
  ],
};

// 2P-RSPO — Left[A,empty], Right = SPO.
const twoPanelRspoPanel: TrolleyPanelConfig = {
  ...SIDE_PANEL_DEFAULTS,
  spoTopBottomAllowanceMm: 15,
  columns: [
    { side: 'left', segments: [{ kind: 'top', label: 'A', sourceBoxKey: 'leftTop' }, { kind: 'remaining', label: 'C' }] },
    { side: 'spo', isSpo: true },
  ],
};

// 2P-LSPO — mirror: Left = SPO, Right[A,empty].
const twoPanelLspoPanel: TrolleyPanelConfig = {
  ...SIDE_PANEL_DEFAULTS,
  spoTopBottomAllowanceMm: 15,
  columns: [
    { side: 'spo', isSpo: true },
    { side: 'right', segments: [{ kind: 'top', label: 'A', sourceBoxKey: 'rightTop' }, { kind: 'remaining', label: 'C' }] },
  ],
};

// 3P-RSPO — Left[A,fixed200,empty], Right = SPO.
const threePanelRspoPanel: TrolleyPanelConfig = {
  ...SIDE_PANEL_DEFAULTS,
  spoTopBottomAllowanceMm: 15,
  columns: [
    { side: 'left', segments: [{ kind: 'top', label: 'A', sourceBoxKey: 'leftTop' }, { kind: 'fixed', label: 'Fixed', height: 200 }, { kind: 'remaining', label: 'C' }] },
    { side: 'spo', isSpo: true },
  ],
};

// 3P-LSPO — mirror: Left = SPO, Right[A,fixed200,empty].
const threePanelLspoPanel: TrolleyPanelConfig = {
  ...SIDE_PANEL_DEFAULTS,
  spoTopBottomAllowanceMm: 15,
  columns: [
    { side: 'spo', isSpo: true },
    { side: 'right', segments: [{ kind: 'top', label: 'A', sourceBoxKey: 'rightTop' }, { kind: 'fixed', label: 'Fixed', height: 200 }, { kind: 'remaining', label: 'C' }] },
  ],
};

// 5P-CSPO — Left[A,empty], Center = SPO, Right[A,fixed200,empty].
const fivePanelCspoPanel: TrolleyPanelConfig = {
  ...SIDE_PANEL_DEFAULTS,
  spoTopBottomAllowanceMm: 15,
  columns: [
    { side: 'left', segments: [{ kind: 'top', label: 'A', sourceBoxKey: 'leftTop' }, { kind: 'remaining', label: 'C' }] },
    { side: 'spo', isSpo: true },
    { side: 'right', segments: [{ kind: 'top', label: 'A', sourceBoxKey: 'rightTop' }, { kind: 'fixed', label: 'Fixed', height: 200 }, { kind: 'remaining', label: 'C' }] },
  ],
};

// 5P-LSPO — Left = SPO, Middle[A,empty], Right[A,fixed200,empty].
const fivePanelLspoPanel: TrolleyPanelConfig = {
  ...SIDE_PANEL_DEFAULTS,
  spoTopBottomAllowanceMm: 15,
  columns: [
    { side: 'spo', isSpo: true },
    { side: 'left', segments: [{ kind: 'top', label: 'A', sourceBoxKey: 'middleTop' }, { kind: 'remaining', label: 'C' }] },
    { side: 'right', segments: [{ kind: 'top', label: 'A', sourceBoxKey: 'rightTop' }, { kind: 'fixed', label: 'Fixed', height: 200 }, { kind: 'remaining', label: 'C' }] },
  ],
};

export const TROLLEY_PANEL_CONFIGS: Record<string, TrolleyPanelConfig> = {
  '7p-only': sevenPanelOnlyPanel,
  '5p-only': fivePanelOnlyPanel,
  '2p-rspo': twoPanelRspoPanel,
  '2p-lspo': twoPanelLspoPanel,
  '3p-rspo': threePanelRspoPanel,
  '3p-lspo': threePanelLspoPanel,
  '5p-cspo': fivePanelCspoPanel,
  '5p-lspo': fivePanelLspoPanel,
  '4p-only': fourPanelOnlyPanel,
};

export function getTrolleyPanelConfig(templateId: string | null | undefined): TrolleyPanelConfig | null {
  if (!templateId) return null;
  return TROLLEY_PANEL_CONFIGS[templateId] ?? null;
}

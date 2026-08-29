import type { ComponentSpec, DimensionLine } from './types';
import { constantValue } from './constants';

export interface TraceRow {
  label: string;
  detail: string;
}

/** Powers the Drawing Inspector: id/type/position/size/formula-source/status for one component. */
export function traceComponent(c: ComponentSpec): TraceRow[] {
  const rows: TraceRow[] = [
    { label: 'Component', detail: c.label },
    { label: 'Type', detail: c.type },
    { label: 'Position', detail: `X: ${Math.round(c.x)}mm  Y: ${Math.round(c.y)}mm` },
    { label: 'Size', detail: `W: ${Math.round(c.width)}mm  H: ${Math.round(c.height)}mm${c.depth ? `  D: ${Math.round(c.depth)}mm` : ''}` },
    { label: 'Qty', detail: String(c.qty) },
    { label: 'Formula', detail: c.source.formula },
  ];
  if (c.source.constants.length) {
    rows.push({
      label: 'Constants used',
      detail: c.source.constants.map((name) => `${name}=${constantValue(name) ?? '?'}`).join(', '),
    });
  }
  if (c.source.fixed) rows.push({ label: 'Note', detail: 'Fixed size in verified source data — not derived from W/H/D.' });
  if (c.source.needsVerification) rows.push({ label: '⚠ Needs verification', detail: c.source.note ?? 'Flagged uncertain in the source formula sheet.' });
  rows.push({ label: 'Status', detail: c.source.needsVerification ? '⚠ Needs shop-floor confirmation' : '✓ Valid' });
  return rows;
}

/** Powers "why this dimension?": measurement -> constants -> formula -> result. */
export function traceDimension(d: DimensionLine): TraceRow[] {
  const rows: TraceRow[] = [
    { label: 'Dimension', detail: `${Math.round(d.valueMm)} mm` },
    { label: 'Formula', detail: d.source.formula },
  ];
  if (d.source.constants.length) {
    rows.push({
      label: 'Constants used',
      detail: d.source.constants.map((name) => `${name}=${constantValue(name) ?? '?'}`).join(', '),
    });
  }
  rows.push({ label: 'Result', detail: `= ${Math.round(d.valueMm)} mm` });
  return rows;
}

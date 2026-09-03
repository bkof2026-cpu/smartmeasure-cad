import React from 'react';
import type { ComponentSpec, DimensionLine, FormulaStatus, ValidationIssue } from './types';
import { traceComponent, traceDimension } from './traceabilityEngine';

interface Props {
  selected: ComponentSpec | DimensionLine | null;
  issues: ValidationIssue[];
  formulaStatus: FormulaStatus;
}

const STATUS_BADGE: Record<FormulaStatus, { text: string; bg: string; fg: string }> = {
  verified: { text: '✓ Formula Verified — matched to real historical orders', bg: '#14532d', fg: '#86efac' },
  not_verified: { text: '~ Formula Not Verified — pending real order data', bg: '#1a1000', fg: '#fcd34d' },
  not_configured: { text: '✕ Not Configured', bg: '#3f0f0f', fg: '#fca5a5' },
};

function isComponent(x: ComponentSpec | DimensionLine): x is ComponentSpec {
  return 'type' in x;
}

export const DrawingInspector: React.FC<Props> = ({ selected, issues, formulaStatus }) => {
  const badge = STATUS_BADGE[formulaStatus];
  const critical = issues.filter((i) => i.severity === 'CRITICAL' || i.severity === 'ERROR');
  // Advisory-only issues — shown distinctly from `critical` (amber, not
  // red; never blocks PDF/"issue count" badge above) so a product can
  // surface a non-blocking heads-up (e.g. Kitchen Cabinet's "door width
  // exceeds 400mm" — spec explicitly wants this shown but never auto-
  // correcting the user's own entered values) without it reading as a
  // real validation failure the way CRITICAL/ERROR does.
  const warnings = issues.filter((i) => i.severity === 'WARNING');

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: badge.bg, color: badge.fg }}>{badge.text}</span>
        <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: critical.length ? '#3f0f0f' : '#14532d', color: critical.length ? '#fca5a5' : '#86efac' }}>
          {critical.length ? `${critical.length} issue${critical.length > 1 ? 's' : ''}` : 'PDF READY'}
        </span>
      </div>

      {critical.length > 0 && (
        <div className="rounded-lg p-2 text-xs" style={{ background: '#1a0f0f', border: '1px solid #4c1d1d', color: '#fca5a5' }}>
          {critical.map((i) => <div key={i.id}>⚠ {i.message}</div>)}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg p-2 text-xs" style={{ background: '#1a1000', border: '1px solid #7c5a12', color: '#fcd34d' }}>
          {warnings.map((i) => <div key={i.id}>⚠ {i.message}</div>)}
        </div>
      )}

      {selected && (
        <div className="rounded-lg p-3 text-xs font-mono" style={{ background: '#0f172a', border: '1px solid #243045', color: '#cbd5e1' }}>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: '#60a5fa' }}>
            {isComponent(selected) ? 'Component' : 'Dimension — why this value?'}
          </div>
          {(isComponent(selected) ? traceComponent(selected) : traceDimension(selected)).map((row, i) => (
            <div key={i} className="flex justify-between gap-3 py-0.5">
              <span style={{ color: '#64748b' }}>{row.label}</span>
              <span className="text-right">{row.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { TechnicalDrawingSvg, type ComponentStyle } from '../../engine/CanonicalSvg';
import { resolveDiningTablePlan, diningTableTitle, type DiningTableInputs, type DiningTableType } from './diningTableGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);

interface Props {
  dims: Record<string, number | string>;
}

function parseType(v: number | string | undefined): DiningTableType {
  return String(v ?? 'Folding Dining Table').toLowerCase().startsWith('simple') ? 'simple' : 'folding';
}

function diningTableStyle(c: ComponentSpec): ComponentStyle {
  if (c.id === 'dining-top') return { fill: '#fff7ea', stroke: '#f59e0b', strokeWidth: 1.2 };
  return { fill: '#f0eee8', stroke: '#3b82f6', strokeWidth: 1.2 };
}

/**
 * Replaces the legacy DiningTableDrawing (kept on disk, unwired, for
 * reference) — routed through the shared engine like every other migrated
 * product, per the Dining Table Type dropdown (Folding / Simple).
 */
export const DiningTableDrawing2: React.FC<Props> = ({ dims }) => {
  const inp: DiningTableInputs = {
    type: parseType(dims.diningType),
    foldW: n(dims.foldW) || 900,
    foldL: n(dims.foldL) || 1500,
    boxL: n(dims.boxL) || 1800,
    boxW: n(dims.boxW) || 900,
    boxD: n(dims.boxD) || 750,
    topL: n(dims.topL) || 1600,
    topW: n(dims.topW) || 700,
  };
  const drawing = resolveDiningTablePlan(inp);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={diningTableTitle(inp)}
        components={drawing.components}
        dimensions={drawing.dimensions}
        lines={drawing.lines}
        shapes={drawing.shapes}
        componentStyle={diningTableStyle}
        onSelectComponent={setSelected}
        onSelectDimension={setSelected}
        selectedComponentId={selected && 'type' in selected ? selected.id : null}
      />
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
    </div>
  );
};

export default DiningTableDrawing2;

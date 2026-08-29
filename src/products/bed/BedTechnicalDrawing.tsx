import React, { useState } from 'react';
import { TechnicalDrawingSvg } from '../../engine/CanonicalSvg';
import { resolveBedFront, resolveBedPlan, resolveBedSide, type SideTableZone } from './bedGeometry';
import type { BedInputs } from './bedFormulas';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);

function bedInputsFrom(dims: Record<string, number | string>): BedInputs {
  return {
    W: n(dims.W), L: n(dims.L), H: n(dims.H), D: n(dims.D),
    headboardH: n(dims.headboardH), thk: n(dims.thk) || 18,
    skirtingH: n(dims.skirtingH) || 100,
    includeHeadboard: dims.includeHeadboard === undefined ? true : Number(dims.includeHeadboard) === 1,
    includeHydraulic: Number(dims.includeHydraulic) === 1,
  };
}

interface Props {
  dims: Record<string, number | string>;
  activeView: string;
  sideTables?: SideTableZone[];
}

export const BedTechnicalDrawing: React.FC<Props> = ({ dims, activeView, sideTables = [] }) => {
  const inp = bedInputsFrom(dims);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  const L = n(dims.L) || inp.H * 2;
  const drawing = activeView === 'plan'
    ? resolveBedPlan(inp, L, sideTables)
    : activeView === 'side'
    ? resolveBedSide(inp, L)
    : resolveBedFront(inp, sideTables);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={`BED ${activeView.toUpperCase()} — ${Math.round(drawing.worldWidth)}×${Math.round(drawing.worldHeight)} mm`}
        components={drawing.components}
        dimensions={drawing.dimensions}
        onSelectComponent={setSelected}
        onSelectDimension={setSelected}
        selectedComponentId={selected && 'type' in selected ? selected.id : null}
      />
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
    </div>
  );
};

export default BedTechnicalDrawing;

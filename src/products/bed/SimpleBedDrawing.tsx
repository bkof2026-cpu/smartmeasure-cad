import React, { useState } from 'react';
import { TechnicalDrawingSvg } from '../../engine/CanonicalSvg';
import { resolveSimpleBedPlan, simpleBedTitle, type SimpleBedInputs, type SimpleSideTableInput } from './simpleBedGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);
const DEFAULT_ST: SimpleSideTableInput = { enabled: false, depthMm: 460, widthMm: 560 };

interface Props {
  dims: Record<string, number | string>;
  lst?: SimpleSideTableInput;
  rst?: SimpleSideTableInput;
}

export const SimpleBedDrawing: React.FC<Props> = ({ dims, lst, rst }) => {
  const H = n(dims.H);
  const inp: SimpleBedInputs = {
    W: n(dims.W), L: n(dims.L), H,
    headboardH: n(dims.headboardH) || 900,
    lst: lst ?? DEFAULT_ST,
    rst: rst ?? DEFAULT_ST,
  };
  const drawing = resolveSimpleBedPlan(inp);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={`${simpleBedTitle(inp)} — ${Math.round(inp.W)}×${Math.round(inp.L)} mm (H = ${Math.round(H)}mm)`}
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

export default SimpleBedDrawing;

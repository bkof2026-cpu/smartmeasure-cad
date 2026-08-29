import React, { useState } from 'react';
import { TechnicalDrawingSvg } from '../../engine/CanonicalSvg';
import { DrawingInspector } from '../../engine/DrawingInspector';
import { resolveBoxFront, resolveBoxPlan, resolveBoxSide } from './boxGeometry';
import type { BoxInputs } from './boxFormulas';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);

function boxInputsFrom(dims: Record<string, number | string>): BoxInputs {
  return {
    W: n(dims.W), H: n(dims.H), D: n(dims.D), thk: n(dims.thk) || 18,
    verticalQty: Math.max(0, n(dims.boxes) - 1), shelfQty: 0,
    includeBack: true, includeDoor: Number(dims.hasDoor) === 1,
  };
}

interface Props {
  dims: Record<string, number | string>;
  activeView: string;
}

export const BoxTechnicalDrawing: React.FC<Props> = ({ dims, activeView }) => {
  const inp = boxInputsFrom(dims);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  const drawing = activeView === 'plan' ? resolveBoxPlan(inp)
    : activeView === 'side' ? resolveBoxSide(inp)
    : resolveBoxFront(inp);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={`LOFT CABINET ${activeView.toUpperCase()} — ${Math.round(drawing.worldWidth)}×${Math.round(drawing.worldHeight)} mm`}
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

export default BoxTechnicalDrawing;

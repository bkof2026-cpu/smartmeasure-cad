import React, { useState } from 'react';
import { TechnicalDrawingSvg } from '../../engine/CanonicalSvg';
import { resolveSimpleSideTablePlan, simpleSideTableTitle, type SimpleSideTableInputs } from './simpleSideTableGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);

interface Props {
  dims: Record<string, number | string>;
}

export const SimpleSideTableDrawing: React.FC<Props> = ({ dims }) => {
  const inp: SimpleSideTableInputs = {
    W: n(dims.W) || 500,
    H: n(dims.H) || 550,
    D: n(dims.D) || 400,
    doors: n(dims.doors) || 2,
  };
  const drawing = resolveSimpleSideTablePlan(inp);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={simpleSideTableTitle(inp)}
        components={drawing.components}
        dimensions={drawing.dimensions}
        lines={drawing.lines}
        onSelectComponent={setSelected}
        onSelectDimension={setSelected}
        selectedComponentId={selected && 'type' in selected ? selected.id : null}
      />
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
    </div>
  );
};

export default SimpleSideTableDrawing;

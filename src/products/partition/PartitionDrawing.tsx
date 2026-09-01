import React, { useState } from 'react';
import { TechnicalDrawingSvg, type ComponentStyle } from '../../engine/CanonicalSvg';
import { resolvePartitionPlan, partitionTitle, type PartitionInputs } from './partitionGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);

interface Props {
  dims: Record<string, number | string>;
}

function partitionStyle(): ComponentStyle {
  return { fill: '#f0eee8', stroke: '#111827', strokeWidth: 1.2 };
}

export const PartitionDrawing: React.FC<Props> = ({ dims }) => {
  const inp: PartitionInputs = {
    type: String(dims.type ?? 'With Framing').toLowerCase().includes('partition') ? 'partition' : 'framing',
    H: n(dims.H) || 2100,
    W: n(dims.W) || 900,
    D: n(dims.D) || 400,
    side: String(dims.side ?? 'Left').toLowerCase() === 'right' ? 'right' : 'left',
  };
  const drawing = resolvePartitionPlan(inp);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={partitionTitle(inp)}
        components={drawing.components}
        dimensions={drawing.dimensions}
        lines={drawing.lines}
        componentStyle={partitionStyle}
        onSelectComponent={setSelected}
        onSelectDimension={setSelected}
        selectedComponentId={selected && 'type' in selected ? selected.id : null}
      />
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
    </div>
  );
};

export default PartitionDrawing;

import React, { useState } from 'react';
import { TechnicalDrawingSvg, type ComponentStyle } from '../../engine/CanonicalSvg';
import { resolveSeparateSideTablePlan, type SeparateSideTableInputs } from './separateSideTableGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);

interface Props {
  dims: Record<string, number | string>;
}

function componentStyle(c: ComponentSpec): ComponentStyle {
  const stroke = c.id === 'mirror' ? '#111827' : c.id.startsWith('base-storage') ? '#0891b2' : '#333';
  return { fill: '#f0eee8', stroke, strokeWidth: 1.2 };
}

export const SeparateSideTableDrawing: React.FC<Props> = ({ dims }) => {
  const inp: SeparateSideTableInputs = {
    mirrorW: n(dims.mirrorW) || 500,
    mirrorH: n(dims.mirrorH) || 700,
    baseH: n(dims.baseH) || 600,
    baseW: n(dims.baseW) || 500,
    baseD: n(dims.baseD) || 400,
  };
  const drawing = resolveSeparateSideTablePlan(inp);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title="SEPARATE SIDE TABLE"
        components={drawing.components}
        dimensions={drawing.dimensions}
        lines={drawing.lines}
        componentStyle={componentStyle}
        onSelectComponent={setSelected}
        onSelectDimension={setSelected}
        selectedComponentId={selected && 'type' in selected ? selected.id : null}
      />
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
    </div>
  );
};

export default SeparateSideTableDrawing;

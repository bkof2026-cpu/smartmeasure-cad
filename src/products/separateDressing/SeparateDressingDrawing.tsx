import React, { useState } from 'react';
import { TechnicalDrawingSvg } from '../../engine/CanonicalSvg';
import { resolveSeparateDressingPlan, type SeparateDressingInputs } from './separateDressingGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);

interface Props {
  dims: Record<string, number | string>;
}

export const SeparateDressingDrawing: React.FC<Props> = ({ dims }) => {
  const W = n(dims.W) || 1200;
  const inp: SeparateDressingInputs = {
    H: n(dims.H) || 2100,
    W,
    D: n(dims.D) || 600,
    dressingBoxH: n(dims.dressingBoxH) || 1400,
    baseStorageH: n(dims.baseStorageH) || 700,
    // Defaults to Total Width when not explicitly set — the "no duplicate
    // dimension when identical" rule only kicks in once this is actually
    // entered differently.
    baseStorageW: dims.baseStorageW !== undefined && dims.baseStorageW !== '' ? n(dims.baseStorageW) : W,
  };
  const drawing = resolveSeparateDressingPlan(inp);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title="SEPARATE DRESSING"
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

export default SeparateDressingDrawing;

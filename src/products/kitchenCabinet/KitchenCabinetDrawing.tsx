import React, { useState } from 'react';
import { TechnicalDrawingSvg, type ComponentStyle } from '../../engine/CanonicalSvg';
import { resolveKitchenCabinetPlan, kitchenCabinetTitle, type KitchenCabinetInputs } from './kitchenCabinetGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);

interface Props {
  dims: Record<string, number | string>;
}

// Main cabinet + doors → black (§18); Open Box → blue. Matched by id/type
// prefix, same convention as every other multi-zone product this session
// (Separate Dressing, Study Table's storage bands).
function kitchenCabinetComponentStyle(c: ComponentSpec): ComponentStyle {
  if (c.id === 'open-box') return { fill: '#eaf2ff', stroke: '#3b82f6', strokeWidth: 1.5 };
  return { fill: '#f0eee8', stroke: '#111827', strokeWidth: 1.2 };
}

export const KitchenCabinetDrawing: React.FC<Props> = ({ dims }) => {
  const W = n(dims.W) || 2000;
  const inp: KitchenCabinetInputs = {
    H: n(dims.H) || 720,
    W,
    D: n(dims.D) || 560,
    doorCount: n(dims.doorCount) || 2,
    addOpenBox: Number(dims.addOpenBox ?? 0) === 1,
    openBoxH: n(dims.openBoxH) || 150,
    // Defaults to Total Width when not explicitly set (§10) — matches the
    // established "no duplicate dimension" default pattern already used
    // for Separate Dressing's Base Storage Width.
    openBoxW: dims.openBoxW !== undefined && dims.openBoxW !== '' ? n(dims.openBoxW) : 0,
    profileLight: Number(dims.profileLight ?? 0) === 1,
  };
  const drawing = resolveKitchenCabinetPlan(inp);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={kitchenCabinetTitle(inp)}
        components={drawing.components}
        dimensions={drawing.dimensions}
        lines={drawing.lines}
        componentStyle={kitchenCabinetComponentStyle}
        onSelectComponent={setSelected}
        onSelectDimension={setSelected}
        selectedComponentId={selected && 'type' in selected ? selected.id : null}
      />
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
    </div>
  );
};

export default KitchenCabinetDrawing;

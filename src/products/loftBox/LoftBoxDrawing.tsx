import React, { useState } from 'react';
import { TechnicalDrawingSvg, type ComponentStyle } from '../../engine/CanonicalSvg';
import { resolveLoftBoxPlan, loftBoxTitle, type LoftBoxInputs } from './loftBoxGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);

interface Props {
  dims: Record<string, number | string>;
}

function loftBoxStyle(): ComponentStyle {
  return { fill: '#f0eee8', stroke: '#3b82f6', strokeWidth: 1.2 };
}

export const LoftBoxDrawing: React.FC<Props> = ({ dims }) => {
  const inp: LoftBoxInputs = {
    H: n(dims.H) || 600,
    W: n(dims.W) || 1000,
    D: n(dims.D) || 400,
    onlyShutter: Number(dims.onlyShutter ?? 0) === 1,
    shutterCount: n(dims.shutterCount) || 6,
    topPanel: Number(dims.topPanel ?? 0) === 1,
    // Base measurementFields store a 'select' as its literal option string
    // (never an index) — unlike addon fields, which store an index.
    topPanelSide: String(dims.topPanelSide ?? 'Left').toLowerCase() === 'right' ? 'right' : 'left',
    topPanelWidth: n(dims.topPanelWidth) || 300,
  };
  const drawing = resolveLoftBoxPlan(inp);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={loftBoxTitle(inp)}
        components={drawing.components}
        dimensions={drawing.dimensions}
        lines={drawing.lines}
        componentStyle={loftBoxStyle}
        onSelectComponent={setSelected}
        onSelectDimension={setSelected}
        selectedComponentId={selected && 'type' in selected ? selected.id : null}
      />
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
    </div>
  );
};

export default LoftBoxDrawing;

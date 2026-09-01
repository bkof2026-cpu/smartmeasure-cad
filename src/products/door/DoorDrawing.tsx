import React, { useState } from 'react';
import { TechnicalDrawingSvg, type ComponentStyle } from '../../engine/CanonicalSvg';
import { resolveDoorPlan, doorTitle, type DoorInputs, type DoorSide } from './doorGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);

interface Props {
  dims: Record<string, number | string>;
}

function parseSide(v: number | string | undefined): DoorSide {
  const s = String(v ?? 'None').toLowerCase();
  if (s === 'left' || s === 'right' || s === 'both') return s;
  return 'none';
}

// Component color system (spec §13): Door / Side Panel / Top each get one
// consistent color, used for the component's own outline AND its matching
// dimension lines (see doorGeometry.ts's dimReqs `color` fields) — never a
// random color per drawing.
function doorStyle(c: ComponentSpec): ComponentStyle {
  if (c.id.startsWith('side-panel')) return { fill: '#eafbff', stroke: '#0891b2', strokeWidth: 1.2 };
  if (c.id === 'top') return { fill: '#f5f0ff', stroke: '#7c3aed', strokeWidth: 1.2 };
  return { fill: '#eef4ff', stroke: '#3b82f6', strokeWidth: 1.2 };
}

export const DoorDrawing: React.FC<Props> = ({ dims }) => {
  const sidePanel = parseSide(dims.sidePanel);
  const inp: DoorInputs = {
    H: n(dims.H) || 2100,
    W: n(dims.W) || 900,
    sidePanel,
    sidePanelWLeft: n(dims.sidePanelWLeft) || 300,
    sidePanelWRight: n(dims.sidePanelWRight) || 300,
    addTop: Number(dims.addTop ?? 0) === 1,
    topH: n(dims.topH) || 300,
    // 0/unset reads as "inherit Door Width" inside resolveDoorPlan — the
    // measurement form's own default value is also wired to Door Width
    // (see productRegistry.tsx) so the field shows the real number, not 0.
    topW: n(dims.topW),
  };
  const drawing = resolveDoorPlan(inp);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={doorTitle(inp)}
        components={drawing.components}
        dimensions={drawing.dimensions}
        lines={drawing.lines}
        componentStyle={doorStyle}
        onSelectComponent={setSelected}
        onSelectDimension={setSelected}
        selectedComponentId={selected && 'type' in selected ? selected.id : null}
      />
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
    </div>
  );
};

export default DoorDrawing;

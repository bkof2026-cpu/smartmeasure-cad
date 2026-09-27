import React, { useState } from 'react';
import { TechnicalDrawingSvg, defaultStyleFor, type ComponentStyle } from '../../engine/CanonicalSvg';
import { resolveLShapeKitchenPlan, type LShapeKitchenDrawingInputs } from './lShapeKitchenGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';
import type { LShapeKitchenConfig } from '../../store/types';
// Same component-type -> style map I-Shape Kitchen uses — L-Shape draws the
// exact same component TYPES (KITCHEN_BODY, PANI_PATTI, KADAPPA_LINE,
// TROLLEY_*, SIDE_SECTION_DOOR, FIX_PATTI, ...) per wall, plus the Corner
// Fix Patti which reuses the existing FIX_PATTI style directly (it IS a
// Fix Patti, conceptually — see lShapeKitchenGeometry.ts's resolveLShapeCorner).
import { I_SHAPE_COMPONENT_COLORS } from './IShapeKitchenDrawing';

function componentStyle(c: ComponentSpec): ComponentStyle {
  return I_SHAPE_COMPONENT_COLORS[c.type] ?? defaultStyleFor(c);
}

interface Props {
  lShape: LShapeKitchenConfig;
}

export const LShapeKitchenDrawing: React.FC<Props> = ({ lShape }) => {
  const inp: LShapeKitchenDrawingInputs = { lShape };
  const drawing = resolveLShapeKitchenPlan(inp);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={`L-SHAPE KITCHEN — Wall A ${Math.round(lShape.wallA.width)} × Wall B ${Math.round(lShape.wallB.width)} mm`}
        components={drawing.components}
        dimensions={drawing.dimensions}
        lines={drawing.lines}
        noteBoxes={drawing.noteBoxes}
        componentStyle={componentStyle}
        onSelectComponent={setSelected}
        onSelectDimension={setSelected}
        selectedComponentId={selected && 'type' in selected ? selected.id : null}
        // L-Shape's own real-world footprint (two full walls + a stacked
        // Inner Trolley detail column below both) is substantially larger
        // than any single-wall drawing — the default 1280x960 viewport
        // forced `scale` down so far that dimension-tier gaps (a fixed
        // SCREEN-px step) collapsed to just a couple of px in world-mm
        // terms, which is what read as "values hiding inside other
        // values." A bigger internal viewport buys back that resolution
        // directly (this only changes internal mm-per-px precision, not
        // the on-screen CSS size — TechnicalDrawingSvg always renders at
        // width="100%" of its container either way).
        maxVw={2200}
        maxVh={2600}
      />
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
    </div>
  );
};

export default LShapeKitchenDrawing;

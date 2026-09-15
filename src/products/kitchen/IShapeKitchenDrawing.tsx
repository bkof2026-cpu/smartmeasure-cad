import React, { useState } from 'react';
import { TechnicalDrawingSvg, defaultStyleFor, type ComponentStyle } from '../../engine/CanonicalSvg';
import { resolveIShapeKitchenPlan, type IShapeKitchenDrawingInputs } from './iShapeKitchenGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';
import type { IShapeKitchenConfig } from '../../store/types';

const I_SHAPE_COMPONENT_COLORS: Record<string, ComponentStyle> = {
  PANI_PATTI:           { fill: '#f5f3ff', stroke: '#7c3aed', strokeWidth: 2 },
  KADAPPA_WALL:         { fill: '#f0fdfa', stroke: '#0f766e', strokeWidth: 1.4 },
  KADAPPA_INNER:        { fill: '#eff6ff', stroke: '#1d4ed8', strokeWidth: 1.4 },
  TROLLEY_OUTER:        { fill: '#fef3c7', stroke: '#b45309', strokeWidth: 1.6 },
  TROLLEY_INNER_DETAIL: { fill: '#fff7ed', stroke: '#b45309', strokeWidth: 1.1 },
};

function componentStyle(c: ComponentSpec): ComponentStyle {
  return I_SHAPE_COMPONENT_COLORS[c.type] ?? defaultStyleFor(c);
}

interface Props {
  iShape: IShapeKitchenConfig;
}

export const IShapeKitchenDrawing: React.FC<Props> = ({ iShape }) => {
  const inp: IShapeKitchenDrawingInputs = { iShape };
  const drawing = resolveIShapeKitchenPlan(inp);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={`I-SHAPE KITCHEN — ${Math.round(iShape.width)}×${Math.round(iShape.height)} mm`}
        components={drawing.components}
        dimensions={drawing.dimensions}
        lines={drawing.lines}
        noteBoxes={drawing.noteBoxes}
        componentStyle={componentStyle}
        onSelectComponent={setSelected}
        onSelectDimension={setSelected}
        selectedComponentId={selected && 'type' in selected ? selected.id : null}
      />
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
    </div>
  );
};

export default IShapeKitchenDrawing;

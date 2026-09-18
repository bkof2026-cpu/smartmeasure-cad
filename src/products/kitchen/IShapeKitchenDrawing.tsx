import React, { useState } from 'react';
import { TechnicalDrawingSvg, defaultStyleFor, type ComponentStyle } from '../../engine/CanonicalSvg';
import { resolveIShapeKitchenPlan, type IShapeKitchenDrawingInputs } from './iShapeKitchenGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';
import type { IShapeKitchenConfig } from '../../store/types';

const I_SHAPE_COMPONENT_COLORS: Record<string, ComponentStyle> = {
  KITCHEN_BODY:         { fill: '#ffffff', stroke: '#111827', strokeWidth: 2 },
  PANI_PATTI:           { fill: '#f5f3ff', stroke: '#7c3aed', strokeWidth: 2 },
  KADAPPA_BOX:          { fill: '#e0f2fe', stroke: '#0284c7', strokeWidth: 1.6 },
  TROLLEY_OUTER:        { fill: '#fef3c7', stroke: '#b45309', strokeWidth: 1.6 },
  TROLLEY_INNER_DETAIL: { fill: '#fff7ed', stroke: '#b45309', strokeWidth: 1.1 },
  // Unfilled outline (transparent) so it never occludes the real template
  // content it wraps — represents the actual calculated Trolley H×W
  // bounding box, drawn as a bold outer border around everything else.
  TROLLEY_OUTER_BOUND:  { fill: 'transparent', stroke: '#b45309', strokeWidth: 2.4 },
  TROLLEY_INNER_SPO:    { fill: '#f3e8ff', stroke: '#9333ea', strokeWidth: 1.4 },
  // Dashed outline + no fill reads as "not yet dimensioned" at a glance —
  // a real structural box the reference drawing shows, but whose exact
  // size is still DERIVED DIMENSION — FORMULA TO BE PROVIDED, never
  // invented here.
  TROLLEY_INNER_EMPTY:  { fill: '#ffffff', stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 3' },
  // Real physical 20mm structural pipe — solid dark fill so it visually
  // reads as a genuine separator, distinct from every labeled box.
  TROLLEY_INNER_PIPE:   { fill: '#44403c', stroke: '#292524', strokeWidth: 0.5 },
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

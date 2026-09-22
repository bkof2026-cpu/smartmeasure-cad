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
  // TROLLEY PANEL — the second, independent geometry layer (see
  // trolleyPanelCalc.ts) drawn over/around the Inner Trolley in the
  // Kitchen section. Deliberately a different fill from every
  // TROLLEY_INNER_* style so it never reads as the same layer.
  TROLLEY_PANEL:        { fill: '#dcfce7', stroke: '#15803d', strokeWidth: 1.4 },
  TROLLEY_PANEL_SPO:    { fill: '#ede9fe', stroke: '#7c3aed', strokeWidth: 1.4 },
  TROLLEY_PANEL_PIPE:   { fill: '#166534', stroke: '#14532d', strokeWidth: 0.5 },
  // Left/Right Trolley Panel columns — per the user's own reference
  // sketch, these show NO visible box border at all (just each segment's
  // own plain "295(h)"-style height text + tick, drawn via the panel's
  // own AnnotationLines) — fully transparent fill AND stroke so the
  // component still exists (for bounds/click-select) but draws nothing.
  TROLLEY_PANEL_UNBORDERED: { fill: 'transparent', stroke: 'transparent', strokeWidth: 0 },
  // Side Section Door(s) — the plain cabinet door(s) filling the outer
  // (wall-adjacent) Clear-Width sections, per sideSectionDoorCalc.ts.
  // Distinct teal fill so it never reads as the same layer as the Kadappa
  // boxes it sits inside or the Trolley Panel it sits beside.
  SIDE_SECTION_DOOR: { fill: '#ecfeff', stroke: '#0891b2', strokeWidth: 1.4 },
  // Fix Patti — a real vertical panel attached OUTSIDE the kitchen box.
  // Distinct green fill, matching the same convention as Fix Patti in the
  // Wardrobe product (a solid, always-visible fixed panel, not a derived
  // "empty" placeholder).
  FIX_PATTI: { fill: '#dcfce7', stroke: '#16a34a', strokeWidth: 1.5 },
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

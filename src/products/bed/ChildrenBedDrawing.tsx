import React, { useState } from 'react';
import { TechnicalDrawingSvg, type ComponentStyle } from '../../engine/CanonicalSvg';
import { resolveChildrenBedPlan, childrenBedComponentColor, childrenBedInputsFromDims, CENTER_TABLE_COLOR, CHILDREN_BED_CENTER_TABLE_DISABLED, CHILDREN_BED_ST_DISABLED, type CenterTableInput } from './childrenBedGeometry';
import type { SimpleSideTableInput } from './simpleBedGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

function childrenBedComponentStyle(c: ComponentSpec): ComponentStyle {
  if (c.type === 'CENTER_TABLE') return { fill: '#fef3e2', stroke: CENTER_TABLE_COLOR, strokeWidth: 1.4 };
  const stroke = childrenBedComponentColor(c.id);
  if (c.id.endsWith('-headboard')) return { fill: '#d9c8ab', stroke, strokeWidth: 1.5 };
  return { fill: '#f0eee8', stroke, strokeWidth: 1.2 };
}

interface Props {
  dims: Record<string, number | string>;
  centerTable?: CenterTableInput;
  lst?: SimpleSideTableInput;
  rst?: SimpleSideTableInput;
}

/** Reuses the existing Bed engine (resolveSimpleBedPlan, via resolveChildrenBedPlan) exactly — Bed A/Bed B are each a fully independent SimpleBedInputs, never a new measurement engine. Center Table/LST/RST come from their own "+" addon cards (PRODUCT_ADDONS['bed']), not dims, since they're optional extras. */
export const ChildrenBedDrawing: React.FC<Props> = ({ dims, centerTable, lst, rst }) => {
  const inp = childrenBedInputsFromDims(
    dims,
    centerTable ?? CHILDREN_BED_CENTER_TABLE_DISABLED,
    lst ?? CHILDREN_BED_ST_DISABLED,
    rst ?? CHILDREN_BED_ST_DISABLED,
  );
  const drawing = resolveChildrenBedPlan(inp);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={`CHILDREN BED — Bed A ${Math.round(inp.bedA.W)}×${Math.round(inp.bedA.L)} + Bed B ${Math.round(inp.bedB.W)}×${Math.round(inp.bedB.L)} mm`}
        components={drawing.components}
        dimensions={drawing.dimensions}
        lines={drawing.lines}
        noteBoxes={drawing.noteBoxes}
        componentStyle={childrenBedComponentStyle}
        onSelectComponent={setSelected}
        onSelectDimension={setSelected}
        selectedComponentId={selected && 'type' in selected ? selected.id : null}
      />
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
    </div>
  );
};

export default ChildrenBedDrawing;

import React, { useState } from 'react';
import { TechnicalDrawingSvg, type ComponentStyle } from '../../engine/CanonicalSvg';
import { resolveStudyTablePlan, studyTableTitle, type StudyTableInputs, type StudyTableSide } from './studyTableGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);

interface Props {
  dims: Record<string, number | string>;
}

function parseSide(v: number | string | undefined): StudyTableSide {
  const s = String(v ?? 'None').toLowerCase();
  if (s === 'left' || s === 'right' || s === 'both') return s;
  return 'none';
}

function studyTableStyle(c: ComponentSpec): ComponentStyle {
  if (c.id.startsWith('storage')) return { fill: '#f0eee8', stroke: '#0891b2', strokeWidth: 1.2 };
  return { fill: '#f0eee8', stroke: '#3b82f6', strokeWidth: 1.2 };
}

export const StudyTableDrawing: React.FC<Props> = ({ dims }) => {
  const inp: StudyTableInputs = {
    H: n(dims.H) || 750,
    W: n(dims.W) || 1200,
    D: n(dims.D) || 600,
    storage: parseSide(dims.storage),
    storageW: n(dims.storageW) || 450,
    sidePanel: parseSide(dims.sidePanel),
  };
  const drawing = resolveStudyTablePlan(inp);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={studyTableTitle(inp)}
        components={drawing.components}
        dimensions={drawing.dimensions}
        lines={drawing.lines}
        componentStyle={studyTableStyle}
        onSelectComponent={setSelected}
        onSelectDimension={setSelected}
        selectedComponentId={selected && 'type' in selected ? selected.id : null}
      />
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
    </div>
  );
};

export default StudyTableDrawing;

import React, { useState } from 'react';
import { TechnicalDrawingSvg } from '../../engine/CanonicalSvg';
import { resolveSimpleWardrobePlan, simpleWardrobeTitle, type SimpleWardrobeInputs, type WardrobeDressingInput, type WardrobeSidePanelInput, type WardrobeLoftInput } from './simpleWardrobeGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);
const DEFAULT_DRESSING: WardrobeDressingInput = { enabled: false, side: 'left', widthMm: 400 };
const DEFAULT_PANEL: WardrobeSidePanelInput = { enabled: false, side: 'left', widthMm: 80, depthMm: 600 };
const DEFAULT_LOFT: WardrobeLoftInput = { enabled: false, mode: 'door', widthMm: 0, heightMm: 400, depthMm: 350, doorCount: 2 };

interface Props {
  dims: Record<string, number | string>;
  dressing?: WardrobeDressingInput;
  sidePanel?: WardrobeSidePanelInput;
  loft?: WardrobeLoftInput;
}

export const SimpleWardrobeDrawing: React.FC<Props> = ({ dims, dressing, sidePanel, loft }) => {
  const W = n(dims.W);
  const inp: SimpleWardrobeInputs = {
    W, H: n(dims.H), D: n(dims.D),
    dressing: dressing ?? DEFAULT_DRESSING,
    sidePanel: sidePanel ?? DEFAULT_PANEL,
    loft: loft ? { ...loft, widthMm: loft.widthMm || W } : DEFAULT_LOFT,
  };
  const drawing = resolveSimpleWardrobePlan(inp);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={`${simpleWardrobeTitle(inp)} — ${Math.round(inp.W)}×${Math.round(inp.H)} mm (D = ${Math.round(inp.D)}mm)`}
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

export default SimpleWardrobeDrawing;

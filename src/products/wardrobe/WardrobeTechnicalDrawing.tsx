import React, { useState } from 'react';
import { TechnicalDrawingSvg } from '../../engine/CanonicalSvg';
import { DrawingInspector } from '../../engine/DrawingInspector';
import { resolveWardrobeFront, resolveWardrobeInternal, resolveWardrobePlan, type WardrobeDims } from './wardrobeGeometry';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);

export function wardrobeDimsFrom(dims: Record<string, number | string>): WardrobeDims {
  const shutters = n(dims.shutters) || 4;
  return {
    W: n(dims.W), H: n(dims.H), D: n(dims.D), thk: n(dims.thk) || 18, backThk: n(dims.backThk) || 9,
    verticals: n(dims.verticals), shelves: n(dims.shelves) || 4, drawers: n(dims.drawers) || 0,
    loftH: n(dims.loftH) || 450, loftShutters: n(dims.loftShutters) || shutters, plinthH: n(dims.plinthH) || 100,
    leftSectionW: n(dims.leftSectionW) || n(dims.W) / 3, centerSectionW: n(dims.centerSectionW) || n(dims.W) / 3, rightSectionW: n(dims.rightSectionW) || n(dims.W) / 3,
  };
}

interface Props {
  designId: string;
  dims: Record<string, number | string>;
  activeView: string;
}

export const WardrobeTechnicalDrawing: React.FC<Props> = ({ designId, dims, activeView }) => {
  const wd = wardrobeDimsFrom(dims);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  const drawing = activeView === 'plan' ? resolveWardrobePlan(designId, wd)
    : activeView === 'internal' ? resolveWardrobeInternal(designId, wd)
    : resolveWardrobeFront(designId, wd);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={`WARDROBE ${activeView.toUpperCase()} — ${Math.round(drawing.worldWidth)}×${Math.round(drawing.worldHeight)} mm`}
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

export default WardrobeTechnicalDrawing;

import React, { useState } from 'react';
import { TechnicalDrawingSvg, type ComponentStyle } from '../../engine/CanonicalSvg';
import { resolveSimpleBedPlan, simpleBedTitle, type SimpleBedInputs, type SimpleSideTableInput, type ProfileShutterInput, BED_COMPONENT_COLORS } from './simpleBedGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);
const DEFAULT_ST: SimpleSideTableInput = { enabled: false, depthMm: 460, widthMm: 560 };
const DEFAULT_PS: ProfileShutterInput = { enabled: false, side: 'left', heightMm: 150, light: false };

// Each box's own outline uses the same colour as its dimension lines (see
// BED_COMPONENT_COLORS) — so a viewer can visually pair a measurement with
// the exact component it belongs to, rather than every box reading the
// same neutral grey regardless of which one it is.
function bedComponentStyle(c: ComponentSpec): ComponentStyle {
  const stroke = BED_COMPONENT_COLORS[c.id] ?? '#333';
  if (c.id === 'headboard') return { fill: '#d9c8ab', stroke, strokeWidth: 1.5 };
  return { fill: '#f0eee8', stroke, strokeWidth: 1.2 };
}

interface Props {
  dims: Record<string, number | string>;
  lst?: SimpleSideTableInput;
  rst?: SimpleSideTableInput;
  profileShutter?: ProfileShutterInput;
}

export const SimpleBedDrawing: React.FC<Props> = ({ dims, lst, rst, profileShutter }) => {
  const H = n(dims.H);
  const inp: SimpleBedInputs = {
    W: n(dims.W), L: n(dims.L), H,
    // Headboard is optional — defaults to shown (1) so existing saved
    // measurements without this field keep their current drawing.
    headboardEnabled: Number(dims.hasHeadboard ?? 1) === 1,
    headboardH: n(dims.headboardH) || 900,
    lst: lst ?? DEFAULT_ST,
    rst: rst ?? DEFAULT_ST,
    profileShutter: profileShutter ?? DEFAULT_PS,
  };
  const drawing = resolveSimpleBedPlan(inp);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={`${simpleBedTitle(inp)} — ${Math.round(inp.W)}×${Math.round(inp.L)} mm (H = ${Math.round(H)}mm)`}
        components={drawing.components}
        dimensions={drawing.dimensions}
        lines={drawing.lines}
        componentStyle={bedComponentStyle}
        onSelectComponent={setSelected}
        onSelectDimension={setSelected}
        selectedComponentId={selected && 'type' in selected ? selected.id : null}
      />
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
    </div>
  );
};

export default SimpleBedDrawing;

import React, { useState } from 'react';
import { TechnicalDrawingSvg } from '../../engine/CanonicalSvg';
import { resolveSimpleBedPlan, simpleBedTitle, type SimpleBedInputs, type SimpleSideTableInput, type ProfileShutterInput } from './simpleBedGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);
const DEFAULT_ST: SimpleSideTableInput = { enabled: false, depthMm: 460, widthMm: 560 };
const DEFAULT_PS: ProfileShutterInput = { enabled: false, side: 'left', heightMm: 150, depthMm: 300, light: false };

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
        onSelectComponent={setSelected}
        onSelectDimension={setSelected}
        selectedComponentId={selected && 'type' in selected ? selected.id : null}
      />
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
    </div>
  );
};

export default SimpleBedDrawing;

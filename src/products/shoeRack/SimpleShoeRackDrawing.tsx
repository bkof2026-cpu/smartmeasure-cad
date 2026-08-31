import React, { useState } from 'react';
import { TechnicalDrawingSvg } from '../../engine/CanonicalSvg';
import { resolveShoeRackPlan, shoeRackTitle, type ShoeRackInputs, type ShoeRackBoxInput } from './shoeRackGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const DEFAULT_BOX: ShoeRackBoxInput = { enabled: false, heightMm: 1500, widthMm: 1050, depthMm: 450 };

interface Props {
  twoDoor?: ShoeRackBoxInput;
  singleDoor?: ShoeRackBoxInput;
}

export const SimpleShoeRackDrawing: React.FC<Props> = ({ twoDoor, singleDoor }) => {
  const inp: ShoeRackInputs = {
    twoDoor: twoDoor ?? DEFAULT_BOX,
    singleDoor: singleDoor ?? DEFAULT_BOX,
  };
  const drawing = resolveShoeRackPlan(inp);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={shoeRackTitle(inp)}
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

export default SimpleShoeRackDrawing;

import React, { useState } from 'react';
import { TechnicalDrawingSvg, type ComponentStyle } from '../../engine/CanonicalSvg';
import { resolveLabeledBoxPlan, type LabeledBoxInputs, type LabeledBoxConfig } from './labeledBoxGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

interface Props {
  inp: LabeledBoxInputs;
  cfg: LabeledBoxConfig;
}

function boxStyle(cfg: LabeledBoxConfig) {
  return (): ComponentStyle => ({ fill: '#f0eee8', stroke: cfg.color, strokeWidth: 1.2 });
}

export const LabeledBoxDrawing: React.FC<Props> = ({ inp, cfg }) => {
  const drawing = resolveLabeledBoxPlan(inp, cfg);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={cfg.title}
        components={drawing.components}
        dimensions={drawing.dimensions}
        lines={drawing.lines}
        componentStyle={boxStyle(cfg)}
        onSelectComponent={setSelected}
        onSelectDimension={setSelected}
        selectedComponentId={selected && 'type' in selected ? selected.id : null}
      />
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
    </div>
  );
};

export default LabeledBoxDrawing;

import React, { useState } from 'react';
import { TechnicalDrawingSvg, type ComponentStyle } from '../../engine/CanonicalSvg';
import { resolveLoftBoxPlan, loftBoxTitle, type LoftBoxInputs } from './loftBoxGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);

interface Props {
  dims: Record<string, number | string>;
}

function loftBoxStyle(): ComponentStyle {
  return { fill: '#f0eee8', stroke: '#3b82f6', strokeWidth: 1.2 };
}

export const LoftBoxDrawing: React.FC<Props> = ({ dims }) => {
  const inp: LoftBoxInputs = {
    H: n(dims.H) || 600,
    W: n(dims.W) || 1000,
    D: n(dims.D) || 400,
    onlyShutter: Number(dims.onlyShutter ?? 0) === 1,
    shutterCount: n(dims.shutterCount) || 6,
    topPanel: Number(dims.topPanel ?? 0) === 1,
    // Base measurementFields store a 'select' as its literal option string
    // (never an index) — unlike addon fields, which store an index.
    topPanelSide: String(dims.topPanelSide ?? 'Left').toLowerCase() === 'right' ? 'right' : 'left',
    topPanelWidth: n(dims.topPanelWidth) || 300,
  };
  const drawing = resolveLoftBoxPlan(inp);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      {/* The shared engine's <svg> always fills 100% of its container's
          WIDTH (by design, so drawings use available space on a big desktop
          canvas) — so trimming this product's own internal padding alone
          can't shrink the box's own rendered pixel height, since the box's
          real 1000x600-style ratio must stay undistorted and the SVG just
          re-stretches to whatever width it's given. Loft Box is genuinely
          short and wide, so this caps how much of the (now generously-
          sized) drawing card its SVG actually stretches across — the box
          renders smaller on screen as a direct result, purely a display
          choice, the real entered Height/Width values and their dimension
          labels are completely unaffected. */}
      <div style={{ maxWidth: '68%', margin: '0 auto' }}>
        <TechnicalDrawingSvg
          worldWidth={drawing.worldWidth}
          worldHeight={drawing.worldHeight}
          title={loftBoxTitle(inp)}
          components={drawing.components}
          dimensions={drawing.dimensions}
          lines={drawing.lines}
          componentStyle={loftBoxStyle}
          onSelectComponent={setSelected}
          onSelectDimension={setSelected}
          selectedComponentId={selected && 'type' in selected ? selected.id : null}
        />
      </div>
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
    </div>
  );
};

export default LoftBoxDrawing;

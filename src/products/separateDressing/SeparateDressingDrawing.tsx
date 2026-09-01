import React, { useState } from 'react';
import { TechnicalDrawingSvg, type ComponentStyle } from '../../engine/CanonicalSvg';
import {
  resolveSeparateDressingPlan, type SeparateDressingInputs,
  DRESSING_BOX_COLOR, SWITCH_BOARD_COLOR, BASE_STORAGE_COLOR,
} from './separateDressingGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);

interface Props {
  dims: Record<string, number | string>;
}

// Each zone's own sub-boxes (real ComponentSpec rows/drawers, not just
// division lines) keep that zone's original colour from the reference
// sketch — matched by id prefix, since a zone is now several real
// components (a frame + N rows/drawers) rather than one.
function separateDressingComponentStyle(c: ComponentSpec): ComponentStyle {
  const stroke = c.id.startsWith('dressing-box') ? DRESSING_BOX_COLOR
    : c.id.startsWith('switch-board') ? SWITCH_BOARD_COLOR
    : c.id.startsWith('base-storage') ? BASE_STORAGE_COLOR
    : '#333';
  return { fill: '#f0eee8', stroke, strokeWidth: 1 };
}

export const SeparateDressingDrawing: React.FC<Props> = ({ dims }) => {
  const W = n(dims.W) || 1200;
  const inp: SeparateDressingInputs = {
    H: n(dims.H) || 2100,
    W,
    D: n(dims.D) || 600,
    dressingBoxH: n(dims.dressingBoxH) || 1400,
    baseStorageH: n(dims.baseStorageH) || 700,
    // Defaults to Total Width when not explicitly set — the "no duplicate
    // dimension when identical" rule only kicks in once this is actually
    // entered differently.
    baseStorageW: dims.baseStorageW !== undefined && dims.baseStorageW !== '' ? n(dims.baseStorageW) : W,
  };
  const drawing = resolveSeparateDressingPlan(inp);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title="SEPARATE DRESSING"
        components={drawing.components}
        dimensions={drawing.dimensions}
        lines={drawing.lines}
        componentStyle={separateDressingComponentStyle}
        onSelectComponent={setSelected}
        onSelectDimension={setSelected}
        selectedComponentId={selected && 'type' in selected ? selected.id : null}
      />
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
    </div>
  );
};

export default SeparateDressingDrawing;

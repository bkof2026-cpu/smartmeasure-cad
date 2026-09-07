import React, { useState } from 'react';
import { TechnicalDrawingSvg, defaultStyleFor, type ComponentStyle } from '../../engine/CanonicalSvg';
import { resolveSimpleWardrobePlan, simpleWardrobeTitle, type SimpleWardrobeInputs, type WardrobeDressingInput, type WardrobeTopPanelInput, type WardrobeLoftInput, type WardrobeFixPattiInput } from './simpleWardrobeGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);
const DEFAULT_DRESSING: WardrobeDressingInput = { enabled: false, side: 'left', widthMm: 400 };
const DEFAULT_TOP_PANEL: WardrobeTopPanelInput = { enabled: false, side: 'left', widthMm: 80, depthMm: 600 };
const DEFAULT_LOFT: WardrobeLoftInput = { enabled: false, mode: 'door', widthMm: 0, heightMm: 400, depthMm: 350, doorCount: 2 };
const DEFAULT_FIX_PATTI: WardrobeFixPattiInput = { position: 'none', leftHeightMm: 400, leftWidthMm: 100, rightHeightMm: 400, rightWidthMm: 100 };

interface Props {
  dims: Record<string, number | string>;
  dressing?: WardrobeDressingInput;
  topPanel?: WardrobeTopPanelInput;
  loft?: WardrobeLoftInput;
  fixPatti?: WardrobeFixPattiInput;
}

// Fix Patti's own green colour, matching the spec's explicit colour
// convention — every other component type falls back to the SAME default
// styling this drawing always used (it had no componentStyle override
// before this change), via the shared defaultStyleFor(). Without this
// explicit override, FIX_PATTI would fall into defaultStyleFor's own
// substring match on "PATTI" (shared with skirting/plinth types) and
// render in that tan/skirting colour instead of green.
function componentStyle(c: ComponentSpec): ComponentStyle {
  if (c.type === 'FIX_PATTI') return { fill: '#dcfce7', stroke: '#16a34a', strokeWidth: 1.5 };
  return defaultStyleFor(c);
}

export const SimpleWardrobeDrawing: React.FC<Props> = ({ dims, dressing, topPanel, loft, fixPatti }) => {
  const W = n(dims.W);
  const inp: SimpleWardrobeInputs = {
    W, H: n(dims.H), D: n(dims.D),
    dressing: dressing ?? DEFAULT_DRESSING,
    topPanel: topPanel ?? DEFAULT_TOP_PANEL,
    loft: loft ?? DEFAULT_LOFT,
    fixPatti: fixPatti ?? DEFAULT_FIX_PATTI,
    // Separate, directly-entered overall envelope — see
    // simpleWardrobeGeometry.ts's own comment: never derived/recomputed,
    // shown exactly as typed. Absent/0 simply hides the outer line. Now
    // also the source Room/Total Width the Fix Patti deduction and Top
    // Panel Width auto-calc read from (resolved in ProductFlow.tsx).
    totalWidthMm: n(dims.totalWidth),
    totalHeightMm: n(dims.totalHeight),
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
        componentStyle={componentStyle}
        onSelectComponent={setSelected}
        onSelectDimension={setSelected}
        selectedComponentId={selected && 'type' in selected ? selected.id : null}
      />
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
    </div>
  );
};

export default SimpleWardrobeDrawing;

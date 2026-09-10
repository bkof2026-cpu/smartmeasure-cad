import React, { useState } from 'react';
import { TechnicalDrawingSvg, defaultStyleFor, type ComponentStyle } from '../../engine/CanonicalSvg';
import { resolveSimpleWardrobePlan, simpleWardrobeTitle, type SimpleWardrobeInputs, type WardrobeDressingInput, type WardrobeTopPanelInput, type WardrobeLoftInput, type WardrobeFixPattiInput, type WardrobeKhachaInput, type WardrobeStorageInput, type WardrobeOpenBoxInput, type WardrobeStudyTableInput, type WardrobeAdjacentLoftInput } from './simpleWardrobeGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import type { ComponentSpec, DimensionLine } from '../../engine/types';

const n = (v: number | string | undefined) => Number(v ?? 0);
const DEFAULT_DRESSING: WardrobeDressingInput = { enabled: false, side: 'left', widthMm: 400, hasMirror: false, drawerCount: 0, totalDrawerHeightMm: 0 };
const DEFAULT_TOP_PANEL: WardrobeTopPanelInput = { enabled: false, side: 'left', widthMm: 80, depthMm: 600 };
const DEFAULT_LOFT: WardrobeLoftInput = { enabled: false, mode: 'door', widthMm: 0, heightMm: 400, depthMm: 350, doorCount: 2 };
const DEFAULT_FIX_PATTI: WardrobeFixPattiInput = { position: 'none', leftHeightMm: 400, leftWidthMm: 100, rightHeightMm: 400, rightWidthMm: 100 };
const DEFAULT_KHACHA: WardrobeKhachaInput = { position: 'none', leftHeightMm: 400, leftWidthMm: 100, rightHeightMm: 400, rightWidthMm: 100 };
const DEFAULT_STORAGE_SIDE = { enabled: false, heightMm: 450, widthMm: 600, depthMm: 600, doorCount: 2 };
const DEFAULT_STORAGE: WardrobeStorageInput = { position: 'none', left: DEFAULT_STORAGE_SIDE, right: DEFAULT_STORAGE_SIDE };
const DEFAULT_OPEN_BOX_SIDE = { enabled: false, heightMm: 300, widthMm: 600, depthMm: 600 };
const DEFAULT_OPEN_BOX: WardrobeOpenBoxInput = { position: 'none', left: DEFAULT_OPEN_BOX_SIDE, right: DEFAULT_OPEN_BOX_SIDE };
const DEFAULT_STUDY_TABLE: WardrobeStudyTableInput = { position: 'none', heightMm: 750, widthMm: 1200, depthMm: 600, storage: 'none', storageWidthMm: 450, sidePanel: 'none' };
const DEFAULT_ADJACENT_LOFT: WardrobeAdjacentLoftInput = {
  enabled: false, side: 'left', mode: 'door', widthMm: 0, heightMm: 400, depthMm: 350, doorCount: 2,
  fixPatti: DEFAULT_FIX_PATTI, khacha: DEFAULT_KHACHA,
};

interface Props {
  dims: Record<string, number | string>;
  dressing?: WardrobeDressingInput;
  topPanel?: WardrobeTopPanelInput;
  loft?: WardrobeLoftInput;
  fixPatti?: WardrobeFixPattiInput;
  khacha?: WardrobeKhachaInput;
  storage?: WardrobeStorageInput;
  openBox?: WardrobeOpenBoxInput;
  studyTable?: WardrobeStudyTableInput;
  adjacentLoft?: WardrobeAdjacentLoftInput;
}

// Per-component-type colour code — every distinct component in the
// Wardrobe composite reads in its OWN colour so a viewer can tell them
// apart at a glance (per the user's "all components colour code will be
// different"). Fill is a light tint, stroke the matching saturated hue;
// the stroke colour is also what CanonicalSvg uses for that component's
// small-size leader callout, so each callout is colour-paired to its box.
const WARDROBE_COMPONENT_COLORS: Record<string, ComponentStyle> = {
  WARDROBE_BODY: { fill: '#eef2ff', stroke: '#1e3a8a', strokeWidth: 1.6 },
  DRESSING:      { fill: '#eff6ff', stroke: '#2563eb', strokeWidth: 1.4 },
  MIRROR:        { fill: '#dbe9f5', stroke: '#0369a1', strokeWidth: 1.1 },
  DRAWER:        { fill: '#e0f2fe', stroke: '#0284c7', strokeWidth: 1 },
  PLATFORM_TOP:  { fill: '#faf5ff', stroke: '#6d28d9', strokeWidth: 1.6 }, // Loft frame / L-Shaped Loft
  DOOR:          { fill: '#f5f3ff', stroke: '#7c3aed', strokeWidth: 1.1 }, // Loft doors
  FIX_PATTI:     { fill: '#dcfce7', stroke: '#16a34a', strokeWidth: 1.5 },
  KHACHA:        { fill: '#bbf7d0', stroke: '#15803d', strokeWidth: 1.5 },
  STORAGE_DOOR:  { fill: '#fef3c7', stroke: '#b45309', strokeWidth: 1.1 },
  OPEN_BOX:      { fill: '#fff7ed', stroke: '#ea580c', strokeWidth: 1.2, strokeDasharray: '4 2' },
  STUDY_TABLE_FRAME: { fill: '#ccfbf1', stroke: '#0d9488', strokeWidth: 1.5 },
  SKIRTING:      { fill: '#c8c0a8', stroke: '#78716c', strokeWidth: 0.9 },
};
function componentStyle(c: ComponentSpec): ComponentStyle {
  return WARDROBE_COMPONENT_COLORS[c.type] ?? defaultStyleFor(c);
}

export const SimpleWardrobeDrawing: React.FC<Props> = ({ dims, dressing, topPanel, loft, fixPatti, khacha, storage, openBox, studyTable, adjacentLoft }) => {
  const W = n(dims.W);
  const inp: SimpleWardrobeInputs = {
    W, H: n(dims.H), D: n(dims.D),
    dressing: dressing ?? DEFAULT_DRESSING,
    topPanel: topPanel ?? DEFAULT_TOP_PANEL,
    loft: loft ?? DEFAULT_LOFT,
    fixPatti: fixPatti ?? DEFAULT_FIX_PATTI,
    khacha: khacha ?? DEFAULT_KHACHA,
    storage: storage ?? DEFAULT_STORAGE,
    openBox: openBox ?? DEFAULT_OPEN_BOX,
    studyTable: studyTable ?? DEFAULT_STUDY_TABLE,
    adjacentLoft: adjacentLoft ?? DEFAULT_ADJACENT_LOFT,
    // Separate, directly-entered overall envelope — see
    // simpleWardrobeGeometry.ts's own comment: never derived/recomputed,
    // shown exactly as typed. Absent/0 simply hides the outer line. Now
    // also the source Room/Total Width the Fix Patti/Khacha deduction and
    // Top Panel Width auto-calc read from (resolved in ProductFlow.tsx).
    totalWidthMm: n(dims.totalWidth),
    totalHeightMm: n(dims.totalHeight),
  };
  const drawing = resolveSimpleWardrobePlan(inp);
  // Colour-match each dimension to the component it measures — the arrow
  // and its label take that component's own box stroke colour, so a
  // viewer can pair a measurement to its component at a glance (per the
  // user's "measurement colour and the component box colour should
  // match"). A dimension that measures nothing specific (overall
  // Total W / Total H, per-door widths that belong to a row) keeps the
  // default red.
  const compTypeById = new Map(drawing.components.map((c) => [c.id, c.type] as const));
  const dimensions = drawing.dimensions.map((d) => {
    if (d.color) return d;
    const firstId = d.componentIds[0];
    const t = firstId ? compTypeById.get(firstId) : undefined;
    const stroke = t ? WARDROBE_COMPONENT_COLORS[t]?.stroke : undefined;
    // Skip the shared "row" dimensions (Loft / Wall B per-door width
    // ticks) — their own DOOR colour on every tick reads as visual noise;
    // the overall Total W / Total H should also stay the neutral red.
    const isRowOrTotal = /\(Total|^\d+$/.test(d.label) || d.componentIds.some((id) => /loft-door-/.test(id));
    return stroke && !isRowOrTotal ? { ...d, color: stroke } : d;
  });
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);

  return (
    <div>
      <TechnicalDrawingSvg
        worldWidth={drawing.worldWidth}
        worldHeight={drawing.worldHeight}
        title={`${simpleWardrobeTitle(inp)} — ${Math.round(inp.W)}×${Math.round(inp.H)} mm (D = ${Math.round(inp.D)}mm)`}
        components={drawing.components}
        dimensions={dimensions}
        lines={drawing.lines}
        componentStyle={componentStyle}
        plainDimLabels
        onSelectComponent={setSelected}
        onSelectDimension={setSelected}
        selectedComponentId={selected && 'type' in selected ? selected.id : null}
      />
      <DrawingInspector selected={selected} issues={drawing.issues} formulaStatus={drawing.formulaStatus} />
      {/* Attached Study Table is now drawn INSIDE the composite plan above
          (per the user's reference), beside the Wardrobe on its side —
          no longer a separate section here. */}
    </div>
  );
};

export default SimpleWardrobeDrawing;

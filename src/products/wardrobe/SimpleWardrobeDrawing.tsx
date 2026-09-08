import React, { useState } from 'react';
import { TechnicalDrawingSvg, defaultStyleFor, type ComponentStyle } from '../../engine/CanonicalSvg';
import { resolveSimpleWardrobePlan, simpleWardrobeTitle, type SimpleWardrobeInputs, type WardrobeDressingInput, type WardrobeTopPanelInput, type WardrobeLoftInput, type WardrobeFixPattiInput, type WardrobeKhachaInput, type WardrobeStorageInput, type WardrobeOpenBoxInput, type WardrobeStudyTableInput } from './simpleWardrobeGeometry';
import { DrawingInspector } from '../../engine/DrawingInspector';
import { StudyTableDrawing } from '../studyTable/StudyTableDrawing';
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
const DEFAULT_STUDY_TABLE: WardrobeStudyTableInput = { enabled: false, side: 'left', heightMm: 750, widthMm: 1200, depthMm: 600 };

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
}

// Fix Patti and Khacha both use the spec's green colour convention, but in
// two distinguishable shades — per the spec's own "do not merge their
// data" rule (§16/§50), they must read as visually separate components,
// not one indistinguishable green blob. Every other component type falls
// back to the SAME default styling this drawing always used, via the
// shared defaultStyleFor(). Without this explicit override, FIX_PATTI/
// KHACHA would fall into defaultStyleFor's own substring match on "PATTI"
// (shared with skirting/plinth types) and render in that tan/skirting
// colour instead.
function componentStyle(c: ComponentSpec): ComponentStyle {
  if (c.type === 'FIX_PATTI') return { fill: '#dcfce7', stroke: '#16a34a', strokeWidth: 1.5 };
  if (c.type === 'KHACHA') return { fill: '#bbf7d0', stroke: '#15803d', strokeWidth: 1.5 };
  // Storage Box doors reuse the same style as Loft/Loft Box doors (a real
  // shuttered door), Open Box gets a distinct open-front look (dashed
  // stroke reads as "no door/shutter" at a glance) so the two never get
  // confused despite sitting in the same reserved column.
  if (c.type === 'STORAGE_DOOR') return defaultStyleFor({ ...c, type: 'DOOR' });
  if (c.type === 'OPEN_BOX') return { fill: '#f8fafc', stroke: '#64748b', strokeWidth: 1.2, strokeDasharray: '4 2' };
  return defaultStyleFor(c);
}

export const SimpleWardrobeDrawing: React.FC<Props> = ({ dims, dressing, topPanel, loft, fixPatti, khacha, storage, openBox, studyTable }) => {
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
    // Separate, directly-entered overall envelope — see
    // simpleWardrobeGeometry.ts's own comment: never derived/recomputed,
    // shown exactly as typed. Absent/0 simply hides the outer line. Now
    // also the source Room/Total Width the Fix Patti/Khacha deduction and
    // Top Panel Width auto-calc read from (resolved in ProductFlow.tsx).
    totalWidthMm: n(dims.totalWidth),
    totalHeightMm: n(dims.totalHeight),
  };
  const drawing = resolveSimpleWardrobePlan(inp);
  const [selected, setSelected] = useState<ComponentSpec | DimensionLine | null>(null);
  const st = studyTable ?? DEFAULT_STUDY_TABLE;

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
      {/* Study Table attached to the Wardrobe (spec §23-25) — rendered as
          its OWN separate section using the exact same standalone Study
          Table product's drawing/measurement engine, per the spec's
          explicit "Do NOT create a second Study Table calculation
          system" rule. Never merged into the Wardrobe's own coordinate
          space above — it's a genuinely separate product-style drawing,
          placed directly below so it reads as physically attached beside
          the Wardrobe/Dressing (matching the reference layout) without
          requiring a second geometry engine. */}
      {st.enabled && (
        <div style={{ marginTop: 16 }}>
          <StudyTableDrawing dims={{ H: st.heightMm, W: st.widthMm, D: st.depthMm, storage: 'None', storageW: 0, sidePanel: 'None' }} />
        </div>
      )}
    </div>
  );
};

export default SimpleWardrobeDrawing;

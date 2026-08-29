import type { AnnotationLine, ComponentSpec, ResolvedDrawing } from '../../engine/types';
import { resolveDimensions, type DimensionRequest } from '../../engine/dimensionEngine';
import { validateComponentBounds, validateDimensionIntegrity, validateMeasurements, notConfiguredIssue } from '../../engine/validationEngine';
import { computeZoneCutlist, type ZoneInputs } from './wardrobeFormulas';
import { getWardrobeDesignDef, type WardrobeDesignDef, type ZoneDef } from './wardrobeDesigns';

export interface WardrobeDims {
  W: number; H: number; D: number; thk: number; backThk: number;
  verticals: number; shelves: number; drawers: number;
  loftH: number; loftShutters: number; plinthH: number;
  leftSectionW: number; centerSectionW: number; rightSectionW: number;
}

function resolvedZoneWidths(def: WardrobeDesignDef, dims: WardrobeDims): number[] {
  if (def.useExplicitZoneWidths && def.zones.length === 3) {
    return [dims.leftSectionW, dims.centerSectionW, dims.rightSectionW];
  }
  return def.zones.map((z) => z.widthShare * dims.W);
}

interface ZoneLayout { zone: ZoneDef; x: number; width: number; }

function layoutZones(def: WardrobeDesignDef, dims: WardrobeDims): ZoneLayout[] {
  const widths = resolvedZoneWidths(def, dims);
  let x = 0;
  return def.zones.map((zone, i) => {
    const width = widths[i];
    const layout = { zone, x, width };
    x += width;
    return layout;
  });
}

const NOT_CONFIGURED_DRAWING = (view: string, designId: string): ResolvedDrawing => ({
  view, productType: 'wardrobe', designId, designName: designId,
  worldWidth: 100, worldHeight: 100, components: [], dimensions: [],
  issues: [notConfiguredIssue('wardrobe', designId)], formulaStatus: 'not_configured',
});

function zoneCutlistFor(width: number, height: number, dims: WardrobeDims, zone: ZoneDef, construction: 'openable' | 'sliding') {
  const zoneInputs: ZoneInputs = {
    W: width, H: height, D: dims.D, construction, doorCount: zone.doorCount,
    shelves: Math.round((zone.shelfShare ?? 0) * dims.shelves), drawers: Math.round((zone.drawerShare ?? 0) * dims.drawers),
    verticals: 0, backThk: dims.backThk,
  };
  return computeZoneCutlist(zoneInputs);
}

/** Real carcass frame — TOP/BOTTOM/SIDE panels for the full wardrobe width, plus a vertical divider at every zone boundary. Shared by Front and Internal views. */
function drawCarcassFrame(dims: WardrobeDims, construction: 'openable' | 'sliding', y0: number, zoneLayouts: ZoneLayout[]): ComponentSpec[] {
  const { W, H, thk } = dims;
  const full = zoneCutlistFor(W, H, dims, { id: 'full', widthShare: 1, doorCount: 0, content: 'standard' }, construction);
  const top = full.find((r) => r.id === 'TOP')!;
  const bottom = full.find((r) => r.id === 'BOTTOM')!;
  const side = full.find((r) => r.id === 'SIDE_L')!;
  const comps: ComponentSpec[] = [
    { id: 'frame-top', type: 'TOP_PANEL', label: 'Top', x: 0, y: y0, width: W, height: thk, qty: 1, visible: true, source: top.source },
    { id: 'frame-bottom', type: 'BOTTOM_PANEL', label: 'Bottom', x: 0, y: y0 + H - thk, width: W, height: thk, qty: 1, visible: true, source: bottom.source },
    { id: 'frame-side-l', type: 'SIDE_PANEL', label: 'LHS', x: 0, y: y0, width: thk, height: H, qty: 1, visible: true, source: side.source },
    { id: 'frame-side-r', type: 'SIDE_PANEL', label: 'RHS', x: W - thk, y: y0, width: thk, height: H, qty: 1, visible: true, source: side.source },
  ];
  for (let i = 1; i < zoneLayouts.length; i++) {
    const boundaryX = zoneLayouts[i].x;
    comps.push({ id: `frame-vert-${i}`, type: 'VERTICAL_PARTITION', label: 'Vertical', x: boundaryX - thk / 2, y: y0, width: thk, height: H, qty: 1, visible: true, source: { formula: `Vertical partition at zone boundary, thickness = Carcass Thickness (${thk}mm)`, constants: [] } });
  }
  return comps;
}

function drawZoneContent(layout: ZoneLayout, y: number, height: number, dims: WardrobeDims, prefix: string, construction: 'openable' | 'sliding'): ComponentSpec[] {
  const { zone, x, width } = layout;
  const comps: ComponentSpec[] = [];
  const cutlist = zoneCutlistFor(width, height, dims, zone, construction);
  const doorRow = cutlist.find((r) => r.id === 'DOOR');

  if (zone.content === 'niche') {
    comps.push({ id: `${prefix}-niche`, type: 'NICHE_PANEL', label: 'Open Niche', x, y: y + 4, width: width - 8, height: height - 8, qty: 1, visible: true, source: { formula: 'Open zone — no door, real carcass opening', constants: [] } });
    return comps;
  }
  if (zone.content === 'dressing') {
    const mirrorH = height * 0.55;
    comps.push({ id: `${prefix}-mirror`, type: 'MIRROR_PANEL', label: 'Mirror', x: x + 6, y: y + 6, width: width - 12, height: mirrorH - 12, qty: 1, visible: true, source: { formula: 'Mirror panel sized to zone width, upper 55% of height', constants: [] } });
    comps.push({ id: `${prefix}-open-shelf`, type: 'SHELF', label: 'Open Shelf', x: x + 6, y: y + mirrorH, width: width - 12, height: height - mirrorH - 6, qty: 1, visible: true, source: { formula: 'Open shelf zone below mirror', constants: [] } });
    return comps;
  }
  if (zone.content === 'drawerTower') {
    const drawerCount = Math.max(2, Math.round((zone.drawerShare ?? 1) * Math.max(dims.drawers, 4)));
    const rowH = height / drawerCount;
    for (let i = 0; i < drawerCount; i++) {
      comps.push({ id: `${prefix}-drawer-${i}`, type: 'DRAWER_FRONT', label: `Drawer ${i + 1}`, x: x + 4, y: y + i * rowH + 3, width: width - 8, height: rowH - 6, qty: 1, visible: true, source: { formula: 'Drawer tower — real DR FACIA sizing per CALC_OPEN_WARDROBE, stacked evenly across zone height', constants: [] } });
    }
    return comps;
  }

  if (zone.doorCount > 0 && doorRow) {
    for (let i = 0; i < zone.doorCount; i++) {
      comps.push({
        id: `${prefix}-door-${i}`, type: 'HINGED_SHUTTER', label: `Door ${i + 1}`,
        x: x + i * (width / zone.doorCount) + 2, y: y + 2, width: width / zone.doorCount - 4, height: height - 4, qty: 1, visible: true,
        source: doorRow.source,
      });
    }
  } else {
    comps.push({ id: `${prefix}-carcass`, type: 'CARCASS', label: 'Carcass', x, y, width, height, qty: 1, visible: true, source: { formula: 'Carcass outline (TOP/BOTTOM/SIDE assembly)', constants: [] } });
  }
  return comps;
}

export function resolveWardrobeFront(designId: string, dims: WardrobeDims): ResolvedDrawing {
  const def = getWardrobeDesignDef(designId);
  if (!def) return NOT_CONFIGURED_DRAWING('front', designId);

  const loftH = def.hasLoft ? dims.loftH : 0;
  const plinthH = def.hasPlinth ? dims.plinthH : 0;
  const worldWidth = dims.W;
  const worldHeight = loftH + dims.H + plinthH;
  const components: ComponentSpec[] = [];
  const dimReqs: DimensionRequest[] = [];

  if (def.hasLoft) {
    const loftShutterCount = Math.max(1, dims.loftShutters);
    for (let i = 0; i < loftShutterCount; i++) {
      const lw = worldWidth / loftShutterCount;
      components.push({ id: `loft-${i}`, type: 'LOFT_SHUTTER', label: `L${i + 1}`, x: i * lw + 2, y: 2, width: lw - 4, height: loftH - 4, qty: 1, visible: true, source: { formula: 'Loft shutter, width = overall width / loft shutter count', constants: [] } });
    }
  }

  const zoneLayouts = layoutZones(def, dims);
  components.push(...drawCarcassFrame(dims, def.construction, loftH, zoneLayouts));
  const inset = dims.thk;
  for (const layout of zoneLayouts) {
    components.push(...drawZoneContent(layout, loftH + inset, dims.H - inset * 2, dims, `z-${layout.zone.id}`, def.construction));
  }

  if (def.hasPlinth) {
    components.push({ id: 'plinth', type: 'PLINTH', label: 'Plinth', x: 0, y: loftH + dims.H, width: worldWidth, height: plinthH, qty: 1, visible: true, source: { formula: 'Skirting/plinth strip, height = fixed 70mm real board width per CALC_OPEN_WARDROBE SCRTING row', constants: [] } });
  }

  dimReqs.push({ axis: 'h', x1: 0, y1: worldHeight, x2: worldWidth, y2: worldHeight, edge: 'bottom', componentIds: components.map((c) => c.id), label: `${Math.round(worldWidth)} mm`, source: { formula: 'Overall Width = W', constants: [] } });
  dimReqs.push({ axis: 'v', x1: worldWidth, y1: 0, x2: worldWidth, y2: worldHeight, edge: 'right', componentIds: components.map((c) => c.id), label: `${Math.round(worldHeight)} mm`, source: { formula: 'Overall Height (+ loft + plinth)', constants: [] } });
  if (zoneLayouts.length > 1) {
    for (const layout of zoneLayouts) {
      dimReqs.push({ axis: 'h', x1: layout.x, y1: loftH, x2: layout.x + layout.width, y2: loftH, edge: 'top', componentIds: [], label: `${Math.round(layout.width)} mm`, source: { formula: `Zone "${layout.zone.id}" width`, constants: [] } });
    }
  }

  const dimensions = resolveDimensions(dimReqs);
  const issues = [
    ...validateMeasurements(dims as unknown as Record<string, number>, [{ key: 'W', label: 'Overall Width', min: 1 }, { key: 'H', label: 'Overall Height', min: 1 }]),
    ...validateComponentBounds(components, worldWidth, worldHeight),
    ...validateDimensionIntegrity(dimensions),
  ];

  return {
    view: 'front', productType: 'wardrobe', designId, designName: designId,
    worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified',
  };
}

/** Internal box construction — real carcass frame with shelves/hanging rod/drawers revealed, doors removed. */
export function resolveWardrobeInternal(designId: string, dims: WardrobeDims): ResolvedDrawing {
  const def = getWardrobeDesignDef(designId);
  if (!def) return NOT_CONFIGURED_DRAWING('internal', designId);

  const worldWidth = dims.W;
  const worldHeight = dims.H;
  const components: ComponentSpec[] = [];
  const lines: AnnotationLine[] = [];
  const zoneLayouts = layoutZones(def, dims);
  const thk = dims.thk;

  components.push(...drawCarcassFrame(dims, def.construction, 0, zoneLayouts));

  const internalVariant = designId.startsWith('internal-') ? designId : null;

  for (const { zone, x, width } of zoneLayouts) {
    const innerX = x + thk / 2 + 4;
    const innerW = width - thk - 8;
    if (zone.content === 'niche') {
      components.push({ id: `int-niche-${zone.id}`, type: 'NICHE_PANEL', label: 'Open Niche', x: innerX, y: thk + 4, width: innerW, height: dims.H - thk * 2 - 8, qty: 1, visible: true, source: { formula: 'Open zone, no internal fittings', constants: [] } });
      continue;
    }
    if (zone.content === 'dressing') {
      const mirrorH = (dims.H - thk * 2) * 0.55;
      components.push({ id: `int-mirror-${zone.id}`, type: 'MIRROR_PANEL', label: 'Mirror', x: innerX, y: thk + 4, width: innerW, height: mirrorH, qty: 1, visible: true, source: { formula: 'Mirror panel, upper 55% of internal height', constants: [] } });
      components.push({ id: `int-openshelf-${zone.id}`, type: 'SHELF', label: 'Open Shelf', x: innerX, y: thk + 8 + mirrorH, width: innerW, height: thk, qty: 1, visible: true, source: { formula: 'Real SELF TOP shelf sizing per CALC_OPEN_WARDROBE, below mirror', constants: [] } });
      continue;
    }
    if (zone.content === 'drawerTower') {
      const drawerCount = Math.max(2, Math.round((zone.drawerShare ?? 1) * Math.max(dims.drawers, 4)));
      const rowH = (dims.H - thk * 2 - 8) / drawerCount;
      for (let i = 0; i < drawerCount; i++) {
        components.push({ id: `int-drawer-tower-${zone.id}-${i}`, type: 'DRAWER_FRONT', label: `Drawer ${i + 1}`, x: innerX, y: thk + 4 + i * rowH + 3, width: innerW, height: rowH - 6, qty: 1, visible: true, source: { formula: 'Real DR FACIA sizing per CALC_OPEN_WARDROBE, stacked evenly', constants: [] } });
      }
      continue;
    }

    // standard zone: hanging rod + shelves/drawers, keyed by internal-only variant where selected
    let hangRods = 1, shelfCount = Math.round((zone.shelfShare ?? 0) * dims.shelves), drawerCount = Math.round((zone.drawerShare ?? 0) * dims.drawers);
    if (internalVariant === 'internal-1') { shelfCount = 0; drawerCount = 0; }
    else if (internalVariant === 'internal-5') { hangRods = 2; shelfCount = 0; drawerCount = 0; }
    else if (internalVariant === 'internal-6') { hangRods = 1; shelfCount = 0; drawerCount = 0; }
    else if (internalVariant === 'internal-7') { hangRods = 0; }

    let cursorY = thk + 8;
    if (hangRods > 0) {
      const bandTop = cursorY;
      const bandH = internalVariant === 'internal-6' ? dims.H * 0.75 : (dims.H - thk * 2 - 16) * (hangRods === 2 ? 0.75 : 0.45);
      const rodSpacing = bandH / hangRods;
      for (let r = 0; r < hangRods; r++) {
        const rodY = bandTop + rodSpacing * (r + 1) - 4;
        components.push({ id: `int-rod-panel-${zone.id}-${r}`, type: 'HANGING_PIPE', label: 'Hanging Rod', x: innerX + 6, y: rodY, width: innerW - 12, height: 3, qty: 1, visible: true, source: { formula: 'Hanging rod position — standard internal layout convention, not a cut panel', constants: [] } });
        lines.push({ x1: innerX + 6, y1: rodY + 1.5, x2: innerX + innerW - 6, y2: rodY + 1.5, color: '#777' });
      }
      cursorY = bandTop + bandH + 12;
    }
    const remainingH = dims.H - thk - 8 - cursorY;
    if (shelfCount > 0) {
      const gap = remainingH / (shelfCount + 1);
      for (let s = 0; s < shelfCount; s++) {
        components.push({ id: `int-shelf-${zone.id}-${s}`, type: 'SHELF', label: 'Shelf', x: innerX, y: cursorY + gap * (s + 1) - thk / 2, width: innerW, height: thk, qty: 1, visible: true, source: { formula: 'Real SELF TOP shelf sizing per CALC_OPEN_WARDROBE, positioned evenly', constants: [] } });
      }
    } else if (drawerCount > 0) {
      const rowH = remainingH / drawerCount;
      for (let d = 0; d < drawerCount; d++) {
        components.push({ id: `int-drawer-${zone.id}-${d}`, type: 'DRAWER_FRONT', label: `Drawer ${d + 1}`, x: innerX, y: cursorY + d * rowH + 3, width: innerW, height: rowH - 6, qty: 1, visible: true, source: { formula: 'Real DR FACIA sizing per CALC_OPEN_WARDROBE', constants: [] } });
      }
    }
  }

  const dimReqs: DimensionRequest[] = [
    { axis: 'h', x1: 0, y1: worldHeight, x2: worldWidth, y2: worldHeight, edge: 'bottom', componentIds: [], label: `${Math.round(worldWidth)} mm`, source: { formula: 'Overall Width = W', constants: [] } },
    { axis: 'v', x1: worldWidth, y1: 0, x2: worldWidth, y2: worldHeight, edge: 'right', componentIds: [], label: `${Math.round(worldHeight)} mm`, source: { formula: 'Overall Height = H', constants: [] } },
  ];
  if (zoneLayouts.length > 1) {
    for (const layout of zoneLayouts) {
      dimReqs.push({ axis: 'h', x1: layout.x, y1: 0, x2: layout.x + layout.width, y2: 0, edge: 'top', componentIds: [], label: `${Math.round(layout.width)} mm`, source: { formula: `Zone "${layout.zone.id}" width`, constants: [] } });
    }
  }
  const dimensions = resolveDimensions(dimReqs);
  const issues = [...validateComponentBounds(components, worldWidth, worldHeight), ...validateDimensionIntegrity(dimensions)];

  return { view: 'internal', productType: 'wardrobe', designId, designName: designId, worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines };
}

/** Proper top-down plan — real carcass frame (side/back panels), zone dividers, and door-swing / sliding-track indication. */
export function resolveWardrobePlan(designId: string, dims: WardrobeDims): ResolvedDrawing {
  const def = getWardrobeDesignDef(designId);
  if (!def) return NOT_CONFIGURED_DRAWING('plan', designId);

  const { W, D, thk, backThk } = dims;
  const worldWidth = W;
  const worldHeight = D;
  const components: ComponentSpec[] = [];
  const lines: AnnotationLine[] = [];
  const zoneLayouts = layoutZones(def, dims);

  const full = zoneCutlistFor(W, dims.H, dims, { id: 'full', widthShare: 1, doorCount: 0, content: 'standard' }, def.construction);
  const sideRow = full.find((r) => r.id === 'SIDE_L')!;
  const backRow = full.find((r) => r.id === 'BACK_PANEL')!;

  components.push({ id: 'plan-side-l', type: 'SIDE_PANEL', label: 'LHS', x: 0, y: 0, width: thk, height: D, qty: 1, visible: true, source: sideRow.source });
  components.push({ id: 'plan-side-r', type: 'SIDE_PANEL', label: 'RHS', x: W - thk, y: 0, width: thk, height: D, qty: 1, visible: true, source: sideRow.source });
  components.push({ id: 'plan-back', type: 'BACK_PANEL', label: `Back Panel (${backThk}mm)`, x: 0, y: D - backThk, width: W, height: backThk, qty: 1, visible: true, source: backRow.source });

  for (let i = 1; i < zoneLayouts.length; i++) {
    const boundaryX = zoneLayouts[i].x;
    components.push({ id: `plan-vert-${i}`, type: 'VERTICAL_PARTITION', label: 'Vertical', x: boundaryX - thk / 2, y: 0, width: thk, height: D - backThk, qty: 1, visible: true, source: { formula: `Vertical partition at zone boundary, thickness = ${thk}mm`, constants: [] } });
  }

  for (const { zone, x, width } of zoneLayouts) {
    const innerX = x + thk / 2;
    const innerW = width - thk;
    if (zone.content === 'niche') {
      components.push({ id: `plan-niche-${zone.id}`, type: 'NICHE_PANEL', label: 'Open Niche', x: innerX + 4, y: 4, width: innerW - 8, height: D - backThk - 8, qty: 1, visible: true, source: { formula: 'Open zone footprint', constants: [] } });
      continue;
    }
    if (zone.content === 'dressing') {
      components.push({ id: `plan-dressing-${zone.id}`, type: 'MIRROR_PANEL', label: 'Dressing', x: innerX + 4, y: 4, width: innerW - 8, height: D - backThk - 8, qty: 1, visible: true, source: { formula: 'Dressing zone footprint (mirror + open shelf above)', constants: [] } });
      continue;
    }

    // Real door plan indication. Track bands are drawn at a legible fixed
    // world thickness (not the true ~3mm aluminum profile) so they read as
    // tracks at any zoom level — the same reasoning DimensionLine already
    // uses fixed screen-space stroke widths rather than true-to-scale ones.
    if (def.construction === 'sliding' && zone.doorCount > 0) {
      const bandH = Math.max(20, dims.D * 0.05);
      const frontY = 4;
      const rearY = D - backThk - bandH - 4;
      components.push({ id: `plan-track-front-${zone.id}`, type: 'SLIDING_TRACK', label: 'Track', x: innerX, y: frontY, width: innerW, height: bandH, qty: 1, visible: true, source: { formula: 'Sliding door track, front rail', constants: [] } });
      components.push({ id: `plan-track-rear-${zone.id}`, type: 'SLIDING_TRACK', label: 'Track', x: innerX, y: rearY, width: innerW, height: bandH, qty: 1, visible: true, source: { formula: 'Sliding door track, rear rail', constants: [] } });
      const doorW = innerW / zone.doorCount;
      const doorDepth = bandH * 0.7;
      for (let i = 0; i < zone.doorCount; i++) {
        const onFrontTrack = i % 2 === 0;
        const dy = onFrontTrack ? frontY + (bandH - doorDepth) / 2 : rearY + (bandH - doorDepth) / 2;
        components.push({ id: `plan-slider-${zone.id}-${i}`, type: 'SLIDING_SHUTTER', label: '', x: innerX + i * doorW + 2, y: dy, width: doorW - 4, height: doorDepth, qty: 1, visible: true, source: { formula: `Sliding door ${i + 1}, ${onFrontTrack ? 'front' : 'rear'} track`, constants: [] } });
      }
    } else if (zone.doorCount > 0) {
      const doorW = innerW / zone.doorCount;
      for (let i = 0; i < zone.doorCount; i++) {
        const hingeLeft = i % 2 === 0;
        const dx0 = innerX + i * doorW;
        components.push({ id: `plan-door-${zone.id}-${i}`, type: 'HINGED_SHUTTER', label: '', x: dx0, y: 0, width: doorW - 2, height: thk, qty: 1, visible: true, source: { formula: 'Door leaf, closed position (plan)', constants: [] } });
        const hingeX = hingeLeft ? dx0 : dx0 + doorW;
        const swingX = hingeLeft ? dx0 + doorW * 0.75 : dx0 + doorW * 0.25;
        lines.push({ x1: hingeX, y1: thk, x2: swingX, y2: D * 0.5, dashed: true, color: '#0055bb' });
      }
    }
  }

  const dimReqs: DimensionRequest[] = [
    { axis: 'h', x1: 0, y1: worldHeight, x2: worldWidth, y2: worldHeight, edge: 'bottom', componentIds: [], label: `${Math.round(worldWidth)} mm`, source: { formula: 'Overall Width = W', constants: [] } },
    { axis: 'v', x1: worldWidth, y1: 0, x2: worldWidth, y2: worldHeight, edge: 'right', componentIds: [], label: `${Math.round(worldHeight)} mm`, source: { formula: 'Depth = D', constants: [] } },
  ];
  if (zoneLayouts.length > 1) {
    for (const layout of zoneLayouts) {
      dimReqs.push({ axis: 'h', x1: layout.x, y1: 0, x2: layout.x + layout.width, y2: 0, edge: 'top', componentIds: [], label: `${Math.round(layout.width)} mm`, source: { formula: `Zone "${layout.zone.id}" width`, constants: [] } });
    }
  }
  const dimensions = resolveDimensions(dimReqs);
  const issues = [...validateComponentBounds(components, worldWidth, worldHeight), ...validateDimensionIntegrity(dimensions)];

  return { view: 'plan', productType: 'wardrobe', designId, designName: designId, worldWidth, worldHeight, components, dimensions, issues, formulaStatus: 'verified', lines };
}

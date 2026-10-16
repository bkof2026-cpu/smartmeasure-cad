import type { ProductId } from '../productTypes';
import { wardrobeCarcassWidth, type WardrobeSide, type WardrobeDressingInput, type WardrobeTopPanelInput, type WardrobeLoftInput, type WardrobeLoftSidePanelInput, type WardrobeFixPattiInput, type WardrobeKhachaInput, type WardrobeStorageInput, type WardrobeOpenBoxInput, type WardrobeStudyTableInput, type WardrobeAdjacentLoftInput } from './simpleWardrobeGeometry';
import { recommendLoftDoorCount, loftHeightForWardrobe, usableLoftDoorWidthWithKhacha, totalFixPattiWidth, calculateLoftDoorWidth, calculateWardrobeDoorWidth, type FixPattiPosition, type KhachaPosition } from '../../engine/loftDoorEngine';

// Pure Openable/Sliding Wardrobe add-on derivation — turns one product
// session's raw form state (dims + selected add-ons + addonDims) into the
// resolved geometry inputs. Lives outside ProductFlow.tsx so the live
// screen, the combined PDF and Node-side verification scripts all share
// exactly the same code path.

const n = (v: number | string) => Number(v);

const FIX_PATTI_POSITIONS: FixPattiPosition[] = ['none', 'left', 'right', 'both'];
const KHACHA_POSITIONS: KhachaPosition[] = ['none', 'left', 'right', 'both'];
// Same None/Left/Right/Both shape, used by Storage and Open Box position
// dropdowns (spec §27/§34) — WardrobeSide doesn't itself include 'none',
// so this is its own local option list rather than reusing SIDE_OPTS.
const SIDE_OR_NONE_OPTS: (WardrobeSide | 'none')[] = ['none', 'left', 'right', 'both'];
/** Top Panel's standard width when there's no Total Width to derive it from (the addon field's own default). */
const TOP_PANEL_STANDARD_WIDTH_MM = 80;

/** Wardrobe door-width breakdown for one Dressing configuration — the ONE
 * place the form, the drawing and the cutlist all read the door width
 * from. Door Width defaults to the calculated value
 * ((Carcass W − doorCount × 2mm [− 2mm extra]) / doorCount, see
 * calculateWardrobeDoorWidth) but stays editable: `dims.doorWidth` holds a
 * manually entered value once the user types one (undefined until then). */
export function wardrobeDoorWidthBreakdown(dims: Record<string, number | string>, dressing: WardrobeDressingInput, doorCount: number) {
  const count = Math.max(0, Math.round(doorCount) || 0);
  const carcassW = wardrobeCarcassWidth(n(dims.W ?? 0), dressing);
  const extraOn = Number(dims.doorExtraDeduction ?? 0) === 1;
  const calc = calculateWardrobeDoorWidth({ wardrobeDoorWidth: carcassW, doorCount: count, extra2mmDeduction: extraOn });
  const override = Number(dims.doorWidth);
  const isOverridden = dims.doorWidth !== undefined && dims.doorWidth !== '' && Number.isFinite(override) && override > 0;
  const doorWidth = isOverridden ? override : calc.doorWidth;
  return { count, carcassW, extraOn, calc, isOverridden, doorWidth, widths: Array.from({ length: count }, () => doorWidth) };
}

/** Openable Wardrobe's per-door Width array (every door shares the same
 * width) — feeds resolveSimpleWardrobePlan/simpleWardrobeCutlist's
 * doorWidthsMm directly. */
export function wardrobeCalculatedDoorWidths(dims: Record<string, number | string>, selectedAddons: Set<string>, addonDims: Record<string, Record<string, number>>, doorCount: number): number[] {
  const SIDE_OPTS: WardrobeSide[] = ['left', 'right', 'both'];
  const dressing: WardrobeDressingInput = {
    enabled: selectedAddons.has('dressing'),
    side: SIDE_OPTS[(addonDims['dressing']?.side) ?? 0] ?? 'left',
    widthMm: (addonDims['dressing']?.W) ?? 400,
    hasMirror: false, drawerCount: 0, totalDrawerHeightMm: 0,
  };
  return wardrobeDoorWidthBreakdown(dims, dressing, doorCount).widths;
}

/** Real Wardrobe/Loft/Fix Patti add-on state, with the "auto-calculated
 * default, still editable" pattern the spec requires for Top Panel Width,
 * Loft Height, and Loft Door Count: `addonDims[...]` only holds a REAL
 * value once the user has actually typed one (see handleAddonDimChange) —
 * until then this derives the live computed default from the shared
 * loftDoorEngine / the Wardrobe's own current Width/Dressing/Total Width,
 * so the UI shows a real recommendation on first render, not a fixed
 * placeholder constant, without ever overwriting a value the user already
 * set (§32 "Do not unexpectedly overwrite a user's manual value"). */
export function deriveWardrobeAddonInputs(productId: ProductId, dims: Record<string, number | string>, selectedAddons: Set<string>, addonDims: Record<string, Record<string, number>>) {
  const isWardrobe = productId === 'openable-wardrobe' || productId === 'sliding-wardrobe';
  const SIDE_OPTS: WardrobeSide[] = ['left', 'right', 'both'];
  const wardrobeW = n(dims.W ?? 0);
  const wardrobeH = n(dims.H ?? 0);
  const dressing: WardrobeDressingInput = {
    enabled: isWardrobe && selectedAddons.has('dressing'),
    side: SIDE_OPTS[(addonDims['dressing']?.side) ?? 0] ?? 'left',
    widthMm: (addonDims['dressing']?.W) ?? 400,
    hasMirror: ((addonDims['dressing']?.mirror) ?? 0) === 1,
    drawerCount: (addonDims['dressing']?.drawers) ?? 0,
    totalDrawerHeightMm: (addonDims['dressing']?.drawerH) ?? 600,
    // Undefined until the user edits it — the form shows Wardrobe Height
    // as the starting value (see wardrobeComputedAddonDefaults).
    heightMm: addonDims['dressing']?.H,
  };
  const dressingTotalW = dressing.enabled ? (dressing.side === 'both' ? dressing.widthMm * 2 : dressing.widthMm) : 0;

  // Fix Patti — read first (before Top Panel/Loft) since its width feeds
  // the Loft Door Count calculation below. position is forced to 'none'
  // whenever the Fix Patti addon card itself isn't selected — a real bug
  // fixed here: addonDims['fix-patti'].position PERSISTS in state once
  // ever set (e.g. toggled to Left/Both then the whole addon toggled back
  // off), and without this selectedAddons check that stale position kept
  // silently deducting from Wall A's usable Loft width forever, even
  // after the addon card showed "not selected" in the UI — exactly the
  // "phantom Fix Patti sliver eating into the Loft width" bug reported.
  const fixPatti: WardrobeFixPattiInput = {
    position: isWardrobe && selectedAddons.has('fix-patti') ? (FIX_PATTI_POSITIONS[(addonDims['fix-patti']?.position) ?? 0] ?? 'none') : 'none',
    leftHeightMm: (addonDims['fix-patti']?.leftH) ?? 400,
    leftWidthMm: (addonDims['fix-patti']?.leftW) ?? 100,
    rightHeightMm: (addonDims['fix-patti']?.rightH) ?? 400,
    rightWidthMm: (addonDims['fix-patti']?.rightW) ?? 100,
  };

  // Khacha — a real, separate component from Fix Patti (never merged
  // data, per the spec's own explicit rule). Read alongside Fix Patti
  // since BOTH widths feed the Loft Door Count calculation together.
  // Same selectedAddons gate as Fix Patti above, same real bug fixed.
  const khacha: WardrobeKhachaInput = {
    position: isWardrobe && selectedAddons.has('khacha') ? (KHACHA_POSITIONS[(addonDims['khacha']?.position) ?? 0] ?? 'none') : 'none',
    leftHeightMm: (addonDims['khacha']?.leftH) ?? 400,
    leftWidthMm: (addonDims['khacha']?.leftW) ?? 100,
    rightHeightMm: (addonDims['khacha']?.rightH) ?? 400,
    rightWidthMm: (addonDims['khacha']?.rightW) ?? 100,
  };

  // Room/Total Width — entered directly (see productRegistry.tsx's
  // 'totalWidth' field); falls back to the entered Wardrobe Width when not
  // entered (0). Per the user's explicit correction, the entered Wardrobe
  // Width now ALREADY represents the full Wardrobe+Dressing span (Dressing
  // Width comes OUT of the wardrobe carcass rather than being added on top
  // of it — see wardrobeCarcassWidth() in simpleWardrobeGeometry.ts), so
  // the composite fallback is simply the entered Width itself, not
  // Width + Dressing (which would double-count Dressing's own span).
  const enteredTotalW = n(dims.totalWidth ?? 0);
  const totalWidthForCalc = enteredTotalW > 0 ? enteredTotalW : wardrobeW;

  // Loft Height — resolved FIRST (before the Top Panel default below),
  // because the Top Panel formula is conditional on whether Fix Patti's
  // height reaches the Loft height. Live computed default = Total Height
  // − Wardrobe Height − 10mm gap, falling back to a 400mm placeholder
  // when Total Height isn't entered yet.
  const enteredTotalH = n(dims.totalHeight ?? 0);
  const loftHeightDefault = enteredTotalH > 0 ? loftHeightForWardrobe(enteredTotalH, wardrobeH) : 400;
  const loftMode: 'door' | 'box' = ((addonDims['loft']?.mode) ?? 0) === 1 ? 'box' : 'door';
  const loftDepthMm = (addonDims['loft']?.D) ?? 350;
  const resolvedLoftHeight = (addonDims['loft']?.H) ?? loftHeightDefault;

  // Fix Patti total width (0 when the addon isn't selected —
  // fixPatti.position is already forced to 'none' in that case), and the
  // max Fix Patti height across whatever side(s) are active — both feed
  // the conditional Top Panel formula below.
  const fixPattiTotalW = totalFixPattiWidth(fixPatti);
  const fixPattiMaxH = fixPatti.position === 'none' ? 0 : Math.max(
    fixPatti.position === 'left' || fixPatti.position === 'both' ? fixPatti.leftHeightMm : 0,
    fixPatti.position === 'right' || fixPatti.position === 'both' ? fixPatti.rightHeightMm : 0,
  );

  // Top Panel (a.k.a. Side Panel) — Width's live computed default. The
  // formula is CONDITIONAL on whether Fix Patti reaches the Loft height,
  // per the user's explicit correction (Dressing Width is NOT part of this
  // deduction — Dressing already sits between the Wardrobe and the Top
  // Panel, so the Top Panel just fills whatever remains of the wall beyond
  // the Wardrobe+Dressing):
  //   IF Fix Patti height >= Loft height:
  //     Top Panel Width = Total Room Width − Wardrobe Carcass Width − Dressing Width − Fix Patti Width
  //   ELSE:
  //     Top Panel Width = Total Room Width − Wardrobe Carcass Width − Dressing Width
  // Uses the Wardrobe's own CARCASS width (entered Width minus Dressing,
  // per wardrobeCarcassWidth()) plus Dressing's own width separately, since
  // the entered Width no longer represents the carcass alone — using the
  // raw entered Width here would double-count Dressing's span and under-
  // allocate the Top Panel by exactly Dressing's width.
  // Only seeds the DISPLAYED default before the user touches the field; a
  // real stored value wins.
  //
  // Top Panel Width is a PER-SIDE value (Both = one panel on each side), so
  // the leftover span is split across the active sides — otherwise "Both"
  // would draw two full-leftover panels and overshoot Total Width by the
  // whole leftover. With no Total Width entered yet there is nothing to
  // derive from, so the field's own standard default (80mm) is used rather
  // than 0mm (which is not a real panel and raised a CRITICAL error).
  const wardrobeCarcassW = Math.max(1, wardrobeW - dressingTotalW);
  const topPanelSubtractsFixPatti = fixPattiMaxH > 0 && fixPattiMaxH >= resolvedLoftHeight;
  const topPanelSide = SIDE_OPTS[(addonDims['top-panel']?.side) ?? 0] ?? 'left';
  const topPanelSides = topPanelSide === 'both' ? 2 : 1;
  const topPanelWidthDefault = enteredTotalW > 0
    ? Math.max(
      0,
      (totalWidthForCalc - wardrobeCarcassW - dressingTotalW
        - (topPanelSubtractsFixPatti ? fixPattiTotalW : 0)) / topPanelSides,
    )
    : TOP_PANEL_STANDARD_WIDTH_MM;
  const topPanel: WardrobeTopPanelInput = {
    enabled: isWardrobe && selectedAddons.has('top-panel'),
    side: topPanelSide,
    widthMm: (addonDims['top-panel']?.W) ?? topPanelWidthDefault,
    depthMm: (addonDims['top-panel']?.D) ?? 600,
  };

  // Loft Total Width — the Loft's OWN separate measurement field (per the
  // user's explicit correction), independent of the Wardrobe's own 'Total
  // Width' field (which still only drives the outer room-width dimension
  // line and the Top Panel default). Falls back to totalWidthForCalc (the
  // Wardrobe's own Total Width / composite width) as a sensible starting
  // point only until the user actually types a value into this field —
  // once set, a real stored value always wins, same override convention
  // as every other computed-default addon field.
  // With no Total Width entered, the Loft sits on the full Wardrobe(+
  // Dressing) + Top Panel span below it — not the bare Wardrobe Width,
  // which left the Loft visibly shorter than the composite under it.
  const loftTotalWidthDefault = enteredTotalW > 0
    ? enteredTotalW
    : wardrobeW + (topPanel.enabled ? topPanel.widthMm * topPanelSides : 0);
  const loftTotalW = (addonDims['loft']?.totalW) ?? loftTotalWidthDefault;

  // Loft Width = Loft Total Width − Fix Patti (Left+Right) − Khacha
  // (Left+Right). Wardrobe/Dressing/Top Panel Width are NEVER part of
  // this deduction (they sit below the Loft, not beside it). loft.widthMm
  // is therefore already the final USABLE Loft Door Width — Door Count /
  // One Door Width / the drawing all use it directly as the REAL,
  // PHYSICAL width (drawn box/boundary — never includes the Attached-
  // Dressing calculation allowance below).
  const usableW = usableLoftDoorWidthWithKhacha(loftTotalW, fixPatti, khacha);

  // Attached Side Dressing -> Loft Door Width calculation-only +20mm
  // allowance — per the user's explicit, repeated spec: a real 20mm
  // fabrication gap between the Wardrobe's own door and the Dressing's
  // own door, which the Loft spans across, so its DOOR WIDTH (never its
  // drawn geometry) must account for it. `dressing.enabled` is exactly
  // "this Wardrobe has an Attached Side Dressing" (not a standalone
  // Dressing product elsewhere) — the one condition specified. Uses the
  // ONE shared calculateLoftDoorWidth() engine (engine/loftDoorEngine.ts)
  // so Openable Wardrobe and Sliding Wardrobe never get two different
  // formulas. doorCalculationWidthMm is handed to the geometry resolver
  // as a SEPARATE field from widthMm — the resolver only ever uses it for
  // the printed door-width number, never for the drawn Loft box itself.
  // The recommended Door Count is searched on the SAME width the door
  // width is printed from (incl. the +20mm allowance) — recommending from
  // the bare physical width could pick a count whose printed width then
  // breaks the 310–400mm standard (e.g. 2400 → 6 doors = 398, but the
  // printed (2420 − 12) / 6 = 401).
  const loftCalcBaseW = calculateLoftDoorWidth({ actualLoftWidth: usableW, doorCount: 1, hasAttachedDressing: dressing.enabled }).calculationLoftWidth;
  const doorCountDefault = recommendLoftDoorCount(loftCalcBaseW).doorCount;
  const loftDoorCalc = calculateLoftDoorWidth({
    actualLoftWidth: usableW,
    doorCount: (addonDims['loft']?.doors) ?? doorCountDefault,
    hasAttachedDressing: dressing.enabled,
  });

  const loft: WardrobeLoftInput = {
    enabled: isWardrobe && selectedAddons.has('loft'),
    mode: loftMode,
    widthMm: usableW,
    heightMm: resolvedLoftHeight,
    depthMm: loftDepthMm,
    doorCount: (addonDims['loft']?.doors) ?? doorCountDefault,
    doorCalculationWidthMm: loftDoorCalc.calculationLoftWidth,
    doorWidthOverrideMm: addonDims['loft']?.doorW,
  };

  // Loft Side Panel — purely visual/informational extra measurement,
  // Depth defaults to the Wardrobe's own Depth (live computed default,
  // still editable) — same convention as Storage/Open Box/Study Table's
  // own Depth defaults above.
  const loftSidePanel: WardrobeLoftSidePanelInput = {
    enabled: isWardrobe && selectedAddons.has('loft-side-panel'),
    widthMm: (addonDims['loft-side-panel']?.W) ?? 100,
    heightMm: (addonDims['loft-side-panel']?.H) ?? 400,
    depthMm: (addonDims['loft-side-panel']?.D) ?? (n(dims.D ?? 0) || 600),
  };

  // Extra Storage — a real box beside the Wardrobe/Dressing, with its OWN
  // door calculation from Storage Width alone (spec §29: "Do NOT calculate
  // Storage Doors using Room Width, Loft Width, Wardrobe Width"). Depth
  // defaults to Wardrobe Depth (spec §28), same "live computed default,
  // still editable" pattern as Loft Height/Door Count.
  // storagePosition/openBoxPosition below are the RAW stored dropdown
  // value, which PERSISTS once ever set even after the addon card itself
  // is toggled back off — storage/openBox.position (and every left/right
  // .enabled below) must gate on selectedAddons too, the same real bug
  // just fixed for Fix Patti/Khacha above (a stale Left/Both position
  // would otherwise keep drawing a phantom Storage/Open Box even after
  // the addon showed "not selected" in the UI).
  const storageAddonActive = isWardrobe && selectedAddons.has('storage');
  const storagePosition = storageAddonActive ? (SIDE_OR_NONE_OPTS[(addonDims['storage']?.position) ?? 0] ?? 'none') : 'none';
  const storageLeftWidth = (addonDims['storage']?.leftW) ?? 600;
  const storageRightWidth = (addonDims['storage']?.rightW) ?? 600;
  const storage: WardrobeStorageInput = {
    position: storagePosition,
    left: {
      enabled: storagePosition === 'left' || storagePosition === 'both',
      heightMm: (addonDims['storage']?.leftH) ?? 450,
      widthMm: storageLeftWidth,
      depthMm: (addonDims['storage']?.leftD) ?? (n(dims.D ?? 0) || 600),
      doorCount: (addonDims['storage']?.leftDoors) ?? recommendLoftDoorCount(storageLeftWidth).doorCount,
    },
    right: {
      enabled: storagePosition === 'right' || storagePosition === 'both',
      heightMm: (addonDims['storage']?.rightH) ?? 450,
      widthMm: storageRightWidth,
      depthMm: (addonDims['storage']?.rightD) ?? (n(dims.D ?? 0) || 600),
      doorCount: (addonDims['storage']?.rightDoors) ?? recommendLoftDoorCount(storageRightWidth).doorCount,
    },
  };

  // Open Box — a small open box in the top pocket (top edge = Loft
  // bottom), no door calculation, keeping its own entered W/H/D.
  //   - WITH a Storage Box on the same side: sits directly below the
  //     Storage Box in the same column; Width defaults to the Storage Box
  //     Width (reference: "W = 340, by default same as Storage Box W").
  //   - WITHOUT a Storage Box: takes the Storage Box's own top spot;
  //     defaults to a small box — W 300 / H 200 / D 200 (reference:
  //     "Open Box Without Storage box — W=300, H=200, D=200").
  // The user's entered value always wins over any default.
  const openBoxAddonActive = isWardrobe && selectedAddons.has('open-box');
  const openBoxPosition = openBoxAddonActive ? (SIDE_OR_NONE_OPTS[(addonDims['open-box']?.position) ?? 0] ?? 'none') : 'none';
  const hasStorageLeft = (storage.position === 'left' || storage.position === 'both') && storage.left.enabled;
  const hasStorageRight = (storage.position === 'right' || storage.position === 'both') && storage.right.enabled;
  const openBox: WardrobeOpenBoxInput = {
    position: openBoxPosition,
    left: {
      enabled: openBoxPosition === 'left' || openBoxPosition === 'both',
      heightMm: (addonDims['open-box']?.leftH) ?? 200,
      widthMm: (addonDims['open-box']?.leftW) ?? (hasStorageLeft ? storage.left.widthMm : 300),
      depthMm: (addonDims['open-box']?.leftD) ?? (hasStorageLeft ? (n(dims.D ?? 0) || 450) : 200),
    },
    right: {
      enabled: openBoxPosition === 'right' || openBoxPosition === 'both',
      heightMm: (addonDims['open-box']?.rightH) ?? 200,
      widthMm: (addonDims['open-box']?.rightW) ?? (hasStorageRight ? storage.right.widthMm : 300),
      depthMm: (addonDims['open-box']?.rightD) ?? (hasStorageRight ? (n(dims.D ?? 0) || 450) : 200),
    },
  };

  // Study Table attached to the Wardrobe — uses the SAME measurement set +
  // drawing as the standalone Study Table product (H/W/D + optional
  // Storage + optional Side Panel); the extra `Position` dropdown docks
  // it to the Wardrobe on that side (Left / Right / Both). Can coexist
  // with Side Dressing — Dressing sits flush to the wardrobe, the Study
  // Table docks outside it on its chosen side.
  const studyTableAddonActive = isWardrobe && selectedAddons.has('study-table');
  const studyTablePosition = studyTableAddonActive
    ? (SIDE_OPTS[(addonDims['study-table']?.side) ?? 0] ?? 'left')
    : 'none';
  const studyTable: WardrobeStudyTableInput = {
    position: studyTablePosition,
    heightMm: (addonDims['study-table']?.H) ?? 750,
    widthMm: (addonDims['study-table']?.W) ?? 1200,
    depthMm: (addonDims['study-table']?.D) ?? (n(dims.D ?? 0) || 600),
    storage: SIDE_OR_NONE_OPTS[(addonDims['study-table']?.storage) ?? 0] ?? 'none',
    storageWidthMm: (addonDims['study-table']?.storageW) ?? 450,
    sidePanel: SIDE_OR_NONE_OPTS[(addonDims['study-table']?.sidePanel) ?? 0] ?? 'none',
  };

  // L-Shaped Loft — Wall B, a fully independent second Loft standing on
  // the adjacent wall, using the EXACT SAME door-count/width formulas as
  // Wall A (the main Loft) above, but calculated completely
  // independently — its own entered Width, its own Fix Patti/Khacha
  // (never combined with Wall A's), never combined into one width for
  // door calculation, per the user's own explicit instruction.
  const alFixPatti: WardrobeFixPattiInput = {
    position: FIX_PATTI_POSITIONS[(addonDims['adjacent-loft']?.fpPosition) ?? 0] ?? 'none',
    leftHeightMm: (addonDims['adjacent-loft']?.fpLeftH) ?? 400,
    leftWidthMm: (addonDims['adjacent-loft']?.fpLeftW) ?? 100,
    rightHeightMm: (addonDims['adjacent-loft']?.fpRightH) ?? 400,
    rightWidthMm: (addonDims['adjacent-loft']?.fpRightW) ?? 100,
  };
  const alKhacha: WardrobeKhachaInput = {
    position: KHACHA_POSITIONS[(addonDims['adjacent-loft']?.khPosition) ?? 0] ?? 'none',
    leftHeightMm: (addonDims['adjacent-loft']?.khLeftH) ?? 400,
    leftWidthMm: (addonDims['adjacent-loft']?.khLeftW) ?? 100,
    rightHeightMm: (addonDims['adjacent-loft']?.khRightH) ?? 400,
    rightWidthMm: (addonDims['adjacent-loft']?.khRightW) ?? 100,
  };
  // Wall B's own entered Total Width (its own room-wall span, entirely
  // separate from Wall A's) — its usable Loft Door Width is this value
  // minus Wall B's own Fix Patti + Khacha, same shared formula as Wall A.
  const alEnteredWidth = (addonDims['adjacent-loft']?.totalW) ?? 2000;
  const alUsableW = usableLoftDoorWidthWithKhacha(alEnteredWidth, alFixPatti, alKhacha);
  const alDoorCountDefault = recommendLoftDoorCount(alUsableW).doorCount;
  const adjacentLoft: WardrobeAdjacentLoftInput = {
    enabled: isWardrobe && selectedAddons.has('adjacent-loft'),
    side: ((addonDims['adjacent-loft']?.side) ?? 0) === 1 ? 'right' : 'left',
    mode: ((addonDims['adjacent-loft']?.mode) ?? 0) === 1 ? 'box' : 'door',
    widthMm: alUsableW,
    heightMm: (addonDims['adjacent-loft']?.H) ?? 400,
    depthMm: (addonDims['adjacent-loft']?.D) ?? 350,
    doorCount: (addonDims['adjacent-loft']?.doors) ?? alDoorCountDefault,
    fixPatti: alFixPatti,
    khacha: alKhacha,
  };

  return { dressing, topPanel, loft, loftTotalWidthDefault, loftDoorWidthFormula: loftDoorCalc.doorWidth, loftSidePanel, fixPatti, khacha, storage, openBox, studyTable, adjacentLoft };
}

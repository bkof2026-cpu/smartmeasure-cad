// ─── Add-on field definition ────────────────────────────────────────────────────
export interface AddonField {
  key: string;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
  step?: number;
  /** When set, this field renders as a dropdown instead of a number input —
   * the stored value is the selected option's index (0-based), decoded back
   * to its real meaning (e.g. 'left'/'right'/'both', or 'door'/'box') by
   * the product's own geometry resolver. Keeps the shared addonDims state
   * as plain numbers everywhere, no separate string-valued state needed. */
  options?: string[];
  /** When set to 'checkbox', this field renders as a real checkbox instead
   * of a number input or dropdown — the stored value is 0 (unchecked) or 1
   * (checked), decoded to a boolean by the product's own geometry resolver.
   * Same "plain numbers everywhere" convention as `options` above. */
  kind?: 'checkbox';
  /** Marks this field as belonging to one side of a Left/Right/Both
   * position dropdown elsewhere in the SAME addon. When set, the field
   * renders ONLY when that dropdown's current value actually includes
   * that side — 'left' fields show for Left/Both, 'right' fields show
   * for Right/Both, and neither shows for None. A field with no sideOf
   * (e.g. the position dropdown itself, or a side-agnostic field) always
   * renders. This is the single, common mechanism every Left/Right/Both/
   * None addon (Fix Patti, Khacha, Extra Storage, Open Box, and any
   * future one) should use — never hand-roll per-addon conditional
   * rendering. */
  sideOf?: 'left' | 'right';
  /** Which position/side dropdown field (by its own `key`) controls this
   * field's sideOf visibility, when an addon has MORE THAN ONE such
   * dropdown (e.g. L-Shaped Loft's own Fix Patti position and Khacha
   * position are two independent Left/Right/Both/None groups in the same
   * addon). Omit when an addon has only one Left/Right(/Both/None)
   * dropdown — the renderer falls back to that addon's sole such field
   * automatically, so every existing single-group addon (Fix Patti,
   * Khacha, Storage, Open Box) needs no groupKey at all. */
  groupKey?: string;
  /** True for a plain COUNT field (Number of Drawers, Loft/Storage Door
   * Count) — a quantity, not a millimetre measurement. The form renderer
   * suppresses the automatic " (mm)" suffix and the "min–max mm" hint
   * for these. Omit for every real mm measurement. */
  isCount?: boolean;
  /** Conditional visibility driven by ANOTHER field in the same addon.
   * The field renders only when the field named by `key` currently holds
   * one of the values in `equals` (a single value or a list). Use for
   * mode-dependent fields — e.g. the Loft's "Depth" only applies to the
   * "Box" Loft Type, so it carries `showWhen: { key: 'mode', equals: 1 }`
   * (mode index 1 = "Box"; hidden for index 0 = "Only Door"). Independent
   * of `sideOf` (that gates on a Left/Right/Both position); a field may
   * use either, both, or neither. */
  showWhen?: { key: string; equals: number | number[] };
}

// placement: 'composite' = shown INSIDE the main drawing
//            'separate'  = shown as its own detail drawing below
export interface AddonDef {
  id: string;
  label: string;
  icon: string;
  description: string;
  placement: 'composite' | 'separate';
  fields: AddonField[];
}

// ─── Field colour groups for measurement form ───────────────────────────────────
export interface FieldColorGroup {
  label: string;
  color: string;   // hex accent colour
  keys: string[];  // matching dims keys
}

export const FIELD_GROUPS: Record<string, FieldColorGroup[]> = {
  bed: [
    { label: 'Bed', color: '#3b82f6', keys: ['W', 'L', 'H'] },
    { label: 'Headboard', color: '#f59e0b', keys: ['hasHeadboard', 'headboardH'] },
  ],
  'separate-side-table': [
    // #111827 (near-black, matching the Mirror's own drawing outline
    // color) was invisible against the dark form background — the
    // measurement-form label needs a bright, readable color regardless of
    // what shade the drawing itself uses for that component's outline.
    { label: 'Mirror', color: '#e2e8f0', keys: ['mirrorW', 'mirrorH'] },
    { label: 'Base Storage', color: '#0891b2', keys: ['baseH', 'baseW', 'baseD', 'skirtingEnabled'] },
  ],
  'separate-dressing': [
    { label: 'Total',         color: '#ea580c', keys: ['H', 'W', 'D'] },
    { label: 'Dressing Box',  color: '#2563eb', keys: ['dressingBoxH'] },
    { label: 'Base Storage',  color: '#ea580c', keys: ['baseStorageH', 'baseStorageW', 'skirtingEnabled'] },
  ],
  'openable-wardrobe': [
    { label: 'Wardrobe', color: '#3b82f6', keys: ['W', 'H', 'D'] },
    // Directly-entered overall envelope — never recomputed FROM the
    // Wardrobe's own W/H (that direction still holds), but now used AS a
    // source for Top Panel Width / Loft Height / Loft Door Count when
    // present, per the Fix Patti / Loft engine spec. Its own group/colour
    // keeps it visually distinct from the wardrobe's own carcass W/H above.
    { label: 'Total (Overall)', color: '#22c55e', keys: ['totalWidth', 'totalHeight'] },
  ],
  'sliding-wardrobe': [
    { label: 'Wardrobe', color: '#3b82f6', keys: ['W', 'H', 'D'] },
    { label: 'Total (Overall)', color: '#22c55e', keys: ['totalWidth', 'totalHeight'] },
  ],
  'tv-unit': [
    { label: 'T.V.', color: '#3b82f6', keys: ['H', 'W'] },
  ],
  sofa: [
    { label: 'Sofa', color: '#3b82f6', keys: ['H', 'W', 'D'] },
  ],
  'center-table': [
    { label: 'Center Table', color: '#3b82f6', keys: ['L', 'W'] },
  ],
  'loft-box': [
    { label: 'Loft Box', color: '#3b82f6', keys: ['H', 'W', 'D'] },
    { label: 'Shutters', color: '#22c55e', keys: ['onlyShutter', 'shutterCount'] },
    { label: 'Top Panel', color: '#7c3aed', keys: ['topPanel', 'topPanelSide', 'topPanelWidth'] },
  ],
  'study-table': [
    { label: 'Study Table', color: '#3b82f6', keys: ['H', 'W', 'D'] },
    { label: 'Storage', color: '#0891b2', keys: ['storage', 'storageW'] },
    { label: 'Side Panel', color: '#7c3aed', keys: ['sidePanel'] },
  ],
  partition: [
    // Same fix as Separate Side Table's Mirror group — near-black is
    // invisible on the dark form background, even though it matches the
    // drawing's own frame outline color.
    { label: 'Partition', color: '#e2e8f0', keys: ['type', 'H', 'W', 'D', 'side'] },
  ],
  'dining-table': [
    { label: 'Dining Table', color: '#e2e8f0', keys: ['diningType'] },
    { label: 'Folding Dining Table', color: '#3b82f6', keys: ['foldW', 'foldL'] },
    { label: 'Simple Dining Table — Box', color: '#3b82f6', keys: ['boxL', 'boxW', 'boxD'] },
    { label: 'Simple Dining Table — Top', color: '#f59e0b', keys: ['topL', 'topW'] },
  ],
  door: [
    { label: 'Door', color: '#3b82f6', keys: ['H', 'W'] },
    { label: 'Side Panel', color: '#0891b2', keys: ['sidePanel', 'sidePanelWLeft', 'sidePanelWRight'] },
    { label: 'Top', color: '#7c3aed', keys: ['addTop', 'topH', 'topW'] },
  ],
  bedroom: [
    { label: 'Room Size', color: '#3b82f6', keys: ['roomL', 'roomW'] },
    { label: 'Bed',       color: '#22c55e', keys: ['bedW', 'bedL', 'hasBed'] },
    { label: 'Furniture', color: '#f59e0b', keys: ['wardW', 'tvW', 'hasWardrobe', 'hasTVUnit'] },
  ],
  // 1bhk/2bhk/3bhk FIELD_GROUPS removed along with the products themselves
  // (see productRegistry.tsx) — out of scope per the user's explicit
  // instruction.
};

// ─── Per-product add-ons ─────────────────────────────────────────────────────────
export const PRODUCT_ADDONS: Record<string, AddonDef[]> = {
  bed: [
    {
      // Height is intentionally not a field here — it's auto-fetched from
      // Bed Height (see ProductFlow.tsx's bedLST/bedRST construction), not
      // independently entered. Attaches to the bed's headboard-side left
      // corner (X = Bed.Left - LST.Width, Y = Bed.Top).
      id: 'side-table-left',
      label: 'Left Side Table (LST)',
      icon: '🪑',
      description: 'Attaches at the headboard-side left corner — Height auto-fetched from Bed Height',
      placement: 'composite',
      fields: [
        { key: 'D', label: 'Depth', defaultValue: 460, min: 280, max: 650 },
        { key: 'W', label: 'Width', defaultValue: 560, min: 280, max: 700 },
      ],
    },
    {
      id: 'side-table-right',
      label: 'Right Side Table (RST)',
      icon: '🪑',
      description: 'Attaches at the headboard-side right corner — Height auto-fetched from Bed Height',
      placement: 'composite',
      fields: [
        { key: 'D', label: 'Depth', defaultValue: 460, min: 280, max: 650 },
        { key: 'W', label: 'Width', defaultValue: 560, min: 280, max: 700 },
      ],
    },
    {
      // Width is not a field here — always auto-fetched from whichever side
      // table (LST/RST) it's mounted on, per the user's own reference
      // sketch: the profile shutter sits flush on top of that table, sharing
      // its full width. Height and Depth are entered; the optional profile
      // light is a real checkbox, not a dropdown, since it's a plain on/off.
      // Displayed name renamed "Profile Shutter" → "Dressing" per the
      // user's explicit instruction — the internal id stays 'profile-shutter'
      // (existing saved sessions/history reference it by id, and every
      // other file's logic keys off this id) so this is purely a label
      // change, no functional change.
      id: 'profile-shutter',
      label: 'Dressing',
      icon: '💡',
      description: 'Light shutter box mounted above a side table — Width and Depth both auto-fetched from that table',
      placement: 'composite',
      fields: [
        { key: 'side', label: 'Mounted On', defaultValue: 0, min: 0, max: 1, options: ['Left Side Table (LST)', 'Right Side Table (RST)'] },
        { key: 'H', label: 'Height', defaultValue: 150, min: 50, max: 400 },
        { key: 'light', label: 'Add Profile Light', defaultValue: 0, min: 0, max: 1, kind: 'checkbox' },
      ],
    },
  ],
  'openable-wardrobe': [
    {
      // Height is not a field here — always auto-fetched from the
      // Wardrobe's own Height (see simpleWardrobeGeometry.ts), matching
      // the same "H = auto" convention as the Bed's LST/RST.
      id: 'dressing',
      label: 'Side Dressing',
      icon: '🪟',
      description: 'Extra dressing panel beside the wardrobe — Height auto-fetched from Wardrobe Height',
      placement: 'composite',
      fields: [
        { key: 'side', label: 'Side', defaultValue: 0, min: 0, max: 2, options: ['Left', 'Right', 'Both'] },
        { key: 'W', label: 'Width', defaultValue: 400, min: 200, max: 800 },
        { key: 'mirror', label: 'Add Mirror', defaultValue: 0, min: 0, max: 1, kind: 'checkbox' },
        { key: 'drawers', label: 'Number of Drawers', defaultValue: 0, min: 0, max: 8, isCount: true },
        { key: 'drawerH', label: 'Total Drawer Height', defaultValue: 600, min: 100, max: 1800 },
      ],
    },
    {
      // Renamed from "Side Panel" per the user's explicit correction — this
      // is the SAME existing component (position/geometry/purpose all
      // unchanged), only its displayed name changed. Width's own
      // defaultValue here (80) is only the static fallback shown before a
      // real computed recommendation exists — ProductFlow.tsx overrides the
      // displayed default live from Total Width − Wardrobe Width − Dressing
      // Width (see the Top Panel width computation there), same "computed
      // default, still editable" pattern as Loft Height/Door Count below.
      id: 'top-panel',
      label: 'Top Panel',
      icon: '▥',
      description: 'Extra end panel beside the wardrobe (or dressing, if both are added) — Width auto-calculated from Total Width',
      placement: 'composite',
      fields: [
        { key: 'side', label: 'Side', defaultValue: 0, min: 0, max: 2, options: ['Left', 'Right', 'Both'] },
        { key: 'W', label: 'Width', defaultValue: 80, min: 30, max: 3000 },
        { key: 'D', label: 'Depth', defaultValue: 600, min: 300, max: 800 },
      ],
    },
    {
      id: 'loft',
      label: 'Loft Above Wardrobe',
      icon: '📦',
      description: 'Storage loft mounted above the wardrobe — Only Door or a full Box. Height and Door Count are calculated automatically but stay editable.',
      placement: 'composite',
      fields: [
        { key: 'mode', label: 'Loft Type', defaultValue: 0, min: 0, max: 1, options: ['Only Door', 'Box'] },
        // H/doors defaults below are only the static fallback shown before
        // a real computed recommendation exists — ProductFlow.tsx overrides
        // the displayed default live (Loft Height = Total Height − Wardrobe
        // Height − 10mm; Door Count = the loftDoorEngine recommendation).
        { key: 'H', label: 'Loft Height', defaultValue: 400, min: 100, max: 900 },
        { key: 'D', label: 'Loft Depth', defaultValue: 350, min: 250, max: 500, showWhen: { key: 'mode', equals: 1 } },
        { key: 'doors', label: 'Number of Loft Doors', defaultValue: 2, min: 1, max: 12, isCount: true },
      ],
    },
    {
      id: 'fix-patti',
      label: 'Fix Patti',
      icon: '🟩',
      description: 'Fixed outer panel(s) at the edge of the Loft — its width is deducted from Total Width before the Loft Door Count is calculated',
      placement: 'composite',
      fields: [
        { key: 'position', label: 'Fix Patti Position', defaultValue: 0, min: 0, max: 3, options: ['None', 'Left', 'Right', 'Both'] },
        { key: 'leftH', label: 'Left Fix Patti Height', defaultValue: 400, min: 100, max: 900, sideOf: 'left' },
        { key: 'leftW', label: 'Left Fix Patti Width', defaultValue: 100, min: 30, max: 400, sideOf: 'left' },
        { key: 'rightH', label: 'Right Fix Patti Height', defaultValue: 400, min: 100, max: 900, sideOf: 'right' },
        { key: 'rightW', label: 'Right Fix Patti Width', defaultValue: 100, min: 30, max: 400, sideOf: 'right' },
      ],
    },
    {
      // Khacha — a real, separate component from Fix Patti (never merged
      // data). Same shape, tracked independently, and BOTH deduct from the
      // usable Loft door area together when both are present.
      id: 'khacha',
      label: 'Khacha',
      icon: '🟢',
      description: 'Fixed corner panel(s) at the outer edge of the Loft, beyond Fix Patti — its width is also deducted from the usable Loft Door Width',
      placement: 'composite',
      fields: [
        { key: 'position', label: 'Khacha Position', defaultValue: 0, min: 0, max: 3, options: ['None', 'Left', 'Right', 'Both'] },
        { key: 'leftH', label: 'Left Khacha Height', defaultValue: 400, min: 100, max: 900, sideOf: 'left' },
        { key: 'leftW', label: 'Left Khacha Width', defaultValue: 100, min: 30, max: 400, sideOf: 'left' },
        { key: 'rightH', label: 'Right Khacha Height', defaultValue: 400, min: 100, max: 900, sideOf: 'right' },
        { key: 'rightW', label: 'Right Khacha Width', defaultValue: 100, min: 30, max: 400, sideOf: 'right' },
      ],
    },
    {
      // Extra Storage — a real box beside the Wardrobe/Dressing, with its
      // OWN door calculation from Storage Width alone (never Room/Loft/
      // Wardrobe Width). Depth defaults to Wardrobe Depth (spec §28) via
      // ProductFlow.tsx's live-computed-default pattern, same as Loft
      // Height/Door Count — the defaultValue here is only the static
      // fallback shown before that real default exists.
      id: 'storage',
      label: 'Extra Storage',
      icon: '📦',
      description: 'Storage box beside the Wardrobe/Dressing, with its own door count calculated from Storage Width only',
      placement: 'composite',
      fields: [
        { key: 'position', label: 'Storage Position', defaultValue: 0, min: 0, max: 3, options: ['None', 'Left', 'Right', 'Both'] },
        { key: 'leftH', label: 'Left Storage Height', defaultValue: 450, min: 100, max: 1200, sideOf: 'left' },
        { key: 'leftW', label: 'Left Storage Width', defaultValue: 600, min: 200, max: 1500, sideOf: 'left' },
        { key: 'leftD', label: 'Left Storage Depth', defaultValue: 600, min: 200, max: 800, sideOf: 'left' },
        { key: 'leftDoors', label: 'Left Storage Number of Doors', defaultValue: 2, min: 1, max: 8, sideOf: 'left', isCount: true },
        { key: 'rightH', label: 'Right Storage Height', defaultValue: 450, min: 100, max: 1200, sideOf: 'right' },
        { key: 'rightW', label: 'Right Storage Width', defaultValue: 600, min: 200, max: 1500, sideOf: 'right' },
        { key: 'rightD', label: 'Right Storage Depth', defaultValue: 600, min: 200, max: 800, sideOf: 'right' },
        { key: 'rightDoors', label: 'Right Storage Number of Doors', defaultValue: 2, min: 1, max: 8, sideOf: 'right', isCount: true },
      ],
    },
    {
      // Open Box — a real box beside the Wardrobe/Dressing, no door
      // calculation (an open box, not a shuttered one). Sits BELOW Storage
      // on the same side when both are present.
      id: 'open-box',
      label: 'Open Box',
      icon: '🔲',
      description: 'Open storage box beside the Wardrobe/Dressing — no door/shutter. Sits below Extra Storage on the same side when both are added.',
      placement: 'composite',
      fields: [
        { key: 'position', label: 'Open Box Position', defaultValue: 0, min: 0, max: 3, options: ['None', 'Left', 'Right', 'Both'] },
        { key: 'leftH', label: 'Left Open Box Height', defaultValue: 300, min: 100, max: 900, sideOf: 'left' },
        { key: 'leftW', label: 'Left Open Box Width', defaultValue: 600, min: 200, max: 1500, sideOf: 'left' },
        { key: 'leftD', label: 'Left Open Box Depth', defaultValue: 600, min: 200, max: 800, sideOf: 'left' },
        { key: 'rightH', label: 'Right Open Box Height', defaultValue: 300, min: 100, max: 900, sideOf: 'right' },
        { key: 'rightW', label: 'Right Open Box Width', defaultValue: 600, min: 200, max: 1500, sideOf: 'right' },
        { key: 'rightD', label: 'Right Open Box Depth', defaultValue: 600, min: 200, max: 800, sideOf: 'right' },
      ],
    },
    {
      // Study Table attached to the Wardrobe — only offered when Dressing
      // is NOT selected (spec §23). Reuses the EXISTING standalone Study
      // Table product's own measurement/drawing engine (rendered as its
      // own separate section in SimpleWardrobeDrawing.tsx) — this addon
      // only tracks whether it's attached, its side, and its H×W×D.
      id: 'study-table',
      label: 'Study Table (Attached)',
      icon: '🪑',
      description: 'Study Table attached beside the Wardrobe/Dressing — Left, Right or Both, each with its own H × W × D. Only available when Side Dressing is not added.',
      placement: 'composite',
      fields: [
        { key: 'side', label: 'Study Table Position', defaultValue: 0, min: 0, max: 2, options: ['Left', 'Right', 'Both'] },
        { key: 'leftH', label: 'Left Study Table Height', defaultValue: 750, min: 600, max: 900, sideOf: 'left' },
        { key: 'leftW', label: 'Left Study Table Width', defaultValue: 1200, min: 600, max: 2400, sideOf: 'left' },
        { key: 'leftD', label: 'Left Study Table Depth', defaultValue: 600, min: 400, max: 800, sideOf: 'left' },
        { key: 'rightH', label: 'Right Study Table Height', defaultValue: 750, min: 600, max: 900, sideOf: 'right' },
        { key: 'rightW', label: 'Right Study Table Width', defaultValue: 1200, min: 600, max: 2400, sideOf: 'right' },
        { key: 'rightD', label: 'Right Study Table Depth', defaultValue: 600, min: 400, max: 800, sideOf: 'right' },
      ],
    },
    {
      // L-Shaped Loft — Wall B, a fully independent second Loft on the
      // adjacent wall (Left or Right of the main Wardrobe), using the
      // SAME door-count/width formulas as the main Loft above (Wall A),
      // calculated completely independently — its own Total Width, its
      // own Height/Depth, its own Fix Patti AND Khacha (both optional,
      // both manual H×W per side, never combined with Wall A's own).
      id: 'adjacent-loft',
      label: 'L-Shaped Loft (Adjacent Wall)',
      icon: '📐',
      description: 'A second, independent Loft on the adjacent wall — same door-count formula as the main Loft, its own Total Width/Height/Fix Patti/Khacha, never combined with the main Loft’s.',
      placement: 'composite',
      fields: [
        { key: 'side', label: 'Adjacent Loft Side', defaultValue: 0, min: 0, max: 1, options: ['Left', 'Right'] },
        { key: 'mode', label: 'Loft Type', defaultValue: 0, min: 0, max: 1, options: ['Only Door', 'Box'] },
        { key: 'totalW', label: 'Wall B Total Width', defaultValue: 2000, min: 600, max: 6000 },
        // H/doors defaults below are only the static fallback shown before
        // a real computed recommendation exists — ProductFlow.tsx's own
        // wardrobeComputedAddonDefaults overrides the displayed default
        // live (Door Count = the loftDoorEngine recommendation from Wall
        // B's own usable width).
        { key: 'H', label: 'Wall B Loft Height', defaultValue: 400, min: 100, max: 900 },
        { key: 'D', label: 'Wall B Loft Depth', defaultValue: 350, min: 250, max: 500, showWhen: { key: 'mode', equals: 1 } },
        { key: 'doors', label: 'Wall B Number of Loft Doors', defaultValue: 2, min: 1, max: 12, isCount: true },
        { key: 'fpPosition', label: 'Wall B Fix Patti Position', defaultValue: 0, min: 0, max: 3, options: ['None', 'Left', 'Right', 'Both'] },
        { key: 'fpLeftH', label: 'Wall B Left Fix Patti Height', defaultValue: 400, min: 100, max: 900, sideOf: 'left', groupKey: 'fpPosition' },
        { key: 'fpLeftW', label: 'Wall B Left Fix Patti Width', defaultValue: 100, min: 30, max: 400, sideOf: 'left', groupKey: 'fpPosition' },
        { key: 'fpRightH', label: 'Wall B Right Fix Patti Height', defaultValue: 400, min: 100, max: 900, sideOf: 'right', groupKey: 'fpPosition' },
        { key: 'fpRightW', label: 'Wall B Right Fix Patti Width', defaultValue: 100, min: 30, max: 400, sideOf: 'right', groupKey: 'fpPosition' },
        { key: 'khPosition', label: 'Wall B Khacha Position', defaultValue: 0, min: 0, max: 3, options: ['None', 'Left', 'Right', 'Both'] },
        { key: 'khLeftH', label: 'Wall B Left Khacha Height', defaultValue: 400, min: 100, max: 900, sideOf: 'left', groupKey: 'khPosition' },
        { key: 'khLeftW', label: 'Wall B Left Khacha Width', defaultValue: 100, min: 30, max: 400, sideOf: 'left', groupKey: 'khPosition' },
        { key: 'khRightH', label: 'Wall B Right Khacha Height', defaultValue: 400, min: 100, max: 900, sideOf: 'right', groupKey: 'khPosition' },
        { key: 'khRightW', label: 'Wall B Right Khacha Width', defaultValue: 100, min: 30, max: 400, sideOf: 'right', groupKey: 'khPosition' },
      ],
    },
  ],
  'sliding-wardrobe': [
    {
      id: 'dressing',
      label: 'Side Dressing',
      icon: '🪟',
      description: 'Extra dressing panel beside the wardrobe — Height auto-fetched from Wardrobe Height',
      placement: 'composite',
      fields: [
        { key: 'side', label: 'Side', defaultValue: 0, min: 0, max: 2, options: ['Left', 'Right', 'Both'] },
        { key: 'W', label: 'Width', defaultValue: 400, min: 200, max: 800 },
        { key: 'mirror', label: 'Add Mirror', defaultValue: 0, min: 0, max: 1, kind: 'checkbox' },
        { key: 'drawers', label: 'Number of Drawers', defaultValue: 0, min: 0, max: 8, isCount: true },
        { key: 'drawerH', label: 'Total Drawer Height', defaultValue: 600, min: 100, max: 1800 },
      ],
    },
    {
      id: 'top-panel',
      label: 'Top Panel',
      icon: '▥',
      description: 'Extra end panel beside the wardrobe (or dressing, if both are added) — Width auto-calculated from Total Width',
      placement: 'composite',
      fields: [
        { key: 'side', label: 'Side', defaultValue: 0, min: 0, max: 2, options: ['Left', 'Right', 'Both'] },
        { key: 'W', label: 'Width', defaultValue: 80, min: 30, max: 3000 },
        { key: 'D', label: 'Depth', defaultValue: 600, min: 300, max: 800 },
      ],
    },
    {
      id: 'loft',
      label: 'Loft Above Wardrobe',
      icon: '📦',
      description: 'Storage loft mounted above the wardrobe — Only Door or a full Box. Height and Door Count are calculated automatically but stay editable.',
      placement: 'composite',
      fields: [
        { key: 'mode', label: 'Loft Type', defaultValue: 0, min: 0, max: 1, options: ['Only Door', 'Box'] },
        { key: 'H', label: 'Loft Height', defaultValue: 400, min: 100, max: 900 },
        { key: 'D', label: 'Loft Depth', defaultValue: 350, min: 250, max: 500, showWhen: { key: 'mode', equals: 1 } },
        { key: 'doors', label: 'Number of Loft Doors', defaultValue: 2, min: 1, max: 12, isCount: true },
      ],
    },
    {
      id: 'fix-patti',
      label: 'Fix Patti',
      icon: '🟩',
      description: 'Fixed outer panel(s) at the edge of the Loft — its width is deducted from Total Width before the Loft Door Count is calculated',
      placement: 'composite',
      fields: [
        { key: 'position', label: 'Fix Patti Position', defaultValue: 0, min: 0, max: 3, options: ['None', 'Left', 'Right', 'Both'] },
        { key: 'leftH', label: 'Left Fix Patti Height', defaultValue: 400, min: 100, max: 900, sideOf: 'left' },
        { key: 'leftW', label: 'Left Fix Patti Width', defaultValue: 100, min: 30, max: 400, sideOf: 'left' },
        { key: 'rightH', label: 'Right Fix Patti Height', defaultValue: 400, min: 100, max: 900, sideOf: 'right' },
        { key: 'rightW', label: 'Right Fix Patti Width', defaultValue: 100, min: 30, max: 400, sideOf: 'right' },
      ],
    },
    {
      // Khacha — a real, separate component from Fix Patti (never merged
      // data). Same shape, tracked independently, and BOTH deduct from the
      // usable Loft door area together when both are present.
      id: 'khacha',
      label: 'Khacha',
      icon: '🟢',
      description: 'Fixed corner panel(s) at the outer edge of the Loft, beyond Fix Patti — its width is also deducted from the usable Loft Door Width',
      placement: 'composite',
      fields: [
        { key: 'position', label: 'Khacha Position', defaultValue: 0, min: 0, max: 3, options: ['None', 'Left', 'Right', 'Both'] },
        { key: 'leftH', label: 'Left Khacha Height', defaultValue: 400, min: 100, max: 900, sideOf: 'left' },
        { key: 'leftW', label: 'Left Khacha Width', defaultValue: 100, min: 30, max: 400, sideOf: 'left' },
        { key: 'rightH', label: 'Right Khacha Height', defaultValue: 400, min: 100, max: 900, sideOf: 'right' },
        { key: 'rightW', label: 'Right Khacha Width', defaultValue: 100, min: 30, max: 400, sideOf: 'right' },
      ],
    },
    {
      // Extra Storage — a real box beside the Wardrobe/Dressing, with its
      // OWN door calculation from Storage Width alone (never Room/Loft/
      // Wardrobe Width). Depth defaults to Wardrobe Depth (spec §28) via
      // ProductFlow.tsx's live-computed-default pattern, same as Loft
      // Height/Door Count — the defaultValue here is only the static
      // fallback shown before that real default exists.
      id: 'storage',
      label: 'Extra Storage',
      icon: '📦',
      description: 'Storage box beside the Wardrobe/Dressing, with its own door count calculated from Storage Width only',
      placement: 'composite',
      fields: [
        { key: 'position', label: 'Storage Position', defaultValue: 0, min: 0, max: 3, options: ['None', 'Left', 'Right', 'Both'] },
        { key: 'leftH', label: 'Left Storage Height', defaultValue: 450, min: 100, max: 1200, sideOf: 'left' },
        { key: 'leftW', label: 'Left Storage Width', defaultValue: 600, min: 200, max: 1500, sideOf: 'left' },
        { key: 'leftD', label: 'Left Storage Depth', defaultValue: 600, min: 200, max: 800, sideOf: 'left' },
        { key: 'leftDoors', label: 'Left Storage Number of Doors', defaultValue: 2, min: 1, max: 8, sideOf: 'left', isCount: true },
        { key: 'rightH', label: 'Right Storage Height', defaultValue: 450, min: 100, max: 1200, sideOf: 'right' },
        { key: 'rightW', label: 'Right Storage Width', defaultValue: 600, min: 200, max: 1500, sideOf: 'right' },
        { key: 'rightD', label: 'Right Storage Depth', defaultValue: 600, min: 200, max: 800, sideOf: 'right' },
        { key: 'rightDoors', label: 'Right Storage Number of Doors', defaultValue: 2, min: 1, max: 8, sideOf: 'right', isCount: true },
      ],
    },
    {
      // Open Box — a real box beside the Wardrobe/Dressing, no door
      // calculation (an open box, not a shuttered one). Sits BELOW Storage
      // on the same side when both are present.
      id: 'open-box',
      label: 'Open Box',
      icon: '🔲',
      description: 'Open storage box beside the Wardrobe/Dressing — no door/shutter. Sits below Extra Storage on the same side when both are added.',
      placement: 'composite',
      fields: [
        { key: 'position', label: 'Open Box Position', defaultValue: 0, min: 0, max: 3, options: ['None', 'Left', 'Right', 'Both'] },
        { key: 'leftH', label: 'Left Open Box Height', defaultValue: 300, min: 100, max: 900, sideOf: 'left' },
        { key: 'leftW', label: 'Left Open Box Width', defaultValue: 600, min: 200, max: 1500, sideOf: 'left' },
        { key: 'leftD', label: 'Left Open Box Depth', defaultValue: 600, min: 200, max: 800, sideOf: 'left' },
        { key: 'rightH', label: 'Right Open Box Height', defaultValue: 300, min: 100, max: 900, sideOf: 'right' },
        { key: 'rightW', label: 'Right Open Box Width', defaultValue: 600, min: 200, max: 1500, sideOf: 'right' },
        { key: 'rightD', label: 'Right Open Box Depth', defaultValue: 600, min: 200, max: 800, sideOf: 'right' },
      ],
    },
    {
      id: 'study-table',
      label: 'Study Table (Attached)',
      icon: '🪑',
      description: 'Study Table attached beside the Wardrobe/Dressing — Left, Right or Both, each with its own H × W × D. Only available when Side Dressing is not added.',
      placement: 'composite',
      fields: [
        { key: 'side', label: 'Study Table Position', defaultValue: 0, min: 0, max: 2, options: ['Left', 'Right', 'Both'] },
        { key: 'leftH', label: 'Left Study Table Height', defaultValue: 750, min: 600, max: 900, sideOf: 'left' },
        { key: 'leftW', label: 'Left Study Table Width', defaultValue: 1200, min: 600, max: 2400, sideOf: 'left' },
        { key: 'leftD', label: 'Left Study Table Depth', defaultValue: 600, min: 400, max: 800, sideOf: 'left' },
        { key: 'rightH', label: 'Right Study Table Height', defaultValue: 750, min: 600, max: 900, sideOf: 'right' },
        { key: 'rightW', label: 'Right Study Table Width', defaultValue: 1200, min: 600, max: 2400, sideOf: 'right' },
        { key: 'rightD', label: 'Right Study Table Depth', defaultValue: 600, min: 400, max: 800, sideOf: 'right' },
      ],
    },
    {
      id: 'adjacent-loft',
      label: 'L-Shaped Loft (Adjacent Wall)',
      icon: '📐',
      description: 'A second, independent Loft on the adjacent wall — same door-count formula as the main Loft, its own Total Width/Height/Fix Patti/Khacha, never combined with the main Loft’s.',
      placement: 'composite',
      fields: [
        { key: 'side', label: 'Adjacent Loft Side', defaultValue: 0, min: 0, max: 1, options: ['Left', 'Right'] },
        { key: 'mode', label: 'Loft Type', defaultValue: 0, min: 0, max: 1, options: ['Only Door', 'Box'] },
        { key: 'totalW', label: 'Wall B Total Width', defaultValue: 2000, min: 600, max: 6000 },
        { key: 'H', label: 'Wall B Loft Height', defaultValue: 400, min: 100, max: 900 },
        { key: 'D', label: 'Wall B Loft Depth', defaultValue: 350, min: 250, max: 500, showWhen: { key: 'mode', equals: 1 } },
        { key: 'doors', label: 'Wall B Number of Loft Doors', defaultValue: 2, min: 1, max: 12, isCount: true },
        { key: 'fpPosition', label: 'Wall B Fix Patti Position', defaultValue: 0, min: 0, max: 3, options: ['None', 'Left', 'Right', 'Both'] },
        { key: 'fpLeftH', label: 'Wall B Left Fix Patti Height', defaultValue: 400, min: 100, max: 900, sideOf: 'left', groupKey: 'fpPosition' },
        { key: 'fpLeftW', label: 'Wall B Left Fix Patti Width', defaultValue: 100, min: 30, max: 400, sideOf: 'left', groupKey: 'fpPosition' },
        { key: 'fpRightH', label: 'Wall B Right Fix Patti Height', defaultValue: 400, min: 100, max: 900, sideOf: 'right', groupKey: 'fpPosition' },
        { key: 'fpRightW', label: 'Wall B Right Fix Patti Width', defaultValue: 100, min: 30, max: 400, sideOf: 'right', groupKey: 'fpPosition' },
        { key: 'khPosition', label: 'Wall B Khacha Position', defaultValue: 0, min: 0, max: 3, options: ['None', 'Left', 'Right', 'Both'] },
        { key: 'khLeftH', label: 'Wall B Left Khacha Height', defaultValue: 400, min: 100, max: 900, sideOf: 'left', groupKey: 'khPosition' },
        { key: 'khLeftW', label: 'Wall B Left Khacha Width', defaultValue: 100, min: 30, max: 400, sideOf: 'left', groupKey: 'khPosition' },
        { key: 'khRightH', label: 'Wall B Right Khacha Height', defaultValue: 400, min: 100, max: 900, sideOf: 'right', groupKey: 'khPosition' },
        { key: 'khRightW', label: 'Wall B Right Khacha Width', defaultValue: 100, min: 30, max: 400, sideOf: 'right', groupKey: 'khPosition' },
      ],
    },
  ],
  'tv-unit': [
    {
      id: 'back-panel',
      label: 'Back Panel / Feature Wall',
      icon: '🖼️',
      description: 'Decorative back panel behind the TV unit',
      placement: 'composite',
      fields: [
        { key: 'W', label: 'Panel Width',  defaultValue: 3200, min: 1200, max: 6000 },
        { key: 'H', label: 'Panel Height', defaultValue: 2750, min: 2000, max: 3500 },
      ],
    },
    {
      id: 'storage-box',
      label: 'Extra Storage Box',
      icon: '📦',
      description: 'Standalone storage cabinet next to the TV unit',
      placement: 'separate',
      fields: [
        { key: 'H', label: 'Height', defaultValue: 450, min: 200, max: 900 },
        { key: 'W', label: 'Width',  defaultValue: 600, min: 300, max: 1200 },
        { key: 'D', label: 'Depth',  defaultValue: 350, min: 200, max: 600 },
      ],
    },
  ],
  // Shoe Rack has no base W/H/D of its own — it's built entirely from these
  // two optional box types, per the user's own reference sketch. Both take
  // a real Height x Width x Depth, and both can be added together (2 Door
  // Box on the left, Single Door Box on the right, flush on the same
  // bottom line) or on their own.
  'shoe-rack': [
    {
      id: 'two-door-box',
      label: 'Add 2 Door Box',
      icon: '🚪',
      description: 'Two-door shoe rack box — takes Height, Width, Depth',
      placement: 'composite',
      fields: [
        { key: 'H', label: 'Height', defaultValue: 1500, min: 400, max: 2000 },
        { key: 'W', label: 'Width', defaultValue: 1050, min: 400, max: 2000 },
        { key: 'D', label: 'Depth', defaultValue: 450, min: 250, max: 600 },
      ],
    },
    {
      id: 'single-door-box',
      label: 'Add Single Door Box',
      icon: '🚪',
      description: 'Single-door shoe rack box — takes Height, Width, Depth',
      placement: 'composite',
      fields: [
        { key: 'H', label: 'Height', defaultValue: 750, min: 300, max: 1500 },
        { key: 'W', label: 'Width', defaultValue: 450, min: 300, max: 1000 },
        { key: 'D', label: 'Depth', defaultValue: 450, min: 250, max: 600 },
      ],
    },
  ],
  'dining-table': [
    {
      id: 'crockery-unit',
      label: 'Crockery / Display Unit',
      icon: '🍽️',
      description: 'Wall-mounted crockery or display cabinet',
      placement: 'separate',
      fields: [
        { key: 'W', label: 'Width',  defaultValue: 900,  min: 600, max: 1800 },
        { key: 'H', label: 'Height', defaultValue: 1200, min: 800, max: 2100 },
        { key: 'D', label: 'Depth',  defaultValue: 350,  min: 250, max: 500 },
      ],
    },
    {
      id: 'bar-unit',
      label: 'Bar / Drinks Unit',
      icon: '🍷',
      description: 'Bar cabinet or drinks trolley',
      placement: 'separate',
      fields: [
        { key: 'W', label: 'Width',  defaultValue: 800,  min: 500, max: 1400 },
        { key: 'H', label: 'Height', defaultValue: 900,  min: 700, max: 1200 },
        { key: 'D', label: 'Depth',  defaultValue: 400,  min: 300, max: 600 },
      ],
    },
  ],
  bedroom: [
    {
      id: 'dressing-table',
      label: 'Dressing Table',
      icon: '🪞',
      description: 'Dressing table with mirror',
      placement: 'separate',
      fields: [
        { key: 'W', label: 'Width',  defaultValue: 900, min: 600, max: 1400 },
        { key: 'H', label: 'Height', defaultValue: 750, min: 600, max: 900 },
        { key: 'D', label: 'Depth',  defaultValue: 450, min: 350, max: 600 },
      ],
    },
    {
      id: 'study-table',
      label: 'Study / Work Table',
      icon: '📚',
      description: 'Study or work desk with overhead storage',
      placement: 'separate',
      fields: [
        { key: 'W', label: 'Width',  defaultValue: 1200, min: 900,  max: 1800 },
        { key: 'H', label: 'Height', defaultValue: 750,  min: 700,  max: 850 },
        { key: 'D', label: 'Depth',  defaultValue: 600,  min: 450,  max: 750 },
      ],
    },
  ],
  // 1bhk/2bhk/3bhk PRODUCT_ADDONS removed along with the products
  // themselves (see productRegistry.tsx) — out of scope per the user's
  // explicit instruction.
};

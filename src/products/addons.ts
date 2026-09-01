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
    { label: 'Base Storage', color: '#0891b2', keys: ['baseH', 'baseW', 'baseD'] },
  ],
  'separate-dressing': [
    { label: 'Total',         color: '#ea580c', keys: ['H', 'W', 'D'] },
    { label: 'Dressing Box',  color: '#2563eb', keys: ['dressingBoxH'] },
    { label: 'Base Storage',  color: '#ea580c', keys: ['baseStorageH', 'baseStorageW'] },
  ],
  'openable-wardrobe': [
    { label: 'Wardrobe', color: '#3b82f6', keys: ['W', 'H', 'D'] },
  ],
  'sliding-wardrobe': [
    { label: 'Wardrobe', color: '#3b82f6', keys: ['W', 'H', 'D'] },
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
    { label: 'Table Top', color: '#f59e0b', keys: ['L', 'W', 'topThick'] },
    { label: 'Frame',     color: '#3b82f6', keys: ['H'] },
    { label: 'Seating',   color: '#22c55e', keys: ['seats'] },
  ],
  bedroom: [
    { label: 'Room Size', color: '#3b82f6', keys: ['roomL', 'roomW'] },
    { label: 'Bed',       color: '#22c55e', keys: ['bedW', 'bedL', 'hasBed'] },
    { label: 'Furniture', color: '#f59e0b', keys: ['wardW', 'tvW', 'hasWardrobe', 'hasTVUnit'] },
  ],
  '1bhk': [
    { label: 'Living / Dining', color: '#3b82f6', keys: ['livingL', 'livingW'] },
    { label: 'Kitchen',         color: '#f59e0b', keys: ['kitchenL', 'kitchenW'] },
    { label: 'Bedroom',         color: '#22c55e', keys: ['bedL', 'bedW'] },
    { label: 'Bathroom',        color: '#8b5cf6', keys: ['bathL', 'bathW'] },
  ],
  '2bhk': [
    { label: 'Living',          color: '#3b82f6', keys: ['livingL', 'livingW'] },
    { label: 'Kitchen',         color: '#f59e0b', keys: ['kitchenL', 'kitchenW'] },
    { label: 'Master Bedroom',  color: '#22c55e', keys: ['bed1L', 'bed1W'] },
    { label: 'Bedroom 2',       color: '#a855f7', keys: ['bed2L', 'bed2W'] },
    { label: 'Bathroom',        color: '#8b5cf6', keys: ['bath1L', 'bath1W'] },
  ],
  '3bhk': [
    { label: 'Living',         color: '#3b82f6', keys: ['livingL', 'livingW'] },
    { label: 'Kitchen',        color: '#f59e0b', keys: ['kitchenL', 'kitchenW'] },
    { label: 'Master Bedroom', color: '#22c55e', keys: ['bed1L', 'bed1W'] },
    { label: 'Bedroom 2',      color: '#a855f7', keys: ['bed2L', 'bed2W'] },
    { label: 'Bedroom 3',      color: '#ec4899', keys: ['bed3L', 'bed3W'] },
  ],
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
      id: 'profile-shutter',
      label: 'Profile Shutter',
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
      ],
    },
    {
      id: 'side-panel',
      label: 'Side Panel',
      icon: '▥',
      description: 'Extra end panel beside the wardrobe (or dressing, if both are added)',
      placement: 'composite',
      fields: [
        { key: 'side', label: 'Side', defaultValue: 0, min: 0, max: 2, options: ['Left', 'Right', 'Both'] },
        { key: 'W', label: 'Width', defaultValue: 80, min: 30, max: 300 },
        { key: 'D', label: 'Depth', defaultValue: 600, min: 300, max: 800 },
      ],
    },
    {
      id: 'loft',
      label: 'Loft Above Wardrobe',
      icon: '📦',
      description: 'Storage loft mounted above the wardrobe — Only Door or a full Box',
      placement: 'composite',
      fields: [
        { key: 'mode', label: 'Loft Type', defaultValue: 0, min: 0, max: 1, options: ['Only Door', 'Box'] },
        { key: 'H', label: 'Loft Height', defaultValue: 400, min: 250, max: 650 },
        { key: 'D', label: 'Loft Depth', defaultValue: 350, min: 250, max: 500 },
        { key: 'doors', label: 'Door Count', defaultValue: 2, min: 1, max: 8 },
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
      ],
    },
    {
      id: 'side-panel',
      label: 'Side Panel',
      icon: '▥',
      description: 'Extra end panel beside the wardrobe (or dressing, if both are added)',
      placement: 'composite',
      fields: [
        { key: 'side', label: 'Side', defaultValue: 0, min: 0, max: 2, options: ['Left', 'Right', 'Both'] },
        { key: 'W', label: 'Width', defaultValue: 80, min: 30, max: 300 },
        { key: 'D', label: 'Depth', defaultValue: 600, min: 300, max: 800 },
      ],
    },
    {
      id: 'loft',
      label: 'Loft Above Wardrobe',
      icon: '📦',
      description: 'Storage loft mounted above the wardrobe — Only Door or a full Box',
      placement: 'composite',
      fields: [
        { key: 'mode', label: 'Loft Type', defaultValue: 0, min: 0, max: 1, options: ['Only Door', 'Box'] },
        { key: 'H', label: 'Loft Height', defaultValue: 400, min: 250, max: 650 },
        { key: 'D', label: 'Loft Depth', defaultValue: 350, min: 250, max: 500 },
        { key: 'doors', label: 'Door Count', defaultValue: 2, min: 1, max: 8 },
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
  '1bhk': [
    {
      id: 'balcony',
      label: 'Balcony',
      icon: '🌿',
      description: 'Attached balcony area',
      placement: 'separate',
      fields: [
        { key: 'L', label: 'Length', defaultValue: 3000, min: 1500, max: 6000 },
        { key: 'W', label: 'Width',  defaultValue: 1500, min: 900,  max: 3000 },
      ],
    },
  ],
  '2bhk': [
    {
      id: 'balcony',
      label: 'Balcony',
      icon: '🌿',
      description: 'Attached balcony area',
      placement: 'separate',
      fields: [
        { key: 'L', label: 'Length', defaultValue: 3000, min: 1500, max: 6000 },
        { key: 'W', label: 'Width',  defaultValue: 1500, min: 900,  max: 3000 },
      ],
    },
    {
      id: 'utility',
      label: 'Utility / Store Room',
      icon: '🧹',
      description: 'Utility or store room',
      placement: 'separate',
      fields: [
        { key: 'L', label: 'Length', defaultValue: 2000, min: 1000, max: 3500 },
        { key: 'W', label: 'Width',  defaultValue: 1500, min: 1000, max: 2500 },
      ],
    },
  ],
  '3bhk': [
    {
      id: 'balcony',
      label: 'Balcony',
      icon: '🌿',
      description: 'Attached balcony area',
      placement: 'separate',
      fields: [
        { key: 'L', label: 'Length', defaultValue: 3500, min: 1500, max: 6000 },
        { key: 'W', label: 'Width',  defaultValue: 1800, min: 900,  max: 3500 },
      ],
    },
    {
      id: 'study-room',
      label: 'Study Room',
      icon: '📚',
      description: 'Dedicated study or home office',
      placement: 'separate',
      fields: [
        { key: 'L', label: 'Length', defaultValue: 3000, min: 1500, max: 5000 },
        { key: 'W', label: 'Width',  defaultValue: 2500, min: 1500, max: 4000 },
      ],
    },
  ],
};

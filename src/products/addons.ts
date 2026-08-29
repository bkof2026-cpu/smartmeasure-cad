// ─── Add-on field definition ────────────────────────────────────────────────────
export interface AddonField {
  key: string;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
  step?: number;
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
    { label: 'Frame & Structure', color: '#3b82f6', keys: ['W', 'L', 'H', 'thk'] },
    { label: 'Headboard',         color: '#f59e0b', keys: ['headboardH'] },
    { label: 'Side Panel',        color: '#8b5cf6', keys: ['D'] },
    { label: 'Base / Skirting',   color: '#a16207', keys: ['skirtingH'] },
  ],
  'side-table': [
    { label: 'Cabinet Body',   color: '#3b82f6', keys: ['W', 'D', 'H', 'thk'] },
    { label: 'Drawer Details', color: '#22c55e', keys: ['drawers', 'drawerH'] },
  ],
  'openable-wardrobe': [
    { label: 'Carcass',         color: '#3b82f6', keys: ['W', 'H', 'D', 'thk'] },
    { label: 'Internal Layout', color: '#22c55e', keys: ['verticals', 'shelves'] },
  ],
  'sliding-wardrobe': [
    { label: 'Carcass',         color: '#3b82f6', keys: ['W', 'H', 'D'] },
    { label: 'Shutters',        color: '#f59e0b', keys: ['shutters'] },
    { label: 'Internal Layout', color: '#22c55e', keys: ['verticals', 'shelves'] },
  ],
  'tv-unit': [
    { label: 'Overall Size',    color: '#3b82f6', keys: ['W', 'H', 'D'] },
    { label: 'TV Screen',       color: '#22c55e', keys: ['tvW', 'tvH'] },
    { label: 'Cabinet Layout',  color: '#f59e0b', keys: ['baseCabs', 'wallCabs', 'openBoxes'] },
  ],
  loft: [
    { label: 'Cabinet',  color: '#3b82f6', keys: ['W', 'H', 'D', 'thk'] },
    { label: 'Layout',   color: '#22c55e', keys: ['boxes', 'hasDoor'] },
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
      id: 'side-table-left',
      label: 'Side Table — Left',
      icon: '🪑',
      description: 'Bedside cabinet on the left side of the bed',
      placement: 'composite',
      fields: [
        { key: 'H', label: 'Height', defaultValue: 500, min: 380, max: 700 },
        { key: 'W', label: 'Width',  defaultValue: 450, min: 280, max: 650 },
        { key: 'D', label: 'Depth',  defaultValue: 400, min: 280, max: 550 },
      ],
    },
    {
      id: 'side-table-right',
      label: 'Side Table — Right',
      icon: '🪑',
      description: 'Bedside cabinet on the right side of the bed',
      placement: 'composite',
      fields: [
        { key: 'H', label: 'Height', defaultValue: 500, min: 380, max: 700 },
        { key: 'W', label: 'Width',  defaultValue: 450, min: 280, max: 650 },
        { key: 'D', label: 'Depth',  defaultValue: 400, min: 280, max: 550 },
      ],
    },
    {
      id: 'wardrobe',
      label: 'Wardrobe',
      icon: '🚪',
      description: 'Openable wardrobe for the bedroom',
      placement: 'separate',
      fields: [
        { key: 'W', label: 'Width',  defaultValue: 1800, min: 900,  max: 3600 },
        { key: 'H', label: 'Height', defaultValue: 2100, min: 1800, max: 2750 },
        { key: 'D', label: 'Depth',  defaultValue: 600,  min: 400,  max: 750 },
      ],
    },
  ],
  'side-table': [
    {
      id: 'mirror',
      label: 'Wall Mirror Above',
      icon: '🪞',
      description: 'Decorative mirror mounted above the side table',
      placement: 'separate',
      fields: [
        { key: 'W', label: 'Mirror Width',  defaultValue: 600, min: 300, max: 1000 },
        { key: 'H', label: 'Mirror Height', defaultValue: 800, min: 400, max: 1200 },
      ],
    },
  ],
  'openable-wardrobe': [
    {
      id: 'loft',
      label: 'Loft Above Wardrobe',
      icon: '📦',
      description: 'Storage loft unit mounted flush above the wardrobe',
      placement: 'composite',
      fields: [
        { key: 'H', label: 'Loft Height', defaultValue: 400, min: 250, max: 650 },
        { key: 'D', label: 'Loft Depth',  defaultValue: 350, min: 250, max: 500 },
      ],
    },
    {
      id: 'skirting-box',
      label: 'Raised Skirting / Plinth Box',
      icon: '▬',
      description: 'Raised plinth at the base of the wardrobe',
      placement: 'composite',
      fields: [
        { key: 'H', label: 'Plinth Height', defaultValue: 150, min: 80, max: 250 },
      ],
    },
  ],
  'sliding-wardrobe': [
    {
      id: 'loft',
      label: 'Loft Above Wardrobe',
      icon: '📦',
      description: 'Storage loft unit mounted flush above the wardrobe',
      placement: 'composite',
      fields: [
        { key: 'H', label: 'Loft Height', defaultValue: 400, min: 250, max: 650 },
        { key: 'D', label: 'Loft Depth',  defaultValue: 350, min: 250, max: 500 },
      ],
    },
    {
      id: 'storage-box',
      label: 'Storage Box (standalone)',
      icon: '📦',
      description: 'Extra freestanding storage box next to the wardrobe',
      placement: 'separate',
      fields: [
        { key: 'H', label: 'Height', defaultValue: 800, min: 300, max: 1500 },
        { key: 'W', label: 'Width',  defaultValue: 600, min: 300, max: 1200 },
        { key: 'D', label: 'Depth',  defaultValue: 450, min: 250, max: 700 },
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
  loft: [
    {
      id: 'storage-box',
      label: 'Storage Box',
      icon: '📦',
      description: 'Standalone storage box to complement the loft',
      placement: 'separate',
      fields: [
        { key: 'H', label: 'Height', defaultValue: 400, min: 200, max: 800 },
        { key: 'W', label: 'Width',  defaultValue: 600, min: 300, max: 1200 },
        { key: 'D', label: 'Depth',  defaultValue: 300, min: 200, max: 600 },
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

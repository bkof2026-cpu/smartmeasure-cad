import type { WardrobeConstruction } from './wardrobeFormulas';

// ─────────────────────────────────────────────────────────────────────────────
// Explicit, structured construction definitions for every wardrobe design in
// src/screens/WardrobeDesignSelection.tsx's WARDROBE_DESIGNS catalog (25
// entries). This is the fix for the confirmed bug: previously only 1 of 25
// designs had any distinct drawing — the other 24 fell back to a generic
// N-door box regardless of what the design card said. Every design here maps
// to real, differently-shaped zones — never inferred from the design's name
// string at render time.
//
// A design not present in this map renders NOT_CONFIGURED rather than a
// guessed layout (see wardrobeGeometry.ts).
// ─────────────────────────────────────────────────────────────────────────────

export type ZoneContentKind = 'standard' | 'niche' | 'drawerTower' | 'dressing';

export interface ZoneDef {
  id: string;
  /** Fraction of the overall width this zone occupies (all zones in a design must sum to 1). */
  widthShare: number;
  doorCount: number;
  content: ZoneContentKind;
  /** For 'standard' zones: how the generic shelves/drawers/verticals fields split across zones. */
  shelfShare?: number;
  drawerShare?: number;
}

export interface WardrobeDesignDef {
  id: string;
  construction: WardrobeConstruction;
  zones: ZoneDef[];
  hasLoft: boolean;
  hasPlinth: boolean;
  /** True only for the one design with its own independently-sized zones (mixed storage). */
  useExplicitZoneWidths?: boolean;
}

const standardZone = (id: string, widthShare: number, doorCount: number, shelfShare = 1, drawerShare = 1): ZoneDef => ({
  id, widthShare, doorCount, content: 'standard', shelfShare, drawerShare,
});

function nDoorDesign(id: string, count: number, construction: WardrobeConstruction): WardrobeDesignDef {
  return { id, construction, zones: [standardZone('main', 1, count)], hasLoft: false, hasPlinth: true };
}

function comboDesign(id: string, construction: WardrobeConstruction, doorCount: number, special: ZoneContentKind): WardrobeDesignDef {
  return {
    id, construction, hasPlinth: true, hasLoft: false,
    zones: [standardZone('main', 0.72, doorCount), { id: 'special', widthShare: 0.28, doorCount: 0, content: special }],
  };
}

function loftDesign(id: string, construction: WardrobeConstruction, doorCount: number): WardrobeDesignDef {
  return { id, construction, zones: [standardZone('main', 1, doorCount)], hasLoft: true, hasPlinth: true };
}

function internalOnlyDesign(id: string): WardrobeDesignDef {
  return { id, construction: 'openable', zones: [standardZone('main', 1, 2)], hasLoft: false, hasPlinth: true };
}

export const WARDROBE_DESIGN_DEFS: Record<string, WardrobeDesignDef> = {
  ...Object.fromEntries([2, 3, 4, 5, 6].map((count) => [`hinged-${count}`, nDoorDesign(`hinged-${count}`, count, 'openable')])),
  ...Object.fromEntries([2, 3, 4].map((count) => [`sliding-${count}`, nDoorDesign(`sliding-${count}`, count, 'sliding')])),

  wardrobe_openable_6door_loft_mixed_storage: {
    id: 'wardrobe_openable_6door_loft_mixed_storage', construction: 'openable', hasLoft: true, hasPlinth: true, useExplicitZoneWidths: true,
    zones: [
      standardZone('left', 1 / 3, 2),
      standardZone('center', 1 / 3, 2),
      standardZone('right', 1 / 3, 2),
    ],
  },

  'hinged-niche': comboDesign('hinged-niche', 'openable', 4, 'niche'),
  'sliding-niche': comboDesign('sliding-niche', 'sliding', 3, 'niche'),
  'hinged-drawer': comboDesign('hinged-drawer', 'openable', 4, 'drawerTower'),
  'sliding-drawer': comboDesign('sliding-drawer', 'sliding', 3, 'drawerTower'),
  'hinged-loft': loftDesign('hinged-loft', 'openable', 4),
  'sliding-loft': loftDesign('sliding-loft', 'sliding', 3),
  'hinged-dressing': comboDesign('hinged-dressing', 'openable', 4, 'dressing'),
  'sliding-dressing': comboDesign('sliding-dressing', 'sliding', 3, 'dressing'),

  // "Internal" catalog entries specify no door type/count in WARDROBE_DESIGNS
  // — defaulted to a 2-door openable carcass; each varies only in internal
  // shelf/drawer/hanging composition (applied in wardrobeGeometry.ts's
  // internal-view resolver, keyed by these same ids).
  'internal-1': internalOnlyDesign('internal-1'), // Full Hanging
  'internal-2': internalOnlyDesign('internal-2'), // Hanging + Shelf
  'internal-3': internalOnlyDesign('internal-3'), // Hanging + Drawer
  'internal-4': internalOnlyDesign('internal-4'), // Hanging + Shelf + Drawer
  'internal-5': internalOnlyDesign('internal-5'), // Double Hanging
  'internal-6': internalOnlyDesign('internal-6'), // Long Hanging
  'internal-7': internalOnlyDesign('internal-7'), // Shelves + Drawers
  'internal-8': internalOnlyDesign('internal-8'), // Custom Internal Configuration
};

export function getWardrobeDesignDef(id: string): WardrobeDesignDef | undefined {
  return WARDROBE_DESIGN_DEFS[id];
}

import type React from 'react';

export type ProductId =
  | 'kitchen'
  | 'bed'
  | 'side-table'
  | 'openable-wardrobe'
  | 'sliding-wardrobe'
  | 'tv-unit'
  | 'loft'
  | 'shoe-rack'
  | 'dining-table'
  | 'bedroom'
  | 'separate-dressing'
  | 'sofa'
  | 'center-table'
  | 'separate-side-table'
  | 'loft-box'
  | 'study-table'
  | 'partition'
  | 'door'
  | 'sofa-cum-bed';

/**
 * The user-facing room grouping from the Product Categories spec — purely
 * an organizational layer over the product library (dropdown grouping +
 * PDF section headings). Deliberately separate from the older `category`
 * field below (which drives the small "Furniture/Room/Apartment" badge in
 * the top bar) so this never changes that existing, unrelated behavior.
 */
export type RoomCategory = 'Master Bedroom' | 'Living Room' | 'Kitchen';

export interface MeasurementField {
  key: string;
  label: string;
  unit: 'mm' | 'count' | 'bool' | 'select';
  defaultValue: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

export interface CutlistRow {
  srNo: number;
  component: string;
  material: string;
  width: number;
  height: number;
  qty: number;
  thickness: number;
  groove: string;
  remark: string;
}

export interface ProductTemplate {
  id: ProductId;
  name: string;
  icon: string;
  category: 'furniture' | 'room' | 'apartment';
  /** Master Bedroom / Living Room / Kitchen — see RoomCategory. Optional so
   * the handful of whole-apartment/room-layout products (bedroom, 1bhk,
   * 2bhk, 3bhk, kitchen-the-room-planner) that don't fit this furniture-
   * oriented grouping can simply omit it; the grouped dropdown/PDF treat an
   * unset roomCategory as its own unlabeled bucket, never a crash. */
  roomCategory?: RoomCategory;
  isFormulaVerified: boolean;
  measurementFields: MeasurementField[];
  demoDimensions: Record<string, number | string>;
  computeCutlist: (dims: Record<string, number | string>) => CutlistRow[];
  views: string[];
  DrawingComponent: React.FC<{ dims: Record<string, number | string>; activeView: string }>;
}

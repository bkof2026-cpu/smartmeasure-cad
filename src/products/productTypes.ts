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
  | '1bhk'
  | '2bhk'
  | '3bhk'
  | 'separate-dressing'
  | 'sofa'
  | 'center-table';

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
  isFormulaVerified: boolean;
  measurementFields: MeasurementField[];
  demoDimensions: Record<string, number | string>;
  computeCutlist: (dims: Record<string, number | string>) => CutlistRow[];
  views: string[];
  DrawingComponent: React.FC<{ dims: Record<string, number | string>; activeView: string }>;
}

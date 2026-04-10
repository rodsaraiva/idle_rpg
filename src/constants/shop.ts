export interface StatVariance {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
}

export interface ShopItem {
  id: string;
  label: string;
  costMultiplier: number;
  statVariance: StatVariance;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'chest_bronze', label: 'Baú Herói Bronze', costMultiplier: 1, statVariance: { mean: 0.85, stdDev: 0.12, min: 0.5, max: 1.1 } },
  { id: 'chest_silver', label: 'Baú Herói Prata', costMultiplier: 2, statVariance: { mean: 1.0, stdDev: 0.14, min: 0.7, max: 1.3 } },
  { id: 'chest_gold', label: 'Baú Herói Ouro', costMultiplier: 3.5, statVariance: { mean: 1.2, stdDev: 0.10, min: 0.9, max: 1.5 } },
];


import { useContext, useMemo, useState } from 'react';
import { GameContext } from '../context/GameContext';
import { Hero, HeroTask } from '../types';

export interface UsePantheonResult {
  eligibleHeroes: Hero[];
  pantheonBonuses: { goldPercent: number; atkPercent: number; hpPercent: number };
  pantheonFusions: number;
  selectedIds: string[];
  canFuse: boolean;
  toggleHero: (heroId: string) => void;
  confirmFusion: () => void;
  clearSelection: () => void;
}

export function usePantheon(): UsePantheonResult {
  const { state, dispatch } = useContext(GameContext);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const eligibleHeroes = useMemo(
    () => state.heroes.filter(h => h.currentTask === HeroTask.IDLE && h.hpCurrent > 0),
    [state.heroes]
  );

  const pantheonBonuses = state.pantheonBonuses ?? { goldPercent: 0, atkPercent: 0, hpPercent: 0 };
  const pantheonFusions = state.pantheonFusions ?? 0;

  const canFuse = selectedIds.length === 3;

  function toggleHero(heroId: string) {
    setSelectedIds(prev => {
      if (prev.includes(heroId)) {
        return prev.filter(id => id !== heroId);
      }
      if (prev.length >= 3) return prev; // máximo 3
      return [...prev, heroId];
    });
  }

  function confirmFusion() {
    if (!canFuse) return;
    dispatch({ type: 'FUSE_HEROES', heroIds: selectedIds as [string, string, string] });
    setSelectedIds([]);
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  return {
    eligibleHeroes,
    pantheonBonuses,
    pantheonFusions,
    selectedIds,
    canFuse,
    toggleHero,
    confirmFusion,
    clearSelection,
  };
}

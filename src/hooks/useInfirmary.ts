import { useState, useMemo } from 'react';
import { useGame } from './useGame';
import { Hero, HeroTask } from '../types';

export function useInfirmary() {
  const { state, dispatch, isLoaded } = useGame();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const injuredIdle = useMemo(
    () => state.heroes.filter(
      (h) => h.currentTask === HeroTask.IDLE && h.hpCurrent < h.hpMax
    ),
    [state.heroes]
  );

  const inInfirmary = useMemo(
    () => state.heroes.filter((h) => h.currentTask === HeroTask.INFIRMARY),
    [state.heroes]
  );

  const toggleSelection = (id: string) =>
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const sendToInfirmary = () => {
    if (selectedIds.length === 0) return;
    dispatch({ type: 'START_INFERMARIA', heroIds: selectedIds });
    setSelectedIds([]);
  };

  const releaseFromInfirmary = (id: string) => {
    dispatch({ type: 'RELEASE_FROM_INFERMARIA', heroIds: [id] });
  };

  return {
    state,
    isLoaded,
    injuredIdle,
    inInfirmary,
    selectedIds,
    toggleSelection,
    sendToInfirmary,
    releaseFromInfirmary,
  };
}

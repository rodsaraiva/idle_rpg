import React, { useState } from 'react';
import { useGame } from './useGame';
import { Hero, HeroTask } from '../types';
import { emit, FEEDBACK_EVENTS } from '../services/feedback';

export function useMissions() {
  const { state, isLoaded, dispatch } = useGame();

  // modal state for choosing heroes after clicking "Enviar"
  const [selectionModalVisible, setSelectionModalVisible] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<{ templateId: string; minHeroes: number } | null>(null);

  // memoize hero lists to avoid unnecessary effect runs / re-renders
  const missionHeroes = React.useMemo(
    () => state.heroes.filter((h) => h.currentTask === HeroTask.MISSION),
    [state.heroes]
  );

  const selectableHeroes = React.useMemo(
    () => state.heroes.filter((h) => h.currentTask !== HeroTask.MISSION),
    [state.heroes]
  );

  const openSelectionModal = (templateId: string, minHeroes: number) => {
    setPendingTemplate({ templateId, minHeroes });
    setSelectionModalVisible(true);
  };

  const closeSelectionModal = () => {
    setSelectionModalVisible(false);
    setPendingTemplate(null);
  };

  const handleConfirmMission = (templateId: string, heroIds: string[]) => {
    if (!templateId) return;
    
    const now = Date.now();
    const valid = heroIds.filter((id) =>
      selectableHeroes.some((h) => h.id === id && !(h.incapacitatedUntilMs && h.incapacitatedUntilMs > now))
    );

    if (valid.length < (pendingTemplate?.minHeroes ?? 0)) {
      emit(FEEDBACK_EVENTS.TOAST, { 
        text: 'Alguns heróis não podem ir para missão (estão incapacitados ou já em missão)' 
      });
      return;
    }

    dispatch({ type: 'START_MISSION', templateId, heroIds: valid });
    closeSelectionModal();
  };

  const availableCount = selectableHeroes.filter(
    (h) => !(h.incapacitatedUntilMs && h.incapacitatedUntilMs > Date.now())
  ).length;

  return {
    state,
    isLoaded,
    missionHeroes,
    selectableHeroes,
    selectionModalVisible,
    pendingTemplate,
    availableCount,
    openSelectionModal,
    closeSelectionModal,
    handleConfirmMission,
  };
}

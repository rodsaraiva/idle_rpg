import React, { useState } from 'react';
import { useGame } from './useGame';
import { Hero, HeroTask } from '../types';
import { emit, FEEDBACK_EVENTS } from '../services/feedback';
import { INCAPACITATED_HP_THRESHOLD } from '../constants/game';

export function useMissions() {
  const { state, isLoaded, dispatch } = useGame();

  // modal state for choosing heroes after clicking "Enviar"
  const [selectionModalVisible, setSelectionModalVisible] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<{ templateId: string; minHeroes: number } | null>(null);
  const [playbackMissionId, setPlaybackMissionId] = useState<string | null>(null);

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

  const handleConfirmMission = (templateId: string, heroIds: string[], heroPositions?: Record<string, number>) => {
    if (!templateId) return;
    
    const valid = heroIds.filter((id) =>
      selectableHeroes.some((h) => h.id === id && h.hpCurrent >= INCAPACITATED_HP_THRESHOLD)
    );

    if (valid.length < (pendingTemplate?.minHeroes ?? 0)) {
      emit(FEEDBACK_EVENTS.TOAST, { 
        text: 'Alguns heróis não podem ir para missão (estão incapacitados ou já em missão)' 
      });
      return;
    }

    dispatch({ type: 'START_MISSION', templateId, heroIds: valid, heroPositions, now: Date.now() });
    closeSelectionModal();
  };

  const availableCount = selectableHeroes.filter(
    (h) => h.hpCurrent >= INCAPACITATED_HP_THRESHOLD
  ).length;

  const activePlaybackMission = React.useMemo(
    () => state.activeMissions?.find(m => m.id === playbackMissionId) || null,
    [state.activeMissions, playbackMissionId]
  );

  return {
    state,
    isLoaded,
    missionHeroes,
    selectableHeroes,
    selectionModalVisible,
    pendingTemplate,
    playbackMissionId,
    activePlaybackMission,
    availableCount,
    openSelectionModal,
    closeSelectionModal,
    handleConfirmMission,
    openPlaybackModal: (id: string) => setPlaybackMissionId(id),
    closePlaybackModal: () => setPlaybackMissionId(null),
  };
}

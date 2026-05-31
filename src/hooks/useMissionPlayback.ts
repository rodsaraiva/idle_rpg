import { useState, useEffect, useMemo, useRef } from 'react';
import { ActiveMission, MissionAction, Hero, MissionActorType } from '../types';
import { useGame } from './useGame';
import { GameMath } from '../utils/gameMath';

export type CombatantState = {
  id: string;
  name: string;
  type: MissionActorType;
  hp: number;
  maxHp: number;
  position: number;
  classId?: string;
  alive: boolean;
};

export function useMissionPlayback(mission: ActiveMission | null) {
  const { state } = useGame();
  const [currentCombatants, setCurrentCombatants] = useState<Record<string, CombatantState>>({});
  const [playbackLog, setPlaybackLog] = useState<string[]>([]);
  const [lastActionIdx, setLastActionIdx] = useState(-1);
  const [isFinished, setIsFinished] = useState(false);

  // Initialize combatants from mission state
  useEffect(() => {
    if (!mission) {
      setCurrentCombatants({});
      setPlaybackLog([]);
      setLastActionIdx(-1);
      setIsFinished(false);
      return;
    }

    const initialCombatants: Record<string, CombatantState> = {};

    // Heroes
    mission.heroIds.forEach((id) => {
      const hero = state.heroes.find((h) => h.id === id);
      if (hero) {
        initialCombatants[id] = {
          id: hero.id,
          name: hero.name,
          type: 'hero',
          hp: hero.hpMax, // Start with full HP for playback simulation if not tracked
          maxHp: hero.hpMax,
          position: (mission.heroPositions || {})[id] ?? 45,
          classId: hero.classId,
          alive: true,
        };
      }
    });

    // Enemies
    (mission.enemiesState || []).forEach((e) => {
      initialCombatants[e.id] = {
        id: e.id,
        name: e.id,
        type: 'enemy',
        hp: e.maxHp ?? e.hp,
        maxHp: e.maxHp ?? e.hp,
        position: e.position ?? 0,
        alive: true,
      };
    });

    setCurrentCombatants(initialCombatants);
    setPlaybackLog(['Iniciando missão...']);
  }, [mission?.id]);

  // Process scheduled actions based on elapsed time since mission start
  useEffect(() => {
    if (!mission || !mission.scheduledActions) return;
    const scheduledActions = mission.scheduledActions;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - mission.startedAt;

      // Find actions that should have happened by now but haven't been "played" in our local state
      const actionsToPlay = scheduledActions
        .map((sa, idx) => ({ ...sa, originalIdx: idx }))
        .filter((sa) => sa.atMsFromStart <= elapsed && sa.originalIdx > lastActionIdx)
        .sort((a, b) => a.atMsFromStart - b.atMsFromStart);

      if (actionsToPlay.length > 0) {
        setCurrentCombatants((prev) => {
          const next = { ...prev };
          const newLogs: string[] = [];

          actionsToPlay.forEach((sa) => {
            const action = sa.action;
            newLogs.push(action.text);

            if (action.actionType === 'move' && action.toPosition !== undefined) {
              if (next[action.actorId]) {
                next[action.actorId] = { ...next[action.actorId], position: action.toPosition };
              }
            } else if (action.actionType === 'hit' && action.targetId && action.amount !== undefined) {
              if (next[action.targetId]) {
                const target = next[action.targetId];
                const newHp = Math.max(0, target.hp - action.amount);
                next[action.targetId] = { ...target, hp: newHp };
              }
            } else if (action.actionType === 'heal' && action.targetId && action.amount !== undefined) {
              if (next[action.targetId]) {
                const target = next[action.targetId];
                const newHp = Math.min(target.maxHp, target.hp + action.amount);
                next[action.targetId] = { ...target, hp: newHp };
              }
            } else if (action.actionType === 'defeat' && action.targetId) {
              if (next[action.targetId]) {
                next[action.targetId] = { ...next[action.targetId], alive: false, hp: 0 };
              }
            }
          });

          setPlaybackLog((prevLogs) => [...prevLogs, ...newLogs].slice(-10));
          return next;
        });

        setLastActionIdx(actionsToPlay[actionsToPlay.length - 1].originalIdx);
      }

      // Check if mission is finished
      if (mission.finishAt && now >= mission.finishAt) {
        setIsFinished(true);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [mission, lastActionIdx]);

  return {
    currentCombatants: Object.values(currentCombatants),
    playbackLog,
    isFinished,
  };
}

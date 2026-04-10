import { GameState, HeroTask, Hero, ActiveMission } from '../types';
import { MISSIONS, MissionTemplate } from '../constants/missions';
import { v4 as uuidv4 } from 'uuid';
import { computeBattleOutcome } from '../utils/battleSim';
import { BattleEngine } from '../utils/battleEngine';
import { emit, FEEDBACK_EVENTS } from '../services/feedback';
import {
  HEALER_BUFF_PER_HERO,
  HEALER_BUFF_CAP,
  ROGUE_RNG_BONUS_PER_HERO,
  ROGUE_RNG_BONUS_CAP,
  MISSION_START_DELAY_MS,
  MISSION_ACTION_INTERVAL_MS,
} from '../constants/game';
import { isHeroAvailableForMission } from '../utils/heroUtils';
import { getActiveSynergies } from '../constants/synergies';
import { ClassId } from '../types';

function validateMissionRequirements(template: MissionTemplate, heroes: Hero[]): string | null {
  if (!template.requirements) return null;

  for (const req of template.requirements) {
    if (req.type === 'class_needed') {
      if (!heroes.some((h) => h.classId === req.classId)) {
        return req.label;
      }
    } else if (req.type === 'min_stat') {
      const statKey = req.stat === 'hp' ? 'hpMax' : req.stat!;
      if (!heroes.some((h) => (h[statKey as keyof Hero] as number) >= req.value!)) {
        return req.label;
      }
    } else if (req.type === 'min_avg_stat') {
      const statKey = req.stat === 'hp' ? 'hpMax' : req.stat!;
      const avg = heroes.reduce((acc, h) => acc + (h[statKey as keyof Hero] as number), 0) / heroes.length;
      if (avg < req.value!) {
        return req.label;
      }
    }
  }
  return null;
}

export function handleStartMission(state: GameState, templateId: string, heroIds: string[], heroPositions?: Record<string, number>, now?: number): GameState {
  const template = MISSIONS.find((t) => t.id === templateId);
  if (!template) return state;
  if ((heroIds?.length ?? 0) < template.minHeroes) return state;

  const heroesMap = new Map(state.heroes.map((h) => [h.id, h]));
  const timestamp = now ?? Date.now();
  const heroesForMission: Hero[] = [];

  for (const hid of heroIds) {
    const h = heroesMap.get(hid);
    if (!h || !isHeroAvailableForMission(h)) {
      return state;
    }
    heroesForMission.push(h);
  }

  // Validação de requisitos da missão
  const error = validateMissionRequirements(template, heroesForMission);
  if (error) {
    emit(FEEDBACK_EVENTS.TOAST, { text: `Requisito não atendido: ${error}` });
    return state;
  }

  const missionId = uuidv4();
  const countHealers = heroesForMission.filter((h) => h.classId === 'HEALER').length;
  const countRogues = heroesForMission.filter((h) => h.classId === 'ROGUE').length;
  const healerBuffMultiplier = 1 + Math.min(HEALER_BUFF_CAP, countHealers * HEALER_BUFF_PER_HERO);
  const rogueRngBonus = Math.min(ROGUE_RNG_BONUS_CAP, countRogues * ROGUE_RNG_BONUS_PER_HERO);

  const teamClassIds = heroesForMission.map(h => h.classId).filter(Boolean) as ClassId[];
  const activeSynergyNames = getActiveSynergies(teamClassIds).map(s => s.name);

  const newMission: ActiveMission = {
    id: missionId,
    templateId: template.id,
    heroIds: heroIds,
    heroPositions,
    startedAt: timestamp,
    healerBuffMultiplier,
    rogueRngBonus,
    activeSynergies: activeSynergyNames.length > 0 ? activeSynergyNames : undefined,
  };

  // Apply equipment stat bonuses to hero copies for battle
  const heroesWithEquipment = heroesForMission.map(h => {
    const equipped = h.equippedItems || [];
    if (equipped.length === 0) return h;
    const copy = { ...h };
    for (const eqId of equipped) {
      const item = (state.inventory || []).find(e => e.id === eqId);
      if (!item) continue;
      const bonus = item.statBonus;
      if (bonus.hp) copy.hpMax += bonus.hp;
      if (bonus.atk) copy.atk += bonus.atk;
      if (bonus.mp) copy.mp += bonus.mp;
      if (bonus.defense) copy.defense = (copy.defense ?? 0) + bonus.defense;
      if (bonus.crit) copy.crit = (copy.crit ?? 0) + bonus.crit;
      if (bonus.agility) copy.agility = (copy.agility ?? 0) + bonus.agility;
    }
    // Also boost current HP proportionally
    if (copy.hpMax > h.hpMax) {
      copy.hpCurrent = Math.min(copy.hpMax, copy.hpCurrent + (copy.hpMax - h.hpMax));
    }
    return copy;
  });

  try {
    const outcome = computeBattleOutcome(template, heroesWithEquipment, {
      healerBuffMultiplier,
      rogueRngBonus,
      heroPositions,
    });
    
    const missionEnemies = BattleEngine.createEnemies(template);
    const scheduled = (outcome.actions || []).map((a, i) => ({
      atMsFromStart: MISSION_START_DELAY_MS + i * MISSION_ACTION_INTERVAL_MS,
      action: a,
      applied: false,
    }));

    newMission.scheduledActions = scheduled;
    newMission.enemiesState = missionEnemies;
    newMission.precomputedOutcome = outcome;
  } catch (err) {
    console.error('Erro ao processar batalha da missão:', err);
    newMission.scheduledActions = [];
  }

  const newHeroesState = state.heroes.map((h) =>
    heroIds.includes(h.id)
      ? {
          ...h,
          currentTask: HeroTask.MISSION,
        }
      : h
  );

  return {
    ...state,
    heroes: newHeroesState,
    activeMissions: [...(state.activeMissions || []), newMission],
  };
}

export function handleDismissMissionResult(state: GameState, missionId: string): GameState {
  return {
    ...state,
    recentMissionResults: (state.recentMissionResults || []).filter((r) => r.missionId !== missionId),
  };
}

export function handleCompleteMission(state: GameState, missionId: string, reward: number): GameState {
  const mission = (state.activeMissions || []).find((m) => m.id === missionId);
  if (!mission) return state;

  const newMissions = (state.activeMissions || []).filter((m) => m.id !== missionId);
  const newHeroesState = state.heroes.map((h) =>
    mission.heroIds.includes(h.id) ? { ...h, currentTask: HeroTask.IDLE } : h
  );

  return {
    ...state,
    heroes: newHeroesState,
    activeMissions: newMissions,
    gold: state.gold + reward,
  };
}

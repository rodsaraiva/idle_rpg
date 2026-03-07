import { GameState, HeroTask, Hero, ActiveMission } from '../types';
import { MISSIONS } from '../constants/missions';
import { v4 as uuidv4 } from 'uuid';
import { computeBattleOutcome } from '../utils/battleSim';
import { 
  HEALER_BUFF_PER_HERO, 
  HEALER_BUFF_CAP, 
  ROGUE_RNG_BONUS_PER_HERO, 
  ROGUE_RNG_BONUS_CAP,
  MISSION_START_DELAY_MS,
  MISSION_ACTION_INTERVAL_MS
} from '../constants/game';

export function handleStartMission(state: GameState, templateId: string, heroIds: string[]): GameState {
  const template = MISSIONS.find((t) => t.id === templateId);
  if (!template) return state;
  if ((heroIds?.length ?? 0) < template.minHeroes) return state;

  const heroesMap = new Map(state.heroes.map((h) => [h.id, h]));
  const now = Date.now();
  for (const hid of heroIds) {
    const h = heroesMap.get(hid);
    if (!h) return state;
    if (h.currentTask === HeroTask.MISSION) return state;
    if (h.incapacitatedUntilMs && h.incapacitatedUntilMs > now) return state;
  }

  const missionId = uuidv4();
  const heroesForMission = heroIds.map((id) => heroesMap.get(id)!).filter(Boolean) as Hero[];
  const countHealers = heroesForMission.filter((h) => h.classId === 'HEALER').length;
  const countRogues = heroesForMission.filter((h) => h.classId === 'ROGUE').length;
  const healerBuffMultiplier = 1 + Math.min(HEALER_BUFF_CAP, countHealers * HEALER_BUFF_PER_HERO);
  const rogueRngBonus = Math.min(ROGUE_RNG_BONUS_CAP, countRogues * ROGUE_RNG_BONUS_PER_HERO);

  const newMission: ActiveMission = {
    id: missionId,
    templateId: template.id,
    heroIds: heroIds,
    startedAt: Date.now(),
    healerBuffMultiplier,
    rogueRngBonus,
  };

  try {
    const outcome = computeBattleOutcome(template, heroesForMission, {
      healerBuffMultiplier,
      rogueRngBonus,
    });
    
    const missionEnemies: Required<ActiveMission>['enemiesState'] = [];
    if (template.enemies && template.enemies.length > 0) {
      template.enemies.forEach((edef, gi) => {
        const cnt = edef.count ?? 1;
        for (let i = 0; i < cnt; i++) {
          missionEnemies.push({
            id: `enemy_${gi}_${i}`,
            hp: edef.hp,
            maxHp: edef.hp,
            atk: edef.atk,
            mp: edef.mp,
            alive: true,
            attackType: Math.random() < 0.5 ? 'MELEE' : 'RANGED',
          });
        }
      });
    } else {
      const enemyCount = template.minHeroes;
      for (let i = 0; i < enemyCount; i++) {
        missionEnemies.push({
          id: `orc_${i}`,
          hp: 5,
          maxHp: 5,
          atk: 2,
          mp: 1,
          alive: true,
          attackType: i % 2 === 0 ? 'MELEE' : 'RANGED',
        });
      }
    }

    const scheduled = (outcome.actions || []).map((a: any, i: number) => ({
      atMsFromStart: MISSION_START_DELAY_MS + i * MISSION_ACTION_INTERVAL_MS,
      action: a,
      applied: false,
    }));

    newMission.scheduledActions = scheduled;
    newMission.enemiesState = missionEnemies;
    newMission.precomputedOutcome = outcome;
  } catch (err) {
    newMission.scheduledActions = [];
  }

  const newHeroesState = state.heroes.map((h) =>
    heroIds.includes(h.id)
      ? {
          ...h,
          currentTask: HeroTask.MISSION,
          trainingProgressMs: undefined,
          trainingCount: undefined,
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

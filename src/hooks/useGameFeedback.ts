import { useEffect, useRef } from 'react';
import { GameState } from '../types';
import { emit, FEEDBACK_EVENTS } from '../services/feedback';
import { 
  BATTLE_HIGHLIGHT_DURATION_MS, 
  FEEDBACK_GOLD_COLOR, 
  FEEDBACK_HP_GAIN_COLOR, 
  FEEDBACK_HP_LOSS_COLOR, 
  FEEDBACK_ATK_GAIN_COLOR, 
  FEEDBACK_MP_GAIN_COLOR 
} from '../constants/game';

export function useGameFeedback(state: GameState) {
  const prevStateRef = useRef<GameState | null>(null);

  useEffect(() => {
    const prev = prevStateRef.current;
    if (prev) {
      // 1. Gold delta
      if ((state.gold || 0) > (prev.gold || 0)) {
        const delta = Math.floor((state.gold || 0) - (prev.gold || 0));
        if (delta > 0) {
          emit(FEEDBACK_EVENTS.FLOAT, { text: `+${delta}💰`, color: FEEDBACK_GOLD_COLOR });
        }
      }

      // 2. New heroes recruited
      if ((state.heroes?.length || 0) > (prev.heroes?.length || 0)) {
        const newCount = (state.heroes?.length || 0) - (prev.heroes?.length || 0);
        emit(FEEDBACK_EVENTS.TOAST, { text: `Recrutado +${newCount} herói(s)` });
      }

      // 3. Per-hero stat increases & damage
      state.heroes.forEach((h) => {
        const prevHero = prev.heroes.find((ph) => ph.id === h.id);
        if (!prevHero) return;

        // SKIP FEEDBACK FOR "Jareth #48" or specific ID if debugging
        // if (h.id === 'debug_id') return;

        // Check hpMax increase
        if (h.hpMax > prevHero.hpMax) {
          emit(FEEDBACK_EVENTS.FLOAT, { text: `+${Math.floor(h.hpMax - prevHero.hpMax)} HP Máx`, color: FEEDBACK_HP_GAIN_COLOR });
        }

        // Check hpCurrent decrease (damage)
        if (h.hpCurrent < prevHero.hpCurrent) {
          const lost = prevHero.hpCurrent - h.hpCurrent;
          emit(FEEDBACK_EVENTS.FLOAT, { text: `-${Math.floor(lost)} HP`, color: FEEDBACK_HP_LOSS_COLOR });
          emit(FEEDBACK_EVENTS.BATTLE_HIGHLIGHT, { id: h.id, duration: BATTLE_HIGHLIGHT_DURATION_MS });
          emit(FEEDBACK_EVENTS.BATTLE_HIT, { id: h.id, amount: lost });
          emit(FEEDBACK_EVENTS.BATTLE_TARGET, { id: h.id, duration: BATTLE_HIGHLIGHT_DURATION_MS });
          if (h.hpCurrent <= 0) {
            emit(FEEDBACK_EVENTS.BATTLE_DEATH, { id: h.id });
          }
        }

        // Check atk increase
        if (h.atk > prevHero.atk) {
          emit(FEEDBACK_EVENTS.FLOAT, { text: `+${Math.floor(h.atk - prevHero.atk)} ATK`, color: FEEDBACK_ATK_GAIN_COLOR });
        }

        // Check mp increase
        if (h.mp > prevHero.mp) {
          emit(FEEDBACK_EVENTS.FLOAT, { text: `+${Math.floor(h.mp - prevHero.mp)} MP`, color: FEEDBACK_MP_GAIN_COLOR });
        }
      });

      // 4. Enemy damage/death in missions
      const prevMissions = (prev.activeMissions || []) as any[];
      const curMissions = (state.activeMissions || []) as any[];
      const prevById = new Map(prevMissions.map((m) => [m.id, m]));

      curMissions.forEach((cm) => {
        const pm = prevById.get(cm.id);
        if (!pm || !pm.enemiesState || !cm.enemiesState) return;

        const prevEnemies = pm.enemiesState as any[];
        const curEnemies = cm.enemiesState as any[];
        const prevByE = new Map(prevEnemies.map((e) => [e.id, e]));

        curEnemies.forEach((ce) => {
          const pe = prevByE.get(ce.id);
          if (!pe) return;

          const prevHp = pe.hp ?? 0;
          const curHp = ce.hp ?? 0;

          if (curHp < prevHp) {
            const dmg = prevHp - curHp;
            emit(FEEDBACK_EVENTS.BATTLE_HIT, { id: ce.id, amount: dmg });
            emit(FEEDBACK_EVENTS.BATTLE_TARGET, { id: ce.id, duration: BATTLE_HIGHLIGHT_DURATION_MS });
          }

          if ((pe.alive ?? true) && !(ce.alive ?? (ce.hp ?? 0) > 0)) {
            emit(FEEDBACK_EVENTS.BATTLE_DEATH, { id: ce.id });
          }
        });
      });
    }
    prevStateRef.current = state;
  }, [state]);
}

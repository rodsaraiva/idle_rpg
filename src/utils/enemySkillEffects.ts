import { Hero } from '../types';
import { BattleState, BattleEnemy, Buff } from './battleEngine';
import { EnemySkillDef } from '../constants/enemySkills';
import { GameMath } from './gameMath';
import { getShieldReduction, onHeroDamagedSkills } from './skillEffects';

// ─── Internal helpers ───

function isReady(enemy: BattleEnemy, skill: EnemySkillDef, state: BattleState): boolean {
  const key = `${enemy.id}_${skill.id}`;
  if (skill.cooldownRounds === -1) {
    return !(enemy.skillOnceUsed?.[key]);
  }
  if (skill.cooldownRounds === 0) return true;
  return (enemy.skillCooldowns?.[key] ?? 0) <= state.rounds;
}

function markUsed(enemy: BattleEnemy, skill: EnemySkillDef, state: BattleState): void {
  const key = `${enemy.id}_${skill.id}`;
  if (skill.cooldownRounds === -1) {
    if (!enemy.skillOnceUsed) enemy.skillOnceUsed = {};
    enemy.skillOnceUsed[key] = true;
  } else if (skill.cooldownRounds > 0) {
    if (!enemy.skillCooldowns) enemy.skillCooldowns = {};
    enemy.skillCooldowns[key] = state.rounds + skill.cooldownRounds;
  }
}

function addBuff(state: BattleState, actorId: string, buff: Buff): void {
  if (!state.buffs[actorId]) state.buffs[actorId] = [];
  const existing = state.buffs[actorId].findIndex(
    b => b.source === buff.source && b.type === buff.type,
  );
  if (existing >= 0) {
    state.buffs[actorId][existing] = buff;
  } else {
    state.buffs[actorId].push(buff);
  }
}

function logEnemySkill(state: BattleState, enemy: BattleEnemy, skillName: string, text: string): void {
  const msg = `⚡ ${enemy.id} — ${skillName}: ${text}`;
  state.log.push(msg);
  state.actions.push({
    round: state.rounds,
    actorType: 'enemy',
    actorId: enemy.id,
    actorName: enemy.id,
    actionType: 'hit',
    text: msg,
  });
}

// ─── Skill implementations ───

function tryCharge(enemy: BattleEnemy, state: BattleState): void {
  const skill = { id: 'CHARGE', cooldownRounds: -1 } as EnemySkillDef;
  if (state.rounds !== 1) return;
  if (!isReady(enemy, skill, state)) return;
  markUsed(enemy, skill, state);
  addBuff(state, enemy.id, {
    source: 'ENEMY_CHARGE',
    type: 'atkMul',
    value: 1.30,
    expiresAfterRound: state.rounds,
  });
  logEnemySkill(state, enemy, 'Investida', '+30% ATK este round');
}

function tryCarapace(enemy: BattleEnemy, state: BattleState): void {
  if (enemy.hp / enemy.maxHp <= 0.5) return;
  // Skip if already active
  const existing = state.buffs[enemy.id]?.find(
    b => b.source === 'ENEMY_CARAPACE' && b.type === 'defMul' && b.expiresAfterRound >= state.rounds,
  );
  if (existing) return;
  addBuff(state, enemy.id, {
    source: 'ENEMY_CARAPACE',
    type: 'defMul',
    value: 1.20,
    expiresAfterRound: state.rounds,
  });
  logEnemySkill(state, enemy, 'Couraça', '+20% DEF este round');
}

function tryIntimidate(enemy: BattleEnemy, state: BattleState): void {
  const skill = { id: 'INTIMIDATE', cooldownRounds: -1 } as EnemySkillDef;
  if (state.rounds !== 1) return;
  if (!isReady(enemy, skill, state)) return;
  markUsed(enemy, skill, state);

  const enemyPos = state.enemyPositions[enemy.id];
  for (const hero of state.heroes) {
    if (hero.hpCurrent <= 0) continue;
    const heroPos = state.heroPositions[hero.id];
    if (heroPos === undefined) continue;
    const dist = GameMath.getHexDistance(enemyPos, heroPos);
    if (dist <= 2) {
      addBuff(state, hero.id, {
        source: 'ENEMY_INTIMIDATE',
        type: 'atkMul',
        value: 0.90,
        expiresAfterRound: state.rounds + 1,
      });
    }
  }
  logEnemySkill(state, enemy, 'Grito Intimidante', 'heróis próximos -10% ATK por 2 rounds');
}

function tryPoison(enemy: BattleEnemy, target: Hero, state: BattleState, rng: number): void {
  if (rng >= 0.2) return;
  const dotValue = Math.max(1, Math.floor(enemy.atk * 0.05));
  addBuff(state, target.id, {
    source: 'ENEMY_POISON',
    type: 'dot',
    value: dotValue,
    expiresAfterRound: state.rounds + 1,
  });
  logEnemySkill(state, enemy, 'Veneno', `${dotValue} de veneno por round em ${target.id}`);
}

function tryAoeAttack(enemy: BattleEnemy, state: BattleState): boolean {
  const skill = { id: 'AOE_ATTACK', cooldownRounds: 4 } as EnemySkillDef;
  if (!isReady(enemy, skill, state)) return false;
  markUsed(enemy, skill, state);

  const enemyPos = state.enemyPositions[enemy.id];
  // Find alive heroes sorted by hex distance
  const heroesWithDist = state.heroes
    .filter(h => h.hpCurrent > 0 && state.heroPositions[h.id] !== undefined)
    .map(h => ({ hero: h, dist: GameMath.getHexDistance(enemyPos, state.heroPositions[h.id]) }))
    .sort((a, b) => a.dist - b.dist);

  const targets = heroesWithDist.slice(0, 2).map(x => x.hero);
  const dmg = Math.max(1, Math.floor(enemy.atk * 0.5));

  for (const target of targets) {
    const shield = getShieldReduction(state, target.id);
    const actualDmg = shield > 0
      ? Math.max(1, Math.floor(dmg * (1 - shield)))
      : dmg;
    target.hpCurrent = Math.max(0, target.hpCurrent - actualDmg);
    logEnemySkill(state, enemy, 'Ataque em Área', `${actualDmg} de dano em ${target.id}${shield > 0 ? ` (Escudo: -${Math.round(shield * 100)}%)` : ''}`);
    state.handlers.onHeroDamaged(state, target, target.hpCurrent);
    onHeroDamagedSkills(target, state);
    if (target.hpCurrent <= 0) {
      delete state.heroPositions[target.id];
    }
  }
  return true;
}

function tryMagicShield(enemy: BattleEnemy, state: BattleState): void {
  const skill = { id: 'MAGIC_SHIELD', cooldownRounds: 4 } as EnemySkillDef;
  if (!isReady(enemy, skill, state)) return;
  markUsed(enemy, skill, state);
  addBuff(state, enemy.id, {
    source: 'ENEMY_MAGIC_SHIELD',
    type: 'shield',
    value: 0.30,
    expiresAfterRound: state.rounds,
  });
  logEnemySkill(state, enemy, 'Escudo Mágico', '30% de absorção deste round');
}

function tryBossFury(enemy: BattleEnemy, state: BattleState): void {
  const skill = { id: 'BOSS_FURY', cooldownRounds: -1 } as EnemySkillDef;
  if (enemy.hp / enemy.maxHp >= 0.25) return;
  if (!isReady(enemy, skill, state)) return;
  markUsed(enemy, skill, state);
  addBuff(state, enemy.id, {
    source: 'ENEMY_BOSS_FURY',
    type: 'atkMul',
    value: 1.50,
    expiresAfterRound: -1,
  });
  logEnemySkill(state, enemy, 'Fúria do Boss', '+50% ATK permanente');
}

// ─── Exported functions ───

/**
 * Process regen for all alive enemies that have the REGEN skill.
 */
export function processEnemyRegenBuffs(state: BattleState): void {
  for (const enemy of state.enemies) {
    if (!enemy.alive || !enemy.skills) continue;
    const regenSkill = enemy.skills.find(s => s.id === 'REGEN');
    if (!regenSkill) continue;
    if (!isReady(enemy, regenSkill, state)) continue;
    markUsed(enemy, regenSkill, state);
    const heal = Math.max(1, Math.floor(enemy.maxHp * 0.1));
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal);
    logEnemySkill(state, enemy, 'Regeneração', `+${heal} HP`);
  }
}

/**
 * Apply passive skills each round (called before combat).
 */
export function applyEnemyPassiveSkills(enemy: BattleEnemy, state: BattleState): void {
  if (!enemy.skills) return;
  if (enemy.skills.some(s => s.id === 'CARAPACE')) tryCarapace(enemy, state);
  if (enemy.skills.some(s => s.id === 'BOSS_FURY')) tryBossFury(enemy, state);
}

/**
 * Execute pre-attack skills. Returns true if the turn is consumed.
 */
export function executeEnemyPreAttackSkills(
  enemy: BattleEnemy,
  target: Hero,
  state: BattleState,
  rng: number,
): boolean {
  if (!enemy.skills) return false;
  if (enemy.skills.some(s => s.id === 'CHARGE')) tryCharge(enemy, state);
  if (enemy.skills.some(s => s.id === 'INTIMIDATE')) tryIntimidate(enemy, state);
  if (enemy.skills.some(s => s.id === 'AOE_ATTACK')) {
    if (tryAoeAttack(enemy, state)) return true;
  }
  return false;
}

/**
 * Called after enemy hits a hero — applies on-hit effects.
 */
export function onEnemyHitSkills(
  enemy: BattleEnemy,
  target: Hero,
  state: BattleState,
  rng: number,
): void {
  if (!enemy.skills) return;
  if (enemy.skills.some(s => s.id === 'POISON')) tryPoison(enemy, target, state, rng);
}

/**
 * Called after enemy takes damage — applies reactive skills.
 */
export function onEnemyDamagedSkills(enemy: BattleEnemy, state: BattleState): void {
  if (!enemy.skills) return;
  if (enemy.skills.some(s => s.id === 'MAGIC_SHIELD')) tryMagicShield(enemy, state);
}

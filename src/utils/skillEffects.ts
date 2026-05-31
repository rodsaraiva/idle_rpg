import { Hero, MissionAction } from '../types';
import { BattleState, BattleEnemy, Buff } from './battleEngine';
import { getUnlockedSkills, SkillDef } from '../constants/skills';
import { GameMath } from './gameMath';
import { onEnemyDamagedSkills } from './enemySkillEffects';

/** Check if a skill is off cooldown and available */
function isSkillReady(state: BattleState, heroId: string, skill: SkillDef): boolean {
  const key = `${heroId}_${skill.id}`;

  // Once-per-battle skills
  if (skill.cooldownRounds === -1) {
    return !state.skillOnceUsed[key];
  }

  // No fixed cooldown (conditional triggers)
  if (skill.cooldownRounds === 0) return true;

  // Cooldown-based
  const readyAt = state.skillCooldowns[key] ?? 0;
  return state.rounds >= readyAt;
}

/** Mark a skill as used (sets cooldown or once-used flag) */
function markSkillUsed(state: BattleState, heroId: string, skill: SkillDef): void {
  const key = `${heroId}_${skill.id}`;
  if (skill.cooldownRounds === -1) {
    state.skillOnceUsed[key] = true;
  } else if (skill.cooldownRounds > 0) {
    state.skillCooldowns[key] = state.rounds + skill.cooldownRounds;
  }
}

/** Add a buff to an actor */
function addBuff(state: BattleState, actorId: string, buff: Buff): void {
  if (!state.buffs[actorId]) state.buffs[actorId] = [];
  const existing = state.buffs[actorId].findIndex(b => b.source === buff.source && b.type === buff.type);
  if (existing >= 0) {
    state.buffs[actorId][existing] = buff;
  } else {
    state.buffs[actorId].push(buff);
  }
}

/** Push a skill action to the battle log */
function logSkill(state: BattleState, hero: Hero, skillName: string, text: string): void {
  state.actions.push({
    round: state.rounds,
    actorType: 'hero',
    actorId: hero.id,
    actorName: hero.name,
    actionType: 'hit',
    text: `✦ ${hero.name} — ${skillName}: ${text}`,
  });
  state.log.push(`✦ ${hero.name} — ${skillName}: ${text}`);
}

function markDefeat(state: BattleState, hero: Hero, target: BattleEnemy): void {
  target.alive = false;
  delete state.enemyPositions[target.id];
  state.actions.push({
    round: state.rounds, actorType: 'hero', actorId: hero.id,
    actorName: hero.name, actionType: 'defeat', targetId: target.id,
    text: `${target.id} foi derrotado!`,
  });
}

/**
 * Aplica um hit de AoE: reduz escudo, subtrai dano, dispara reação do inimigo.
 * Espelha o padrão do ataque normal (battleEngine.ts:598-604).
 * Recebe onDamaged como parâmetro para evitar dependência circular com enemySkillEffects.ts.
 */
function applyAoEHit(
  state: BattleState,
  hero: Hero,
  enemy: BattleEnemy,
  rawDmg: number,
  onDamaged: (enemy: BattleEnemy, state: BattleState) => void,
): void {
  const shield = getShieldReduction(state, enemy.id);
  const actualDmg = shield > 0
    ? Math.max(1, Math.floor(rawDmg * (1 - shield)))
    : rawDmg;
  enemy.hp = Math.max(0, enemy.hp - actualDmg);
  onDamaged(enemy, state);
  if (enemy.hp <= 0) markDefeat(state, hero, enemy);
}

// ─── Skill implementations ───

function tryGolpePesado(hero: Hero, target: BattleEnemy, state: BattleState): boolean {
  const skill = { id: 'WARRIOR_GOLPE_PESADO', cooldownRounds: 3 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  const effectiveDef = (target.defense ?? 0) * 0.7;
  const dmg = Math.max(1, Math.floor(hero.atk * 1.5 - effectiveDef));
  target.hp = Math.max(0, target.hp - dmg);
  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Golpe Pesado', `${dmg} de dano (ignora 30% DEF)`);
  if (target.hp <= 0) markDefeat(state, hero, target);
  return true;
}

function tryGritoDeGuerra(hero: Hero, state: BattleState): boolean {
  const injured = state.heroes.find(h => h.id !== hero.id && h.hpCurrent > 0 && h.hpCurrent / h.hpMax < 0.4);
  if (!injured) return false;

  const existing = state.buffs[hero.id]?.find(b => b.source === 'WARRIOR_GRITO_DE_GUERRA' && b.type === 'atkMul');
  if (existing && existing.expiresAfterRound >= state.rounds) return false;

  const heroPos = state.heroPositions[hero.id] ?? 0;
  for (const ally of state.heroes.filter(h => h.hpCurrent > 0)) {
    const allyPos = state.heroPositions[ally.id] ?? 0;
    if (GameMath.getHexDistance(heroPos, allyPos) <= 2) {
      addBuff(state, ally.id, {
        source: 'WARRIOR_GRITO_DE_GUERRA', type: 'atkMul',
        value: 1.20, expiresAfterRound: state.rounds + 2,
      });
    }
  }
  logSkill(state, hero, 'Grito de Guerra', 'aliados próximos +20% ATK');
  return false;
}

function tryFuria(hero: Hero, state: BattleState): boolean {
  if (hero.hpCurrent / hero.hpMax >= 0.3) return false;
  const skill = { id: 'WARRIOR_FURIA', cooldownRounds: -1 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  addBuff(state, hero.id, { source: 'WARRIOR_FURIA', type: 'atkMul', value: 1.50, expiresAfterRound: -1 });
  addBuff(state, hero.id, { source: 'WARRIOR_FURIA', type: 'defMul', value: 0.80, expiresAfterRound: -1 });
  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Fúria', '+50% ATK, -20% DEF permanente');
  return false;
}

function tryProvocar(hero: Hero, state: BattleState): boolean {
  if (state.rounds !== 1) return false;
  const skill = { id: 'TANK_PROVOCAR', cooldownRounds: -1 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  addBuff(state, hero.id, { source: 'TANK_PROVOCAR', type: 'taunt', value: 80, expiresAfterRound: state.rounds + 3 });
  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Provocar', 'taunt +80 por 3 rounds');
  return false;
}

function tryMuralha(hero: Hero, state: BattleState): boolean {
  const heroPos = state.heroPositions[hero.id] ?? 0;
  const adjacentAllies = state.heroes.filter(h =>
    h.id !== hero.id && h.hpCurrent > 0 &&
    GameMath.getHexDistance(heroPos, state.heroPositions[h.id] ?? 99) <= 1
  );
  if (adjacentAllies.length < 2) return false;

  const existing = state.buffs[hero.id]?.find(b => b.source === 'TANK_MURALHA' && b.type === 'shield');
  if (existing && existing.expiresAfterRound >= state.rounds) return false;

  addBuff(state, hero.id, { source: 'TANK_MURALHA', type: 'shield', value: 0.25, expiresAfterRound: state.rounds + 2 });
  logSkill(state, hero, 'Muralha', '-25% dano recebido por 2 rounds');
  return false;
}

function tryUltimoSuspiro(hero: Hero, state: BattleState): void {
  for (const ally of state.heroes.filter(h => h.id !== hero.id && h.hpCurrent > 0)) {
    addBuff(state, ally.id, { source: 'TANK_ULTIMO_SUSPIRO', type: 'defMul', value: 1.30, expiresAfterRound: state.rounds + 2 });
  }
  logSkill(state, hero, 'Último Suspiro', 'aliados +30% DEF por 2 rounds');
}

function tryGolpeFurtivo(hero: Hero, target: BattleEnemy, state: BattleState): boolean {
  if (state.rounds !== 1) return false;
  const skill = { id: 'ROGUE_GOLPE_FURTIVO', cooldownRounds: -1 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  const dmg = Math.max(1, Math.floor(hero.atk * 2.0));
  target.hp = Math.max(0, target.hp - dmg);
  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Golpe Furtivo', `${dmg} de dano (crítico garantido)`);
  if (target.hp <= 0) markDefeat(state, hero, target);
  return true;
}

function tryVeneno(target: BattleEnemy, state: BattleState, hero: Hero, rng: () => number): void {
  if (rng() >= 0.3) return;
  addBuff(state, target.id, {
    source: 'ROGUE_VENENO', type: 'dot',
    value: Math.max(1, Math.floor(hero.atk * 0.3)),
    expiresAfterRound: state.rounds + 2,
  });
  logSkill(state, hero, 'Veneno', `aplicou veneno em ${target.id}`);
}

function tryExecucao(hero: Hero, target: BattleEnemy, state: BattleState): boolean {
  const targetHpPct = target.hp / target.maxHp;
  if (targetHpPct >= 0.2) return false;

  const dmg = Math.max(1, Math.floor(hero.atk * 2.5));
  target.hp = Math.max(0, target.hp - dmg);
  logSkill(state, hero, 'Execução', `${dmg} de dano (ignora defesa)`);
  if (target.hp <= 0) markDefeat(state, hero, target);
  return true;
}

function tryTiroCerteiro(hero: Hero, target: BattleEnemy, state: BattleState, rng: () => number): boolean {
  const skill = { id: 'ARCHER_TIRO_CERTEIRO', cooldownRounds: 3 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  const critChance = GameMath.calcCritChance(hero.classId, hero.crit) + 0.30;
  const isCrit = rng() < critChance;
  const dmg = GameMath.calcDamage(hero.atk, target.defense, isCrit);
  target.hp = Math.max(0, target.hp - dmg);
  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Tiro Certeiro', `${dmg} de dano${isCrit ? ' (CRIT)' : ''}`);
  if (target.hp <= 0) markDefeat(state, hero, target);
  return true;
}

function tryChuvaFlechas(
  hero: Hero,
  state: BattleState,
  onDamaged: (enemy: BattleEnemy, state: BattleState) => void,
): boolean {
  const skill = { id: 'ARCHER_CHUVA_DE_FLECHAS', cooldownRounds: 5 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  const aliveEnemies = state.enemies.filter(e => e.alive);
  const center = aliveEnemies[0];
  if (!center) return false;
  const centerPos = state.enemyPositions[center.id] ?? 0;

  let hitCount = 0;
  for (const enemy of aliveEnemies) {
    const ePos = state.enemyPositions[enemy.id] ?? 0;
    if (GameMath.getHexDistance(centerPos, ePos) <= 2) {
      const dmg = Math.max(1, Math.floor(hero.atk * 0.5));
      applyAoEHit(state, hero, enemy, dmg, onDamaged);
      hitCount++;
    }
  }
  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Chuva de Flechas', `atingiu ${hitCount} inimigos`);
  return true;
}

function tryTiroPerfurante(hero: Hero, target: BattleEnemy, state: BattleState): boolean {
  if ((target.defense ?? 0) <= 20) return false;

  const effectiveDef = (target.defense ?? 0) * 0.4;
  const dmg = GameMath.calcDamage(hero.atk, effectiveDef, false);
  target.hp = Math.max(0, target.hp - dmg);
  logSkill(state, hero, 'Tiro Perfurante', `${dmg} de dano (ignora 60% DEF)`);
  if (target.hp <= 0) markDefeat(state, hero, target);
  return true;
}

function tryBolaDeFogo(
  hero: Hero,
  target: BattleEnemy,
  state: BattleState,
  onDamaged: (enemy: BattleEnemy, state: BattleState) => void,
): boolean {
  const skill = { id: 'MAGE_BOLA_DE_FOGO', cooldownRounds: 3 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  const mainDmg = Math.max(1, Math.floor(hero.atk * 0.8));
  applyAoEHit(state, hero, target, mainDmg, onDamaged);

  const targetPos = state.enemyPositions[target.id] ?? 0;
  let splashCount = 0;
  for (const enemy of state.enemies.filter(e => e.alive && e.id !== target.id)) {
    const ePos = state.enemyPositions[enemy.id] ?? 0;
    if (GameMath.getHexDistance(targetPos, ePos) <= 1) {
      const splashDmg = Math.max(1, Math.floor(hero.atk * 0.4));
      applyAoEHit(state, hero, enemy, splashDmg, onDamaged);
      splashCount++;
    }
  }

  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Bola de Fogo', `${mainDmg} no alvo + ${splashCount} adjacentes`);
  return true;
}

function tryEscudoArcano(hero: Hero, state: BattleState): void {
  const skill = { id: 'MAGE_ESCUDO_ARCANO', cooldownRounds: 4 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return;

  addBuff(state, hero.id, { source: 'MAGE_ESCUDO_ARCANO', type: 'shield', value: 0.50, expiresAfterRound: state.rounds + 1 });
  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Escudo Arcano', '-50% dano no próximo hit');
}

function tryMeteoro(
  hero: Hero,
  state: BattleState,
  onDamaged: (enemy: BattleEnemy, state: BattleState) => void,
): boolean {
  const aliveEnemies = state.enemies.filter(e => e.alive);
  if (aliveEnemies.length < 3) return false;

  const skill = { id: 'MAGE_METEORO', cooldownRounds: -1 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  const centerEnemy = aliveEnemies[Math.floor(aliveEnemies.length / 2)];
  const centerPos = state.enemyPositions[centerEnemy.id] ?? 0;
  let hitCount = 0;

  for (const enemy of aliveEnemies) {
    const ePos = state.enemyPositions[enemy.id] ?? 0;
    if (GameMath.getHexDistance(centerPos, ePos) <= 3) {
      const dmg = Math.max(1, Math.floor(hero.atk * 1.0));
      applyAoEHit(state, hero, enemy, dmg, onDamaged);
      hitCount++;
    }
  }
  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Meteoro', `atingiu ${hitCount} inimigos`);
  return true;
}

function tryCuraMaior(hero: Hero, state: BattleState): boolean {
  const injured = state.heroes
    .filter(h => h.id !== hero.id && h.hpCurrent > 0 && h.hpCurrent / h.hpMax < 0.4)
    .sort((a, b) => a.hpCurrent / a.hpMax - b.hpCurrent / b.hpMax)[0];
  if (!injured) return false;

  const healAmount = Math.floor(injured.hpMax * 0.5);
  const prevHp = injured.hpCurrent;
  injured.hpCurrent = Math.min(injured.hpMax, injured.hpCurrent + healAmount);
  const actual = injured.hpCurrent - prevHp;

  state.actions.push({
    round: state.rounds, actorType: 'hero', actorId: hero.id,
    actorName: hero.name, actionType: 'heal', targetId: injured.id,
    amount: actual, text: `✦ ${hero.name} — Cura Maior: ${actual} HP em ${injured.name}`,
  });
  state.log.push(`✦ ${hero.name} — Cura Maior: ${actual} HP em ${injured.name}`);
  if (actual > 0) {
    state.handlers.onHealApplied(state, hero, injured, actual);
  }
  return true;
}

function tryPurificacao(hero: Hero, state: BattleState): boolean {
  const allyWithDebuff = state.heroes.find(h =>
    h.id !== hero.id && h.hpCurrent > 0 &&
    state.buffs[h.id]?.some(b => b.type === 'dot' || b.type === 'defDebuffMul' || (b.type === 'defMul' && b.value < 1))
  );
  if (!allyWithDebuff) return false;

  state.buffs[allyWithDebuff.id] = (state.buffs[allyWithDebuff.id] ?? []).filter(
    b => b.type !== 'dot' && b.type !== 'defDebuffMul' && !(b.type === 'defMul' && b.value < 1)
  );

  const healAmount = Math.floor(allyWithDebuff.hpMax * 0.2);
  const prevHp = allyWithDebuff.hpCurrent;
  allyWithDebuff.hpCurrent = Math.min(allyWithDebuff.hpMax, allyWithDebuff.hpCurrent + healAmount);
  const actualHeal = allyWithDebuff.hpCurrent - prevHp;

  logSkill(state, hero, 'Purificação', `limpou debuffs de ${allyWithDebuff.name} e curou ${actualHeal} HP`);
  if (actualHeal > 0) {
    state.handlers.onHealApplied(state, hero, allyWithDebuff, actualHeal);
  }
  return true;
}

function tryRessurreicao(hero: Hero, state: BattleState): boolean {
  const deadAlly = state.heroes.find(h => h.id !== hero.id && h.hpCurrent <= 0);
  if (!deadAlly) return false;

  const skill = { id: 'HEALER_RESSURREICAO', cooldownRounds: -1 } as SkillDef;
  if (!isSkillReady(state, hero.id, skill)) return false;

  deadAlly.hpCurrent = Math.max(1, Math.floor(deadAlly.hpMax * 0.3));
  const heroPos = state.heroPositions[hero.id] ?? 45;
  state.heroPositions[deadAlly.id] = heroPos;

  markSkillUsed(state, hero.id, skill);
  logSkill(state, hero, 'Ressurreição', `reviveu ${deadAlly.name} com ${deadAlly.hpCurrent} HP`);
  return true;
}

// ─── Public API ───

/**
 * Execute pre-attack skills for a hero (called before normal attack in processHeroTurn).
 * Returns true if the skill consumed the hero's turn.
 */
export function executePreAttackSkills(
  hero: Hero,
  target: BattleEnemy | undefined,
  state: BattleState,
  rng: () => number
): boolean {
  const skills = getUnlockedSkills(hero);
  if (skills.length === 0) return false;
  const skillIds = new Set(skills.map(s => s.id));

  // Healer skills (priority: Ressurreição > Purificação > Cura Maior)
  if (hero.classId === 'HEALER') {
    if (skillIds.has('HEALER_RESSURREICAO') && tryRessurreicao(hero, state)) return true;
    if (skillIds.has('HEALER_PURIFICACAO') && tryPurificacao(hero, state)) return true;
    if (skillIds.has('HEALER_CURA_MAIOR') && tryCuraMaior(hero, state)) return true;
  }

  if (!target) return false;

  // Warrior passive skills (don't consume turn)
  if (hero.classId === 'WARRIOR') {
    if (skillIds.has('WARRIOR_FURIA')) tryFuria(hero, state);
    if (skillIds.has('WARRIOR_GRITO_DE_GUERRA')) tryGritoDeGuerra(hero, state);
    if (skillIds.has('WARRIOR_GOLPE_PESADO') && tryGolpePesado(hero, target, state)) return true;
  }

  // Tank passive skills
  if (hero.classId === 'TANK') {
    if (skillIds.has('TANK_PROVOCAR')) tryProvocar(hero, state);
    if (skillIds.has('TANK_MURALHA')) tryMuralha(hero, state);
  }

  // Rogue skills
  if (hero.classId === 'ROGUE') {
    if (skillIds.has('ROGUE_GOLPE_FURTIVO') && tryGolpeFurtivo(hero, target, state)) return true;
    if (skillIds.has('ROGUE_EXECUCAO') && tryExecucao(hero, target, state)) return true;
  }

  // Archer skills
  if (hero.classId === 'ARCHER') {
    if (skillIds.has('ARCHER_TIRO_CERTEIRO') && tryTiroCerteiro(hero, target, state, rng)) return true;
    if (skillIds.has('ARCHER_CHUVA_DE_FLECHAS') && tryChuvaFlechas(hero, state, onEnemyDamagedSkills)) return true;
    if (skillIds.has('ARCHER_TIRO_PERFURANTE') && tryTiroPerfurante(hero, target, state)) return true;
  }

  // Mage skills
  if (hero.classId === 'MAGE') {
    if (skillIds.has('MAGE_METEORO') && tryMeteoro(hero, state, onEnemyDamagedSkills)) return true;
    if (skillIds.has('MAGE_BOLA_DE_FOGO') && tryBolaDeFogo(hero, target, state, onEnemyDamagedSkills)) return true;
  }

  return false;
}

/** Called after a hero takes damage. Triggers reactive skills. */
export function onHeroDamagedSkills(hero: Hero, state: BattleState): void {
  const skills = getUnlockedSkills(hero);
  if (skills.length === 0) return;
  const skillIds = new Set(skills.map(s => s.id));

  if (hero.classId === 'MAGE' && skillIds.has('MAGE_ESCUDO_ARCANO')) {
    tryEscudoArcano(hero, state);
  }
}

/** Called when a hero dies. Triggers death skills. */
export function onHeroDeathSkills(hero: Hero, state: BattleState): void {
  const skills = getUnlockedSkills(hero);
  if (skills.length === 0) return;
  const skillIds = new Set(skills.map(s => s.id));

  if (hero.classId === 'TANK' && skillIds.has('TANK_ULTIMO_SUSPIRO')) {
    tryUltimoSuspiro(hero, state);
  }
}

/** Called after a successful hit by a Rogue. Triggers post-hit skills. */
export function onRogueHitSkills(hero: Hero, target: BattleEnemy, state: BattleState, rng: () => number): void {
  const skills = getUnlockedSkills(hero);
  if (skills.length === 0) return;
  const skillIds = new Set(skills.map(s => s.id));

  if (skillIds.has('ROGUE_VENENO')) {
    tryVeneno(target, state, hero, rng);
  }
}

/** Process DoT (damage over time) buffs at the start of each round. */
export function processDoTBuffs(state: BattleState): void {
  for (const enemy of state.enemies.filter(e => e.alive)) {
    const dots = state.buffs[enemy.id]?.filter(b => b.type === 'dot' && b.expiresAfterRound >= state.rounds) ?? [];
    for (const dot of dots) {
      enemy.hp = Math.max(0, enemy.hp - dot.value);
      state.log.push(`${enemy.id} sofreu ${dot.value} de veneno`);
      state.actions.push({
        round: state.rounds, actorType: 'enemy', actorId: enemy.id,
        actionType: 'hit', text: `${enemy.id} sofreu ${dot.value} de veneno`,
        amount: dot.value,
      });
      if (enemy.hp <= 0) {
        enemy.alive = false;
        delete state.enemyPositions[enemy.id];
      }
    }
  }
}

/** Get effective defense considering shield buffs. Consumes the shield. */
export function getShieldReduction(state: BattleState, targetId: string): number {
  const shields = state.buffs[targetId]?.filter(b => b.type === 'shield' && b.expiresAfterRound >= state.rounds) ?? [];
  if (shields.length === 0) return 0;
  const best = shields.reduce((max, b) => b.value > max.value ? b : max);
  state.buffs[targetId] = state.buffs[targetId].filter(b => b !== best);
  return best.value;
}

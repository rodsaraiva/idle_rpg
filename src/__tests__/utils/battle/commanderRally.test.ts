import { BattleEngine, BattleState } from '../../../utils/battleEngine';
import { HeroTask, Hero } from '../../../types';

describe('COMMANDER_RALLY', () => {
  const makeState = (): BattleState => ({
    heroes: [],
    enemies: [],
    heroPositions: {},
    enemyPositions: {},
    lastAttacker: {},
    threats: {},
    log: [],
    actions: [],
    rounds: 1,
    activeSynergies: [],
    buffs: {},
    flags: {},
    handlers: {
      onBattleStart: () => {},
      onHealApplied: () => {},
      onHeroDamaged: () => {},
      onAttackResolved: () => {},
      shouldIgnoreDefense: () => false,
      modifyTargetScore: (_s: any, _e: any, _c: any, score: number) => score,
    } as any,
    skillCooldowns: {},
    skillOnceUsed: {},
    rng: () => 0.5,
  });

  const makeCommander = (atk = 20): Hero => ({
    id: 'commander1',
    name: 'Comandante',
    hpMax: 50,
    hpCurrent: 50,
    atk,
    mp: 4,
    defense: 0,
    crit: 0,
    agility: 0,
    currentTask: HeroTask.IDLE,
    classId: 'COMMANDER',
  });

  const makeWarrior = (): Hero => ({
    id: 'warrior1',
    name: 'Guerreiro',
    hpMax: 60,
    hpCurrent: 60,
    atk: 15,
    mp: 0,
    defense: 0,
    crit: 0,
    agility: 0,
    currentTask: HeroTask.IDLE,
    classId: 'WARRIOR',
  });

  test('COMMANDER_RALLY eleva ATK efetivo dos aliados por 3 turnos (seed fixa)', () => {
    const state = makeState();
    const commander = makeCommander();
    const warrior = makeWarrior();
    state.heroes = [commander, warrior];

    // Act: Comandante age e dispara rally
    const consumed = BattleEngine.executeClassAbility(commander, state);

    // Turn was consumed
    expect(consumed).toBe(true);

    // Flag de controle está setada para não repetir
    expect(state.flags[`commander_rallied_${commander.id}`]).toBeTruthy();

    // Warrior recebeu buff atkMul da source COMMANDER_RALLY
    const rallyBuff = (state.buffs[warrior.id] ?? []).find(
      b => b.type === 'atkMul' && b.source === 'COMMANDER_RALLY',
    );
    expect(rallyBuff).toBeDefined();
    expect(rallyBuff!.value).toBeGreaterThan(1);

    // Buff expira após 3 turnos (state.rounds + 2 para durar rounds 1, 2 e 3)
    expect(rallyBuff!.expiresAfterRound).toBe(state.rounds + 2);

    // ATK efetivo do Warrior com buff > sem buff
    const dummy = { id: 'e1', hp: 100, defense: 0, agility: 0 };
    const buffed = BattleEngine.calculateAttack(warrior, dummy, 1.0, 'hero', 1, () => 0.1, 1, state);
    const clean = BattleEngine.calculateAttack(
      { ...warrior, id: 'warrior_nobuff' },
      dummy,
      1.0,
      'hero',
      1,
      () => 0.1,
    );
    expect(buffed!.dmg).toBeGreaterThan(clean!.dmg);
  });

  test('COMMANDER_RALLY não ativa duas vezes na mesma batalha', () => {
    const state = makeState();
    const commander = makeCommander();
    const warrior = makeWarrior();
    state.heroes = [commander, warrior];

    const first = BattleEngine.executeClassAbility(commander, state);
    expect(first).toBe(true);

    const second = BattleEngine.executeClassAbility(commander, state);
    expect(second).toBe(false);

    // Apenas 1 buff COMMANDER_RALLY no Warrior
    const rallyBuffs = (state.buffs[warrior.id] ?? []).filter(b => b.source === 'COMMANDER_RALLY');
    expect(rallyBuffs).toHaveLength(1);
  });

  test('COMMANDER_RALLY registra no log e em state.actions', () => {
    const state = makeState();
    const commander = makeCommander();
    state.heroes = [commander, makeWarrior()];

    BattleEngine.executeClassAbility(commander, state);

    expect(state.log.length).toBeGreaterThan(0);
    expect(state.actions.some(a => a.actorId === commander.id)).toBe(true);
  });

  test('COMMANDER_RALLY buff aplica em todos os aliados vivos (não no próprio Comandante)', () => {
    const state = makeState();
    const commander = makeCommander();
    const warrior = makeWarrior();
    const warrior2: Hero = { ...makeWarrior(), id: 'warrior2', name: 'Guerreiro2' };
    state.heroes = [commander, warrior, warrior2];

    BattleEngine.executeClassAbility(commander, state);

    // Ambos os warriors recebem buff
    expect((state.buffs[warrior.id] ?? []).some(b => b.source === 'COMMANDER_RALLY')).toBe(true);
    expect((state.buffs[warrior2.id] ?? []).some(b => b.source === 'COMMANDER_RALLY')).toBe(true);

    // Comandante não recebe buff de si mesmo
    expect((state.buffs[commander.id] ?? []).some(b => b.source === 'COMMANDER_RALLY')).toBe(false);
  });
});

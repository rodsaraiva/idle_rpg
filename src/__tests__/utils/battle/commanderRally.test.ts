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

    // Warrior recebeu buff atkFlat da source COMMANDER_RALLY (≈20% ATK do Comandante, ≥1)
    const rallyBuff = (state.buffs[warrior.id] ?? []).find(
      b => b.type === 'atkFlat' && b.source === 'COMMANDER_RALLY',
    );
    expect(rallyBuff).toBeDefined();
    // commander ATK=20 → flatBonus = max(1, floor(20*0.2)) = 4
    expect(rallyBuff!.value).toBe(Math.max(1, Math.floor(commander.atk * 0.2)));
    expect(rallyBuff!.value).toBeGreaterThanOrEqual(1);

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

  test('COMMANDER_RALLY buff é proporcional ao ATK do Comandante — commander forte dá bônus maior', () => {
    // Commander fraco: ATK 5 → flatBonus = max(1, floor(5*0.2)) = 1
    const stateWeak = makeState();
    const commanderWeak = makeCommander(5);
    const warriorWeak = makeWarrior();
    stateWeak.heroes = [commanderWeak, warriorWeak];
    BattleEngine.executeClassAbility(commanderWeak, stateWeak);
    const buffWeak = (stateWeak.buffs[warriorWeak.id] ?? []).find(
      b => b.type === 'atkFlat' && b.source === 'COMMANDER_RALLY',
    );

    // Commander forte: ATK 100 → flatBonus = max(1, floor(100*0.2)) = 20
    const stateStrong = makeState();
    const commanderStrong = makeCommander(100);
    const warriorStrong = makeWarrior();
    stateStrong.heroes = [commanderStrong, warriorStrong];
    BattleEngine.executeClassAbility(commanderStrong, stateStrong);
    const buffStrong = (stateStrong.buffs[warriorStrong.id] ?? []).find(
      b => b.type === 'atkFlat' && b.source === 'COMMANDER_RALLY',
    );

    expect(buffWeak).toBeDefined();
    expect(buffStrong).toBeDefined();
    // Valores devem ser distintos e refletir a diferença de ATK
    expect(buffStrong!.value).toBeGreaterThan(buffWeak!.value);
    expect(buffWeak!.value).toBe(1);   // floor(5*0.2)=1, max(1,1)=1
    expect(buffStrong!.value).toBe(20); // floor(100*0.2)=20
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

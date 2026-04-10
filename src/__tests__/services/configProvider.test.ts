import { configProvider } from '../../services/configProvider';
import { CLASS_DEFS } from '../../constants/classes';
import { PERSONALITIES } from '../../constants/personalities';

describe('configProvider', () => {
  beforeEach(() => {
    configProvider.reset();
  });

  afterAll(() => {
    configProvider.reset();
  });

  test('getClassDef returns WARRIOR definition', () => {
    const def = configProvider.getClassDef('WARRIOR');
    expect(def.id).toBe('WARRIOR');
    expect(def.displayName).toBe('Guerreiro');
    expect(def.attackType).toBe('MELEE');
    expect(def.range).toBe(1);
  });

  test('getClassDef returns MAGE definition', () => {
    const def = configProvider.getClassDef('MAGE');
    expect(def.id).toBe('MAGE');
    expect(def.displayName).toBe('Mago');
    expect(def.attackType).toBe('RANGED');
  });

  test('getAllClassDefs returns all 6 classes', () => {
    const all = configProvider.getAllClassDefs();
    const ids = Object.keys(all).sort();
    expect(ids).toEqual(
      ['ARCHER', 'HEALER', 'MAGE', 'ROGUE', 'TANK', 'WARRIOR'].sort()
    );
    expect(Object.keys(all)).toHaveLength(6);
  });

  test('getPersonalityDef returns correct personality', () => {
    const def = configProvider.getPersonalityDef('AGGRESSIVE');
    expect(def.id).toBe('AGGRESSIVE');
    expect(def.displayName).toBe('Sanguinário');
    expect(def.emoji).toBe('🩸');
  });

  test('getAllPersonalities returns all 5 personalities', () => {
    const all = configProvider.getAllPersonalities();
    const ids = Object.keys(all).sort();
    expect(ids).toEqual(
      ['AGGRESSIVE', 'CAUTIOUS', 'OPPORTUNIST', 'PROTECTOR', 'VENGEFUL'].sort()
    );
    expect(Object.keys(all)).toHaveLength(5);
  });

  test('overrideConfig merges class overrides', () => {
    configProvider.overrideConfig({
      classes: {
        WARRIOR: { range: 5, displayName: 'Guerreiro Sandbox' },
      },
    });
    const def = configProvider.getClassDef('WARRIOR');
    expect(def.range).toBe(5);
    expect(def.displayName).toBe('Guerreiro Sandbox');
    // Propriedades que não foram sobrescritas devem permanecer
    expect(def.id).toBe('WARRIOR');
    expect(def.attackType).toBe('MELEE');
    expect(def.baseStatDelta).toEqual(CLASS_DEFS.WARRIOR.baseStatDelta);
  });

  test('overrideConfig merges personality overrides', () => {
    configProvider.overrideConfig({
      personalities: {
        CAUTIOUS: { displayName: 'Prudente Sandbox', emoji: '🧪' },
      },
    });
    const def = configProvider.getPersonalityDef('CAUTIOUS');
    expect(def.displayName).toBe('Prudente Sandbox');
    expect(def.emoji).toBe('🧪');
    expect(def.id).toBe('CAUTIOUS');
    // Descrição original deve continuar
    expect(def.description).toBe(PERSONALITIES.CAUTIOUS.description);
  });

  test('overrideConfig handles classes and personalities together', () => {
    configProvider.overrideConfig({
      classes: {
        ROGUE: { range: 9 },
        TANK: { displayName: 'Tanquão' },
      },
      personalities: {
        VENGEFUL: { emoji: '⚡' },
      },
    });
    expect(configProvider.getClassDef('ROGUE').range).toBe(9);
    expect(configProvider.getClassDef('TANK').displayName).toBe('Tanquão');
    expect(configProvider.getPersonalityDef('VENGEFUL').emoji).toBe('⚡');
  });

  test('overrideConfig with empty object is a no-op', () => {
    const before = configProvider.getClassDef('WARRIOR');
    configProvider.overrideConfig({});
    const after = configProvider.getClassDef('WARRIOR');
    expect(after).toEqual(before);
  });

  test('reset restores original values after override', () => {
    configProvider.overrideConfig({
      classes: {
        MAGE: { range: 99, displayName: 'Archmage' },
      },
      personalities: {
        AGGRESSIVE: { displayName: 'Furioso' },
      },
    });
    expect(configProvider.getClassDef('MAGE').range).toBe(99);
    expect(configProvider.getPersonalityDef('AGGRESSIVE').displayName).toBe('Furioso');

    configProvider.reset();

    expect(configProvider.getClassDef('MAGE').range).toBe(CLASS_DEFS.MAGE.range);
    expect(configProvider.getClassDef('MAGE').displayName).toBe(CLASS_DEFS.MAGE.displayName);
    expect(configProvider.getPersonalityDef('AGGRESSIVE').displayName).toBe(
      PERSONALITIES.AGGRESSIVE.displayName
    );
  });

  test('override + reset isolation: overriding WARRIOR leaves ROGUE untouched', () => {
    const rogueOriginal = { ...CLASS_DEFS.ROGUE };

    configProvider.overrideConfig({
      classes: {
        WARRIOR: { range: 42 },
      },
    });
    // ROGUE deve manter os valores originais mesmo antes do reset
    expect(configProvider.getClassDef('ROGUE')).toEqual(rogueOriginal);

    configProvider.reset();

    // Após reset, WARRIOR volta ao valor original e ROGUE continua consistente
    expect(configProvider.getClassDef('WARRIOR').range).toBe(CLASS_DEFS.WARRIOR.range);
    expect(configProvider.getClassDef('ROGUE')).toEqual(rogueOriginal);
  });
});

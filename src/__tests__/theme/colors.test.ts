import { darkColors, lightColors } from '../../theme/tokens/colors';

describe('tokens de cor', () => {
  test('darkColors tem as cores-âncora do ROADMAP §3.2', () => {
    expect(darkColors.bgDeep).toBe('#15100B');
    expect(darkColors.bgBase).toBe('#1E1710');
    expect(darkColors.surface).toBe('#2A2018');
    expect(darkColors.gold).toBe('#C9A227');
    expect(darkColors.statHp).toBe('#C0392B');
    expect(darkColors.rarityLegendary).toBe('#E8C45A');
    expect(darkColors.danger).toBe('#B5471F'); // = ember
    expect(darkColors.warning).toBe('#E8C45A'); // = goldBright
  });

  test('lightColors (pergaminho) sobrescreve superfícies e texto', () => {
    expect(lightColors.bgBase).toBe('#E8DCC0');
    expect(lightColors.surface).toBe('#F2E9CF');
    expect(lightColors.textPrimary).toBe('#2A2018');
    // ouro/raridade/stats herdados do dark
    expect(lightColors.gold).toBe(darkColors.gold);
    expect(lightColors.rarityLegendary).toBe(darkColors.rarityLegendary);
  });

  test('darkColors e lightColors têm o mesmo conjunto de chaves (invariante do provider)', () => {
    expect(Object.keys(lightColors).sort()).toEqual(Object.keys(darkColors).sort());
  });

  test('hpHigh/hpMid/hpLow substituem os 3 hex soltos de HP', () => {
    expect(darkColors.hpHigh).toBe('#6B8E23');
    expect(darkColors.hpMid).toBe('#E8C45A');
    expect(darkColors.hpLow).toBe('#B5471F');
  });
});

export const darkColors = {
  // Superfícies (couro/pedra/madeira escura, quente)
  bgDeep: '#15100B',
  bgBase: '#1E1710',
  surface: '#2A2018',
  surfaceRaised: '#362A1F',
  // Marca (ouro velho)
  gold: '#C9A227',
  goldBright: '#E8C45A',
  goldDark: '#8A6D1B',
  // Acento quente
  ember: '#B5471F',
  blood: '#7E2A1E',
  // Stats (unificados)
  statHp: '#C0392B',
  statAtk: '#C8772E',
  statMp: '#3E6E8E',
  statDef: '#6B7280',
  // Raridade (1ª classe)
  rarityCommon: '#9CA3AF',
  rarityRare: '#3E7CB1',
  rarityEpic: '#8E5BC4',
  rarityLegendary: '#E8C45A',
  // Texto
  textPrimary: '#F3E9D2',
  textSecondary: '#C4B499',
  textMuted: '#8A7B63',
  // Bordas / molduras
  border: '#4A3826',
  borderGold: '#8A6D1B',
  // Feedback (musgo medieval)
  success: '#6B8E23',
  successBright: '#9ACD32',
  danger: '#B5471F', // = ember
  warning: '#E8C45A', // = goldBright
  // HP-bar por faixa (substitui #3CB371/#FFD24D/#FF7A7A)
  hpHigh: '#6B8E23',
  hpMid: '#E8C45A',
  hpLow: '#B5471F',
} as const;

export const lightColors = {
  ...darkColors,
  bgDeep: '#D8C9A4',
  bgBase: '#E8DCC0',
  surface: '#F2E9CF',
  surfaceRaised: '#FBF4E2',
  textPrimary: '#2A2018',
  textSecondary: '#5A4A33',
  textMuted: '#8A7B63',
  border: '#C9B68C',
} as const;

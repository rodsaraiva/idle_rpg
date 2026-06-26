export interface SeasonalEvent {
  id: string;
  name: string;
  icon: string;
  modifier: {
    missionRewardPct?: number;  // ex.: 0.20 = +20% de recompensa de missão
    forgeHastePct?: number;      // ex.: 0.30 = +30% velocidade de forja
  };
}

export const SEASONAL_EVENTS: SeasonalEvent[] = [
  {
    id: 'event_goblin_invasion',
    name: 'Invasão Goblin',
    icon: '👺',
    modifier: { missionRewardPct: 0.20 },
  },
  {
    id: 'event_forge_festival',
    name: 'Festival da Forja',
    icon: '🔨',
    modifier: { forgeHastePct: 0.30 },
  },
  {
    id: 'event_celestial_blessing',
    name: 'Bênção Celestial',
    icon: '✨',
    modifier: { missionRewardPct: 0.10, forgeHastePct: 0.10 },
  },
  {
    id: 'event_blood_moon',
    name: 'Lua de Sangue',
    icon: '🌑',
    modifier: { missionRewardPct: 0.25 },
  },
  {
    id: 'event_ancient_dragon',
    name: 'Despertar do Dragão Ancião',
    icon: '🐉',
    modifier: { missionRewardPct: 0.15, forgeHastePct: 0.15 },
  },
];

/** Retorna seed baseada em janela mensal (YYYYMM). Mesma janela → mesma seed. */
export function getEventSeed(now: number): number {
  const d = new Date(now);
  return d.getFullYear() * 100 + (d.getMonth() + 1);
}

/** Seleção determinística: mesma seed → mesmo evento. */
export function pickEvent(seed: number): SeasonalEvent {
  return SEASONAL_EVENTS[seed % SEASONAL_EVENTS.length];
}

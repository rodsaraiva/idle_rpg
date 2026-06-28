import { theme } from '../theme';

export const STAT_META: Record<string, { label: string; color?: string }> = {
  hp:      { label: 'HP',   color: theme.colors.statHp },
  atk:     { label: 'ATK',  color: theme.colors.statAtk },
  mp:      { label: 'MP',   color: theme.colors.statMp },
  defense: { label: 'DEF',  color: theme.colors.textSecondary },
  crit:    { label: 'CRIT', color: theme.colors.gold },
  agility: { label: 'AGI',  color: theme.colors.success },
};

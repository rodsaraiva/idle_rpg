export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (state: any) => boolean;
  reward: { gold?: number; permanentAtkBonus?: number; permanentHpBonus?: number };
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'recruit_1', name: 'Primeiro Recrutamento', description: 'Recrute seu primeiro herói', icon: '👤', condition: (s) => s.heroesRecruited >= 1, reward: { gold: 20 } },
  { id: 'recruit_5', name: 'Formação de Guilda', description: 'Recrute 5 heróis', icon: '👥', condition: (s) => s.heroesRecruited >= 5, reward: { gold: 100 } },
  { id: 'recruit_10', name: 'Exército Crescente', description: 'Recrute 10 heróis', icon: '⚔️', condition: (s) => s.heroesRecruited >= 10, reward: { gold: 300 } },
  { id: 'gold_100', name: 'Cofre Cheio', description: 'Acumule 100 de ouro', icon: '💰', condition: (s) => s.gold >= 100, reward: { gold: 50 } },
  { id: 'gold_1000', name: 'Tesouro Real', description: 'Acumule 1000 de ouro', icon: '👑', condition: (s) => s.gold >= 1000, reward: { gold: 200 } },
  { id: 'mission_first', name: 'Primeira Vitória', description: 'Complete sua primeira missão', icon: '🏅', condition: (s) => (s.completedMissionCount ?? 0) >= 1, reward: { gold: 30 } },
  { id: 'mission_10', name: 'Veterano', description: 'Complete 10 missões', icon: '🎖️', condition: (s) => (s.completedMissionCount ?? 0) >= 10, reward: { gold: 150 } },
  { id: 'mission_50', name: 'Comandante', description: 'Complete 50 missões', icon: '🏆', condition: (s) => (s.completedMissionCount ?? 0) >= 50, reward: { gold: 500, permanentAtkBonus: 2 } },
  { id: 'forge_1', name: 'Aprendiz Ferreiro', description: 'Forje seu primeiro equipamento', icon: '🔨', condition: (s) => (s.inventory?.length ?? 0) >= 1, reward: { gold: 50 } },
  { id: 'forge_5', name: 'Mestre Ferreiro', description: 'Forje 5 equipamentos', icon: '⚒️', condition: (s) => (s.inventory?.length ?? 0) >= 5, reward: { gold: 200 } },
  { id: 'boss_slayer', name: 'Mata-Dragão', description: 'Complete o Covil do Dragão', icon: '🐉', condition: (s) => (s.completedMissionIds ?? []).includes('mission_boss_1'), reward: { gold: 1000, permanentAtkBonus: 5, permanentHpBonus: 10 } },
];

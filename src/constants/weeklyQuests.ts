export interface WeeklyQuestDef {
  id: string;
  name: string;
  icon: string;
  targetValue: number;
  reward: number;
  tracker: string;
}

export const WEEKLY_QUEST_POOL: WeeklyQuestDef[] = [
  { id: 'wq_missions_20', name: 'Completar 20 missões', icon: '⚔️', targetValue: 20, reward: 200, tracker: 'missionsCompleted' },
  { id: 'wq_train_100', name: 'Treinar 100 pontos', icon: '💪', targetValue: 100, reward: 150, tracker: 'pointsTrained' },
  { id: 'wq_forge_5', name: 'Forjar 5 equipamentos', icon: '🔨', targetValue: 5, reward: 200, tracker: 'itemsForged' },
  { id: 'wq_gold_1000', name: 'Ganhar 1000 de ouro', icon: '💰', targetValue: 1000, reward: 250, tracker: 'goldEarned' },
  { id: 'wq_boss_1', name: 'Derrotar o boss semanal', icon: '🐉', targetValue: 1, reward: 300, tracker: 'weeklyBossKills' },
  { id: 'wq_fuse_1', name: 'Realizar 1 fusão', icon: '🏛️', targetValue: 1, reward: 250, tracker: 'fusionsCompleted' },
];

export const WEEKLY_QUEST_COUNT = 3;
export const WEEKLY_BONUS_REWARD = 500;

export function getWeeklySeed(): number {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7
  );
  return d.getFullYear() * 100 + weekNumber;
}

export function pickWeeklyQuests(seed: number, count: number = WEEKLY_QUEST_COUNT): WeeklyQuestDef[] {
  const shuffled = [...WEEKLY_QUEST_POOL].sort((a, b) => {
    const hashA = (seed * 37 + a.id.length) % 991;
    const hashB = (seed * 37 + b.id.length) % 991;
    return hashA - hashB;
  });
  const picked: WeeklyQuestDef[] = [];
  const usedTrackers = new Set<string>();
  for (const q of shuffled) {
    if (picked.length >= count) break;
    if (!usedTrackers.has(q.tracker)) {
      picked.push(q);
      usedTrackers.add(q.tracker);
    }
  }
  return picked;
}

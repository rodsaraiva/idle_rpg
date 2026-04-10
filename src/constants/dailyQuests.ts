export interface DailyQuestDef {
  id: string;
  name: string;
  icon: string;
  targetValue: number;
  reward: number;
  tracker: string; // key in dailyProgress to track
}

export const DAILY_QUEST_POOL: DailyQuestDef[] = [
  { id: 'dq_missions_3', name: 'Completar 3 missões', icon: '⚔️', targetValue: 3, reward: 30, tracker: 'missionsCompleted' },
  { id: 'dq_missions_5', name: 'Completar 5 missões', icon: '🗡️', targetValue: 5, reward: 60, tracker: 'missionsCompleted' },
  { id: 'dq_train_10', name: 'Treinar 10 pontos', icon: '💪', targetValue: 10, reward: 25, tracker: 'pointsTrained' },
  { id: 'dq_train_20', name: 'Treinar 20 pontos', icon: '🏋️', targetValue: 20, reward: 50, tracker: 'pointsTrained' },
  { id: 'dq_forge_1', name: 'Forjar 1 equipamento', icon: '🔨', targetValue: 1, reward: 40, tracker: 'itemsForged' },
  { id: 'dq_gold_50', name: 'Ganhar 50 de ouro', icon: '💰', targetValue: 50, reward: 30, tracker: 'goldEarned' },
  { id: 'dq_gold_200', name: 'Ganhar 200 de ouro', icon: '👑', targetValue: 200, reward: 80, tracker: 'goldEarned' },
  { id: 'dq_recruit_1', name: 'Recrutar 1 herói', icon: '👤', targetValue: 1, reward: 35, tracker: 'heroesRecruited' },
];

export const DAILY_QUEST_COUNT = 3;
export const DAILY_BONUS_REWARD = 100; // bonus for completing all 3

/** Pick N random quests from pool, ensuring unique trackers */
export function pickDailyQuests(seed: number, count: number = DAILY_QUEST_COUNT): DailyQuestDef[] {
  // Use date-based seed for deterministic daily selection
  const shuffled = [...DAILY_QUEST_POOL].sort((a, b) => {
    const hashA = (seed * 31 + a.id.length) % 997;
    const hashB = (seed * 31 + b.id.length) % 997;
    return hashA - hashB;
  });
  // Pick unique trackers
  const picked: DailyQuestDef[] = [];
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

export function getDailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

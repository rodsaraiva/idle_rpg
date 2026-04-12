import { FeedbackService, FeedbackEvent } from './feedback';

const emitMilestone = (text: string) => {
  FeedbackService.emit(FeedbackEvent.TOAST, { text, type: 'milestone', duration: 4000 });
};

export const emitSkillUnlocked = (heroName: string, skillIcon: string, skillName: string) => {
  emitMilestone(`${skillIcon} ${heroName} desbloqueou ${skillName}!`);
};

export const emitFirstFusion = () => {
  emitMilestone('🏛️ Primeira fusão realizada!');
};

export const emitFusionResult = (heroName: string, stars: number) => {
  emitMilestone(`⭐ ${heroName} nasceu com ${'★'.repeat(stars)}!`);
};

export const emitWeeklyQuestComplete = () => {
  emitMilestone('📅 Quest semanal concluída!');
};

export const emitWeeklyBossDefeated = () => {
  emitMilestone('🐉 Boss semanal derrotado!');
};

export const emitFirstTierForged = (tierName: string) => {
  emitMilestone(`🔨 Primeiro equipamento ${tierName} forjado!`);
};

export const emitRareMaterialDrop = (materialName: string) => {
  emitMilestone(`💎 ${materialName} obtida!`);
};

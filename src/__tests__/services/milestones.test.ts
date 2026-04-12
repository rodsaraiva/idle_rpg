import { FeedbackService, FeedbackEvent, ToastPayload } from '../../services/feedback';
import {
  emitSkillUnlocked,
  emitFirstFusion,
  emitFusionResult,
  emitWeeklyQuestComplete,
  emitWeeklyBossDefeated,
  emitFirstTierForged,
  emitRareMaterialDrop,
} from '../../services/milestones';

describe('milestones service', () => {
  let handler: jest.Mock;
  let unsubscribe: () => void;

  beforeEach(() => {
    handler = jest.fn();
    unsubscribe = FeedbackService.on(FeedbackEvent.TOAST, handler);
  });

  afterEach(() => {
    unsubscribe();
  });

  test('emitSkillUnlocked emits milestone toast with hero name, icon and skill name', () => {
    emitSkillUnlocked('Aria', '⚔️', 'Slash');
    expect(handler).toHaveBeenCalledTimes(1);
    const payload: ToastPayload = handler.mock.calls[0][0];
    expect(payload.type).toBe('milestone');
    expect(payload.text).toContain('Aria');
    expect(payload.text).toContain('⚔️');
    expect(payload.text).toContain('Slash');
  });

  test('emitFirstFusion emits milestone toast with fusion text', () => {
    emitFirstFusion();
    expect(handler).toHaveBeenCalledTimes(1);
    const payload: ToastPayload = handler.mock.calls[0][0];
    expect(payload.type).toBe('milestone');
    expect(payload.text).toContain('Primeira fusão');
  });

  test('emitFusionResult emits milestone toast with hero name and stars', () => {
    emitFusionResult('Kael', 3);
    expect(handler).toHaveBeenCalledTimes(1);
    const payload: ToastPayload = handler.mock.calls[0][0];
    expect(payload.type).toBe('milestone');
    expect(payload.text).toContain('Kael');
    expect(payload.text).toContain('★★★');
  });

  test('emitWeeklyQuestComplete emits milestone toast with quest text', () => {
    emitWeeklyQuestComplete();
    expect(handler).toHaveBeenCalledTimes(1);
    const payload: ToastPayload = handler.mock.calls[0][0];
    expect(payload.type).toBe('milestone');
    expect(payload.text).toContain('Quest semanal');
  });

  test('emitWeeklyBossDefeated emits milestone toast with boss text', () => {
    emitWeeklyBossDefeated();
    expect(handler).toHaveBeenCalledTimes(1);
    const payload: ToastPayload = handler.mock.calls[0][0];
    expect(payload.type).toBe('milestone');
    expect(payload.text).toContain('Boss semanal');
  });

  test('emitFirstTierForged emits milestone toast with tier name', () => {
    emitFirstTierForged('Lendário');
    expect(handler).toHaveBeenCalledTimes(1);
    const payload: ToastPayload = handler.mock.calls[0][0];
    expect(payload.type).toBe('milestone');
    expect(payload.text).toContain('Lendário');
  });

  test('emitRareMaterialDrop emits milestone toast with material name', () => {
    emitRareMaterialDrop('Pó de Dragão');
    expect(handler).toHaveBeenCalledTimes(1);
    const payload: ToastPayload = handler.mock.calls[0][0];
    expect(payload.type).toBe('milestone');
    expect(payload.text).toContain('Pó de Dragão');
  });
});

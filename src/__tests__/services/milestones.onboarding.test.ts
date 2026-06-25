import { FeedbackService, FeedbackEvent, ToastPayload } from '../../services/feedback';
import { emitForgeHint, emitInfirmaryHint, emitSecondRecruitHint } from '../../services/milestones';

describe('dicas pós-tutorial', () => {
  let handler: jest.Mock;
  let unsubscribe: () => void;

  beforeEach(() => {
    handler = jest.fn();
    unsubscribe = FeedbackService.on(FeedbackEvent.TOAST, handler);
  });
  afterEach(() => unsubscribe());

  test('emitForgeHint emite toast de marco com texto da forja', () => {
    emitForgeHint();
    expect(handler).toHaveBeenCalledTimes(1);
    const p: ToastPayload = handler.mock.calls[0][0];
    expect(p.type).toBe('milestone');
    expect(p.text).toContain('Forje');
  });

  test('emitInfirmaryHint emite toast sobre Enfermaria', () => {
    emitInfirmaryHint();
    const p: ToastPayload = handler.mock.calls[0][0];
    expect(p.type).toBe('milestone');
    expect(p.text).toContain('Enfermaria');
  });

  test('emitSecondRecruitHint emite toast sobre juntar ouro', () => {
    emitSecondRecruitHint();
    const p: ToastPayload = handler.mock.calls[0][0];
    expect(p.type).toBe('milestone');
    expect(p.text).toContain('ouro');
  });
});

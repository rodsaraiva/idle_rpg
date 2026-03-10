import { FeedbackService, FeedbackEvent } from '../../services/feedback';

describe('FeedbackService', () => {
  test('on and emit should work for floating text', () => {
    const cb = jest.fn();
    FeedbackService.on(FeedbackEvent.FLOAT, cb);
    
    const payload = { text: 'Hello', x: 10, y: 20 };
    FeedbackService.emit(FeedbackEvent.FLOAT, payload);
    
    expect(cb).toHaveBeenCalledWith(payload);
  });

  test('off should stop listeners from receiving events', () => {
    const cb = jest.fn();
    const unsubscribe = FeedbackService.on(FeedbackEvent.TOAST, cb);
    
    unsubscribe();
    FeedbackService.emit(FeedbackEvent.TOAST, { text: 'Toast' });
    
    expect(cb).not.toHaveBeenCalled();
  });

  test('multiple listeners should all be called', () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    FeedbackService.on(FeedbackEvent.BATTLE_HIT, cb1);
    FeedbackService.on(FeedbackEvent.BATTLE_HIT, cb2);
    
    FeedbackService.emit(FeedbackEvent.BATTLE_HIT, { id: 'h1', amount: 5 });
    
    expect(cb1).toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
  });

  test('emit should not fail if a callback throws', () => {
    const badCb = () => { throw new Error('Bad'); };
    const goodCb = jest.fn();
    
    FeedbackService.on(FeedbackEvent.BATTLE_DEATH, badCb);
    FeedbackService.on(FeedbackEvent.BATTLE_DEATH, goodCb);
    
    expect(() => {
      FeedbackService.emit(FeedbackEvent.BATTLE_DEATH, { id: 'h1' });
    }).not.toThrow();
    
    expect(goodCb).toHaveBeenCalled();
  });
});

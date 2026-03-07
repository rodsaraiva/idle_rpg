import { ColorValue } from 'react-native';

export enum FeedbackEvent {
  FLOAT = 'FEEDBACK_FLOAT',
  TOAST = 'FEEDBACK_TOAST',
  BATTLE_HIGHLIGHT = 'BATTLE_HIGHLIGHT',
  BATTLE_HIT = 'BATTLE_HIT',
  BATTLE_TARGET = 'BATTLE_TARGET',
  BATTLE_DEATH = 'BATTLE_DEATH',
}

export interface FloatPayload {
  x?: number;
  y?: number;
  text: string;
  color?: ColorValue;
  duration?: number;
}

export interface ToastPayload {
  text: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
}

export interface BattleHighlightPayload {
  id: string;
  duration?: number;
}

export interface BattleHitPayload {
  id: string;
  amount: number;
}

export interface BattleTargetPayload {
  id: string;
  duration?: number;
}

export interface BattleDeathPayload {
  id: string;
}

type PayloadMap = {
  [FeedbackEvent.FLOAT]: FloatPayload;
  [FeedbackEvent.TOAST]: ToastPayload;
  [FeedbackEvent.BATTLE_HIGHLIGHT]: BattleHighlightPayload;
  [FeedbackEvent.BATTLE_HIT]: BattleHitPayload;
  [FeedbackEvent.BATTLE_TARGET]: BattleTargetPayload;
  [FeedbackEvent.BATTLE_DEATH]: BattleDeathPayload;
};

type Callback<T extends FeedbackEvent> = (payload: PayloadMap[T]) => void;

const listeners: { [K in FeedbackEvent]?: Callback<K>[] } = {};

export const FeedbackService = {
  on<T extends FeedbackEvent>(event: T, cb: Callback<T>) {
    if (!listeners[event]) {
      listeners[event] = [];
    }
    listeners[event]!.push(cb);
    return () => this.off(event, cb);
  },

  off<T extends FeedbackEvent>(event: T, cb: Callback<T>) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event]!.filter((c) => c !== cb);
  },

  emit<T extends FeedbackEvent>(event: T, payload: PayloadMap[T]) {
    (listeners[event] || []).forEach((cb) => {
      try {
        cb(payload);
      } catch (e) {
        // quiet fail
      }
    });
  },
};

// Backward compatibility exports
export const emit = (event: any, payload: any) => 
  FeedbackService.emit(event as FeedbackEvent, payload);

export const on = (event: any, cb: any) => 
  FeedbackService.on(event as FeedbackEvent, cb);

export const FEEDBACK_EVENTS = {
  FLOAT: FeedbackEvent.FLOAT,
  TOAST: FeedbackEvent.TOAST,
  BATTLE_HIGHLIGHT: FeedbackEvent.BATTLE_HIGHLIGHT,
  BATTLE_HIT: FeedbackEvent.BATTLE_HIT,
  BATTLE_TARGET: FeedbackEvent.BATTLE_TARGET,
  BATTLE_DEATH: FeedbackEvent.BATTLE_DEATH,
};

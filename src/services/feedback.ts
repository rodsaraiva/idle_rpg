type Callback = (payload: any) => void;

const listeners: Record<string, Callback[]> = {};

export function on(event: string, cb: Callback) {
  listeners[event] = listeners[event] || [];
  listeners[event].push(cb);
  return () => off(event, cb);
}

export function off(event: string, cb: Callback) {
  if (!listeners[event]) return;
  listeners[event] = listeners[event].filter((c) => c !== cb);
}

export function emit(event: string, payload?: any) {
  (listeners[event] || []).forEach((cb) => {
    try {
      cb(payload);
    } catch (e) {
      // swallow
      // console.error('Feedback listener error', e);
    }
  });
}

export const FEEDBACK_EVENTS = {
  FLOAT: 'FEEDBACK_FLOAT',
  TOAST: 'FEEDBACK_TOAST',
};


type BattleAction = {
  round: number;
  actorType: 'hero' | 'enemy';
  actorId: string;
  actorName?: string;
  actionType: 'hit' | 'miss' | 'heal' | 'defeat';
  targetId?: string;
  amount?: number;
  isCrit?: boolean;
  text: string;
};

export class BattleRunner {
  private actions: BattleAction[];
  private idx = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private delayMs: number;

  constructor(actions: BattleAction[], delayMs = 1000) {
    this.actions = actions || [];
    this.delayMs = delayMs;
  }

  start(onAction: (a: BattleAction) => void, onComplete?: () => void) {
    if (this.idx >= this.actions.length) {
      onComplete?.();
      return;
    }
    const step = () => {
      if (this.idx >= this.actions.length) {
        this.timer = null;
        onComplete?.();
        return;
      }
      const a = this.actions[this.idx++];
      onAction(a);
      this.timer = setTimeout(step, this.delayMs);
    };
    step();
  }

  pause() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  skip(onAction: (a: BattleAction) => void, onComplete?: () => void) {
    while (this.idx < this.actions.length) {
      onAction(this.actions[this.idx++]);
    }
    onComplete?.();
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.idx = this.actions.length;
    this.timer = null;
  }
}


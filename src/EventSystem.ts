import { GameEventType } from './types/game.types';
import { GameEvent, AttackEvent, DefendEvent, EvadeEvent, DeathEvent, FocusAttackEvent, HpChangeEvent, StatusChangeEvent, AbilityUseEvent, AbilityEffectEvent } from './events';

export class EventSystem {
  private handlers: Map<GameEventType, Set<(event: GameEvent) => void | Promise<void>>>;
  private eventHistory: GameEvent[];
  private isProcessing: boolean = false;
  private eventQueue: GameEvent[] = [];

  constructor() {
    this.handlers = new Map();
    this.eventHistory = [];
  }

  on(eventType: GameEventType, handler: (event: GameEvent) => void | Promise<void>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  off(eventType: GameEventType, handler: (event: GameEvent) => void | Promise<void>): void {
    this.handlers.get(eventType)?.delete(handler);
  }

  async emit(event: GameEvent): Promise<void> {
    if (this.isProcessing) {
      // Queue the event if we're currently processing
      this.eventQueue.push(event);
      return;
    }

    this.isProcessing = true;
    
    try {
      // Add timestamp if not present
      if (!event.timestamp) {
        event.timestamp = Date.now();
      }

      // Add to history
      this.eventHistory.push(event);

      // Call handlers sequentially
      const handlers = this.handlers.get(event.type);
      if (handlers) {
        for (const handler of handlers) {
          await handler(event);
        }
      }

      // Process queued events
      while (this.eventQueue.length > 0) {
        const queuedEvent = this.eventQueue.shift()!;
        await this.emit(queuedEvent);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  getEventHistory(): GameEvent[] {
    return this.eventHistory;
  }

  clearHistory(): void {
    this.eventHistory = [];
  }

  // Helper methods for common events
  emitAttack(data: AttackEvent): Promise<void> {
    return this.emit({
      type: GameEventType.ATTACK_ACTION,
      timestamp: Date.now(),
      data
    });
  }

  emitDefend(data: DefendEvent): Promise<void> {
    return this.emit({
      type: GameEventType.DEFEND_ACTION,
      timestamp: Date.now(),
      data
    });
  }

  emitEvade(data: EvadeEvent): Promise<void> {
    return this.emit({
      type: GameEventType.EVADE_ACTION,
      timestamp: Date.now(),
      data
    });
  }

  emitDeath(data: DeathEvent): Promise<void> {
    return this.emit({
      type: GameEventType.DEATH,
      timestamp: Date.now(),
      data
    });
  }

  emitFocusAttack(data: FocusAttackEvent): Promise<void> {
    return this.emit({
      type: GameEventType.FOCUS_ATTACK,
      timestamp: Date.now(),
      data
    });
  }

  emitHpChange(data: HpChangeEvent): Promise<void> {
    return this.emit({
      type: GameEventType.HP_CHANGE,
      timestamp: Date.now(),
      data
    });
  }

  emitStatusChange(data: StatusChangeEvent): Promise<void> {
    return this.emit({
      type: GameEventType.STATUS_CHANGE,
      timestamp: Date.now(),
      data
    });
  }

  emitAbilityUse(data: AbilityUseEvent): Promise<void> {
    return this.emit({
      type: GameEventType.ABILITY_USE,
      timestamp: Date.now(),
      data
    });
  }

  emitAbilityEffect(data: AbilityEffectEvent): Promise<void> {
    return this.emit({
      type: GameEventType.ABILITY_EFFECT,
      timestamp: Date.now(),
      data
    });
  }
} 
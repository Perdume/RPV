import { GameEvent, GameEventType, ModifiableEvent } from '../types/game.types';

export type EventHandler = (event: ModifiableEvent) => Promise<void>;

export class EventSystem {
  private handlers: Map<GameEventType, EventHandler[]>;
  private eventHistory: ModifiableEvent[];

  constructor() {
    this.handlers = new Map();
    this.eventHistory = [];
  }

  on(eventType: GameEventType, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  async emit(event: ModifiableEvent): Promise<void> {
    // 이벤트 히스토리에 추가
    this.eventHistory.push(event);

    // 이벤트 타입에 등록된 모든 핸들러 실행
    const handlers = this.handlers.get(event.type) || [];
    for (const handler of handlers) {
      await handler(event);
    }
  }

  getEventHistory(): ModifiableEvent[] {
    return [...this.eventHistory];
  }

  off(eventType: GameEventType, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
      this.handlers.set(eventType, handlers);
    }
  }
} 
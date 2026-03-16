import { GameEventType, ModifiableEvent, Player, PlayerStatus } from '../types/game.types';
import { GameState } from '../GameState';
import { AbilityManager } from '../abilities/AbilityManager';

export type EventHandler = (event: ModifiableEvent) => Promise<void>;

interface GameSnapshot {
  // 기본 게임 상태
  gameState: {
    players: Player[];
    currentTurn: number;
    logs: string[];
    isDeathZone: boolean;
  };
  
  // 이벤트 히스토리
  eventHistory: ModifiableEvent[];
  
  // 메타데이터
  metadata: {
    timestamp: number;
    turnNumber: number;
    actionCount: number;
  };
}

export class EventSystem {
  private handlers: Map<GameEventType, EventHandler[]>;
  private eventHistory: ModifiableEvent[];
  private snapshots: GameSnapshot[];
  private currentIndex: number;
  private maxHistory: number;
  private isDisposed: boolean = false;
  private debugEnabled: boolean = false;

  constructor(options?: { debug?: boolean }) {
    this.handlers = new Map();
    this.eventHistory = [];
    this.snapshots = [];
    this.currentIndex = -1;
    this.maxHistory = 20;
    this.debugEnabled = options?.debug ?? false;
  }

  setDebug(enabled: boolean): void {
    this.debugEnabled = enabled;
  }

  on(eventType: GameEventType, handler: EventHandler): void {
    if (this.isDisposed) {
      console.warn('EventSystem이 dispose되었습니다.');
      return;
    }
    
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    
    const currentHandlers = this.handlers.get(eventType)!;
    currentHandlers.push(handler);
    
    if (this.debugEnabled) {
      console.log(`[EVENT REGISTER] ${eventType} 핸들러 등록 완료. 총 핸들러 수: ${currentHandlers.length}`);
      if (currentHandlers.length > 1) {
        console.warn(`[EVENT REGISTER] ⚠️ 중복 핸들러 감지! ${eventType}에 ${currentHandlers.length}개 등록됨`);
      }
    }
  }

  removeHandler(eventType: GameEventType, handler: EventHandler): void {
    if (this.isDisposed) {
      console.warn('EventSystem이 dispose되었습니다.');
      return;
    }
    
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
        console.log(`[EVENT SYSTEM] 핸들러 제거 완료: ${eventType}`);
      }
    }
  }

  removeAllHandlers(eventType?: GameEventType): void {
    if (this.isDisposed) {
      console.warn('EventSystem이 dispose되었습니다.');
      return;
    }
    
    if (eventType) {
      this.handlers.delete(eventType);
      console.log(`[EVENT SYSTEM] ${eventType} 모든 핸들러 제거 완료`);
    } else {
      this.handlers.clear();
      console.log(`[EVENT SYSTEM] 모든 이벤트 핸들러 제거 완료`);
    }
  }

  dispose(): void {
    console.log(`[EVENT SYSTEM] EventSystem dispose 시작`);
    this.handlers.clear();
    this.eventHistory = [];
    this.snapshots = [];
    this.currentIndex = -1;
    this.isDisposed = true;
    console.log(`[EVENT SYSTEM] EventSystem dispose 완료`);
  }

  // 🆕 다중 이벤트 타입 리스닝
  onMultiple(types: GameEventType[], callback: EventHandler): void {
    if (this.isDisposed) {
      console.warn('EventSystem이 dispose되었습니다.');
      return;
    }
    
    for (const eventType of types) {
      this.on(eventType, callback);
    }
  }

  // 🆕 일회성 리스너
  once(eventType: GameEventType, callback: EventHandler): void {
    if (this.isDisposed) {
      console.warn('EventSystem이 dispose되었습니다.');
      return;
    }
    
    const onceHandler = async (event: ModifiableEvent) => {
      await callback(event);
      this.off(eventType, onceHandler);
    };
    this.on(eventType, onceHandler);
  }

  async emit(event: ModifiableEvent): Promise<void> {
    if (this.isDisposed) {
      console.warn('EventSystem이 dispose되었습니다.');
      return;
    }
    
    if (this.debugEnabled) {
      console.log(`[EVENT] ${event.type}`, event.data);
    }

    // 이벤트 히스토리에 추가
    this.eventHistory.push(event);

    // 이벤트 타입에 등록된 모든 핸들러 실행
    const handlers = this.handlers.get(event.type) || [];
    
    for (const handler of handlers) {
      await handler(event);
      
      // 이벤트가 취소되면 중단
      if (event.cancelled) {
        break;
      }
    }
  }

  // 스냅샷 생성
  createSnapshot(gameState: GameState, abilityManager: AbilityManager): GameSnapshot {
    const snapshot: GameSnapshot = {
      gameState: {
        players: Array.from(gameState.players.values()).map(p => ({
          ...p,
          status: p.status === 'alive' ? PlayerStatus.ALIVE :
                 p.status === 'wounded' ? PlayerStatus.WOUNDED :
                 p.status === 'dead' ? PlayerStatus.DEAD :
                 PlayerStatus.ALIVE,
          isPerfectGuard: false,
          maxAbilityUses: 0,
          hasDefended: false,
          wasAttacked: false,
          isAbilitySealed: false,
          isDefenseSealed: false,
          damageReduction: 0,
          isGhost: false,
          currentTurn: gameState.currentTurn,
          noDamageTurns: 0,
          inactiveTurns: 0,
          isInvincible: false,
          customFlags: new Map<string, any>()
        })),
        currentTurn: gameState.currentTurn,
        logs: [],
        isDeathZone: gameState.deathZone.stage > 0
      },
      eventHistory: [...this.eventHistory],
      metadata: {
        timestamp: Date.now(),
        turnNumber: gameState.currentTurn,
        actionCount: this.eventHistory.length
      }
    };

    // 이전 스냅샷들 제거 (현재 인덱스 이후)
    this.snapshots = this.snapshots.slice(0, this.currentIndex + 1);
    
    // 새 스냅샷 추가
    this.snapshots.push(snapshot);
    this.currentIndex = this.snapshots.length - 1;

    // 최대 히스토리 크기 제한
    if (this.snapshots.length > this.maxHistory) {
      this.snapshots.shift();
      this.currentIndex--;
    }

    return snapshot;
  }

  // 롤백
  rollback(steps: number = 1): GameSnapshot | null {
    if (this.currentIndex - steps < 0) return null;
    
    this.currentIndex -= steps;
    return this.snapshots[this.currentIndex];
  }

  // 재실행
  redo(steps: number = 1): GameSnapshot | null {
    if (this.currentIndex + steps >= this.snapshots.length) return null;
    
    this.currentIndex += steps;
    return this.snapshots[this.currentIndex];
  }

  // 특정 턴으로 이동
  jumpToTurn(turnNumber: number): GameSnapshot | null {
    const snapshot = this.snapshots.find(s => s.metadata.turnNumber === turnNumber);
    if (!snapshot) return null;
    
    this.currentIndex = this.snapshots.indexOf(snapshot);
    return snapshot;
  }

  // 롤백 가능 여부
  canRollback(): boolean {
    return this.currentIndex > 0;
  }

  // 재실행 가능 여부
  canRedo(): boolean {
    return this.currentIndex < this.snapshots.length - 1;
  }

  // 사용 가능한 턴 목록
  getAvailableTurns(): number[] {
    return this.snapshots.map(s => s.metadata.turnNumber);
  }

  getEventHistory(): ModifiableEvent[] {
    return [...this.eventHistory];
  }

  // 현재 스냅샷의 이벤트 히스토리로 복원
  restoreFromSnapshot(snapshot: GameSnapshot): void {
    this.eventHistory = [...snapshot.eventHistory];
  }

  off(eventType: GameEventType, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
      this.handlers.set(eventType, handlers);
    }
  }

  getHandlerStats(): void {
    console.log(`[EVENT SYSTEM] === 전체 핸들러 상태 ===`);
    for (const [eventType, handlers] of this.handlers.entries()) {
      console.log(`[EVENT SYSTEM] ${eventType}: ${handlers.length}개 핸들러`);
      if (handlers.length > 1) {
        console.warn(`[EVENT SYSTEM] ⚠️ 중복! ${eventType}에 ${handlers.length}개`);
      }
    }
    console.log(`[EVENT SYSTEM] === 상태 확인 완료 ===`);
  }
} 
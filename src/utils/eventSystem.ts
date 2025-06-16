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

  constructor() {
    this.handlers = new Map();
    this.eventHistory = [];
    this.snapshots = [];
    this.currentIndex = -1;
    this.maxHistory = 20;
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
          inactiveTurns: 0
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
} 
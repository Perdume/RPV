import { Player, ActionType, PlayerStatus } from '../types/game.types';

export class ConditionalTriggerManager {
  private triggers: Map<string, ConditionalTrigger> = new Map();
  private playerStates: Map<number, PlayerTriggerState> = new Map();
  private currentTurn: number = 0;

  // 트리거 등록
  registerTrigger(triggerId: string, trigger: ConditionalTrigger): void {
    this.triggers.set(triggerId, trigger);
  }

  // 연속 행동 트리거 (예: 연속 2턴 회피)
  registerConsecutiveActionTrigger(
    playerId: number,
    actionType: ActionType,
    consecutiveCount: number,
    effect: () => void
  ): void {
    const triggerId = `${playerId}_consecutive_${actionType}_${consecutiveCount}`;
    
    this.registerTrigger(triggerId, {
      condition: () => {
        const state = this.getPlayerState(playerId);
        const currentCount = state.consecutiveActions.get(actionType) || 0;
        return currentCount >= consecutiveCount;
      },
      effect,
      oncePerGame: false
    });
  }

  // 누적 데미지 트리거 (예: 누적 2 데미지마다)
  registerCumulativeDamageTrigger(
    playerId: number,
    damageThreshold: number,
    effect: () => void
  ): void {
    const triggerId = `${playerId}_cumulative_damage_${damageThreshold}`;
    
    this.registerTrigger(triggerId, {
      condition: () => {
        const state = this.getPlayerState(playerId);
        return state.cumulativeDamage >= damageThreshold;
      },
      effect: () => {
        effect();
        // 트리거 후 카운터 리셋
        const state = this.getPlayerState(playerId);
        state.cumulativeDamage = 0;
      },
      oncePerGame: false
    });
  }

  // 턴 조건 트리거 (예: 3의 배수 턴)
  registerTurnModuloTrigger(
    modulo: number,
    effect: (turn: number) => void
  ): void {
    const triggerId = `turn_modulo_${modulo}`;
    
    this.registerTrigger(triggerId, {
      condition: () => true, // 턴 체크는 별도
      effect: () => {}, // 실제 effect는 turnCheck에서
      oncePerGame: false,
      turnCheck: (turn: number) => {
        if (turn % modulo === 0) {
          effect(turn);
        }
      }
    });
  }

  // 행동하지 않은 턴 트리거
  registerInactiveTurnsTrigger(
    playerId: number,
    inactiveThreshold: number,
    effect: () => void
  ): void {
    const triggerId = `${playerId}_inactive_${inactiveThreshold}`;
    
    this.registerTrigger(triggerId, {
      condition: () => {
        const state = this.getPlayerState(playerId);
        return state.inactiveTurns >= inactiveThreshold;
      },
      effect,
      oncePerGame: false
    });
  }

  // 플레이어 행동 추적
  trackPlayerAction(playerId: number, actionType: ActionType): void {
    const state = this.getPlayerState(playerId);
    
    // 연속 행동 카운터 업데이트
    const currentCount = state.consecutiveActions.get(actionType) || 0;
    state.consecutiveActions.set(actionType, currentCount + 1);
    
    // 다른 행동 카운터 리셋
    for (const [otherAction, count] of state.consecutiveActions.entries()) {
      if (otherAction !== actionType) {
        state.consecutiveActions.set(otherAction, 0);
      }
    }

    // 행동하지 않은 턴 카운터 리셋
    state.inactiveTurns = 0;
  }

  // 플레이어 데미지 추적
  trackPlayerDamage(playerId: number, damage: number): void {
    const state = this.getPlayerState(playerId);
    state.cumulativeDamage += damage;
  }

  // 플레이어가 행동하지 않음을 추적
  trackPlayerInaction(playerId: number): void {
    const state = this.getPlayerState(playerId);
    state.inactiveTurns++;
  }

  // 모든 트리거 체크 및 실행
  checkAndExecuteTriggers(): void {
    for (const [triggerId, trigger] of this.triggers.entries()) {
      if (trigger.condition()) {
        trigger.effect();
        
        // 게임당 1회성 트리거면 제거
        if (trigger.oncePerGame) {
          this.triggers.delete(triggerId);
        }
      }
    }
  }

  // 턴 기반 트리거 체크
  checkTurnTriggers(currentTurn: number): void {
    this.currentTurn = currentTurn;
    
    for (const trigger of this.triggers.values()) {
      if (trigger.turnCheck) {
        trigger.turnCheck(currentTurn);
      }
    }
  }

  // 특정 플레이어의 트리거만 체크
  checkPlayerTriggers(playerId: number): void {
    for (const [triggerId, trigger] of this.triggers.entries()) {
      if (triggerId.startsWith(`${playerId}_`) && trigger.condition()) {
        trigger.effect();
        
        if (trigger.oncePerGame) {
          this.triggers.delete(triggerId);
        }
      }
    }
  }

  // 플레이어 상태 초기화
  resetPlayerState(playerId: number): void {
    this.playerStates.delete(playerId);
  }

  // 모든 상태 초기화
  resetAllStates(): void {
    this.playerStates.clear();
    this.triggers.clear();
  }

  // 플레이어 상태 조회
  getPlayerState(playerId: number): PlayerTriggerState {
    if (!this.playerStates.has(playerId)) {
      this.playerStates.set(playerId, {
        consecutiveActions: new Map(),
        cumulativeDamage: 0,
        inactiveTurns: 0
      });
    }
    return this.playerStates.get(playerId)!;
  }

  // 트리거 통계 조회
  getTriggerStats(): { totalTriggers: number; activeTriggers: number } {
    let activeTriggers = 0;
    
    for (const trigger of this.triggers.values()) {
      if (trigger.condition()) {
        activeTriggers++;
      }
    }
    
    return {
      totalTriggers: this.triggers.size,
      activeTriggers
    };
  }
}

interface ConditionalTrigger {
  condition: () => boolean;
  effect: () => void;
  oncePerGame: boolean;
  turnCheck?: (turn: number) => void;
}

interface PlayerTriggerState {
  consecutiveActions: Map<ActionType, number>;
  cumulativeDamage: number;
  inactiveTurns: number;
} 
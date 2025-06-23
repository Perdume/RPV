import { Player, ActionType, PlayerAction, ModifiableEvent } from '../types/game.types';

export class ActionManipulator {
  private failedActions: Map<number, Set<ActionType>> = new Map(); // 실패한 행동
  private sealedActions: Map<number, Set<ActionType>> = new Map(); // 봉인된 행동
  private redirectedTargets: Map<number, number> = new Map(); // 리다이렉트된 타겟
  private doubledActions: Set<number> = new Set(); // 2배 효과 플레이어
  private actionModifiers: Map<number, Map<string, any>> = new Map(); // 행동 수정자

  // 행동 실패 처리
  failAction(playerId: number, actionType: ActionType): void {
    if (!this.failedActions.has(playerId)) {
      this.failedActions.set(playerId, new Set());
    }
    this.failedActions.get(playerId)!.add(actionType);
  }

  // 행동 봉인
  sealAction(playerId: number, actionType: ActionType, duration: number = 1): void {
    if (!this.sealedActions.has(playerId)) {
      this.sealedActions.set(playerId, new Set());
    }
    this.sealedActions.get(playerId)!.add(actionType);
    
    // duration 턴 후 자동 해제
    setTimeout(() => {
      this.unsealAction(playerId, actionType);
    }, duration * 1000);
  }

  // 행동 봉인 해제
  unsealAction(playerId: number, actionType: ActionType): void {
    this.sealedActions.get(playerId)?.delete(actionType);
  }

  // 타겟 리다이렉트
  redirectTarget(playerId: number, newTargetId: number): void {
    this.redirectedTargets.set(playerId, newTargetId);
  }

  // 행동 값 2배 적용
  doubleActionValues(playerId: number): void {
    this.doubledActions.add(playerId);
  }

  // 행동 수정자 추가
  addActionModifier(playerId: number, modifierType: string, value: any): void {
    if (!this.actionModifiers.has(playerId)) {
      this.actionModifiers.set(playerId, new Map());
    }
    this.actionModifiers.get(playerId)!.set(modifierType, value);
  }

  // 행동 실행 전 검증
  validateAction(playerId: number, action: PlayerAction): ActionValidationResult {
    // 봉인된 행동 체크
    if (this.sealedActions.get(playerId)?.has(action.actionType)) {
      return { valid: false, reason: `${action.actionType} 행동이 봉인되었습니다.` };
    }

    // 실패 처리된 행동 체크
    if (this.failedActions.get(playerId)?.has(action.actionType)) {
      return { valid: false, reason: `${action.actionType} 행동이 실패했습니다.` };
    }

    return { valid: true };
  }

  // 행동 수정
  modifyAction(playerId: number, action: PlayerAction): PlayerAction {
    let modifiedAction = { ...action };

    // 타겟 리다이렉트
    const newTarget = this.redirectedTargets.get(playerId);
    if (newTarget !== undefined) {
      modifiedAction.targetId = newTarget;
    }

    // 행동 수정자 적용
    const modifiers = this.actionModifiers.get(playerId);
    if (modifiers) {
      for (const [modifierType, value] of modifiers.entries()) {
        switch (modifierType) {
          case 'damage_multiplier':
            modifiedAction.damage = (modifiedAction.damage || 1) * value;
            break;
          case 'defense_boost':
            modifiedAction.defenseGauge = (modifiedAction.defenseGauge || 0) + value;
            break;
          case 'evade_count':
            modifiedAction.evadeCount = (modifiedAction.evadeCount || 0) + value;
            break;
        }
      }
    }

    return modifiedAction;
  }

  // 행동 값 수정 (데미지, 방어 등)
  modifyActionValues(playerId: number, baseValue: number): number {
    if (this.doubledActions.has(playerId)) {
      return baseValue * 2;
    }
    return baseValue;
  }

  // 특정 플레이어의 모든 수정자 제거
  clearPlayerModifiers(playerId: number): void {
    this.failedActions.delete(playerId);
    this.sealedActions.delete(playerId);
    this.redirectedTargets.delete(playerId);
    this.doubledActions.delete(playerId);
    this.actionModifiers.delete(playerId);
  }

  // 턴 정리
  cleanupTurn(): void {
    this.failedActions.clear();
    this.redirectedTargets.clear();
    this.doubledActions.clear();
    this.actionModifiers.clear();
  }

  // 상태 조회
  getFailedActions(playerId: number): Set<ActionType> {
    return this.failedActions.get(playerId) || new Set();
  }

  getSealedActions(playerId: number): Set<ActionType> {
    return this.sealedActions.get(playerId) || new Set();
  }

  getRedirectedTarget(playerId: number): number | undefined {
    return this.redirectedTargets.get(playerId);
  }

  hasDoubledActions(playerId: number): boolean {
    return this.doubledActions.has(playerId);
  }
}

interface ActionValidationResult {
  valid: boolean;
  reason?: string;
} 
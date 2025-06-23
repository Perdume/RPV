export class GameLogger {
  private hiddenActions: Map<number, Set<number>> = new Map(); // 턴별 숨긴 플레이어
  private fakeActions: Map<number, Map<number, string>> = new Map(); // 가짜 행동
  private abilityReveals: Map<number, Set<number>> = new Map(); // 능력 사용 공개

  // 플레이어 행동을 로그에서 숨김
  hidePlayerAction(playerId: number, turn: number): void {
    if (!this.hiddenActions.has(turn)) {
      this.hiddenActions.set(turn, new Set());
    }
    this.hiddenActions.get(turn)!.add(playerId);
  }

  // 가짜 행동으로 기록
  recordFakeAction(playerId: number, turn: number, fakeAction: string): void {
    if (!this.fakeActions.has(turn)) {
      this.fakeActions.set(turn, new Map());
    }
    this.fakeActions.get(turn)!.set(playerId, fakeAction);
  }

  // 능력 사용을 전체 로그에 공개
  revealAbilityUse(playerId: number, turn: number): void {
    if (!this.abilityReveals.has(turn)) {
      this.abilityReveals.set(turn, new Set());
    }
    this.abilityReveals.get(turn)!.add(playerId);
  }

  // 로그 생성 시 조작 적용
  formatAction(action: any, turn: number): string {
    const playerId = action.playerId;

    // 숨겨진 행동
    if (this.hiddenActions.get(turn)?.has(playerId)) {
      return `${playerId}는 행동하지 않았습니다.`;
    }

    // 가짜 행동
    const fakeAction = this.fakeActions.get(turn)?.get(playerId);
    if (fakeAction) {
      return this.formatActionType(playerId, fakeAction, action.targetId);
    }

    // 능력 사용 공개
    if (this.abilityReveals.get(turn)?.has(playerId) && action.abilityId) {
      return `${playerId}가 ${action.abilityId} 능력을 사용했습니다! (타겟: ${action.targetId})`;
    }

    // 일반 행동
    return this.formatActionType(playerId, action.actionType, action.targetId);
  }

  private formatActionType(playerId: number, actionType: string, targetId: number): string {
    switch (actionType) {
      case 'ATTACK': return `${playerId}이(가) ${targetId}를 공격합니다.`;
      case 'DEFEND': return `${playerId}이(가) 방어합니다.`;
      case 'EVADE': return `${playerId}이(가) 회피합니다.`;
      case 'ABILITY': return `${playerId}이(가) 능력을 사용합니다.`;
      case 'PASS': return `${playerId}이(가) 행동을 패스합니다.`;
      default: return `${playerId}의 알 수 없는 행동입니다.`;
    }
  }

  // 턴 종료 시 해당 턴 데이터 정리
  cleanupTurn(turn: number): void {
    this.hiddenActions.delete(turn);
    this.fakeActions.delete(turn);
    this.abilityReveals.delete(turn);
  }
} 
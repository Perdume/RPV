import { BaseAbility } from './BaseAbility';
import { AbilityContext, Player, ModifiableEvent, AttackEvent } from '../types/game.types';

export class Confusion extends BaseAbility {
  private actionCount: Map<string, number> = new Map(); // 공격/방어/회피 행동 카운트
  private logManipulatedPlayers: Set<number> = new Set(); // 로그 조작된 플레이어들

  constructor() {
    super('confusion', '혼선', '대상의 행동을 조작하거나 자신에게 사용시 특수 효과를 발동합니다.', 0, 2);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    const targetId = parameters.targetId;
    if (!targetId) {
      return { success: false, message: '대상을 지정해야 합니다.' };
    }

    const target = context.players.find(p => p.id === targetId);
    if (!target) {
      return { success: false, message: '대상을 찾을 수 없습니다.' };
    }

    // 자신을 대상으로 하는 경우
    if (targetId === this.ownerId) {
      return await this.executeSelfTarget(context);
    } else {
      return await this.executeOtherTarget(context, target);
    }
  }

  private async executeSelfTarget(context: AbilityContext): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    // 로그에서 행동하지 않은 것으로 기록
    const turnProcessor = this.getTurnProcessor(context);
    if (turnProcessor) {
      turnProcessor.hidePlayerAction(this.ownerId!, context.currentTurn);
      this.logManipulatedPlayers.add(this.ownerId!);
    }

    // 이번 턴 모든 값 2배 적용
    this.setTurn('confusion_double_values', true, context.currentTurn);

    return {
      success: true,
      message: `${context.player.name}이(가) 혼선을 자신에게 사용합니다.`,
      target: this.ownerId!
    };
  }

  private async executeOtherTarget(context: AbilityContext, target: any): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    // 대상의 행동을 자신의 행동으로 변경
    const originalAction = target.actionType;
    const originalTarget = target.targetId;
    
    // 자신의 행동을 대상에게 복사
    const ownerPlayer = context.player;
    target.actionType = ownerPlayer.actionType;
    target.targetId = ownerPlayer.targetId;
    target.abilityId = ownerPlayer.abilityId;

    // 능력을 사용했다면 전체 로그에 나타내기
    if (ownerPlayer.abilityId) {
      const turnProcessor = this.getTurnProcessor(context);
      if (turnProcessor) {
        turnProcessor.revealAbilityUse(target.id, context.currentTurn);
      }
    }

    return {
      success: true,
      message: `${context.player.name}이(가) ${target.name}의 행동을 조작합니다.`,
      target: target.id
    };
  }

  // 행동 추적
  async onBeforeAction(event: ModifiableEvent): Promise<void> {
    const data = event.data as any;
    const playerId = data.playerId;
    const actionType = data.actionType;

    if (playerId === this.ownerId) {
      const currentCount = this.actionCount.get(actionType) || 0;
      this.actionCount.set(actionType, currentCount + 1);
    }
  }

  // 턴 종료시 사용 횟수 획득 체크
  async onTurnEnd(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    
    // 모든 행동을 1번씩 했는지 확인
    const attackCount = this.actionCount.get('ATTACK') || 0;
    const defendCount = this.actionCount.get('DEFEND') || 0;
    const evadeCount = this.actionCount.get('EVADE') || 0;

    if (attackCount >= 1 && defendCount >= 1 && evadeCount >= 1) {
      this.maxUses = Math.min(this.maxUses + 1, 2);
      this.actionCount.clear();
      console.log(`[혼선] 모든 행동 완료로 사용 횟수 획득: ${this.maxUses}`);
    }

    // 로그 조작된 플레이어들 정리
    this.logManipulatedPlayers.clear();
  }

  // 값 2배 적용 (자신을 대상으로 했을 때)
  async onBeforeAttack(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as any;
    
    if (this.getTurn('confusion_double_values', currentTurn) && data.attacker === this.ownerId) {
      data.damage = (data.damage || 1) * 2;
      event.modified = true;
      console.log(`[혼선] ${this.ownerId}의 공격 데미지가 2배로 증가: ${data.damage}`);
    }
  }

  async onBeforeDefend(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as any;
    
    if (this.getTurn('confusion_double_values', currentTurn) && data.player === this.ownerId) {
      data.defenseGauge = (data.defenseGauge || 1) * 2;
      event.modified = true;
      console.log(`[혼선] ${this.ownerId}의 방어 게이지가 2배로 증가: ${data.defenseGauge}`);
    }
  }

  async onBeforeEvade(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as any;
    
    if (this.getTurn('confusion_double_values', currentTurn) && data.player === this.ownerId) {
      data.chance = Math.min((data.chance || 50) * 2, 100); // 최대 100%
      event.modified = true;
      console.log(`[혼선] ${this.ownerId}의 회피 확률이 2배로 증가: ${data.chance}%`);
    }
  }

  private getTurnProcessor(context: AbilityContext): any {
    // TurnProcessor 인스턴스 접근 (의존성 주입 필요)
    return (context as any).turnProcessor;
  }

  // 로그 조작된 플레이어 확인
  isLogManipulated(playerId: number): boolean {
    return this.logManipulatedPlayers.has(playerId);
  }

  // 행동 카운트 조회
  getActionCount(actionType: string): number {
    return this.actionCount.get(actionType) || 0;
  }
} 
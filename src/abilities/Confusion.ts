import { BaseAbility } from './BaseAbility';
import { AbilityContext, Player, ModifiableEvent, AttackEvent } from '../types/game.types';

export class Confusion extends BaseAbility {
  private actionCount: Map<string, number> = new Map(); // 공격/방어/회피 행동 카운트

  constructor() {
    super('confusion', '혼선', '대상의 행동을 조작하거나 자신의 행동을 2배로 적용합니다.', 0, 2);
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

    if (targetId === this.ownerId) {
      // 자신을 대상으로 한 경우: 이번 턴 행동하지 않은 것으로 로그에 기록하고 모든 값 2배
      this.setTurn('action_hidden', true, context.currentTurn);
      this.setTurn('values_doubled', true, context.currentTurn);
      
      return {
        success: true,
        message: `${context.player.name}이(가) 자신에게 혼선을 발동합니다!`,
        target: context.player.id
      };
    } else {
      // 다른 플레이어를 대상으로 한 경우: 대상의 행동을 자신의 행동으로 변경
      this.setTurn('action_swap', true, context.currentTurn);
      this.setSession('swap_target', targetId);
      
      return {
        success: true,
        message: `${context.player.name}이(가) ${target.name}에게 혼선을 발동합니다!`,
        target: targetId
      };
    }
  }

  // 패시브: 공격/방어/회피 행동을 전부 1번씩 할 때마다 사용 가능 횟수를 1회 얻음
  async onTurnEnd(event: ModifiableEvent): Promise<void> {
    const player = this.getOwnerPlayer();
    if (!player) return;

    // 현재 행동 카운트 업데이트
    const actionType = player.actionType;
    if (actionType === 'ATTACK' || actionType === 'DEFEND' || actionType === 'EVADE') {
      const currentCount = this.actionCount.get(actionType) || 0;
      this.actionCount.set(actionType, currentCount + 1);
    }

    // 모든 행동을 1번씩 했는지 확인
    const attackCount = this.actionCount.get('ATTACK') || 0;
    const defendCount = this.actionCount.get('DEFEND') || 0;
    const evadeCount = this.actionCount.get('EVADE') || 0;

    if (attackCount >= 1 && defendCount >= 1 && evadeCount >= 1) {
      this.maxUses = Math.min(this.maxUses + 1, 2);
      console.log(`[혼선] ${this.ownerId} 모든 행동 완료로 사용 횟수 1회 획득`);
      
      // 카운트 리셋
      this.actionCount.clear();
    }
  }

  // 대상의 행동을 자신의 행동으로 변경
  async onBeforeAction(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const swapTarget = this.getSession('swap_target') as number;
    
    if (this.getTurn('action_swap', currentTurn) && swapTarget) {
      const data = event.data as any;
      if (data.playerId === swapTarget) {
        // 대상의 행동을 자신의 행동으로 변경
        const targetAction = data.actionType;
        const targetTargetId = data.targetId;
        
        // 자신의 행동을 대상의 행동으로 설정
        const ownerPlayer = this.getOwnerPlayer();
        if (ownerPlayer) {
          ownerPlayer.actionType = targetAction;
          ownerPlayer.targetId = targetTargetId;
          
          // 능력을 사용했다면 전체 로그에 나타냄
          if (data.abilityId) {
            const turnProcessor = this.getTurnProcessor();
            if (turnProcessor) {
              turnProcessor.revealAbilityUse(swapTarget, currentTurn);
            }
          }
          
          console.log(`[혼선] ${swapTarget}의 행동을 ${this.ownerId}에게 적용`);
        }
      }
    }
  }

  // 자신의 행동을 2배로 적용
  async onBeforeAttack(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as AttackEvent;
    
    if (this.getTurn('values_doubled', currentTurn) && data.attacker === this.ownerId) {
      data.newDamage = (data.newDamage || data.damage) * 2;
      event.modified = true;
      console.log(`[혼선] ${this.ownerId} 공격 피해 2배 적용: ${data.newDamage}`);
    }
  }

  // 행동을 로그에서 숨김
  async onAfterAction(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as any;
    
    if (this.getTurn('action_hidden', currentTurn) && data.playerId === this.ownerId) {
      const turnProcessor = this.getTurnProcessor();
      if (turnProcessor) {
        turnProcessor.hidePlayerAction(this.ownerId!, currentTurn);
        console.log(`[혼선] ${this.ownerId}의 행동이 로그에서 숨겨짐`);
      }
    }
  }

  private getTurnProcessor(): any {
    // TurnProcessor 인스턴스 접근 (의존성 주입 필요)
    return null; // 실제 구현에서는 의존성 주입으로 해결
  }
} 
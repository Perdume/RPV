import { BaseAbility } from './BaseAbility';
import { AbilityContext, TypedModifiableEvent, TurnStartEvent } from '../types/game.types';

export class SniperRifle extends BaseAbility {
  constructor() {
    super('sniperRifle', 'HS.50 대물 저격소총', '공격 타겟의 행동에 따라 다양한 효과를 적용합니다.', 0, 3);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    const targetId = parameters.targetId || context.target?.id;
    
    if (!targetId) {
      return { success: false, message: '대상을 지정해야 합니다.' };
    }

    const target = context.players.find(p => p.id === targetId);
    if (!target) {
      return { success: false, message: '대상을 찾을 수 없습니다.' };
    }

    // 타겟의 행동에 따라 효과 적용
    switch (target.actionType) {
      case 'ATTACK':
        // 공격을 행동할 경우: 타겟이 공격하는 그 대상에게까지 1의 피해를 연쇄적으로 가함
        const chainTargetId = target.targetId;
        if (chainTargetId) {
          const chainTarget = context.players.find(p => p.id === chainTargetId);
          if (chainTarget) {
            return {
              success: true,
              message: `${context.player.name}이(가) ${target.name}을 통해 ${chainTarget.name}에게 연쇄 공격을 가합니다!`,
              damage: 1,
              target: chainTargetId
            };
          }
        }
        return {
          success: true,
          message: `${context.player.name}이(가) ${target.name}에게 저격을 가합니다!`,
          damage: 1,
          target: targetId
        };
        
      case 'DEFEND':
      case 'EVADE':
        // 방어/회피를 행동할 경우: 타겟에게 "균열"을 가하고, 다음 턴 타겟의 능력을 봉인
        if (context.statusEffectManager) {
          context.statusEffectManager.applyStatusEffect(targetId, {
            id: 'crack',
            name: '균열',
            description: '턴 종료시 수치가 3 이상이라면 피해를 1 받고 제거됩니다.',
            duration: 3,
            stacks: 1,
            stackable: true,
            type: 'debuff'
          });
        }
        
        // 다음 턴 능력 봉인 플래그 설정
        this.setSession('sealAbility', { targetId, turn: context.currentTurn + 1 });
        
        return {
          success: true,
          message: `${context.player.name}이(가) ${target.name}에게 균열을 가하고 능력을 봉인합니다!`,
          target: targetId
        };
        
      case 'ABILITY':
        // 능력을 사용했을 경우: 타겟의 능력 사용이 전체 로그에 나타나며, 자신은 체력을 1 회복
        return {
          success: true,
          message: `${context.player.name}이(가) ${target.name}의 능력 사용을 감지하고 체력을 회복합니다!`,
          heal: 1,
          target: context.player.id
        };
        
      default:
        return {
          success: true,
          message: `${context.player.name}이(가) ${target.name}을 저격합니다!`,
          damage: 1,
          target: targetId
        };
    }
  }

  // 게임 시작 후 5번째 턴 시작시, 사용 가능 횟수를 최대치로 재충전
  async onTurnStart(event: TypedModifiableEvent<TurnStartEvent>): Promise<void> {
    const turn = event.data.turn;
    if (turn === 5) {
      this.maxUses = 3;
      console.log(`[저격소총] 5턴 시작시 사용 횟수 재충전: ${this.maxUses}`);
    }
  }
} 
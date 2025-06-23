import { BaseAbility } from './BaseAbility';
import { AbilityContext, Player, ModifiableEvent, AttackEvent } from '../types/game.types';

export class WillLoss extends BaseAbility {
  constructor() {
    super('willLoss', '전의 상실', '대상에게 전의 상실 상태이상을 부여합니다.', 0, 2);
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

    // 전의 상실 상태이상 부여
    this.applyStatusEffect(targetId, 'will_loss', -1, 1); // 영구 지속

    return {
      success: true,
      message: `${context.player.name}이(가) ${target.name}에게 전의 상실을 부여합니다!`,
      target: targetId
    };
  }

  // 패시브: 턴 시작시 모든 효과 적용
  async onTurnStart(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    
    // 패시브 1: 3의 배수 턴 시작시마다, "전의 상실" 상태이상을 가진 플레이어는 "가하는 피해 1 감소" 또는 "받는 피해 1 증가"를 얻음
    if (currentTurn % 3 === 0) {
      const players = this.getSession('players') as Player[] || [];
      
      for (const player of players) {
        const hasWillLoss = this.hasStatusEffect(player.id, 'will_loss');
        if (hasWillLoss) {
          // 50% 확률로 가하는 피해 1 감소 또는 받는 피해 1 증가
          const effect = Math.random() < 0.5 ? 'damage_reduction' : 'damage_increase';
          this.applyStatusEffect(player.id, effect, 1, 1);
          
          console.log(`[전의 상실] ${player.name} ${currentTurn}턴에 ${effect} 상태이상 부여`);
        }
      }
    }
    
    // 패시브 2: 짝수 턴 시작시마다, 자신의 사용 가능 횟수가 0이라면 1을 얻음
    if (currentTurn % 2 === 0 && this.maxUses === 0) {
      this.maxUses = 1;
      console.log(`[전의 상실] ${this.ownerId} 짝수 턴으로 사용 횟수 1회 획득`);
    }
  }
} 
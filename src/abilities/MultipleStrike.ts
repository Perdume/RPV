import { BaseAbility } from './BaseAbility';
import { AbilityContext, TypedModifiableEvent, TurnStartEvent } from '../types/game.types';

export class MultipleStrike extends BaseAbility {
  constructor() {
    super('multipleStrike', '다중 타격', '대상을 지정하여 추가 공격을 행동합니다.', 0, 3);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    const targetId = parameters.targetId || context.target?.id;
    
    // 대상이 지정되지 않은 경우, 방어/회피를 사용하지 않은 무작위 플레이어 선택
    let finalTargetId = targetId;
    if (!finalTargetId) {
      const availableTargets = context.players.filter(p => 
        p.id !== context.player.id && 
        p.status !== 'DEAD' && 
        !p.hasDefended && 
        p.actionType !== 'EVADE'
      );
      
      if (availableTargets.length === 0) {
        return { success: false, message: '공격할 수 있는 대상이 없습니다.' };
      }
      
      const randomIndex = Math.floor(Math.random() * availableTargets.length);
      finalTargetId = availableTargets[randomIndex].id;
    }

    const target = context.players.find(p => p.id === finalTargetId);
    if (!target) {
      return { success: false, message: '대상을 찾을 수 없습니다.' };
    }

    // 추가 공격 데미지
    const damage = 1;
    
    return {
      success: true,
      message: `${context.player.name}이(가) ${target.name}에게 추가 공격을 가합니다!`,
      damage,
      target: finalTargetId
    };
  }

  // 게임 시작 후 5번째 턴 시작시 사용 가능 횟수를 1 얻습니다.
  async onTurnStart(event: TypedModifiableEvent<TurnStartEvent>): Promise<void> {
    const turn = event.data.turn;
    if (turn === 5) {
      this.maxUses++;
      console.log(`[다중 타격] 5턴 시작시 사용 횟수 증가: ${this.maxUses}`);
    }
  }
} 
import { BaseAbility } from './BaseAbility';
import { AbilityContext, TypedModifiableEvent, TurnStartEvent, PlayerStatus } from '../types/game.types';

export class MultipleStrike extends BaseAbility {
  constructor() {
    super('multipleStrike', '다중 타격', '대상을 지정하여 추가 공격을 행동합니다.', 0, 3);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    const targetId = parameters.targetId;
    let finalTarget: any = null;

    if (targetId) {
      // 대상 지정시: 해당 대상을 추가 공격
      finalTarget = context.players.find(p => p.id === targetId) || null;
    } else {
      // 대상 비지정시: 방어/회피 사용하지 않은 무작위 플레이어
      const availableTargets = context.players.filter(p => 
        p.id !== context.player.id && 
        p.status === PlayerStatus.ALIVE &&
        !p.hasDefended && 
        p.actionType !== 'EVADE'
      );
      
      if (availableTargets.length > 0) {
        finalTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
      }
    }

    if (!finalTarget) {
      return { success: false, message: '공격할 대상이 없습니다.', damage: 0, heal: 0, death: false };
    }

    // 추가 공격 실행
    const damage = 1;
    finalTarget.hp = Math.max(0, finalTarget.hp - damage);
    finalTarget.wasAttacked = true;

    // 사망 체크
    const death = finalTarget.hp <= 0;
    if (death) {
      finalTarget.status = PlayerStatus.DEAD;
    }

    return {
      success: true,
      message: `${context.player.name}이(가) ${finalTarget.name}에게 추가 공격을 가합니다!`,
      damage,
      heal: 0,
      death,
      target: finalTarget.id
    };
  }

  // 패시브: 5턴 시작시 사용 횟수 +1
  async onTurnStart(event: TypedModifiableEvent<TurnStartEvent>): Promise<void> {
    const turnData = event.data;
    if (turnData.turn === 5) {
      this.maxUses = Math.min(this.maxUses + 1, 3);
      console.log(`[다중 타격] 5턴 시작으로 사용 횟수 증가: ${this.maxUses}`);
    }
  }
} 
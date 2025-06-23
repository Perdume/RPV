import { BaseAbility } from './BaseAbility';
import { AbilityContext, Player, ModifiableEvent, AttackEvent } from '../types/game.types';

export class EndOfDestruction extends BaseAbility {
  private doomSignStacks: number = 0;

  constructor() {
    super('endOfDestruction', '끝의 파멸', '파멸의 징조를 소모하여 강력한 효과를 발동합니다.', 0, 3);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    // 파멸의 징조 스택 수 확인
    const doomSignEffect = this.getStatusEffect(this.ownerId!, 'doom_sign');
    this.doomSignStacks = doomSignEffect ? doomSignEffect.stacks : 0;

    if (this.doomSignStacks === 0) {
      return { success: false, message: '파멸의 징조가 없습니다.' };
    }

    // 파멸의 징조 소모
    this.removeStatusEffect(this.ownerId!, 'doom_sign');

    // 이번 턴 효과 적용
    this.setTurn('additional_targets', this.doomSignStacks, context.currentTurn);
    this.setTurn('damage_boost', Math.min(this.doomSignStacks, 5), context.currentTurn);
    this.setTurn('heal_amount', Math.ceil(this.doomSignStacks / 2), context.currentTurn);

    return {
      success: true,
      message: `${context.player.name}이(가) 파멸의 징조 ${this.doomSignStacks}개를 소모하여 끝의 파멸을 발동합니다!`,
      target: context.player.id
    };
  }

  // 패시브: 공격 행동을 하지 않을 때마다 파멸의 징조 1 얻기
  async onTurnEnd(event: ModifiableEvent): Promise<void> {
    const player = this.getOwnerPlayer();
    if (player && player.actionType !== 'ATTACK') {
      this.applyStatusEffect(this.ownerId!, 'doom_sign', 1, 1);
      console.log(`[끝의 파멸] ${player.name} 공격하지 않아 파멸의 징조 1 획득`);
    }
  }

  // 패시브: 공격 행동시 파멸의 징조 초기화
  async onBeforeAttack(event: ModifiableEvent): Promise<void> {
    const data = event.data as AttackEvent;
    if (data.attacker === this.ownerId) {
      this.removeStatusEffect(this.ownerId!, 'doom_sign');
      console.log(`[끝의 파멸] ${this.ownerId} 공격으로 파멸의 징조 초기화`);
    }
  }

  // 추가 타겟 지정 가능
  getAdditionalTargets(): number {
    const currentTurn = this.getSession('current_turn') as number || 0;
    return this.getTurn('additional_targets', currentTurn) || 0;
  }

  // 피해 증가량
  getDamageBoost(): number {
    const currentTurn = this.getSession('current_turn') as number || 0;
    return this.getTurn('damage_boost', currentTurn) || 0;
  }

  // 회복량
  getHealAmount(): number {
    const currentTurn = this.getSession('current_turn') as number || 0;
    return this.getTurn('heal_amount', currentTurn) || 0;
  }
} 
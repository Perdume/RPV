import { BaseAbility } from './BaseAbility';
import { AbilityContext, TypedModifiableEvent, TurnStartEvent, AttackEvent, StatusEffectEvent } from '../types/game.types';

export class Quantumization extends BaseAbility {
  constructor() {
    super('quantumization', '양자화', '이번 턴, 자신의 모든 부정적 상태이상을 제거하며 특수 효과를 얻습니다.', 0, 3);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    // 이 능력은 봉인된 상태에서도 사용할 수 있습니다
    if (!this.isActive) {
      return { success: false, message: '능력이 봉인되어 사용할 수 없습니다.' };
    }

    // 부정적 상태이상 제거
    if (context.statusEffectManager) {
      const negativeEffects = context.statusEffectManager.getPlayerStatusEffects(context.player.id)
        .filter((effect: any) => effect.type === 'debuff');
      
      for (const effect of negativeEffects) {
        context.statusEffectManager.removeStatusEffect(context.player.id, effect.id);
      }
    }

    // 이번 턴 특수 효과 적용
    this.setTurn('quantumization_active', true, context.currentTurn);
    this.setTurn('ability_immunity', true, context.currentTurn);
    this.setTurn('attack_penetration', true, context.currentTurn);

    return {
      success: true,
      message: `${context.player.name}이(가) 양자화를 발동하여 모든 부정적 상태이상을 제거하고 특수 효과를 얻습니다!`,
      target: context.player.id
    };
  }

  // 다른 플레이어들이 사용한 능력의 영향을 받지 않습니다
  async onStatusEffectApplied(event: TypedModifiableEvent<StatusEffectEvent>): Promise<void> {
    // 현재 턴 정보를 세션에서 가져오기
    const currentTurn = (this.getSession('current_turn') as number) || 0;
    if (this.getTurn('ability_immunity', currentTurn)) {
      event.cancelled = true;
      console.log(`[양자화] ${this.ownerId}는 능력 면역으로 상태이상 적용을 무시합니다.`);
    }
  }

  // 자신의 공격 행동은 타겟의 방어/회피 행동 및 받는 피해 감소 계열 효과를 무시합니다
  async onBeforeAttack(event: TypedModifiableEvent<AttackEvent>): Promise<void> {
    // 현재 턴 정보를 세션에서 가져오기
    const currentTurn = (this.getSession('current_turn') as number) || 0;
    if (this.getTurn('attack_penetration', currentTurn) && event.data.attacker === this.ownerId) {
      event.data.ignoreDefense = true;
      event.data.ignoreEvade = true;
      event.data.ignoreDamageReduction = true;
      console.log(`[양자화] ${this.ownerId}의 공격이 모든 방어 효과를 무시합니다.`);
    }
  }
} 
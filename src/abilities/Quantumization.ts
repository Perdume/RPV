import { BaseAbility } from './BaseAbility';
import { AbilityContext, TypedModifiableEvent, TurnStartEvent, AttackEvent, StatusEffectEvent, StatusEffectId } from '../types/game.types';

export class Quantumization extends BaseAbility {
  constructor() {
    super('quantumization', '양자화', '봉인된 상태에서도 사용 가능한 특수 능력입니다.', 0, 3);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    const player = context.player;

    // 모든 부정적 상태이상 제거
    const negativeEffects = context.statusEffectManager.getPlayerStatusEffects(player.id)
      .filter((effect: any) => effect.type === 'debuff');
    
    negativeEffects.forEach((effect: any) => {
      context.statusEffectManager.removeStatusEffect(player.id, effect.id as StatusEffectId);
    });

    // 이번 턴 특수 효과 적용
    this.setTurn('ability_immunity', true, context.currentTurn);
    this.setTurn('defense_penetration', true, context.currentTurn);

    return {
      success: true,
      message: `${player.name}이(가) 양자화를 발동하여 모든 부정적 상태이상을 제거합니다!`,
      damage: 0,
      heal: 0,
      death: false,
      target: player.id
    };
  }

  // 다른 능력의 영향을 받지 않음
  async onBeforeStatusEffectApplied(event: TypedModifiableEvent<StatusEffectEvent>): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    if (this.getTurn('ability_immunity', currentTurn) && event.data.targetId === this.ownerId) {
      event.cancelled = true;
      console.log(`[양자화] ${this.ownerId}는 능력 면역으로 상태이상을 무시합니다.`);
    }
  }

  // 공격 시 방어/회피 무시
  async onBeforeAttack(event: TypedModifiableEvent<AttackEvent>): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    if (this.getTurn('defense_penetration', currentTurn) && event.data.attacker === this.ownerId) {
      event.data.ignoreDefense = true;
      event.data.ignoreEvade = true;
      event.data.ignoreDamageReduction = true;
      console.log(`[양자화] ${this.ownerId}의 공격이 모든 방어 효과를 무시합니다.`);
    }
  }

  // 🆕 봉인 상태에서도 사용 가능
  protected canUseAbility(context: AbilityContext): boolean {
    // 기본 체크는 무시하고 활성 상태와 사용 횟수만 체크
    return this.isActive && this.maxUses > 0;
  }
} 
import { AbilityRegistry } from './AbilityRegistry';
AbilityRegistry.register('quantumization', () => new Quantumization(), ['양자화']);

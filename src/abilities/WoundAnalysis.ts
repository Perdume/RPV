import { BaseAbility } from './BaseAbility';
import { AbilityContext, Player, ModifiableEvent, AttackEvent } from '../types/game.types';

export class WoundAnalysis extends BaseAbility {
  constructor() {
    super('woundAnalysis', '상처 파악', '균열과 상호작용하는 능력입니다.', 0, 3);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    // 이번 턴 효과 적용
    this.setTurn('crack_on_attack', true, context.currentTurn);
    this.setTurn('crack_damage_boost', true, context.currentTurn);
    this.setTurn('crack_heal', true, context.currentTurn);

    return {
      success: true,
      message: `${context.player.name}이(가) 상처 파악을 발동합니다!`,
      target: context.player.id
    };
  }

  // 패시브: 공격 성공시 타겟에게 균열이 있다면 균열 1 추가
  async onAfterAttack(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getCurrentTurn();
    const data = event.data as AttackEvent;
    if (this.getTurn('crack_on_attack', currentTurn) && data.attacker === this.ownerId && data.attackSuccess) {
      const target = data.targetPlayer;
      if (target) {
        // 타겟에게 균열이 있는지 확인
        const hasCrack = target.statusEffects.some((effect: any) => effect.id === 'crack');
        if (hasCrack) {
          // 균열 1 추가 (최대 3개까지만)
          const crackEffect = target.statusEffects.find((effect: any) => effect.id === 'crack');
          if (crackEffect && crackEffect.stacks < 3) {
            crackEffect.stacks = Math.min(crackEffect.stacks + 1, 3);
            console.log(`[상처 파악] ${target.name}에게 균열 1 추가: ${crackEffect.stacks}`);
          }
        }
      }
    }
  }

  // 패시브: 자신에게 균열이 있다면 균열 1 얻고 가하는 피해 1 증가
  async onBeforeAttack(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getCurrentTurn();
    const data = event.data as AttackEvent;
    if (this.getTurn('crack_damage_boost', currentTurn) && data.attacker === this.ownerId) {
      const attacker = this.getOwnerPlayer();
      if (attacker) {
        const hasCrack = attacker.statusEffects.some((effect: any) => effect.id === 'crack');
        if (hasCrack) {
          // 균열 1 추가
          const crackEffect = attacker.statusEffects.find((effect: any) => effect.id === 'crack');
          if (crackEffect) {
            crackEffect.stacks = Math.min(crackEffect.stacks + 1, 3);
          }
          
          // 가하는 피해 1 증가
          data.newDamage = (data.newDamage || data.damage) + 1;
          event.modified = true;
          
          console.log(`[상처 파악] ${attacker.name} 균열로 피해 증가: ${data.newDamage}`);
        }
      }
    }
  }

  // 패시브: 자신이 균열로 피해를 받았다면 체력 1 회복
  async onAfterDamage(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getCurrentTurn();
    const data = event.data as AttackEvent;
    if (this.getTurn('crack_heal', currentTurn) && data.target !== null && data.target === this.ownerId && data.damage > 0) {
      const target = this.getOwnerPlayer();
      if (target) {
        // 균열로 인한 피해인지 확인 (간단히 균열이 있는 상태에서 피해를 받으면)
        const hasCrack = target.statusEffects.some((effect: any) => effect.id === 'crack');
        if (hasCrack) {
          target.hp = Math.min(target.maxHp, target.hp + 1);
          console.log(`[상처 파악] ${target.name} 균열 피해로 체력 1 회복: ${target.hp}`);
        }
      }
    }
  }

  private getCurrentTurn(): number {
    return (this.getSession('current_turn') as number) || 0;
  }
} 
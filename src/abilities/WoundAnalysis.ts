import { BaseAbility } from './BaseAbility';
import { AbilityContext, TypedModifiableEvent, TurnStartEvent, AttackEvent } from '../types/game.types';

export class WoundAnalysis extends BaseAbility {
  constructor() {
    super('woundAnalysis', '상처 파악', '이번 턴 이하의 효과를 얻습니다. 공격 성공시 "균열"을 1 가합니다. 자신에게 "균열"이 있다면, "균열"을 1 얻고 가하는 피해가 1 증가합니다. 자신이 "균열"로 피해를 받았다면, 체력을 1 회복합니다.', 0, 3);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    // 이번 턴 효과 적용
    this.setTurn('wound_analysis_active', true, context.currentTurn);
    this.setTurn('crack_damage_boost', true, context.currentTurn);
    this.setTurn('crack_heal_ready', true, context.currentTurn);

    return {
      success: true,
      message: `${this.name} 능력을 사용했습니다. 이번 턴 균열 관련 효과가 활성화됩니다.`,
      damage: 0,
      heal: 0,
      death: false
    };
  }

  // 공격 성공시 타겟에게 "균열" 상태이상이 있다면 "균열"을 1회 가합니다
  async onAfterAttack(event: TypedModifiableEvent<AttackEvent>): Promise<void> {
    if (event.data.attacker === this.ownerId && event.data.attackSuccess) {
      const target = event.data.targetPlayer;
      if (target && this.hasStatusEffect(target.id, 'crack')) {
        // 균열 1 추가
        this.applyStatusEffect(target.id, {
          id: 'crack',
          name: '균열',
          description: '턴 종료시 수치가 3 이상이라면 피해를 1 받고 제거됩니다.',
          duration: 3,
          stackable: true,
          type: 'debuff'
        });
        console.log(`[상처 파악] ${this.ownerId}이(가) ${target.id}에게 균열을 추가로 가합니다!`);
      }
    }
  }

  // 자신에게 "균열"이 있다면, "균열"을 1 얻고 가하는 피해가 1 증가합니다
  async onBeforeAttack(event: TypedModifiableEvent<AttackEvent>): Promise<void> {
    if (this.getTurn('crack_damage_boost', event.data.turn) && event.data.attacker === this.ownerId) {
      if (this.hasStatusEffect(this.ownerId, 'crack')) {
        // 균열 1 추가
        this.applyStatusEffect(this.ownerId, {
          id: 'crack',
          name: '균열',
          description: '턴 종료시 수치가 3 이상이라면 피해를 1 받고 제거됩니다.',
          duration: 3,
          stackable: true,
          type: 'debuff'
        });
        
        // 피해 1 증가
        event.data.newDamage = (event.data.newDamage || event.data.damage) + 1;
        console.log(`[상처 파악] ${this.ownerId}이(가) 균열로 인해 피해가 1 증가합니다!`);
      }
    }
  }

  // 자신이 "균열"로 피해를 받았다면, 체력을 1 회복합니다
  async onAfterDamage(event: any): Promise<void> {
    if (this.getTurn('crack_heal_ready', event.data.turn) && event.data.target === this.ownerId) {
      const crackEffect = this.getStatusEffect(this.ownerId, 'crack');
      if (crackEffect && (crackEffect.stacks || 0) >= 3) {
        // 체력 1 회복
        const player = event.data.players?.find((p: any) => p.id === this.ownerId);
        if (player) {
          player.hp = Math.min(player.maxHp, player.hp + 1);
          console.log(`[상처 파악] ${this.ownerId}이(가) 균열 피해로 인해 체력을 1 회복합니다!`);
        }
      }
    }
  }

  // 패시브: 공격 성공시 타겟에게 "균열" 상태이상이 있다면 "균열"을 1회 가합니다
  async onAttackSuccess(event: any): Promise<void> {
    if (event.data.attacker === this.ownerId) {
      const target = event.data.target;
      if (this.hasStatusEffect(target, 'crack')) {
        // 균열 1 추가 (중복 방지)
        const existingCrack = this.getStatusEffect(target, 'crack');
        if (existingCrack && (existingCrack.stacks || 0) < 3) {
          this.applyStatusEffect(target, {
            id: 'crack',
            name: '균열',
            description: '턴 종료시 수치가 3 이상이라면 피해를 1 받고 제거됩니다.',
            duration: 3,
            stackable: true,
            type: 'debuff'
          });
          console.log(`[상처 파악] ${this.ownerId}이(가) ${target}에게 균열을 추가로 가합니다!`);
        }
      }
    }
  }
} 
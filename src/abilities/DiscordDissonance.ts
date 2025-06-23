import { BaseAbility } from './BaseAbility';
import { AbilityContext, TypedModifiableEvent, TurnStartEvent, AttackEvent } from '../types/game.types';

export class DiscordDissonance extends BaseAbility {
  constructor() {
    super('discordDissonance', '불협화음', '이번 턴 이하의 효과를 적용합니다. 받는 피해가 1 감소합니다. 공격 타겟이 공격 행동을 했다면, 그 대상을 자신에게로 옮깁니다. 재사용 기간에 상관없이 즉시 패시브를 활성화시킵니다. 공격 타겟이 공격 외의 행동을 했다면 능력 사용 횟수를 1회 돌려받습니다.', 0, 2);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    // 이번 턴 효과 적용
    this.setTurn('dissonance_active', true, context.currentTurn);
    this.setTurn('damage_reduction', 1, context.currentTurn);
    this.setTurn('target_redirect', true, context.currentTurn);
    this.setTurn('passive_activation', true, context.currentTurn);

    return {
      success: true,
      message: `${this.name} 능력을 사용했습니다. 이번 턴 불협화음이 활성화됩니다.`,
      damage: 0,
      heal: 0,
      death: false
    };
  }

  // 패시브: 자신을 공격한 플레이어가 2명 이상이라면, 그 공격의 타겟들은 해당 플레이어들끼리 내림차순으로 공격하도록 변경됩니다
  async onBeforeAttack(event: TypedModifiableEvent<AttackEvent>): Promise<void> {
    if (event.data.target === this.ownerId) {
      const attackers = this.getSession('attackers') as number[] || [];
      attackers.push(event.data.attacker);
      this.setSession('attackers', attackers);
      
      if (attackers.length >= 2) {
        // 내림차순으로 정렬하여 서로 공격하도록 변경
        attackers.sort((a, b) => b - a);
        for (let i = 0; i < attackers.length - 1; i++) {
          const currentAttacker = attackers[i];
          const nextTarget = attackers[i + 1];
          // 타겟 변경 로직 (TurnProcessor에서 처리)
          console.log(`[불협화음] ${currentAttacker}의 타겟이 ${nextTarget}로 변경됩니다!`);
        }
      }
    }
  }

  // 받는 피해가 1 감소합니다
  async onBeforeDamage(event: any): Promise<void> {
    if (this.getTurn('damage_reduction', this.getCurrentTurn()) && event.data.target === this.ownerId) {
      event.data.newDamage = Math.max(0, (event.data.newDamage || event.data.damage) - 1);
      console.log(`[불협화음] ${this.ownerId}이(가) 받는 피해가 1 감소합니다!`);
    }
  }

  // 공격 타겟이 공격 행동을 했다면, 그 대상을 자신에게로 옮깁니다
  async onAfterAttack(event: TypedModifiableEvent<AttackEvent>): Promise<void> {
    if (this.getTurn('target_redirect', this.getCurrentTurn()) && event.data.attacker === this.ownerId) {
      const target = event.data.targetPlayer;
      if (target && target.actionType === 'ATTACK') {
        // 타겟을 자신으로 변경
        event.data.newTarget = this.ownerId;
        console.log(`[불협화음] ${this.ownerId}이(가) ${target.id}의 타겟을 자신으로 변경합니다!`);
      }
    }
  }

  // 공격 타겟이 공격 외의 행동을 했다면 능력 사용 횟수를 1회 돌려받습니다
  async onAfterAttack(event: TypedModifiableEvent<AttackEvent>): Promise<void> {
    if (this.getTurn('passive_activation', this.getCurrentTurn()) && event.data.attacker === this.ownerId) {
      const target = event.data.targetPlayer;
      if (target && target.actionType !== 'ATTACK') {
        // 능력 사용 횟수 1회 회복
        this.maxUses = Math.min(this.maxUses + 1, 3);
        console.log(`[불협화음] ${this.ownerId}이(가) 능력 사용 횟수를 1회 회복합니다!`);
      }
    }
  }

  private getCurrentTurn(): number {
    return (this.getSession('current_turn') as number) || 0;
  }
} 
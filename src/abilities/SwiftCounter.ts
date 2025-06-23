import { BaseAbility } from './BaseAbility';
import { AbilityContext } from '../types/game.types';

export class SwiftCounter extends BaseAbility {
  constructor() {
    super('swiftCounter', '날렵한 반격', '이번 턴 받는 피해를 감소시키고 회피 확률을 100%로 고정하며 반격을 수행합니다.', 0, 3);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    // 이번 턴 효과 적용
    this.setTurn('swift_counter_active', true, context.currentTurn);
    this.setTurn('damage_reduction', 1, context.currentTurn);
    this.setTurn('evasion_100', true, context.currentTurn);
    this.setTurn('counter_attack_ready', true, context.currentTurn);

    return {
      success: true,
      message: `${context.player.name}이(가) 날렵한 반격을 준비합니다!`,
      target: context.player.id
    };
  }

  // 받는 피해가 1 감소합니다
  async onBeforeAttack(event: any): Promise<void> {
    if (this.getTurn('damage_reduction', event.data.turn) && event.data.target === this.ownerId) {
      event.data.damage = Math.max(1, event.data.damage - 1);
      console.log(`[날렵한 반격] ${this.ownerId}의 받는 피해가 1 감소합니다.`);
    }
  }

  // 회피 확률이 100%로 고정되며 회피 카운트가 증가하지 않습니다
  async onBeforeEvade(event: any): Promise<void> {
    if (this.getTurn('evasion_100', event.data.turn) && event.data.player === this.ownerId) {
      event.data.evadeChance = 100;
      event.data.noEvadeCountIncrease = true;
      console.log(`[날렵한 반격] ${this.ownerId}의 회피 확률이 100%로 고정됩니다.`);
    }
  }

  // 자신을 공격한 플레이어가 1명이라면, 해당 플레이어에게 1의 피해를 가합니다
  // 자신을 공격한 플레이어가 2명 이상이라면, 해당 플레이어들에게 "균열" 상태이상을 가하고 다음 턴 능력을 봉인합니다
  async onAfterAttack(event: any): Promise<void> {
    if (this.getTurn('counter_attack_ready', event.data.turn) && event.data.target === this.ownerId) {
      const attackerId = event.data.attacker;
      
      // 이번 턴에 자신을 공격한 플레이어 수 확인
      const attackCount = (this.getTurn('attack_count', event.data.turn) as number) || 0;
      this.setTurn('attack_count', attackCount + 1, event.data.turn);
      
      if (attackCount === 0) {
        // 첫 번째 공격자에게 1의 피해
        console.log(`[날렵한 반격] ${this.ownerId}이(가) ${attackerId}에게 반격을 가합니다!`);
        // 실제 반격 로직은 TurnProcessor에서 처리
      } else if (attackCount >= 1) {
        // 두 번째 이상의 공격자들에게 균열 상태이상
        if (event.statusEffectManager) {
          event.statusEffectManager.applyStatusEffect(attackerId, {
            id: 'crack',
            name: '균열',
            description: '턴 종료시 수치가 3 이상이라면 피해를 1 받고 제거됩니다.',
            duration: 3,
            stacks: 1,
            stackable: true,
            type: 'debuff'
          });
        }
        
        // 다음 턴 능력 봉인
        this.setSession('seal_ability_next_turn', { targetId: attackerId, turn: event.data.turn + 1 });
        
        console.log(`[날렵한 반격] ${attackerId}에게 균열을 가하고 다음 턴 능력을 봉인합니다.`);
      }
    }
  }

  // 능력을 사용한 턴, 자신을 공격한 플레이어가 없다면 사용 가능 횟수를 1회 돌려받습니다 (게임 당 최대 3회)
  async onTurnEnd(event: any): Promise<void> {
    const turn = event.data.turn;
    if (this.getTurn('swift_counter_active', turn)) {
      const attackCount = (this.getTurn('attack_count', turn) as number) || 0;
      const refundCount = (this.getPermanent('refund_count') as number) || 0;
      
      if (attackCount === 0 && refundCount < 3) {
        this.maxUses++;
        this.setPermanent('refund_count', refundCount + 1);
        console.log(`[날렵한 반격] 공격을 받지 않아 사용 횟수를 1회 돌려받습니다. (총 ${refundCount + 1}/3회)`);
      }
    }
  }
} 
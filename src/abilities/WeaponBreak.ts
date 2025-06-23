import { BaseAbility } from './BaseAbility';
import { AbilityContext, Player, ModifiableEvent, AttackEvent } from '../types/game.types';

export class WeaponBreak extends BaseAbility {
  private defenseAttackCount: Map<number, number> = new Map(); // 플레이어별 방어 공격 횟수

  constructor() {
    super('weaponBreak', '무장 파열', '방어 행동시 모든 플레이어에게 다양한 효과를 적용합니다.', 0, 2);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    // 이번 턴 효과 적용
    this.setTurn('weapon_break_active', true, context.currentTurn);

    return {
      success: true,
      message: `${context.player.name}이(가) 무장 파열을 발동합니다!`,
      target: context.player.id
    };
  }

  // 패시브 1: 능력을 사용하는 턴, 받는 피해가 1 감소
  async onBeforeAttack(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as AttackEvent;
    
    if (this.getTurn('weapon_break_active', currentTurn) && data.target === this.ownerId) {
      data.newDamage = Math.max(0, (data.newDamage || data.damage) - 1);
      event.modified = true;
      console.log(`[무장 파열] ${this.ownerId} 받는 피해 1 감소`);
    }
  }

  // 패시브 2: 방어를 행동한 플레이어를 누적 2번 공격할 때마다 사용 가능 횟수를 1회 얻음
  async onAfterAttack(event: ModifiableEvent): Promise<void> {
    const data = event.data as AttackEvent;
    if (data.attacker === this.ownerId) {
      const target = data.targetPlayer;
      if (target && target.actionType === 'DEFEND') {
        const currentCount = this.defenseAttackCount.get(target.id) || 0;
        const newCount = currentCount + 1;
        this.defenseAttackCount.set(target.id, newCount);
        
        if (newCount % 2 === 0) {
          this.maxUses = Math.min(this.maxUses + 1, 2);
          console.log(`[무장 파열] ${target.name} 방어 공격 ${newCount}회로 사용 횟수 1회 획득`);
        }
      }
    }
  }

  // 턴 종료시 모든 플레이어 행동에 따른 효과 적용
  async onTurnEnd(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    if (!this.getTurn('weapon_break_active', currentTurn)) return;

    const players = this.getSession('players') as Player[] || [];
    
    for (const player of players) {
      switch (player.actionType) {
        case 'ATTACK':
          // 다음 턴 가하는 피해가 2 감소
          this.setSession(`damage_reduction_${player.id}`, {
            turn: currentTurn + 1,
            amount: 2
          });
          console.log(`[무장 파열] ${player.name} 공격으로 다음 턴 피해 2 감소`);
          break;
          
        case 'DEFEND':
          // 이번 방어 행동은 실패하고, 다음 턴 방어 행동이 봉인
          this.setSession(`defend_fail_${player.id}`, currentTurn);
          this.setSession(`defend_seal_${player.id}`, {
            turn: currentTurn + 1
          });
          console.log(`[무장 파열] ${player.name} 방어 실패 및 다음 턴 방어 봉인`);
          break;
          
        case 'EVADE':
          // 이번 회피 행동은 실패하고, 다음 턴 가하는 피해가 1 감소
          this.setSession(`evade_fail_${player.id}`, currentTurn);
          this.setSession(`damage_reduction_${player.id}`, {
            turn: currentTurn + 1,
            amount: 1
          });
          console.log(`[무장 파열] ${player.name} 회피 실패 및 다음 턴 피해 1 감소`);
          break;
      }
    }
  }
} 
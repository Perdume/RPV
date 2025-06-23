import { BaseAbility } from './BaseAbility';
import { AbilityContext, TypedModifiableEvent, TurnStartEvent, AttackEvent } from '../types/game.types';

export class WeaponBreak extends BaseAbility {
  constructor() {
    super('weaponBreak', '무장 파열', '자신을 포함한 모든 플레이어의 행동에 따라 각각 적용합니다. 공격을 행동한 플레이어: 다음 턴 가하는 피해가 2 감소합니다. 방어를 행동한 플레이어: 이번 방어 행동은 실패하고, 다음 턴 방어 행동이 봉인됩니다. 회피를 행동한 플레이어: 이번 회피 행동은 실패하고, 다음 턴 가하는 피해가 1 감소합니다.', 0, 2);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    // 이번 턴 효과 적용
    this.setTurn('weapon_break_active', true, context.currentTurn);
    this.setTurn('attack_damage_reduction', true, context.currentTurn);
    this.setTurn('defend_failure', true, context.currentTurn);
    this.setTurn('evade_failure', true, context.currentTurn);

    return {
      success: true,
      message: `${this.name} 능력을 사용했습니다. 모든 플레이어의 무장이 파열됩니다.`,
      damage: 0,
      heal: 0,
      death: false
    };
  }

  // 패시브 1: 능력을 사용하는 턴, 받는 피해가 1 감소합니다
  async onBeforeDamage(event: any): Promise<void> {
    if (this.getTurn('weapon_break_active', this.getCurrentTurn()) && event.data.target === this.ownerId) {
      event.data.newDamage = Math.max(0, (event.data.newDamage || event.data.damage) - 1);
      console.log(`[무장 파열] ${this.ownerId}이(가) 받는 피해가 1 감소합니다!`);
    }
  }

  // 패시브 2: 방어를 행동한 플레이어를 누적 2번 공격할 때마다 사용 가능 횟수를 1회 얻습니다
  async onAfterAttack(event: TypedModifiableEvent<AttackEvent>): Promise<void> {
    if (event.data.attacker === this.ownerId) {
      const target = event.data.targetPlayer;
      if (target && target.actionType === 'DEFEND') {
        const defendAttackCount = this.getSession(`defend_attack_${target.id}`) as number || 0;
        this.setSession(`defend_attack_${target.id}`, defendAttackCount + 1);
        
        if ((defendAttackCount + 1) % 2 === 0) {
          this.maxUses = Math.min(this.maxUses + 1, 2);
          console.log(`[무장 파열] ${this.ownerId}이(가) ${target.id}를 2번 공격하여 능력 사용 횟수를 1회 얻습니다!`);
        }
      }
    }
  }

  // 공격을 행동한 플레이어: 다음 턴 가하는 피해가 2 감소합니다
  async onTurnStart(event: TypedModifiableEvent<TurnStartEvent>): Promise<void> {
    const turn = event.data.turn;
    if (this.getTurn('attack_damage_reduction', turn - 1)) {
      const players = event.data.players || [];
      for (const player of players) {
        if (player.actionType === 'ATTACK') {
          this.setTurn(`damage_reduction_${player.id}`, 2, turn);
          console.log(`[무장 파열] ${player.id}의 다음 턴 피해가 2 감소합니다!`);
        }
      }
    }
  }

  // 방어를 행동한 플레이어: 이번 방어 행동은 실패하고, 다음 턴 방어 행동이 봉인됩니다
  async onBeforeDefend(event: any): Promise<void> {
    if (this.getTurn('defend_failure', this.getCurrentTurn())) {
      event.cancelled = true;
      const player = event.data.players?.find((p: any) => p.id === event.data.player);
      if (player) {
        this.setTurn(`defend_seal_${player.id}`, true, this.getCurrentTurn() + 1);
        console.log(`[무장 파열] ${player.id}의 방어가 실패하고 다음 턴 방어가 봉인됩니다!`);
      }
    }
  }

  // 회피를 행동한 플레이어: 이번 회피 행동은 실패하고, 다음 턴 가하는 피해가 1 감소합니다
  async onBeforeEvade(event: any): Promise<void> {
    if (this.getTurn('evade_failure', this.getCurrentTurn())) {
      event.cancelled = true;
      const player = event.data.players?.find((p: any) => p.id === event.data.player);
      if (player) {
        this.setTurn(`damage_reduction_${player.id}`, 1, this.getCurrentTurn() + 1);
        console.log(`[무장 파열] ${player.id}의 회피가 실패하고 다음 턴 피해가 1 감소합니다!`);
      }
    }
  }

  private getCurrentTurn(): number {
    return (this.getSession('current_turn') as number) || 0;
  }
} 
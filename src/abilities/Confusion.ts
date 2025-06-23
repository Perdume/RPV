import { BaseAbility } from './BaseAbility';
import { AbilityContext, TypedModifiableEvent, TurnStartEvent, AttackEvent } from '../types/game.types';

export class Confusion extends BaseAbility {
  constructor() {
    super('confusion', '혼선', '대상에 따라 효과가 적용됩니다. 대상이 다른 플레이어일 경우: 대상의 행동을 자신의 행동으로 변경하며, 능력을 사용했다면 전체 로그에 나타냅니다. 대상이 자신일 경우: 이번 턴 자신은 행동하지 않은 것으로 로그에 기록되며, 행동의 모든 값이 2배로 적용됩니다.', 0, 1);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    const targetId = parameters.targetId || context.target?.id;
    
    if (!targetId) {
      return {
        success: false,
        message: '대상을 지정해야 합니다.',
        damage: 0,
        heal: 0,
        death: false
      };
    }

    const target = context.players.find(p => p.id === targetId);
    if (!target) {
      return {
        success: false,
        message: '대상을 찾을 수 없습니다.',
        damage: 0,
        heal: 0,
        death: false
      };
    }

    // 이번 턴 효과 적용
    this.setTurn('confusion_active', true, context.currentTurn);
    this.setTurn('target_id', targetId, context.currentTurn);
    
    if (targetId === this.ownerId) {
      // 자신을 대상으로 한 경우
      this.setTurn('self_confusion', true, context.currentTurn);
      this.setTurn('action_double', true, context.currentTurn);
    } else {
      // 다른 플레이어를 대상으로 한 경우
      this.setTurn('other_confusion', true, context.currentTurn);
      this.setTurn('action_swap', true, context.currentTurn);
    }

    return {
      success: true,
      message: `${this.name} 능력을 사용했습니다. ${target.name}에게 혼선을 적용합니다.`,
      damage: 0,
      heal: 0,
      death: false,
      target: targetId
    };
  }

  // 패시브: 공격 / 방어 / 회피 행동을 전부 1번씩 할 때마다 사용 가능 횟수를 1회 얻습니다
  async onTurnEnd(event: any): Promise<void> {
    const turn = event.data.turn;
    const player = event.data.players?.find((p: any) => p.id === this.ownerId);
    
    if (player) {
      const actionHistory = this.getSession('action_history') as any || {};
      const currentTurn = actionHistory[turn] || {};
      
      if (currentTurn.attack && currentTurn.defend && currentTurn.evade) {
        this.maxUses = Math.min(this.maxUses + 1, 2);
        console.log(`[혼선] ${this.ownerId}이(가) 모든 행동을 완료하여 능력 사용 횟수를 1회 얻습니다!`);
      }
    }
  }

  // 대상이 다른 플레이어일 경우: 대상의 행동을 자신의 행동으로 변경
  async onBeforeAction(event: any): Promise<void> {
    if (this.getTurn('action_swap', this.getCurrentTurn()) && event.data.playerId === this.getTurn('target_id', this.getCurrentTurn())) {
      const targetAction = event.data.actionType;
      const targetAbility = event.data.abilityId;
      
      // 자신의 행동을 대상의 행동으로 변경
      const selfPlayer = event.data.players?.find((p: any) => p.id === this.ownerId);
      if (selfPlayer) {
        selfPlayer.actionType = targetAction;
        selfPlayer.targetId = event.data.targetId;
        if (targetAbility) {
          selfPlayer.abilityId = targetAbility;
        }
        
        console.log(`[혼선] ${this.ownerId}의 행동이 ${event.data.playerId}의 행동으로 변경됩니다!`);
      }
      
      // 대상의 행동을 취소
      event.cancelled = true;
    }
  }

  // 대상이 자신일 경우: 행동의 모든 값이 2배로 적용
  async onBeforeAttack(event: TypedModifiableEvent<AttackEvent>): Promise<void> {
    if (this.getTurn('action_double', this.getCurrentTurn()) && event.data.attacker === this.ownerId) {
      event.data.newDamage = (event.data.newDamage || event.data.damage) * 2;
      console.log(`[혼선] ${this.ownerId}의 공격 피해가 2배로 증가합니다!`);
    }
  }

  async onBeforeDefend(event: any): Promise<void> {
    if (this.getTurn('action_double', this.getCurrentTurn()) && event.data.player === this.ownerId) {
      event.data.newDefenseGauge = (event.data.newDefenseGauge || event.data.defenseGauge) * 2;
      console.log(`[혼선] ${this.ownerId}의 방어 게이지가 2배로 증가합니다!`);
    }
  }

  async onBeforeEvade(event: any): Promise<void> {
    if (this.getTurn('action_double', this.getCurrentTurn()) && event.data.player === this.ownerId) {
      event.data.newEvadeCount = (event.data.newEvadeCount || event.data.evadeCount) * 2;
      console.log(`[혼선] ${this.ownerId}의 회피 횟수가 2배로 증가합니다!`);
    }
  }

  private getCurrentTurn(): number {
    return (this.getSession('current_turn') as number) || 0;
  }
} 
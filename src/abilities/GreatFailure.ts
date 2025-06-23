import { BaseAbility } from './BaseAbility';
import { AbilityContext, TypedModifiableEvent, TurnStartEvent, AttackEvent } from '../types/game.types';

export class GreatFailure extends BaseAbility {
  constructor() {
    super('greatFailure', '대실패', '대상의 능력 사용 유무에 따라 효과가 적용됩니다. 능력 사용시: 해당 능력을 "모든 플레이어는 체력을 1 회복한다" 로서 대신 적용합니다. 능력 미사용시: 대상의 이번 행동을 실패시킵니다.', 0, 1);
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
    this.setTurn('great_failure_active', true, context.currentTurn);
    this.setTurn('target_id', targetId, context.currentTurn);
    this.setTurn('ability_intercept', true, context.currentTurn);
    this.setTurn('action_failure', true, context.currentTurn);

    return {
      success: true,
      message: `${this.name} 능력을 사용했습니다. ${target.name}에게 대실패를 적용합니다.`,
      damage: 0,
      heal: 0,
      death: false,
      target: targetId
    };
  }

  // 패시브: 남은 사용 횟수가 0일 때, 누적 2턴을 행동하지 않는다면 사용 가능 횟수를 1 얻습니다
  async onTurnEnd(event: any): Promise<void> {
    const turn = event.data.turn;
    const player = event.data.players?.find((p: any) => p.id === this.ownerId);
    
    if (player && this.maxUses === 0) {
      const inactiveTurns = this.getSession('inactive_turns') as number || 0;
      
      if (player.actionType === 'PASS' || !player.actionType) {
        this.setSession('inactive_turns', inactiveTurns + 1);
        
        if (inactiveTurns + 1 >= 2) {
          this.maxUses = 1;
          console.log(`[대실패] ${this.ownerId}이(가) 2턴 연속 행동하지 않아 능력 사용 횟수를 1 얻습니다!`);
        }
      } else {
        this.setSession('inactive_turns', 0);
      }
    }
  }

  // 능력 사용시: 해당 능력을 "모든 플레이어는 체력을 1 회복한다" 로서 대신 적용합니다
  async onBeforeAbilityUse(event: any): Promise<void> {
    if (this.getTurn('ability_intercept', this.getCurrentTurn()) && event.data.playerId === this.getTurn('target_id', this.getCurrentTurn())) {
      // 능력 사용을 가로채서 모든 플레이어 체력 1 회복으로 변경
      event.cancelled = true;
      
      const players = event.data.players || [];
      for (const player of players) {
        if (player.status !== 'DEAD') {
          player.hp = Math.min(player.maxHp, player.hp + 1);
        }
      }
      
      console.log(`[대실패] ${event.data.playerId}의 능력이 모든 플레이어 체력 1 회복으로 변경됩니다!`);
    }
  }

  // 능력 미사용시: 대상의 이번 행동을 실패시킵니다
  async onBeforeAction(event: any): Promise<void> {
    if (this.getTurn('action_failure', this.getCurrentTurn()) && event.data.playerId === this.getTurn('target_id', this.getCurrentTurn())) {
      const target = event.data.players?.find((p: any) => p.id === event.data.playerId);
      if (target && target.abilityUses === target.maxAbilityUses) {
        // 능력을 사용하지 않은 경우 행동 실패
        event.cancelled = true;
        console.log(`[대실패] ${event.data.playerId}의 행동이 실패합니다!`);
      }
    }
  }

  private getCurrentTurn(): number {
    return (this.getSession('current_turn') as number) || 0;
  }
} 
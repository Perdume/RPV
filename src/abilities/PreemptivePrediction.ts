import { BaseAbility } from './BaseAbility';
import { AbilityContext, TypedModifiableEvent, TurnStartEvent, AttackEvent } from '../types/game.types';

export class PreemptivePrediction extends BaseAbility {
  constructor() {
    super('preemptivePrediction', '선제 예측', '대상의 공격 / 방어 / 회피 행동중 하나, 그리고 능력 사용 여부를 예측합니다. 행동 예측 성공시: 대상의 행동을 실패시키고, 다음 턴 해당 행동을 봉인합니다. 능력 예측 성공시: 체력을 1 회복하고, 다음 턴 대상의 능력을 봉인합니다.', 0, 2);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    const targetId = parameters.targetId || context.target?.id;
    const predictedAction = parameters.predictedAction; // 'ATTACK', 'DEFEND', 'EVADE'
    const predictedAbilityUse = parameters.predictedAbilityUse; // true/false
    
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

    if (!predictedAction || predictedAbilityUse === undefined) {
      return {
        success: false,
        message: '예측할 행동과 능력 사용 여부를 지정해야 합니다.',
        damage: 0,
        heal: 0,
        death: false
      };
    }

    // 이번 턴 효과 적용
    this.setTurn('prediction_active', true, context.currentTurn);
    this.setTurn('target_id', targetId, context.currentTurn);
    this.setTurn('predicted_action', predictedAction, context.currentTurn);
    this.setTurn('predicted_ability', predictedAbilityUse, context.currentTurn);

    return {
      success: true,
      message: `${this.name} 능력을 사용했습니다. ${target.name}의 ${predictedAction} 행동과 능력 사용 ${predictedAbilityUse ? '예측' : '미사용 예측'}을 적용합니다.`,
      damage: 0,
      heal: 0,
      death: false,
      target: targetId
    };
  }

  // 패시브: 연속 2턴 회피를 행동한다면 사용 가능 횟수를 1 얻습니다
  async onTurnEnd(event: any): Promise<void> {
    const turn = event.data.turn;
    const player = event.data.players?.find((p: any) => p.id === this.ownerId);
    
    if (player && player.actionType === 'EVADE') {
      const consecutiveEvadeTurns = this.getSession('consecutive_evade_turns') as number || 0;
      this.setSession('consecutive_evade_turns', consecutiveEvadeTurns + 1);
      
      if (consecutiveEvadeTurns + 1 >= 2) {
        this.maxUses = Math.min(this.maxUses + 1, 2);
        console.log(`[선제 예측] ${this.ownerId}이(가) 연속 2턴 회피하여 능력 사용 횟수를 1 얻습니다!`);
      }
    } else {
      this.setSession('consecutive_evade_turns', 0);
    }
  }

  // 행동 예측 성공시: 대상의 행동을 실패시키고, 다음 턴 해당 행동을 봉인합니다
  async onBeforeAction(event: any): Promise<void> {
    if (this.getTurn('prediction_active', this.getCurrentTurn()) && event.data.playerId === this.getTurn('target_id', this.getCurrentTurn())) {
      const predictedAction = this.getTurn('predicted_action', this.getCurrentTurn());
      
      if (event.data.actionType === predictedAction) {
        // 행동 예측 성공
        event.cancelled = true;
        this.setTurn(`action_seal_${event.data.playerId}_${predictedAction}`, true, this.getCurrentTurn() + 1);
        console.log(`[선제 예측] ${event.data.playerId}의 ${predictedAction} 행동 예측 성공! 다음 턴 해당 행동이 봉인됩니다.`);
      }
    }
  }

  // 능력 예측 성공시: 체력을 1 회복하고, 다음 턴 대상의 능력을 봉인합니다
  async onBeforeAbilityUse(event: any): Promise<void> {
    if (this.getTurn('prediction_active', this.getCurrentTurn()) && event.data.playerId === this.getTurn('target_id', this.getCurrentTurn())) {
      const predictedAbility = this.getTurn('predicted_ability', this.getCurrentTurn());
      
      if (event.data.abilityUsed === predictedAbility) {
        // 능력 예측 성공
        if (predictedAbility) {
          event.cancelled = true;
        }
        
        // 체력 1 회복
        const player = event.data.players?.find((p: any) => p.id === this.ownerId);
        if (player) {
          player.hp = Math.min(player.maxHp, player.hp + 1);
        }
        
        // 다음 턴 대상의 능력 봉인
        this.setTurn(`ability_seal_${event.data.playerId}`, true, this.getCurrentTurn() + 1);
        console.log(`[선제 예측] ${event.data.playerId}의 능력 사용 예측 성공! 체력을 1 회복하고 다음 턴 대상의 능력이 봉인됩니다.`);
      }
    }
  }

  private getCurrentTurn(): number {
    return (this.getSession('current_turn') as number) || 0;
  }
} 
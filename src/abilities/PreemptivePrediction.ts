import { BaseAbility } from './BaseAbility';
import { AbilityContext, Player, ModifiableEvent, AttackEvent } from '../types/game.types';

export class PreemptivePrediction extends BaseAbility {
  constructor() {
    super('preemptivePrediction', '선제 예측', '대상의 행동과 능력 사용을 예측하여 실패시킵니다.', 0, 2);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    const targetId = parameters.targetId;
    const predictedAction = parameters.predictedAction; // 'ATTACK', 'DEFEND', 'EVADE'
    const predictedAbility = parameters.predictedAbility; // true/false

    if (!targetId) {
      return { success: false, message: '대상을 지정해야 합니다.' };
    }

    if (targetId === this.ownerId) {
      return { success: false, message: '자신을 대상으로 할 수 없습니다.' };
    }

    const target = context.players.find(p => p.id === targetId);
    if (!target) {
      return { success: false, message: '대상을 찾을 수 없습니다.' };
    }

    // 예측 정보 저장
    this.setSession('prediction_target', targetId);
    this.setSession('predicted_action', predictedAction);
    this.setSession('predicted_ability', predictedAbility);
    this.setTurn('prediction_active', true, context.currentTurn);

    return {
      success: true,
      message: `${context.player.name}이(가) ${target.name}의 행동을 예측합니다!`,
      target: targetId
    };
  }

  // 패시브: 연속 2턴 회피를 행동한다면 사용 가능 횟수를 1 얻음
  async onTurnEnd(event: ModifiableEvent): Promise<void> {
    const player = this.getOwnerPlayer();
    if (!player) return;

    const consecutiveEvadeTurns = this.getSession('consecutive_evade_turns') as number || 0;
    
    if (player.actionType === 'EVADE') {
      const newCount = consecutiveEvadeTurns + 1;
      this.setSession('consecutive_evade_turns', newCount);
      
      if (newCount >= 2) {
        this.maxUses = Math.min(this.maxUses + 1, 2);
        console.log(`[선제 예측] ${this.ownerId} 연속 ${newCount}턴 회피로 사용 횟수 1회 획득`);
        this.setSession('consecutive_evade_turns', 0); // 리셋
      }
    } else {
      // 회피가 아닌 행동을 하면 카운트 리셋
      this.setSession('consecutive_evade_turns', 0);
    }
  }

  // 예측 결과 확인 및 효과 적용
  async onAfterAction(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as any;
    
    if (!this.getTurn('prediction_active', currentTurn)) return;

    const targetId = this.getSession('prediction_target') as number;
    const predictedAction = this.getSession('predicted_action') as string;
    const predictedAbility = this.getSession('predicted_ability') as boolean;

    if (data.playerId !== targetId) return;

    // 행동 예측 성공 체크
    if (predictedAction && data.actionType === predictedAction) {
      // 행동 예측 성공: 대상의 행동을 실패시키고 다음 턴 해당 행동 봉인
      this.failAction(targetId, predictedAction);
      this.sealAction(targetId, predictedAction, 1);
      console.log(`[선제 예측] ${targetId}의 ${predictedAction} 행동 예측 성공! 행동 실패 및 다음 턴 봉인`);
    }

    // 능력 사용 예측 성공 체크
    if (predictedAbility !== undefined) {
      const actualAbilityUse = data.abilityId !== undefined;
      if (predictedAbility === actualAbilityUse) {
        // 능력 예측 성공: 체력 1 회복하고 다음 턴 대상의 능력 봉인
        const ownerPlayer = this.getOwnerPlayer();
        if (ownerPlayer) {
          ownerPlayer.hp = Math.min(ownerPlayer.maxHp, ownerPlayer.hp + 1);
        }
        this.sealAbility(targetId, 1);
        console.log(`[선제 예측] ${targetId}의 능력 사용 예측 성공! 체력 1 회복 및 다음 턴 능력 봉인`);
      }
    }
  }

  private failAction(playerId: number, actionType: string): void {
    // 행동 실패 처리 (실제로는 TurnProcessor에서 처리)
    console.log(`[선제 예측] ${playerId}의 ${actionType} 행동 실패`);
  }

  private sealAction(playerId: number, actionType: string, duration: number): void {
    // 행동 봉인 처리 (실제로는 TurnProcessor에서 처리)
    console.log(`[선제 예측] ${playerId}의 ${actionType} 행동 ${duration}턴 봉인`);
  }

  private sealAbility(playerId: number, duration: number): void {
    // 능력 봉인 처리 (실제로는 TurnProcessor에서 처리)
    console.log(`[선제 예측] ${playerId}의 능력 ${duration}턴 봉인`);
  }
} 
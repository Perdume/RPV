import { BaseAbility } from './BaseAbility';
import { AbilityContext, Player, ModifiableEvent, AttackEvent } from '../types/game.types';

export class Unseeable extends BaseAbility {
  private abilityEffectCount: number = 0; // 다른 능력의 영향을 받은 횟수

  constructor() {
    super('unseeable', '직시 불가', '대상의 행동을 실패시키고 복합 조건부 효과를 적용합니다.', 0, 3);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    const targetId = parameters.targetId;
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

    // 대상의 행동을 실패시킴
    this.setTurn('action_fail', true, context.currentTurn);
    this.setSession('fail_target', targetId);

    return {
      success: true,
      message: `${context.player.name}이(가) ${target.name}의 행동을 실패시킵니다!`,
      target: targetId
    };
  }

  // 패시브 1: 자신이 능력의 영향을 받는다면, 그 능력 사용이 전체 로그에 나타남
  async onBeforeStatusEffectApplied(event: ModifiableEvent): Promise<void> {
    const data = event.data as any;
    if (data.targetId === this.ownerId) {
      // 능력 사용을 전체 로그에 공개
      const turnProcessor = this.getTurnProcessor();
      if (turnProcessor) {
        turnProcessor.revealAbilityUse(data.sourceId, this.getSession('current_turn') as number || 0);
      }
      console.log(`[직시 불가] ${this.ownerId} 능력 영향으로 ${data.sourceId}의 능력 사용 공개`);
    }
  }

  // 패시브 2: 자신이 다른 능력의 영향을 누적 2회 받을 때마다 사용 가능 횟수를 1회 얻음
  async onAfterStatusEffectApplied(event: ModifiableEvent): Promise<void> {
    const data = event.data as any;
    if (data.targetId === this.ownerId) {
      this.abilityEffectCount++;
      
      if (this.abilityEffectCount % 2 === 0) {
        this.maxUses = Math.min(this.maxUses + 1, 3);
        console.log(`[직시 불가] ${this.ownerId} 능력 영향 ${this.abilityEffectCount}회로 사용 횟수 1회 획득`);
      }
    }
  }

  // 대상의 행동 실패 처리
  async onBeforeAction(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as any;
    const failTarget = this.getSession('fail_target') as number;
    
    if (this.getTurn('action_fail', currentTurn) && data.playerId === failTarget) {
      event.cancelled = true;
      console.log(`[직시 불가] ${failTarget}의 행동 실패`);
    }
  }

  // 복합 조건부 효과: 이번 턴 자신이 다른 플레이어에게 피해를 받거나 능력의 영향을 받았다면 추가 효과 적용
  async onAfterAction(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as any;
    const failTarget = this.getSession('fail_target') as number;
    
    if (this.getTurn('action_fail', currentTurn) && failTarget) {
      // 자신이 피해를 받았는지 또는 능력의 영향을 받았는지 확인
      const wasDamaged = this.getSession('was_damaged') as boolean || false;
      const wasAffectedByAbility = this.getSession('was_affected_by_ability') as boolean || false;
      
      if (wasDamaged || wasAffectedByAbility) {
        // 추가 효과 적용
        this.applyAdditionalEffects(failTarget);
        console.log(`[직시 불가] ${this.ownerId} 조건 충족으로 ${failTarget}에게 추가 효과 적용`);
      }
    }
  }

  private applyAdditionalEffects(targetId: number): void {
    // 1. 1의 피해를 가함
    const target = this.findPlayer(targetId);
    if (target) {
      target.hp = Math.max(0, target.hp - 1);
    }
    
    // 2. 전체 로그상 나타난 행동을 다음 턴에 봉인
    this.setSession('seal_action_next_turn', {
      targetId,
      turn: (this.getSession('current_turn') as number || 0) + 1
    });
    
    // 3. 다음 턴 능력을 봉인
    this.setSession('seal_ability_next_turn', {
      targetId,
      turn: (this.getSession('current_turn') as number || 0) + 1
    });
    
    // 4. 다음 턴 "받는 피해 1 증가" 상태이상 부여
    this.applyStatusEffect(targetId, 'damage_increase', 1, 1);
  }

  private findPlayer(playerId: number): Player | null {
    // GameState에서 플레이어 찾기 (의존성 주입 필요)
    return null; // 실제 구현에서는 GameState 참조
  }

  private getTurnProcessor(): any {
    // TurnProcessor 인스턴스 접근 (의존성 주입 필요)
    return null; // 실제 구현에서는 의존성 주입으로 해결
  }
} 
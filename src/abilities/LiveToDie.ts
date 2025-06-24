import { BaseAbility } from './BaseAbility';
import { AbilityContext, Player, ModifiableEvent, AttackEvent } from '../types/game.types';

export class LiveToDie extends BaseAbility {
  private refundScheduled: boolean = false;

  constructor() {
    super('liveToDie', '살고자 하면 죽고', '체력 4 이하에서 공격 행동시 특수 효과를 발동합니다.', 0, 1);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    const player = context.player;
    
    // 체력 4 이하 체크
    if (player.hp > 4) {
      return { success: false, message: '체력이 4 이하여야 합니다.' };
    }

    // 공격 행동 체크
    if (player.actionType !== 'ATTACK') {
      return { success: false, message: '공격 행동을 해야 합니다.' };
    }

    // 2턴 후 사용 횟수 회복 스케줄링
    if (!this.refundScheduled) {
      this.scheduleRefund(context.currentTurn);
      this.refundScheduled = true;
    }

    // 이번 턴 특수 효과 적용
    this.setTurn('live_to_die_active', true, context.currentTurn);

    return {
      success: true,
      message: `${player.name}이(가) 살고자 하면 죽고를 발동합니다!`,
      target: player.id
    };
  }

  private scheduleRefund(currentTurn: number): void {
    // 2턴 후 사용 횟수 회복을 위한 세션 변수 설정
    this.setSession('refund_scheduled', {
      turn: currentTurn + 2,
      scheduled: true
    });
  }

  // 2턴 후 사용 횟수 회복 처리
  async onTurnEnd(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const refundData = this.getSession('refund_scheduled') as any;
    
    if (refundData && refundData.scheduled && currentTurn === refundData.turn) {
      this.maxUses = Math.min(this.maxUses + 1, 1);
      this.setSession('refund_scheduled', null);
      this.refundScheduled = false;
      console.log(`[살고자 하면 죽고] 2턴 후 사용 횟수 회복: ${this.maxUses}`);
    }
  }

  // 공격 성공시 특수 효과
  async onAfterAttack(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as AttackEvent;
    
    if (this.getTurn('live_to_die_active', currentTurn) && 
        data.attacker === this.ownerId && 
        data.attackSuccess) {
      
      const player = this.getOwnerPlayer();
      if (player) {
        // 체력 1 회복
        player.hp = Math.min(player.maxHp, player.hp + 1);
        
        // 모든 부정적 상태이상 제거
        const statusEffects = player.statusEffects.filter(effect => effect.type === 'debuff');
        statusEffects.forEach(effect => {
          const index = player.statusEffects.indexOf(effect);
          if (index > -1) {
            player.statusEffects.splice(index, 1);
          }
        });
        
        // 이번 턴 모든 피해 무시
        this.setTurn('damage_immunity', true, currentTurn);
        
        // 이번 턴 다른 능력 영향 무시
        this.setTurn('ability_immunity', true, currentTurn);
        
        console.log(`[살고자 하면 죽고] ${player.name}이 특수 효과를 받습니다!`);
      }
    }
  }

  // 피해 무시
  async onBeforeDamage(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as AttackEvent;
    
    if (this.getTurn('damage_immunity', currentTurn) && data.target === this.ownerId) {
      event.cancelled = true;
      console.log(`[살고자 하면 죽고] ${this.ownerId}는 이번 턴 모든 피해를 무시합니다.`);
    }
  }

  // 능력 영향 무시
  async onBeforeStatusEffectApplied(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as any;
    
    if (this.getTurn('ability_immunity', currentTurn) && data.targetId === this.ownerId) {
      event.cancelled = true;
      console.log(`[살고자 하면 죽고] ${this.ownerId}는 이번 턴 다른 능력의 영향을 받지 않습니다.`);
    }
  }
} 
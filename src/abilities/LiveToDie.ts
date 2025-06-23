import { BaseAbility } from './BaseAbility';
import { AbilityContext, Player, ModifiableEvent, AttackEvent } from '../types/game.types';

export class LiveToDie extends BaseAbility {
  private returnCount: number = 0; // 게임당 최대 3회

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

    // 이번 턴 특수 효과 적용
    this.setTurn('live_to_die_active', true, context.currentTurn);
    this.setTurn('ability_immunity', true, context.currentTurn);
    this.setTurn('damage_immunity', true, context.currentTurn);

    return {
      success: true,
      message: `${player.name}이(가) 살고자 하면 죽고를 발동합니다!`,
      target: player.id
    };
  }

  // 공격 성공시 모든 효과 적용
  async onAfterAttack(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as AttackEvent;
    
    if (this.getTurn('live_to_die_active', currentTurn) && data.attacker === this.ownerId && data.attackSuccess) {
      const player = this.getOwnerPlayer();
      if (player) {
        // 1. 체력 1 회복
        player.hp = Math.min(player.maxHp, player.hp + 1);
        
        // 2. 모든 부정적 상태이상 제거
        this.removeAllNegativeStatusEffects(player.id);
        
        // 3. 이번 턴 모든 피해를 받지 않음
        this.setTurn('damage_immunity', true, currentTurn);
        
        // 4. 이번 턴 다른 능력을 받지 않음
        this.setTurn('ability_immunity', true, currentTurn);
        
        console.log(`[살고자 하면 죽고] ${player.name} 공격 성공으로 모든 효과 적용`);
      }
    }
  }

  // 다른 능력의 영향을 받지 않음
  async onBeforeStatusEffectApplied(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as any;
    
    if (this.getTurn('ability_immunity', currentTurn) && data.targetId === this.ownerId) {
      event.cancelled = true;
      console.log(`[살고자 하면 죽고] ${this.ownerId}는 능력 면역으로 상태이상을 무시합니다.`);
    }
  }

  // 피해를 받지 않음
  async onBeforeAttack(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as AttackEvent;
    
    if (this.getTurn('damage_immunity', currentTurn) && data.target === this.ownerId) {
      data.newDamage = 0;
      event.modified = true;
      console.log(`[살고자 하면 죽고] ${this.ownerId}는 피해 면역으로 데미지를 무시합니다.`);
    }
  }

  // 턴 종료시 2턴째 종료시 사용 횟수 1회 돌려받음
  async onTurnEnd(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    
    if (this.getTurn('live_to_die_active', currentTurn)) {
      // 2턴 후 사용 횟수 회복
      setTimeout(() => {
        if (this.returnCount < 3) {
          this.maxUses = Math.min(this.maxUses + 1, 1);
          this.returnCount++;
          console.log(`[살고자 하면 죽고] ${this.ownerId} 2턴 후 사용 횟수 1회 회복 (${this.returnCount}/3)`);
        }
      }, 2000); // 실제로는 턴 카운터 사용
    }
  }

  private removeAllNegativeStatusEffects(playerId: number): void {
    // StatusEffectManager를 통해 모든 부정적 상태이상 제거
    const statusEffects = this.getStatusEffects(playerId);
    for (const effect of statusEffects) {
      if (effect.type === 'debuff') {
        this.removeStatusEffect(playerId, effect.id);
      }
    }
  }

  private getStatusEffects(playerId: number): any[] {
    // StatusEffectManager에서 플레이어의 상태이상 목록 가져오기
    return []; // 실제 구현에서는 StatusEffectManager 참조
  }
} 
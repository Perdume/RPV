import { BaseAbility } from './BaseAbility';
import { AbilityContext, Player, ModifiableEvent, AttackEvent } from '../types/game.types';

export class DiscordDissonance extends BaseAbility {
  private cooldownTurns: number = 0;

  constructor() {
    super('discordDissonance', '불협화음', '공격 행동시 타겟 리다이렉트 효과를 발동합니다.', 0, 2);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    // 이번 턴 효과 적용
    this.setTurn('damage_reduction', true, context.currentTurn);
    this.setTurn('target_redirect', true, context.currentTurn);
    this.setTurn('passive_activation', true, context.currentTurn);
    this.setTurn('use_return', true, context.currentTurn);

    return {
      success: true,
      message: `${context.player.name}이(가) 불협화음을 발동합니다!`,
      target: context.player.id
    };
  }

  // 패시브: 공격 전 모든 효과 적용
  async onBeforeAttack(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as AttackEvent;
    
    // 1. 자신을 공격한 플레이어가 2명 이상이라면 타겟 리다이렉트
    if (data.target === this.ownerId && this.cooldownTurns === 0) {
      const attackersCount = this.getSession('attackers_count') as number || 0;
      
      if (attackersCount >= 2) {
        this.redirectAttackTargets();
        this.cooldownTurns = 2;
        console.log(`[불협화음] ${attackersCount}명의 공격자 타겟 리다이렉트`);
      }
    }
    
    // 2. 받는 피해가 1 감소
    if (this.getTurn('damage_reduction', currentTurn) && data.target === this.ownerId) {
      data.newDamage = Math.max(0, (data.newDamage || data.damage) - 1);
      event.modified = true;
      console.log(`[불협화음] ${this.ownerId} 받는 피해 1 감소`);
    }
    
    // 3. 공격 타겟이 공격 행동을 했다면, 그 대상을 자신에게로 옮김
    if (this.getTurn('target_redirect', currentTurn) && data.attacker === this.ownerId) {
      const target = data.targetPlayer;
      if (target && target.actionType === 'ATTACK') {
        data.newTarget = this.ownerId;
        event.modified = true;
        console.log(`[불협화음] ${target.name}의 공격 대상을 ${this.ownerId}로 변경`);
      }
    }
    
    // 4. 재사용 기간에 상관없이 즉시 패시브를 활성화
    if (this.getTurn('passive_activation', currentTurn) && data.attacker === this.ownerId) {
      this.cooldownTurns = 0;
      console.log(`[불협화음] ${this.ownerId} 패시브 즉시 활성화`);
    }
  }

  // 패시브: 공격 타겟이 공격 외의 행동을 했다면 능력 사용 횟수를 1회 돌려받음 (최대 3회)
  async onAfterAttack(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as AttackEvent;
    
    if (this.getTurn('use_return', currentTurn) && data.attacker === this.ownerId) {
      const target = data.targetPlayer;
      if (target && target.actionType !== 'ATTACK') {
        this.maxUses = Math.min(this.maxUses + 1, 3);
        console.log(`[불협화음] ${this.ownerId} 타겟이 공격 외 행동으로 사용 횟수 1회 회복`);
      }
    }
  }

  // 턴 종료시 재사용 기간 감소
  async onTurnEnd(event: ModifiableEvent): Promise<void> {
    if (this.cooldownTurns > 0) {
      this.cooldownTurns--;
      console.log(`[불협화음] ${this.ownerId} 재사용 기간 ${this.cooldownTurns}턴 남음`);
    }
  }

  private redirectAttackTargets(): void {
    // 실제 구현에서는 TurnProcessor에서 공격자들의 타겟을 내림차순으로 변경
    // 예: 공격자 [A, B, C] → A는 B를, B는 C를, C는 A를 공격하도록 변경
    console.log(`[불협화음] 공격자 타겟 리다이렉트 실행`);
  }
} 
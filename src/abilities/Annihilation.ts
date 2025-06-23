import { BaseAbility } from './BaseAbility';
import { AbilityContext } from '../types/game.types';

export class Annihilation extends BaseAbility {
  constructor() {
    super(
      'annihilation',
      '소멸',
      '행동하지 않음. 이번 턴 모든 피해와 능력의 영향을 받지 않습니다.',
      0, // maxCooldown
      4  // maxUses
    );
  }

  async execute(context: AbilityContext): Promise<{ success: boolean; message: string }> {
    try {
      const owner = this.getOwnerPlayer();
      
      if (!owner) {
        return { success: false, message: '소유자를 찾을 수 없습니다.' };
      }

      // 행동하지 않음으로 설정
      owner.actionType = 'PASS';
      owner.targetId = undefined;

      // 이번 턴 무적 상태 설정
      this.setSession('invincible', true);
      
      // 체력 3 이하라면 체력 1 회복
      if (owner.hp <= 3) {
        owner.hp = Math.min(owner.maxHp, owner.hp + 1);
      }

      this.maxUses--;
      this.addLog(context, `[소멸] ${owner.name}이 소멸 상태가 되었습니다.`);
      
      return { 
        success: true, 
        message: '소멸 상태가 되었습니다.' 
      };
      
    } catch (error) {
      console.error('[소멸] 실행 오류:', error);
      return { success: false, message: '소멸 실행 중 오류가 발생했습니다.' };
    }
  }

  // 모든 피해와 능력의 영향을 받지 않음
  async onAnyEvent(event: any): Promise<void> {
    const owner = this.getOwnerPlayer();
    if (!owner) return;

    const isInvincible = this.getSession<boolean>('invincible', {
      validate: (v): v is boolean => typeof v === 'boolean',
      defaultValue: false
    });

    if (isInvincible) {
      // 피해 관련 이벤트 취소
      if (event.type.includes('DAMAGE') && event.data.target === owner.id) {
        event.cancelled = true;
        console.log(`[소멸] ${owner.name}이 피해를 무시했습니다.`);
      }
      
      // 능력 효과 관련 이벤트 취소
      if (event.type.includes('ABILITY') && event.data.target === owner.id) {
        event.cancelled = true;
        console.log(`[소멸] ${owner.name}이 능력 효과를 무시했습니다.`);
      }
    }
  }

  // 자신을 공격한 플레이어가 2명 이상이면 체력 회복
  async onTurnEnd(event: any): Promise<void> {
    const owner = this.getOwnerPlayer();
    if (!owner) return;

    const attackers = this.getSession<number[]>('attackers', {
      validate: (v): v is number[] => Array.isArray(v),
      defaultValue: []
    });

    if (attackers.length >= 2) {
      owner.hp = Math.min(owner.maxHp, owner.hp + 1);
      console.log(`[소멸] ${owner.name}이 공격자 ${attackers.length}명으로 인해 체력을 1 회복했습니다.`);
    }

    if (attackers.length >= 3) {
      // 공격자들에게 1의 피해
      for (const attackerId of attackers) {
        const attacker = event.data.players?.find((p: any) => p.id === attackerId);
        if (attacker) {
          attacker.hp = Math.max(1, attacker.hp - 1);
          console.log(`[소멸] ${attacker.name}에게 1의 피해를 가했습니다.`);
        }
      }
    }

    // 공격자 목록 초기화
    this.setSession('attackers', []);
    this.setSession('invincible', false);
  }

  // 공격자를 추적
  async onBeforeAttack(event: any): Promise<void> {
    const owner = this.getOwnerPlayer();
    if (!owner || event.data.target !== owner.id) return;

    const attackers = this.getSession<number[]>('attackers', {
      validate: (v): v is number[] => Array.isArray(v),
      defaultValue: []
    });

    if (!attackers.includes(event.data.attacker)) {
      attackers.push(event.data.attacker);
      this.setSession('attackers', attackers);
    }
  }
} 
import { BaseAbility } from './BaseAbility';
import { AbilityContext } from '../types/game.types';

export class BurningEmbers extends BaseAbility {
  constructor() {
    super(
      'burningEmbers',
      '다시 불타는 잿더미',
      '턴 종료시 자신의 체력이 0이라면 탈락을 저항하고 체력을 회복합니다.',
      0, // maxCooldown
      4  // maxUses
    );
  }

  // 패시브 1: 턴 종료시 체력이 0이면 탈락 저항
  async onTurnEnd(event: any): Promise<void> {
    const owner = this.getOwnerPlayer();
    if (!owner) return;

    if (owner.hp <= 0 && this.maxUses > 0) {
      // 탈락 저항 및 체력 회복
      const healAmount = 1 + this.maxUses;
      owner.hp = Math.min(owner.maxHp, healAmount);
      owner.maxHp = Math.max(owner.maxHp, healAmount); // 최대 체력도 제한
      
      this.maxUses--;
      
      console.log(`[다시 불타는 잿더미] ${owner.name}이 탈락을 저항하고 체력 ${healAmount}을 회복했습니다. (남은 사용 횟수: ${this.maxUses})`);
    }
  }

  // 패시브 2: 연속 2턴동안 다른 플레이어에게 피해를 받지 않으면 비활성화
  async onTurnStart(event: any): Promise<void> {
    const owner = this.getOwnerPlayer();
    if (!owner) return;

    const noDamageTurns = this.getSession<number>('noDamageTurns', {
      validate: (v): v is number => typeof v === 'number',
      defaultValue: 0
    });

    // 이번 턴 피해를 받았는지 확인
    const damageReceived = this.getSession<boolean>('damageReceived', {
      validate: (v): v is boolean => typeof v === 'boolean',
      defaultValue: false
    });

    if (damageReceived) {
      // 피해를 받았다면 카운터 리셋
      this.setSession('noDamageTurns', 0);
      this.setSession('damageReceived', false);
    } else {
      // 피해를 받지 않았다면 카운터 증가
      const newNoDamageTurns = noDamageTurns + 1;
      this.setSession('noDamageTurns', newNoDamageTurns);
      
      if (newNoDamageTurns >= 2) {
        // 능력 비활성화
        this.isActive = false;
        console.log(`[다시 불타는 잿더미] ${owner.name}의 능력이 비활성화되었습니다.`);
      }
    }
  }

  // 피해를 받았을 때 플래그 설정
  async onAnyEvent(event: any): Promise<void> {
    const owner = this.getOwnerPlayer();
    if (!owner) return;

    if (event.type.includes('DAMAGE') && event.data.target === owner.id) {
      this.setSession('damageReceived', true);
    }
  }
} 
import { BaseAbility } from './BaseAbility';
import { AbilityContext, Player, ModifiableEvent, PlayerStatus } from '../types/game.types';

export class RisingAshes extends BaseAbility {
  private consecutiveNoDamageTurns: number = 0; // 연속으로 피해를 받지 않은 턴 수

  constructor() {
    super('risingAshes', '다시 불타는 잿더미', '탈락을 저항하고 체력을 회복합니다.', 0, 4);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    // 이 능력은 수동으로 사용할 수 없음 (패시브만 존재)
    return { success: false, message: '이 능력은 수동으로 사용할 수 없습니다.' };
  }

  // 패시브 1: 턴 종료시 체력이 0이라면 탈락 저항 및 체력 회복
  async onTurnEnd(event: ModifiableEvent): Promise<void> {
    const player = this.getOwnerPlayer();
    if (!player) return;

    if (player.hp <= 0 && this.maxUses > 0) {
      // 탈락 저항
      player.hp = 1;
      player.status = PlayerStatus.ALIVE;
      
      // 체력 회복: [1 + 남은 사용 횟수] 만큼
      const healAmount = 1 + this.maxUses;
      const newHp = Math.min(healAmount, player.maxHp);
      player.hp = newHp;
      
      // 최대 체력도 제한
      player.maxHp = Math.min(player.maxHp, healAmount);
      
      // 사용 횟수 1 감소
      this.maxUses--;
      
      console.log(`[다시 불타는 잿더미] ${player.name} 탈락 저항! 체력 ${healAmount} 회복 (남은 횟수: ${this.maxUses})`);
    }
  }

  // 패시브 2: 연속 2턴동안 다른 플레이어에게 피해를 받지 않았다면 능력 비활성화
  async onAfterAttack(event: ModifiableEvent): Promise<void> {
    const data = event.data as any;
    
    if (data.target === this.ownerId && data.damage > 0) {
      // 피해를 받았으므로 카운터 리셋
      this.consecutiveNoDamageTurns = 0;
    }
  }

  // 턴 시작시 피해를 받지 않았는지 체크
  async onTurnStart(event: ModifiableEvent): Promise<void> {
    const player = this.getOwnerPlayer();
    if (!player) return;

    // 이전 턴에 피해를 받지 않았다면 카운터 증가
    if (!player.wasAttacked) {
      this.consecutiveNoDamageTurns++;
      
      // 연속 2턴 피해를 받지 않으면 능력 비활성화
      if (this.consecutiveNoDamageTurns >= 2) {
        this.isActive = false;
        console.log(`[다시 불타는 잿더미] ${player.name} 연속 2턴 피해 없음으로 능력 비활성화`);
      }
    } else {
      // 피해를 받았으면 카운터 리셋
      this.consecutiveNoDamageTurns = 0;
      player.wasAttacked = false; // 플래그 리셋
    }
  }

  // 능력 재활성화 (필요시)
  reactivateAbility(): void {
    this.isActive = true;
    this.consecutiveNoDamageTurns = 0;
    console.log(`[다시 불타는 잿더미] 능력이 재활성화되었습니다.`);
  }

  // 현재 상태 조회
  getAbilityStatus(): { 
    isActive: boolean; 
    remainingUses: number; 
    consecutiveNoDamageTurns: number 
  } {
    return {
      isActive: this.isActive,
      remainingUses: this.maxUses,
      consecutiveNoDamageTurns: this.consecutiveNoDamageTurns
    };
  }
} 
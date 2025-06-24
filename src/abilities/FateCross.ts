import { BaseAbility } from './BaseAbility';
import { AbilityContext } from '../types/game.types';
import { Player } from '../types/game.types';
import { ModifiableEvent } from '../types/game.types';

export class FateCross extends BaseAbility {
  private isEarlyProtectionActive: boolean = false;
  private hasBeenUsed: boolean = false;

  constructor() {
    super(
      'fateCross',
      '운명 교차',
      '초반 보호 규칙 첫번째 선택시 활성화되어 대상과 번호를 교체합니다.',
      0, // maxCooldown
      1 // 한 번만 사용
    );
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    const targetId = parameters.targetId;
    if (!targetId) {
      return { success: false, message: '대상을 지정해야 합니다.' };
    }

    // 이미 사용했는지 확인
    if (this.hasBeenUsed) {
      return { success: false, message: '이미 사용했습니다.' };
    }

    // 초반 보호 규칙이 활성화되었는지 확인
    if (!this.isEarlyProtectionActive) {
      return { success: false, message: '초반 보호 규칙이 활성화되지 않았습니다.' };
    }

    const target = context.players.find(p => p.id === targetId);
    if (!target) {
      return { success: false, message: '대상을 찾을 수 없습니다.' };
    }

    // 자신과는 교체 불가
    if (targetId === this.ownerId) {
      return { success: false, message: '자신과는 번호를 교체할 수 없습니다.' };
    }

    // 번호 교체 실행
    await this.swapPlayerNumbers(context.player, target);
    this.hasBeenUsed = true;

    return {
      success: true,
      message: `${context.player.name}과 ${target.name}의 번호가 교체되었습니다!`,
      target: targetId
    };
  }

  private async swapPlayerNumbers(player1: Player, player2: Player): Promise<void> {
    // 플레이어 ID 교체
    const tempId = player1.id;
    player1.id = player2.id;
    player2.id = tempId;

    // 게임 시스템에 번호 교체 알림
    this.setSession('number_swap', {
      player1Id: player2.id, // 교체 후 ID
      player2Id: player1.id, // 교체 후 ID
      turn: this.getSession('current_turn') as number || 0
    });

    console.log(`[운명 교차] ${player1.name}(ID: ${player1.id})과 ${player2.name}(ID: ${player2.id})의 번호가 교체되었습니다.`);
  }

  // 초반 보호 규칙 활성화 체크
  async onTurnStart(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    
    // 초반 보호 규칙은 1-3턴 사이에 첫번째 선택으로 활성화
    if (currentTurn <= 3 && !this.isEarlyProtectionActive) {
      // 게임 시스템에서 초반 보호 규칙 상태 확인
      const earlyProtectionStatus = this.getSession('early_protection_status') as any;
      
      if (earlyProtectionStatus && earlyProtectionStatus.isFirstChoice) {
        this.isEarlyProtectionActive = true;
        console.log(`[운명 교차] 초반 보호 규칙 첫번째 선택으로 활성화되었습니다.`);
      }
    }
  }

  // 초반 보호 규칙 상태 업데이트 (게임 시스템에서 호출)
  updateEarlyProtectionStatus(isFirstChoice: boolean): void {
    this.setSession('early_protection_status', {
      isFirstChoice,
      activated: isFirstChoice
    });
  }

  // 능력 사용 가능 여부 체크
  protected canUseAbility(context: AbilityContext): boolean {
    // 초반 보호 규칙이 활성화되어 있고 아직 사용하지 않았을 때만 사용 가능
    return this.isEarlyProtectionActive && !this.hasBeenUsed && this.isActive;
  }

  // 초반 보호 규칙 활성화 여부 확인
  getEarlyProtectionActive(): boolean {
    return this.isEarlyProtectionActive;
  }

  // 번호 교체 이력 확인
  hasNumberBeenSwapped(): boolean {
    return this.hasBeenUsed;
  }
} 
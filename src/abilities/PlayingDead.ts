import { BaseAbility } from './BaseAbility';
import { AbilityContext, PlayerStatus } from '../types/game.types';

export class PlayingDead extends BaseAbility {
  constructor() {
    super(
      'playingDead',
      '죽은 척',
      '즉시 탈락 상태가 되며, 이번 턴 로그에는 행동하지 않은 것으로 기록됩니다.',
      0, // maxCooldown
      1  // maxUses
    );
  }

  async execute(context: AbilityContext): Promise<{ success: boolean; message: string }> {
    try {
      const owner = this.getOwnerPlayer();
      
      if (!owner) {
        return { success: false, message: '소유자를 찾을 수 없습니다.' };
      }

      // 이미 탈락 상태라면 부활
      if (owner.hp <= 0) {
        const deathTurn = this.getSession<number>('deathTurn', {
          validate: (v): v is number => typeof v === 'number',
          defaultValue: 0
        });
        
        const turnsSinceDeath = context.currentTurn - deathTurn;
        await this.revive(owner, turnsSinceDeath);
        
        return { 
          success: true, 
          message: `${turnsSinceDeath}턴 후 부활했습니다.` 
        };
      }

      // 처음 사용하는 경우 - 탈락 상태로 설정
      owner.hp = 0;
      owner.status = PlayerStatus.DEAD;
      
      // 이번 턴 행동을 PASS로 설정하여 로그에 기록되지 않도록 함
      owner.actionType = 'PASS';
      owner.targetId = undefined;

      // 탈락 시점 기록
      this.setSession('deathTurn', context.currentTurn);
      
      this.maxUses--;
      this.addLog(context, `[죽은 척] ${owner.name}이 죽은 척을 했습니다.`);
      
      return { 
        success: true, 
        message: '죽은 척을 했습니다.' 
      };
      
    } catch (error) {
      console.error('[죽은 척] 실행 오류:', error);
      return { success: false, message: '죽은 척 실행 중 오류가 발생했습니다.' };
    }
  }

  // 탈락 상태에서도 재사용 가능
  canUseAbility(context: AbilityContext): boolean {
    const owner = this.getOwnerPlayer();
    if (!owner) return false;

    // 탈락 상태에서도 사용 가능
    if (owner.hp <= 0) {
      return this.maxUses > 0;
    }

    return this.maxUses > 0;
  }

  // 재사용시 체력 회복 및 게임 재참가
  async onTurnStart(event: any): Promise<void> {
    const owner = this.getOwnerPlayer();
    if (!owner) return;

    const deathTurn = this.getSession<number>('deathTurn', {
      validate: (v): v is number => typeof v === 'number',
      defaultValue: 0
    });

    const currentTurn = event.data.turn || 1;
    const turnsSinceDeath = currentTurn - deathTurn;

    // 5번째 턴 종료시 자동 재사용
    if (turnsSinceDeath >= 5 && owner.hp <= 0) {
      await this.revive(owner, turnsSinceDeath);
    }
  }

  // 부활 메서드
  private async revive(owner: any, turnsSinceDeath: number): Promise<void> {
    // 체력 회복 (탈락 상태로 경과한 턴 수만큼)
    owner.hp = Math.min(owner.maxHp, turnsSinceDeath);
    owner.status = PlayerStatus.ALIVE;
    
    // 다음 턴에 다시 참가
    owner.actionType = undefined;
    owner.targetId = undefined;
    
    console.log(`[죽은 척] ${owner.name}이 ${turnsSinceDeath}턴 후 부활했습니다. (체력: ${owner.hp})`);
    
    // 탈락 시점 초기화
    this.setSession('deathTurn', 0);
  }
} 
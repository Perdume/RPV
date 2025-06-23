import { BaseAbility } from './BaseAbility';
import { AbilityContext, Player, ModifiableEvent, AttackEvent, PlayerStatus } from '../types/game.types';

export class FallenCrown extends BaseAbility {
  private emphasizedPlayers: Set<number> = new Set(); // 강조된 플레이어들
  private deathSubstitutions: number = 2; // 게임당 2회

  constructor() {
    super('fallenCrown', '무너져내린 왕관', '플레이어를 강조하여 신하로 만듭니다.', 0, Infinity);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    const targetId = parameters.targetId;
    if (!targetId) {
      return { success: false, message: '대상을 지정해야 합니다.' };
    }

    const target = context.players.find(p => p.id === targetId);
    if (!target) {
      return { success: false, message: '대상을 찾을 수 없습니다.' };
    }

    // 이미 강조된 플레이어인지 확인
    if (this.emphasizedPlayers.has(targetId)) {
      return { success: false, message: '이미 강조된 플레이어입니다.' };
    }

    // 자신은 강조할 수 없음
    if (targetId === this.ownerId) {
      return { success: false, message: '자신은 강조할 수 없습니다.' };
    }

    // 플레이어 강조
    this.emphasizedPlayers.add(targetId);
    
    // 타겟팅 제한 설정
    this.restrictTargeting(targetId);
    
    // 다음 턴 자신의 능력 봉인
    this.setSession('seal_own_ability', {
      turn: context.currentTurn + 1
    });

    return {
      success: true,
      message: `${context.player.name}이(가) ${target.name}을 신하로 강조합니다!`,
      target: targetId
    };
  }

  private restrictTargeting(playerId: number): void {
    // 강조된 플레이어는 왕(자신)을 공격/능력 대상으로 지정 불가
    this.setSession('targeting_restrictions', {
      restrictedPlayer: playerId,
      forbiddenTarget: this.ownerId
    });
  }

  // 패시브 1: 모든 생존자가 강조되면 승리
  async onTurnEnd(event: ModifiableEvent): Promise<void> {
    const players = this.getSession('players') as Player[] || [];
    const alivePlayers = players.filter(p => 
      p.status === PlayerStatus.ALIVE && p.id !== this.ownerId
    );

    const allEmphasized = alivePlayers.every(p => 
      this.emphasizedPlayers.has(p.id)
    );

    if (allEmphasized && alivePlayers.length > 0) {
      // 특수 승리 조건 트리거
      console.log(`[무너져내린 왕관] 모든 생존자가 강조됨 - 왕의 승리!`);
      
      // 게임 종료 이벤트 발생
      const victoryEvent: ModifiableEvent = {
        type: 'GAME_END' as any,
        timestamp: Date.now(),
        data: {
          winner: this.ownerId,
          victoryType: 'CROWN_VICTORY',
          message: '모든 신하를 거느린 왕의 승리!'
        },
        cancelled: false,
        modified: false
      };
      
      // 이벤트 시스템을 통해 이벤트 발생
      const eventSystem = this.getSession('eventSystem') as import('../utils/eventSystem').EventSystem;
      if (eventSystem && typeof eventSystem.emit === 'function') {
        await eventSystem.emit(victoryEvent);
      }
    }
  }

  // 패시브 2: 짝수 턴 시작시 강조된 플레이어들 혜택
  async onTurnStart(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;

    if (currentTurn % 2 === 0) {
      const players = this.getSession('players') as Player[] || [];
      
      for (const playerId of this.emphasizedPlayers) {
        const player = players.find(p => p.id === playerId);
        if (player && player.status === PlayerStatus.ALIVE) {
          // 체력 1 회복
          player.hp = Math.min(player.maxHp, player.hp + 1);
          
          // 받는 피해 1 감소 상태이상 부여
          this.applyStatusEffect(playerId, 'damage_reduction', 1, 1);
          
          console.log(`[무너져내린 왕관] ${player.name}이 왕의 축복을 받습니다.`);
        }
      }
    }
  }

  // 패시브 3: 자신 탈락 시 강조된 플레이어 중 1명 대신 탈락
  async onBeforeDeath(event: ModifiableEvent): Promise<void> {
    const data = event.data as any;
    
    if (data.playerId === this.ownerId && this.deathSubstitutions > 0) {
      const players = this.getSession('players') as Player[] || [];
      const availableSubstitutes = Array.from(this.emphasizedPlayers).filter(id => {
        const player = players.find(p => p.id === id);
        return player && player.status === PlayerStatus.ALIVE;
      });

      if (availableSubstitutes.length > 0) {
        // 랜덤하게 1명 선택하여 대신 탈락
        const substituteId = availableSubstitutes[Math.floor(Math.random() * availableSubstitutes.length)];
        const substitute = players.find(p => p.id === substituteId);
        
        if (substitute) {
          // 자신의 죽음을 방지
          event.cancelled = true;
          
          // 대신 신하가 탈락
          substitute.hp = 0;
          substitute.status = PlayerStatus.DEAD;
          this.emphasizedPlayers.delete(substituteId);
          this.deathSubstitutions--;
          
          console.log(`[무너져내린 왕관] ${substitute.name}이 왕을 대신하여 탈락합니다. (남은 횟수: ${this.deathSubstitutions})`);
        }
      }
    }
  }

  // 강조된 플레이어의 타겟팅 제한 처리
  async onBeforeAction(event: ModifiableEvent): Promise<void> {
    const data = event.data as any;
    const restrictions = this.getSession('targeting_restrictions') as any;
    
    if (restrictions && data.playerId === restrictions.restrictedPlayer) {
      if (data.targetId === restrictions.forbiddenTarget) {
        event.cancelled = true;
        console.log(`[무너져내린 왕관] ${data.playerId}는 왕을 대상으로 지정할 수 없습니다.`);
      }
    }
  }

  // 강조된 플레이어 목록 조회
  getEmphasizedPlayers(): number[] {
    return Array.from(this.emphasizedPlayers);
  }

  // 강조 상태 확인
  isEmphasized(playerId: number): boolean {
    return this.emphasizedPlayers.has(playerId);
  }

  // 남은 대체 횟수 조회
  getRemainingSubstitutions(): number {
    return this.deathSubstitutions;
  }
} 
import { BaseAbility } from './BaseAbility';
import { AbilityContext, Player, ModifiableEvent, AttackEvent, PlayerStatus } from '../types/game.types';

export class GhostSummoning extends BaseAbility {
  private ghostCount: number = 0; // 원귀가 아닌 플레이어 탈락 카운트

  constructor() {
    super('ghostSummoning', '원귀 강령', '탈락한 플레이어를 원귀로 부활시킵니다.', 0, 2);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    const targetId = parameters.targetId;
    if (!targetId) {
      return { success: false, message: '탈락한 플레이어를 지정해야 합니다.' };
    }

    const target = context.players.find(p => p.id === targetId);
    if (!target) {
      return { success: false, message: '대상을 찾을 수 없습니다.' };
    }

    // 탈락한 플레이어인지 확인
    if (target.status !== PlayerStatus.DEAD) {
      return { success: false, message: '탈락한 플레이어만 부활시킬 수 있습니다.' };
    }

    // 원귀가 아닌지 확인
    if (target.isGhost) {
      return { success: false, message: '이미 원귀입니다.' };
    }

    // 원귀로 부활
    target.status = PlayerStatus.ALIVE;
    target.hp = 1;
    target.maxHp = 1;
    target.isGhost = true;

    // 원귀 특성 적용
    this.applyGhostProperties(target);

    return {
      success: true,
      message: `${context.player.name}이(가) ${target.name}을 원귀로 부활시킵니다!`,
      target: targetId
    };
  }

  // 패시브: 원귀가 아닌 플레이어가 3명 탈락할 때마다 사용 가능 횟수를 1회 얻음
  async onAfterDeath(event: ModifiableEvent): Promise<void> {
    const data = event.data as any;
    const deadPlayer = data.player;
    
    if (deadPlayer && !deadPlayer.isGhost) {
      this.ghostCount++;
      
      if (this.ghostCount % 3 === 0) {
        this.maxUses = Math.min(this.maxUses + 1, 2);
        console.log(`[원귀 강령] 원귀가 아닌 플레이어 ${this.ghostCount}명 탈락으로 사용 횟수 1회 획득`);
      }
    }
  }

  // 원귀 특성 적용
  private applyGhostProperties(ghost: Player): void {
    // 체력을 변동시키는 능력의 영향을 받지 않음
    ghost.isInvincible = false; // 무적은 아님
    ghost.customFlags = ghost.customFlags || new Map();
    ghost.customFlags.set('ghost_immune_to_hp_changes', true);
    
    // 매 턴 방어/회피 사용하지 않은 무작위 플레이어 공격
    this.setSession('ghost_auto_attack', {
      ghostId: ghost.id,
      active: true
    });
    
    console.log(`[원귀 강령] ${ghost.name}이 원귀로 부활했습니다.`);
  }

  // 원귀의 자동 공격 처리
  async onTurnStart(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const ghostData = this.getSession('ghost_auto_attack') as any;
    
    if (ghostData && ghostData.active) {
      const ghost = this.findPlayer(ghostData.ghostId);
      if (ghost && ghost.status === PlayerStatus.ALIVE && ghost.isGhost) {
        await this.executeGhostAttack(ghost, currentTurn);
      }
    }
  }

  // 원귀의 무작위 공격 실행
  private async executeGhostAttack(ghost: Player, currentTurn: number): Promise<void> {
    const players = this.getSession('players') as Player[] || [];
    
    // 방어/회피 사용하지 않은 생존 플레이어들 필터링
    const availableTargets = players.filter(p => 
      p.id !== ghost.id && 
      p.status === PlayerStatus.ALIVE && 
      !p.isGhost &&
      p.actionType !== 'DEFEND' && 
      p.actionType !== 'EVADE'
    );

    if (availableTargets.length > 0) {
      // 무작위 타겟 선택
      const randomTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
      
      // 1 데미지 공격
      randomTarget.hp = Math.max(0, randomTarget.hp - 1);
      randomTarget.wasAttacked = true;
      
      // 사망 체크
      if (randomTarget.hp <= 0) {
        randomTarget.status = PlayerStatus.DEAD;
        console.log(`[원귀 강령] ${ghost.name}의 공격으로 ${randomTarget.name}이 탈락했습니다.`);
      } else {
        console.log(`[원귀 강령] ${ghost.name}이 ${randomTarget.name}을 공격했습니다.`);
      }
    }
  }

  // 체력 변동 능력으로부터 보호
  async onBeforeHeal(event: ModifiableEvent): Promise<void> {
    const data = event.data as any;
    const target = this.findPlayer(data.targetId);
    
    if (target && target.isGhost && target.customFlags?.get('ghost_immune_to_hp_changes')) {
      event.cancelled = true;
      console.log(`[원귀 강령] ${target.name}은 체력 변동 능력의 영향을 받지 않습니다.`);
    }
  }

  async onBeforeAttack(event: ModifiableEvent): Promise<void> {
    const data = event.data as AttackEvent;
    const target = this.findPlayer(data.target);
    
    if (target && target.isGhost && target.customFlags?.get('ghost_immune_to_hp_changes')) {
      // 체력 감소는 허용하되, 체력 증가 능력은 무시
      // 공격은 정상적으로 처리됨
    }
  }

  private findPlayer(playerId: number): Player | null {
    // GameState에서 플레이어 찾기 (의존성 주입 필요)
    return null; // 실제 구현에서는 GameState 참조
  }

  // 원귀 통계 조회
  getGhostStats(): { totalGhosts: number; activeGhosts: number } {
    const players = this.getSession('players') as Player[] || [];
    const ghosts = players.filter(p => p.isGhost);
    const activeGhosts = ghosts.filter(p => p.status === PlayerStatus.ALIVE);
    
    return {
      totalGhosts: ghosts.length,
      activeGhosts: activeGhosts.length
    };
  }
} 
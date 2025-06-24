import { BaseAbility } from './BaseAbility';
import { AbilityContext, Player, ModifiableEvent, AttackEvent, PlayerStatus } from '../types/game.types';

export class Judge extends BaseAbility {
  private passCoins: Map<number, number> = new Map(); // 플레이어별 패스코인
  private maxPassCoins: number = 3; // 최대 패스코인
  private isAutoAssigned: boolean = false;

  constructor() {
    super('judge', '심판자', '자동으로 패스코인 시스템을 관리합니다.', 0, 0);
    this.isActive = false; // 수동 사용 불가
  }

  async execute(context: AbilityContext): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    return { success: false, message: '심판자는 수동으로 능력을 사용할 수 없습니다.' };
  }

  // 게임 시작시 0번 자동 배정
  async onGameStart(event: ModifiableEvent): Promise<void> {
    if (!this.isAutoAssigned) {
      // 0번 플레이어로 자동 배정
      this.ownerId = 0;
      this.isAutoAssigned = true;
      
      // 체력 5000으로 설정
      const judgePlayer = this.getOwnerPlayer();
      if (judgePlayer) {
        judgePlayer.hp = 5000;
        judgePlayer.maxHp = 5000;
      }
      
      console.log(`[심판자] 0번 플레이어로 자동 배정되었습니다.`);
    }
  }

  // 매턴 자동 발동
  async onTurnStart(event: ModifiableEvent): Promise<void> {
    const turnData = event.data as any;
    const currentTurn = turnData.turn;
    
    // 자신의 체력을 5000으로 설정 (매턴 회복)
    const judgePlayer = turnData.players?.find((p: any) => p.id === this.ownerId);
    if (judgePlayer) {
      judgePlayer.hp = 5000;
      judgePlayer.maxHp = 5000;
    }

    // 모든 플레이어의 행동 상태 확인
    for (const player of turnData.players || []) {
      if (player.id === this.ownerId) continue; // 자신 제외
      if (player.status === 'DEAD') continue; // 탈락자 제외

      // 행동하지 않은 플레이어에게 패스코인 적용
      if (this.isPlayerInactive(player)) {
        await this.applyPassCoin(player, currentTurn);
      } else {
        // 행동한 플레이어는 패스코인 초기화
        this.passCoins.set(player.id, 0);
      }
    }
  }

  private isPlayerInactive(player: any): boolean {
    // 행동을 선택하지 않은 경우 (actionType이 없거나 PASS)
    return !player.actionType || player.actionType === 'PASS';
  }

  private async applyPassCoin(player: any, currentTurn: number): Promise<void> {
    const currentCoins = this.passCoins.get(player.id) || 0;
    const newCoins = currentCoins + 1;
    this.passCoins.set(player.id, newCoins);

    console.log(`[심판자] ${player.name}에게 패스코인 적용: ${newCoins}`);

    // 자동 공격 실행
    const damage = newCoins >= 3 ? 100 : 1;
    await this.executeJudgeAttack(player, damage, currentTurn);
  }

  private async executeJudgeAttack(target: any, damage: number, currentTurn: number): Promise<void> {
    const oldHp = target.hp;
    target.hp = Math.max(0, target.hp - damage);
    target.wasAttacked = true;

    console.log(`[심판자] ${target.name}에게 심판 공격: ${damage} 데미지 (${oldHp} → ${target.hp})`);

    // 사망 처리
    if (target.hp <= 0) {
      target.status = 'DEAD';
      console.log(`[심판자] ${target.name}이(가) 심판으로 탈락했습니다.`);
    }

    // 패스코인 3 달성 시 100 데미지 후 초기화
    if (damage === 100) {
      this.passCoins.set(target.id, 0);
    }
  }

  // 자신을 타겟팅하는 공격을 본인에게 리다이렉트
  async onBeforeAttack(event: ModifiableEvent): Promise<void> {
    const data = event.data as any;
    if (data.target === this.ownerId) {
      data.target = data.attacker; // 공격자 자신을 공격
      event.modified = true;
      console.log(`[심판자] 심판자를 향한 공격이 ${data.attacker}에게 리다이렉트됩니다.`);
    }
  }

  // 심판자는 승리 불가능 - 게임 종료시 승리 조건에서 제외
  async onGameEnd(event: ModifiableEvent): Promise<void> {
    const gameEndData = event.data as any;
    
    // 심판자가 승리자로 설정된 경우 제거
    if (gameEndData.winner === this.ownerId) {
      gameEndData.winner = null;
      gameEndData.victoryType = 'NO_WINNER';
      gameEndData.message = '심판자는 승리할 수 없습니다.';
      event.modified = true;
      console.log(`[심판자] 심판자는 승리 대상에서 제외됩니다.`);
    }
  }

  // 패스코인 상태 조회
  getPassCoin(playerId: number): number {
    return this.passCoins.get(playerId) || 0;
  }

  // 모든 패스코인 상태 조회
  getAllPassCoins(): Map<number, number> {
    return new Map(this.passCoins);
  }

  // 패스코인 초기화
  resetPassCoins(): void {
    this.passCoins.clear();
  }

  // 특정 플레이어의 패스코인 초기화
  resetPlayerPassCoin(playerId: number): void {
    this.passCoins.set(playerId, 0);
  }

  // 심판자 통계 조회
  getJudgeStats(): { 
    totalPlayersWithCoins: number; 
    maxCoins: number; 
    playersAtMaxCoins: number 
  } {
    let totalPlayersWithCoins = 0;
    let maxCoins = 0;
    let playersAtMaxCoins = 0;

    for (const [playerId, coins] of this.passCoins.entries()) {
      if (coins > 0) {
        totalPlayersWithCoins++;
        if (coins > maxCoins) {
          maxCoins = coins;
        }
        if (coins >= this.maxPassCoins) {
          playersAtMaxCoins++;
        }
      }
    }

    return {
      totalPlayersWithCoins,
      maxCoins,
      playersAtMaxCoins
    };
  }

  // 심판자 여부 확인
  isJudge(playerId: number): boolean {
    return playerId === this.ownerId;
  }
} 
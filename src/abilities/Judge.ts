import { BaseAbility } from './BaseAbility';
import { AbilityContext, Player, ModifiableEvent, AttackEvent, PlayerStatus } from '../types/game.types';

export class Judge extends BaseAbility {
  private passCoins: Map<number, number> = new Map(); // 플레이어별 패스코인
  private maxPassCoins: number = 3; // 최대 패스코인

  constructor() {
    super('judge', '심판자', '자동으로 패스코인 시스템을 관리합니다.', 0, 0);
    this.isActive = false; // 수동 사용 불가
  }

  async execute(context: AbilityContext): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    return { success: false, message: '심판자는 수동으로 능력을 사용할 수 없습니다.' };
  }

  // 매턴 자동 발동
  async onTurnStart(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const players = this.getSession('players') as Player[] || [];
    
    // 자신의 체력을 5000으로 설정
    const judgePlayer = players.find(p => p.id === this.ownerId);
    if (judgePlayer) {
      judgePlayer.hp = 5000;
      judgePlayer.maxHp = 5000;
    }

    // 모든 플레이어의 행동 상태 확인
    for (const player of players) {
      if (player.id === this.ownerId) continue; // 자신 제외
      if (player.status === PlayerStatus.DEAD) continue; // 탈락자 제외

      // 행동하지 않은 플레이어에게 패스코인 적용
      if (this.isPlayerInactive(player)) {
        await this.applyPassCoin(player, currentTurn);
      } else {
        // 행동한 플레이어는 패스코인 초기화
        this.passCoins.set(player.id, 0);
      }
    }
  }

  private isPlayerInactive(player: Player): boolean {
    // 행동을 선택하지 않은 경우 (actionType이 없거나 PASS)
    return !player.actionType || player.actionType === 'PASS';
  }

  private async applyPassCoin(player: Player, currentTurn: number): Promise<void> {
    const currentCoins = this.passCoins.get(player.id) || 0;
    const newCoins = currentCoins + 1;
    this.passCoins.set(player.id, newCoins);

    console.log(`[심판자] ${player.name}에게 패스코인 적용: ${newCoins}`);

    // 자동 공격 실행
    const damage = newCoins >= this.maxPassCoins ? 100 : 1;
    await this.executeJudgeAttack(player, damage, currentTurn);
  }

  private async executeJudgeAttack(target: Player, damage: number, currentTurn: number): Promise<void> {
    const oldHp = target.hp;
    target.hp = Math.max(0, target.hp - damage);
    target.wasAttacked = true;

    console.log(`[심판자] ${target.name}에게 심판 공격: ${damage} 데미지 (${oldHp} → ${target.hp})`);

    // 사망 처리
    if (target.hp <= 0) {
      target.status = PlayerStatus.DEAD;
      console.log(`[심판자] ${target.name}이(가) 심판으로 탈락했습니다.`);
    }

    // 패스코인 3 달성 시 100 데미지 후 초기화
    if (damage === 100) {
      this.passCoins.set(target.id, 0);
    }
  }

  // 자신을 타겟팅하는 공격을 본인에게 리다이렉트
  async onBeforeAttack(event: ModifiableEvent): Promise<void> {
    const data = event.data as AttackEvent;
    if (data.target === this.ownerId) {
      data.newTarget = data.attacker; // 공격자 자신을 공격
      event.modified = true;
      console.log(`[심판자] 심판자를 향한 공격이 ${data.attacker}에게 리다이렉트됩니다.`);
    }
  }

  // 게임 시작 시 특수 설정
  async onGameStart(event: ModifiableEvent): Promise<void> {
    // 0번 플레이어로 자동 배정 (게임 시스템에서 처리)
    console.log(`[심판자] 심판자 시스템이 활성화되었습니다.`);
  }

  // 심판자는 승리 불가
  async onGameEnd(event: ModifiableEvent): Promise<void> {
    // 승리 조건에서 제외 (게임 시스템에서 처리)
    console.log(`[심판자] 심판자는 승리 대상에서 제외됩니다.`);
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
} 
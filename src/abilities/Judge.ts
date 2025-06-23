import { BaseAbility } from './BaseAbility';
import { AbilityContext } from '../types/game.types';

export class Judge extends BaseAbility {
  constructor() {
    super('judge', '심판자', '매턴 자동으로 발동하여 행동을 선택하지 않은 플레이어를 공격합니다.', 0, 0);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    // 심판자는 능력 사용이 불가능합니다
    return { success: false, message: '심판자는 능력을 사용할 수 없습니다.' };
  }

  // 매턴 자동으로 발동
  async onTurnStart(event: any): Promise<void> {
    // 체력 5000 회복
    if (event.data.players) {
      const judgePlayer = event.data.players.find((p: any) => p.id === this.ownerId);
      if (judgePlayer) {
        judgePlayer.hp = 5000;
        console.log(`[심판자] 체력이 5000으로 회복되었습니다.`);
      }
    }
    // 행동하지 않은 플레이어 공격
    const turn = event.data.turn;
    const players = event.data.players || [];
    const inactivePlayers = players.filter((p: any) => 
      p.status !== 'DEAD' && 
      (!p.actionType || p.actionType === 'PASS')
    );
    for (const player of inactivePlayers) {
      const passCoins = (this.getTurn(`pass_coins_${player.id}`, turn) as number) || 0;
      this.setTurn(`pass_coins_${player.id}`, passCoins + 1, turn);
      console.log(`[심판자] ${player.name}에게 패스코인 1 적용 (총 ${passCoins + 1})`);
      if (passCoins + 1 >= 3) {
        const attackEvent = {
          type: 'JUDGE_ATTACK',
          data: {
            attacker: this.ownerId,
            target: player.id,
            damage: 100,
            isJudgeAttack: true
          }
        };
        console.log(`[심판자] ${player.name}에게 100 데미지 심판 공격!`);
        if (event.eventSystem) {
          await event.eventSystem.emit(attackEvent);
        }
      } else {
        const attackEvent = {
          type: 'JUDGE_ATTACK',
          data: {
            attacker: this.ownerId,
            target: player.id,
            damage: 1,
            isJudgeAttack: true
          }
        };
        console.log(`[심판자] ${player.name}에게 1 데미지 심판 공격!`);
        if (event.eventSystem) {
          await event.eventSystem.emit(attackEvent);
        }
      }
    }
  }

  // 자신을 타겟팅할 경우 본인을 공격하는 것으로 변경
  async onBeforeAttack(event: any): Promise<void> {
    if (event.data.target === this.ownerId) {
      event.data.target = this.ownerId; // 본인을 공격
      console.log(`[심판자] 심판자를 타겟팅한 공격이 본인 공격으로 변경됩니다.`);
    }
    if (event.data.attacker === this.ownerId) {
      // 심판자 자신이 공격할 때는 패스코인 리셋
      const turn = event.data.turn;
      this.setTurn(`pass_coins_${this.ownerId}`, 0, turn);
    }
  }

  async onBeforeDefend(event: any): Promise<void> {
    if (event.data.player === this.ownerId) {
      const turn = event.data.turn;
      this.setTurn(`pass_coins_${this.ownerId}`, 0, turn);
    }
  }

  async onBeforeEvade(event: any): Promise<void> {
    if (event.data.player === this.ownerId) {
      const turn = event.data.turn;
      this.setTurn(`pass_coins_${this.ownerId}`, 0, turn);
    }
  }

  async onBeforePass(event: any): Promise<void> {
    if (event.data.player === this.ownerId) {
      const turn = event.data.turn;
      this.setTurn(`pass_coins_${this.ownerId}`, 0, turn);
    }
  }

  // 게임 시작시 특수 설정
  async onGameStart(event: any): Promise<void> {
    if (this.ownerId !== 0) {
      console.log(`[심판자] 심판자는 0번 플레이어로 설정됩니다.`);
    }
    if (event.data.players) {
      const judgePlayer = event.data.players.find((p: any) => p.id === this.ownerId);
      if (judgePlayer) {
        judgePlayer.maxHp = 5000;
        judgePlayer.hp = 5000;
        console.log(`[심판자] 최대 체력이 5000으로 설정되었습니다.`);
      }
    }
  }
} 
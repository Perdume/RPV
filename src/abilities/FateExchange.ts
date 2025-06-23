import { BaseAbility } from './BaseAbility';
import { AbilityContext, Player, ModifiableEvent } from '../types/game.types';

export class FateExchange extends BaseAbility {
  private fateExchangeActive: boolean = false; // 초반 보호 규칙 첫번째 선택시 활성화

  constructor() {
    super('fateExchange', '운명 교차', '대상 플레이어와 번호를 교체합니다.', 0, 0);
  }

  // 초반 보호 규칙 첫번째 선택시 활성화
  activateFateExchange(): void {
    this.fateExchangeActive = true;
    this.maxUses = 1;
    console.log(`[운명 교차] 능력이 활성화되었습니다.`);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    if (!this.fateExchangeActive) {
      return { success: false, message: '아직 활성화되지 않았습니다.' };
    }

    const targetId = parameters.targetId;
    if (!targetId) {
      return { success: false, message: '대상을 지정해야 합니다.' };
    }

    const target = context.players.find(p => p.id === targetId);
    if (!target) {
      return { success: false, message: '대상을 찾을 수 없습니다.' };
    }

    // 자신과 대상의 번호 교체
    const ownerPlayer = context.player;
    const ownerNumber = ownerPlayer.id;
    const targetNumber = target.id;

    // 번호 교체 실행
    this.exchangePlayerNumbers(ownerPlayer, target);

    return {
      success: true,
      message: `${ownerPlayer.name}과 ${target.name}의 번호가 교체되었습니다!`,
      target: targetId
    };
  }

  private exchangePlayerNumbers(player1: Player, player2: Player): void {
    // 번호 교체 (실제로는 플레이어 ID 교체)
    const tempId = player1.id;
    player1.id = player2.id;
    player2.id = tempId;

    // 이름도 임시로 교체하여 구분
    const tempName = player1.name;
    player1.name = player2.name;
    player2.name = tempName;

    // 행동은 변화시키지 않음 (기존 행동 유지)
    console.log(`[운명 교차] ${player1.name}(이전 ${player2.name})과 ${player2.name}(이전 ${player1.name})의 번호가 교체되었습니다.`);
  }

  // 게임 시작 시 초기화
  async onGameStart(event: ModifiableEvent): Promise<void> {
    this.fateExchangeActive = false;
    this.maxUses = 0;
    console.log(`[운명 교차] 게임 시작으로 초기화되었습니다.`);
  }

  // 활성화 상태 확인
  isFateExchangeActive(): boolean {
    return this.fateExchangeActive;
  }

  // 초반 보호 규칙에서 호출될 메서드
  static activateForPlayer(playerId: number): void {
    // 해당 플레이어의 운명 교차 능력을 활성화
    console.log(`[운명 교차] 플레이어 ${playerId}의 운명 교차가 활성화되었습니다.`);
  }
} 
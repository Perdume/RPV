import { BaseAbility } from './BaseAbility';
import { AbilityContext, ModifiableEvent, Player, StatusEffectId, StatusEffect } from '../types/game.types';

export class Alzheimer extends BaseAbility {
  private statusHiddenPlayers: Set<number> = new Set(); // 상태 확인 불가 플레이어들

  constructor() {
    super('alzheimer', '알츠하이머', '대상에게 알츠하이머를 적용하여 로그 조작과 상태이상을 부여합니다.', 0, 2);
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

    // 로그에서 행동을 숨김
    const turnProcessor = this.getTurnProcessor(context);
    if (turnProcessor) {
      turnProcessor.hidePlayerAction(this.ownerId!, context.currentTurn);
    }

    // 다음 턴 무작위 상태이상 적용 및 상태 확인 불가 설정
    this.setSession('next_turn_debuffs', {
      targetId,
      turn: context.currentTurn + 1
    });

    // 상태 확인 불가 플레이어에 추가
    this.statusHiddenPlayers.add(targetId);

    return {
      success: true,
      message: `알츠하이머 능력이 발동되었습니다.`, // 로그에는 나타나지 않음
      target: targetId
    };
  }

  // 다음 턴 상태이상 적용
  async onTurnStart(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const debuffData = this.getSession('next_turn_debuffs') as any;
    
    if (debuffData && debuffData.turn === currentTurn) {
      const targetId = debuffData.targetId;
      const target = this.getPlayerById(targetId);
      
      if (target) {
        // 무작위 상태이상 2개 선택
        const possibleDebuffs: StatusEffectId[] = [
          'damage_reduction', 'crack', 'damage_increase', 'ability_seal'
        ];
        
        const selectedDebuffs = this.getRandomDebuffs(possibleDebuffs, 2);
        
        // 상태이상 적용
        selectedDebuffs.forEach(debuffId => {
          this.applyStatusEffect(targetId, debuffId as StatusEffectId, 1, 1);
        });
        
        console.log(`[알츠하이머] ${target.name}에게 상태이상 적용: ${selectedDebuffs.join(', ')}`);
      }
      
      // 세션 데이터 정리
      this.setSession('next_turn_debuffs', null);
    }
  }

  // 상태 확인 불가 처리
  async onBeforeStatusCheck(event: ModifiableEvent): Promise<void> {
    const data = event.data as any;
    const playerId = data.playerId;
    
    if (this.statusHiddenPlayers.has(playerId)) {
      const player = this.getPlayerById(playerId);
      
      if (player) {
        // 능력이 봉인된 경우에만 해당 상태이상만 고지
        const abilitySealEffect = player.statusEffects.find((effect: StatusEffect) => effect.id === 'ability_seal');
        
        if (abilitySealEffect) {
          // 능력 봉인 상태이상만 보여주고 나머지는 숨김
          data.visibleStatusEffects = [abilitySealEffect];
          data.statusHidden = true;
          event.modified = true;
          
          console.log(`[알츠하이머] ${player.name}의 상태 확인이 제한됩니다. (능력 봉인만 표시)`);
        } else {
          // 모든 상태이상 숨김
          data.visibleStatusEffects = [];
          data.statusHidden = true;
          event.modified = true;
          
          console.log(`[알츠하이머] ${player.name}의 상태 확인이 불가능합니다.`);
        }
      }
    }
  }

  // 턴 종료시 상태 확인 불가 해제
  async onTurnEnd(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const debuffData = this.getSession('next_turn_debuffs') as any;
    
    // 다음 턴 상태이상이 적용된 턴이 끝나면 상태 확인 불가 해제
    if (debuffData && debuffData.turn === currentTurn - 1) {
      const targetId = debuffData.targetId;
      this.statusHiddenPlayers.delete(targetId);
      
      const target = this.getPlayerById(targetId);
      if (target) {
        console.log(`[알츠하이머] ${target.name}의 상태 확인이 다시 가능해집니다.`);
      }
    }
  }

  private getRandomDebuffs(possibleDebuffs: StatusEffectId[], count: number): StatusEffectId[] {
    const shuffled = [...possibleDebuffs].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  private getPlayerById(playerId: number): Player | null {
    // 게임 시스템에서 플레이어 찾기 (의존성 주입 필요)
    return null; // 실제 구현에서는 GameState 참조
  }

  private getTurnProcessor(context: AbilityContext): any {
    // TurnProcessor 인스턴스 접근 (의존성 주입 필요)
    return (context as any).turnProcessor;
  }

  // 상태 확인 불가 플레이어 목록 조회
  getStatusHiddenPlayers(): number[] {
    return Array.from(this.statusHiddenPlayers);
  }

  // 특정 플레이어의 상태 확인 불가 여부 확인
  isStatusHidden(playerId: number): boolean {
    return this.statusHiddenPlayers.has(playerId);
  }
} 
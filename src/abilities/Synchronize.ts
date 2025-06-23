import { BaseAbility } from './BaseAbility';
import { AbilityContext, Player, ModifiableEvent, AttackEvent, PlayerStatus } from '../types/game.types';

export class Synchronize extends BaseAbility {
  private synchronizedTargets: number[] = [];

  constructor() {
    super('synchronize', '동기화', '두 대상을 지정하여 피해를 동기화합니다.', 0, 3);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    const target1Id = parameters.target1Id;
    const target2Id = parameters.target2Id;

    if (!target1Id || !target2Id) {
      return { success: false, message: '두 대상을 지정해야 합니다.' };
    }

    if (target1Id === target2Id) {
      return { success: false, message: '서로 다른 두 대상을 지정해야 합니다.' };
    }

    const target1 = context.players.find(p => p.id === target1Id);
    const target2 = context.players.find(p => p.id === target2Id);

    if (!target1 || !target2) {
      return { success: false, message: '대상을 찾을 수 없습니다.' };
    }

    // 동기화 대상 설정
    this.synchronizedTargets = [target1Id, target2Id];
    
    // 이번 턴 효과 적용
    this.setTurn('damage_boost', true, context.currentTurn);
    this.setTurn('damage_synchronize', true, context.currentTurn);

    return {
      success: true,
      message: `${context.player.name}이(가) ${target1.name}과 ${target2.name}을 동기화합니다!`,
      target: context.player.id
    };
  }

  // 패시브: 자신은 가하는 피해가 1 증가
  async onBeforeAttack(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as AttackEvent;
    
    if (this.getTurn('damage_boost', currentTurn) && data.attacker === this.ownerId) {
      data.newDamage = (data.newDamage || data.damage) + 1;
      event.modified = true;
      console.log(`[동기화] ${this.ownerId}의 피해 증가: ${data.newDamage}`);
    }
  }

  // 패시브: 두 대상이 받는 피해를 평균화
  async onAfterAttack(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as AttackEvent;
    
    if (this.getTurn('damage_synchronize', currentTurn) && this.synchronizedTargets.length === 2) {
      const [target1Id, target2Id] = this.synchronizedTargets;
      
      // 두 대상이 모두 피해를 받았는지 확인
      const target1 = this.findPlayer(target1Id);
      const target2 = this.findPlayer(target2Id);
      
      if (target1 && target2 && target1.wasAttacked && target2.wasAttacked) {
        // 각각 받은 피해 계산 (간단히 1로 가정)
        const damage1 = 1;
        const damage2 = 1;
        
        // 평균 피해 계산 (소수점 올림)
        const averageDamage = Math.ceil((damage1 + damage2) / 2);
        
        // 두 대상 모두 평균 피해로 조정
        target1.hp = Math.max(0, target1.hp - averageDamage);
        target2.hp = Math.max(0, target2.hp - averageDamage);
        
        console.log(`[동기화] 피해 평균화: ${damage1}, ${damage2} → ${averageDamage}`);
        
        // 사망 처리
        if (target1.hp <= 0) {
          target1.status = PlayerStatus.DEAD;
        }
        if (target2.hp <= 0) {
          target2.status = PlayerStatus.DEAD;
        }
      }
    }
  }

  private findPlayer(playerId: number): Player | null {
    // GameState에서 플레이어 찾기 (의존성 주입 필요)
    return null; // 실제 구현에서는 GameState 참조
  }
} 
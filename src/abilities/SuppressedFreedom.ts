import { BaseAbility } from './BaseAbility';
import { AbilityContext } from '../types/game.types';

export class SuppressedFreedom extends BaseAbility {
  constructor() {
    super(
      'suppressedFreedom',
      '억압된 자유',
      '누적 3턴을 행동하지 않으면 사용 가능 횟수를 1 얻습니다. 방어 / 회피를 행동한 플레이어는 자신을 공격한 것으로 변경됩니다.',
      0, // maxCooldown
      3  // maxUses
    );
  }

  async execute(context: AbilityContext): Promise<{ success: boolean; message: string }> {
    try {
      const { players } = context;
      const owner = this.getOwnerPlayer();
      
      if (!owner) {
        return { success: false, message: '소유자를 찾을 수 없습니다.' };
      }

      // 방어/회피를 행동한 플레이어들의 공격 타겟을 자신으로 변경
      let changedCount = 0;
      for (const player of players) {
        if (player.id === owner.id) continue; // 자신 제외
        
        if (player.actionType === 'DEFEND' || player.actionType === 'EVADE') {
          player.targetId = owner.id;
          changedCount++;
        }
      }

      this.maxUses--;
      this.addLog(context, `[억압된 자유] ${owner.name}이 ${changedCount}명의 플레이어를 자신을 공격하도록 조작했습니다.`);
      
      return { 
        success: true, 
        message: `${changedCount}명의 플레이어를 자신을 공격하도록 조작했습니다.` 
      };
      
    } catch (error) {
      console.error('[억압된 자유] 실행 오류:', error);
      return { success: false, message: '억압된 자유 실행 중 오류가 발생했습니다.' };
    }
  }

  // 패시브: 누적 3턴 행동하지 않으면 사용 횟수 회복
  async onTurnStart(event: any): Promise<void> {
    const owner = this.getOwnerPlayer();
    if (!owner) return;

    const inactiveTurns = this.getSession<number>('inactiveTurns', { 
      validate: (v): v is number => typeof v === 'number',
      defaultValue: 0 
    });

    if (owner.actionType === 'PASS' || !owner.actionType) {
      const newInactiveTurns = inactiveTurns + 1;
      this.setSession('inactiveTurns', newInactiveTurns);
      
      if (newInactiveTurns >= 3 && this.maxUses < 3) {
        this.maxUses++;
        console.log(`[억압된 자유] ${owner.name}의 사용 횟수가 회복되었습니다. (${this.maxUses}/3)`);
      }
    } else {
      // 행동을 했다면 카운터 리셋
      this.setSession('inactiveTurns', 0);
    }
  }
} 
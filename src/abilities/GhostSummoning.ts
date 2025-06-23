import { BaseAbility } from './BaseAbility';
import { AbilityContext } from '../types/game.types';
import { PlayerStatus } from '../types/game.types';

export class GhostSummoning extends BaseAbility {
  constructor() {
    super('ghostSummoning', '원귀 강령', '탈락한 플레이어를 원귀로 부활시킵니다.', 3, 2);
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

    if (target.status !== PlayerStatus.DEAD) {
      return { success: false, message: '탈락한 플레이어만 부활시킬 수 있습니다.' };
    }

    // 원귀로 부활
    target.status = PlayerStatus.ALIVE;
    target.hp = 1;
    target.maxHp = 1;
    
    // 원귀 상태이상 적용
    if (context.statusEffectManager) {
      context.statusEffectManager.applyStatusEffect(targetId, {
        id: 'ghost',
        name: '원귀',
        description: '체력 1, 체력을 변동시키는 능력의 영향을 받지 않음',
        duration: -1,
        stacks: 1,
        stackable: false,
        type: 'neutral'
      });
    }
    
    return {
      success: true,
      message: `${context.player.name}이(가) ${target.name}을 원귀로 부활시킵니다!`,
      target: targetId
    };
  }

  // 패시브: "원귀" 이외의 플레이어가 3명 탈락할 때마다 사용 가능 횟수를 1회 얻음
  async onDeath(event: any): Promise<void> {
    // 이벤트에서 플레이어 정보를 가져와야 함
    // 실제 구현에서는 이벤트 시스템을 통해 처리됨
    console.log('원귀 강령: 사망 이벤트 감지');
  }
} 
import { BaseAbility } from './BaseAbility';
import { AbilityContext } from '../types/game.types';

export class Synchronize extends BaseAbility {
  constructor() {
    super('synchronize', '동기화', '두 대상이 받는 피해를 턴 종료시 평균값으로 동일하게 만듭니다.', 2, 3);
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

    // 동기화 효과 적용 (턴 종료시 처리)
    this.setSession('synchronizeTargets', [target1Id, target2Id]);
    this.setSession('synchronizeActive', true);
    
    return {
      success: true,
      message: `${context.player.name}이(가) ${target1.name}과 ${target2.name}을 동기화시킵니다!`,
      damage: 0,
      target: target1Id
    };
  }

  // 턴 종료시 동기화 처리
  async onTurnEnd(event: any): Promise<void> {
    const isActive = this.getSession('synchronizeActive');
    if (!isActive) return;

    const targets = this.getSession('synchronizeTargets') as number[];
    if (!targets || targets.length !== 2) return;

    // 동기화 효과 제거
    this.setSession('synchronizeActive', false);
    this.setSession('synchronizeTargets', null);
  }
} 
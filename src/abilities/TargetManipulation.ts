import { BaseAbility } from './BaseAbility';
import { AbilityContext } from '../types/game.types';

export class TargetManipulation extends BaseAbility {
  constructor() {
    super(
      'targetManipulation',
      '타겟 조작',
      '자신을 제외한 모든 플레이어의 공격 타겟을 전체 로그 기준 ±1로 조정합니다.',
      0, // maxCooldown
      1  // maxUses
    );
  }

  async execute(context: AbilityContext): Promise<{ success: boolean; message: string }> {
    try {
      const { players } = context;
      const owner = this.getOwnerPlayer();
      
      if (!owner) {
        return { success: false, message: '소유자를 찾을 수 없습니다.' };
      }

      // 모든 플레이어의 공격 타겟을 ±1로 조정
      for (const player of players) {
        if (player.id === owner.id) continue; // 자신 제외
        
        if (player.targetId !== undefined) {
          const currentTarget = player.targetId;
          const adjustment = Math.random() < 0.5 ? -1 : 1; // ±1 랜덤 조정
          const newTarget = currentTarget + adjustment;
          
          // 유효한 타겟 범위로 조정
          const validTargets = players.filter(p => p.id !== player.id).map(p => p.id);
          if (validTargets.length > 0) {
            const targetIndex = validTargets.indexOf(newTarget);
            if (targetIndex >= 0) {
              player.targetId = newTarget;
            } else {
              // 범위를 벗어나면 가장 가까운 유효한 타겟으로 조정
              const closestTarget = validTargets.reduce((prev, curr) => 
                Math.abs(curr - newTarget) < Math.abs(prev - newTarget) ? curr : prev
              );
              player.targetId = closestTarget;
            }
          }
        }
      }

      this.maxUses--;
      this.addLog(context, `[타겟 조작] ${owner.name}이 모든 플레이어의 공격 타겟을 조정했습니다.`);
      
      return { 
        success: true, 
        message: '모든 플레이어의 공격 타겟을 조정했습니다.' 
      };
      
    } catch (error) {
      console.error('[타겟 조작] 실행 오류:', error);
      return { success: false, message: '타겟 조작 실행 중 오류가 발생했습니다.' };
    }
  }
} 
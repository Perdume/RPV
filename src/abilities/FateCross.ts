import { BaseAbility } from './BaseAbility';
import { AbilityContext } from '../types/game.types';

export class FateCross extends BaseAbility {
  constructor() {
    super(
      'fateCross',
      '운명 교차',
      '초반 보호 규칙 첫번째 선택시 활성화, 대상과 번호가 교체됩니다.',
      0, // maxCooldown
      -1 // 무제한 사용
    );
  }

  async execute(context: AbilityContext): Promise<{ success: boolean; message: string }> {
    try {
      const { target } = context;
      const owner = this.getOwnerPlayer();
      
      if (!owner) {
        return { success: false, message: '소유자를 찾을 수 없습니다.' };
      }

      if (!target) {
        return { success: false, message: '대상을 지정해야 합니다.' };
      }

      if (target.id === owner.id) {
        return { success: false, message: '자신과는 교체할 수 없습니다.' };
      }

      // 번호 교체
      const ownerNumber = owner.id;
      const targetNumber = target.id;
      
      // 플레이어 ID 교체
      owner.id = targetNumber;
      target.id = ownerNumber;
      
      // 이름도 교체 (선택사항)
      const ownerName = owner.name;
      owner.name = target.name;
      target.name = ownerName;

      this.addLog(context, `[운명 교차] ${ownerName}과 ${target.name}의 번호가 교체되었습니다.`);
      
      return { 
        success: true, 
        message: `${target.name}과 번호가 교체되었습니다.` 
      };
      
    } catch (error) {
      console.error('[운명 교차] 실행 오류:', error);
      return { success: false, message: '운명 교차 실행 중 오류가 발생했습니다.' };
    }
  }

  // 초반 보호 규칙에서만 활성화
  canUseAbility(context: AbilityContext): boolean {
    const currentTurn = context.currentTurn;
    return currentTurn <= 3; // 초반 3턴까지만 사용 가능
  }
} 
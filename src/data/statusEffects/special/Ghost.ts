import { StatusEffect } from '../index';

export const Ghost: StatusEffect = {
  id: 'ghost',
  name: '원귀',
  description: '체력 1, 체력을 변동시키는 능력의 영향을 받지 않음, 매 턴 방어/회피를 사용하지 않은 무작위 플레이어를 공격함',
  duration: -1, // 영구
  stacks: 1,
  stackable: false,
  type: 'neutral',
  
  onTurnStart: (playerId: number) => {
    // 매 턴 자동 공격 로직
    // 이 로직은 능력에서 처리됨
  }
};

// 팩토리에 등록
import { StatusEffectFactory } from '../index';
StatusEffectFactory.register(Ghost); 
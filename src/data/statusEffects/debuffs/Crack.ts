import { StatusEffect } from '../index';

export const Crack: StatusEffect = {
  id: 'crack',
  name: '균열',
  description: '턴 종료시 수치가 3 이상이라면 피해를 1 받고 제거됩니다.',
  duration: 3,
  stacks: 1,
  stackable: true,
  type: 'debuff',
  maxStacks: 5,
  
  onTurnEnd: (playerId: number) => {
    // 턴 종료시 3 이상이면 피해 1 받고 제거
    // 이 로직은 StatusEffectManager에서 처리됨
  }
};

// 팩토리에 등록
import { StatusEffectFactory } from '../index';
StatusEffectFactory.register(Crack); 
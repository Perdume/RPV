import { StatusEffect } from '../index';

export const WillLoss: StatusEffect = {
  id: 'willLoss',
  name: '전의 상실',
  description: '3의 배수 턴 시작시마다 "가하는 피해 1 감소" 또는 "받는 피해 1 증가"를 얻습니다.',
  duration: -1, // 영구
  stacks: 1,
  stackable: false,
  type: 'debuff',
  
  onTurnStart: (playerId: number) => {
    // 3의 배수 턴 시작시 효과 적용
    // 이 로직은 능력에서 처리됨
  }
};

// 팩토리에 등록
import { StatusEffectFactory } from '../index';
StatusEffectFactory.register(WillLoss); 
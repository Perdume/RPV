import { StatusEffect } from '../index';

export const DoomSign: StatusEffect = {
  id: 'doomSign',
  name: '파멸의 징조',
  description: '공격 행동을 하면 턴 종료시 초기화됩니다.',
  duration: -1, // 영구 (공격 행동으로만 제거)
  stacks: 1,
  stackable: true,
  type: 'debuff',
  maxStacks: 10,
  
  onTurnEnd: (playerId: number) => {
    // 공격 행동을 했다면 초기화
    // 이 로직은 능력에서 처리됨
  }
};

// 팩토리에 등록
import { StatusEffectFactory } from '../index';
StatusEffectFactory.register(DoomSign); 
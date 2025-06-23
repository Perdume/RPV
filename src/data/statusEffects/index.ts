// 상태이상 시스템 메인 인덱스

// 상태이상 타입 정의
export interface StatusEffect {
  id: string;
  name: string;
  description: string;
  duration: number; // -1이면 영구
  stacks: number;
  stackable: boolean;
  type: 'buff' | 'debuff' | 'neutral';
  maxStacks?: number;
  onTurnStart?: (playerId: number) => void;
  onTurnEnd?: (playerId: number) => void;
  onRemove?: (playerId: number) => void;
}

// 상태이상 팩토리
export class StatusEffectFactory {
  private static effects: Map<string, StatusEffect> = new Map();

  static register(effect: StatusEffect): void {
    this.effects.set(effect.id, effect);
  }

  static create(effectId: string, duration: number = 1, stacks: number = 1): StatusEffect | null {
    const template = this.effects.get(effectId);
    if (!template) return null;

    return {
      ...template,
      duration,
      stacks
    };
  }

  static getAll(): StatusEffect[] {
    return Array.from(this.effects.values());
  }
}

// 개별 상태이상들을 여기서 직접 정의
export const Crack: StatusEffect = {
  id: 'crack',
  name: '균열',
  description: '턴 종료시 수치가 3 이상이라면 피해를 1 받고 제거됩니다.',
  duration: 3,
  stacks: 1,
  stackable: true,
  type: 'debuff',
  maxStacks: 5
};

export const DoomSign: StatusEffect = {
  id: 'doomSign',
  name: '파멸의 징조',
  description: '공격 행동을 하면 턴 종료시 초기화됩니다.',
  duration: -1,
  stacks: 1,
  stackable: true,
  type: 'debuff',
  maxStacks: 10
};

export const WillLoss: StatusEffect = {
  id: 'willLoss',
  name: '전의 상실',
  description: '3의 배수 턴 시작시마다 "가하는 피해 1 감소" 또는 "받는 피해 1 증가"를 얻습니다.',
  duration: -1,
  stacks: 1,
  stackable: false,
  type: 'debuff'
};

export const Ghost: StatusEffect = {
  id: 'ghost',
  name: '원귀',
  description: '체력 1, 체력을 변동시키는 능력의 영향을 받지 않음, 매 턴 방어/회피를 사용하지 않은 무작위 플레이어를 공격함',
  duration: -1,
  stacks: 1,
  stackable: false,
  type: 'neutral'
};

// 팩토리에 등록
StatusEffectFactory.register(Crack);
StatusEffectFactory.register(DoomSign);
StatusEffectFactory.register(WillLoss);
StatusEffectFactory.register(Ghost); 
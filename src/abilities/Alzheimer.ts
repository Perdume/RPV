import { BaseAbility } from './BaseAbility';
import { AbilityContext } from '../types/game.types';

export class Alzheimer extends BaseAbility {
  constructor() {
    super('alzheimer', '알츠하이머', '대상에게 다양한 디버프를 무작위로 적용합니다.', 1, 2);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    const targetId = parameters.targetId || context.target?.id;
    
    if (!targetId) {
      return { success: false, message: '대상을 지정해야 합니다.' };
    }

    const target = context.players.find(p => p.id === targetId);
    if (!target) {
      return { success: false, message: '대상을 찾을 수 없습니다.' };
    }

    // 이번 턴 전체 로그에 행동하지 않은 것으로 기록
    const turnProcessor = (context as any).turnProcessor;
    if (turnProcessor && this.ownerId) {
      turnProcessor.hidePlayerAction(this.ownerId, context.currentTurn);
    }

    // 다음 턴 무작위 두 종류의 상태이상 적용
    const debuffs = [
      { id: 'damage_reduction', name: '가하는 피해 1 감소' },
      { id: 'crack', name: '균열 1' },
      { id: 'damage_increase', name: '받는 피해 1 증가' },
      { id: 'ability_seal', name: '능력 봉인' }
    ];

    // 무작위로 두 개 선택
    const selectedDebuffs = [];
    const shuffled = [...debuffs].sort(() => 0.5 - Math.random());
    selectedDebuffs.push(shuffled[0], shuffled[1]);

    // 다음 턴에 적용할 상태이상 저장
    this.setSession('next_turn_debuffs', {
      targetId,
      debuffs: selectedDebuffs,
      turn: context.currentTurn + 1
    });

    return {
      success: true,
      message: `${context.player.name}이(가) ${target.name}에게 알츠하이머를 적용합니다!`,
      target: targetId
    };
  }

  // 다음 턴 시작시 상태이상 적용
  async onTurnStart(event: any): Promise<void> {
    const turn = event.data.turn;
    const nextTurnDebuffs = this.getSession('next_turn_debuffs') as any;
    
    if (nextTurnDebuffs && nextTurnDebuffs.turn === turn) {
      const { targetId, debuffs } = nextTurnDebuffs;
      
      // StatusEffectManager는 이벤트에서 가져와야 함
      const statusEffectManager = (event as any).statusEffectManager;
      if (statusEffectManager) {
        for (const debuff of debuffs) {
          switch (debuff.id) {
            case 'crack':
              statusEffectManager.applyStatusEffect(targetId, {
                id: 'crack',
                name: '균열',
                description: '턴 종료시 수치가 3 이상이라면 피해를 1 받고 제거됩니다.',
                duration: 3,
                stacks: 1,
                stackable: true,
                type: 'debuff'
              });
              break;
            case 'damage_reduction':
              statusEffectManager.applyStatusEffect(targetId, {
                id: 'damage_reduction',
                name: '공격력 감소',
                description: '가하는 피해가 1 감소합니다.',
                duration: 1,
                stacks: 1,
                stackable: false,
                type: 'debuff'
              });
              break;
            case 'damage_increase':
              statusEffectManager.applyStatusEffect(targetId, {
                id: 'damage_increase',
                name: '방어력 감소',
                description: '받는 피해가 1 증가합니다.',
                duration: 1,
                stacks: 1,
                stackable: false,
                type: 'debuff'
              });
              break;
            case 'ability_seal':
              // 능력 봉인은 별도 처리
              this.setSession('seal_ability', { targetId, turn });
              break;
          }
        }
      }
      
      console.log(`[알츠하이머] ${targetId}에게 ${debuffs.map((d: any) => d.name).join(', ')} 상태이상을 적용합니다.`);
      
      // 적용 완료 후 세션 변수 정리
      this.setSession('next_turn_debuffs', null);
    }
  }

  // 자신이 피해를 누적 2 받을 때마다 사용 가능 횟수를 1회 얻습니다 (최대치 초과 불가)
  async onAfterAttack(event: any): Promise<void> {
    if (event.data.target === this.ownerId) {
      const damageReceived = (this.getPermanent('damage_received') as number) || 0;
      const newDamageReceived = damageReceived + event.data.damage;
      this.setPermanent('damage_received', newDamageReceived);
      
      if (Math.floor(newDamageReceived / 2) > Math.floor(damageReceived / 2)) {
        // 2의 배수 단위로 횟수 증가
        this.maxUses = Math.min(this.maxUses + 1, 2);
        console.log(`[알츠하이머] 누적 피해 ${newDamageReceived}로 사용 횟수 증가: ${this.maxUses}`);
      }
    }
  }
} 
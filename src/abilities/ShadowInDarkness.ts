import { BaseAbility } from './BaseAbility';
import { AbilityContext, TypedModifiableEvent, TurnStartEvent, AttackEvent } from '../types/game.types';

export class ShadowInDarkness extends BaseAbility {
  constructor() {
    super('shadowInDarkness', '어둠 속 그림자', '이번 턴 이하의 효과를 전부 적용합니다. 가하는 피해 감소의 영향을 받지 않습니다. 타겟이 능력을 사용했다면 사용 여부를 전체 로그에 나타내고, 자신은 체력을 1 회복합니다. 타겟의 회피 확률이 100% 미만이라면, 회피 행동을 무시합니다. 타겟이 방어를 행동했다면 "균열" 상태이상을 가합니다.', 0, 3);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    // 이번 턴 효과 적용
    this.setTurn('shadow_active', true, context.currentTurn);
    this.setTurn('ignore_damage_reduction', true, context.currentTurn);
    this.setTurn('ability_detection', true, context.currentTurn);
    this.setTurn('evade_ignore', true, context.currentTurn);
    this.setTurn('defend_crack', true, context.currentTurn);

    return {
      success: true,
      message: `${this.name} 능력을 사용했습니다. 이번 턴 그림자의 힘이 활성화됩니다.`,
      damage: 0,
      heal: 0,
      death: false
    };
  }

  // 패시브: 공격 행동을 할 때, 자신의 타겟은 변경되지 않습니다
  async onBeforeAttack(event: TypedModifiableEvent<AttackEvent>): Promise<void> {
    if (event.data.attacker === this.ownerId) {
      // 타겟 변경 방지 (이미 구현되어 있음)
      console.log(`[어둠 속 그림자] ${this.ownerId}의 타겟이 고정됩니다.`);
    }
  }

  // 가하는 피해 감소의 영향을 받지 않습니다
  async onBeforeAttack(event: TypedModifiableEvent<AttackEvent>): Promise<void> {
    if (this.getTurn('ignore_damage_reduction', this.getCurrentTurn()) && event.data.attacker === this.ownerId) {
      event.data.ignoreDamageReduction = true;
      console.log(`[어둠 속 그림자] ${this.ownerId}의 공격이 피해 감소 효과를 무시합니다.`);
    }
  }

  // 타겟이 능력을 사용했다면 사용 여부를 전체 로그에 나타내고, 자신은 체력을 1 회복합니다
  async onAfterAttack(event: TypedModifiableEvent<AttackEvent>): Promise<void> {
    if (this.getTurn('ability_detection', this.getCurrentTurn()) && event.data.attacker === this.ownerId) {
      const target = event.data.targetPlayer;
      if (target && target.abilityUses < target.maxAbilityUses) {
        // 능력 사용 감지
        console.log(`[어둠 속 그림자] ${target.id}가 능력을 사용했습니다!`);
        
        // 체력 1 회복
        const attacker = event.data.attackerPlayer;
        if (attacker) {
          attacker.hp = Math.min(attacker.maxHp, attacker.hp + 1);
          console.log(`[어둠 속 그림자] ${this.ownerId}이(가) 능력 감지로 체력을 1 회복합니다!`);
        }
      }
    }
  }

  // 타겟의 회피 확률이 100% 미만이라면, 회피 행동을 무시합니다
  async onBeforeEvade(event: any): Promise<void> {
    if (this.getTurn('evade_ignore', this.getCurrentTurn()) && event.data.target === this.ownerId) {
      const target = event.data.players?.find((p: any) => p.id === event.data.attacker);
      if (target && target.evasion < 100) {
        event.cancelled = true;
        console.log(`[어둠 속 그림자] ${event.data.attacker}의 회피가 무시됩니다!`);
      }
    }
  }

  // 타겟이 방어를 행동했다면 "균열" 상태이상을 가합니다
  async onAfterDefend(event: any): Promise<void> {
    if (this.getTurn('defend_crack', this.getCurrentTurn()) && event.data.target === this.ownerId) {
      const attacker = event.data.players?.find((p: any) => p.id === event.data.attacker);
      if (attacker) {
        this.applyStatusEffect(attacker.id, {
          id: 'crack',
          name: '균열',
          description: '턴 종료시 수치가 3 이상이라면 피해를 1 받고 제거됩니다.',
          duration: 3,
          stackable: true,
          type: 'debuff'
        });
        console.log(`[어둠 속 그림자] ${this.ownerId}이(가) ${attacker.id}에게 방어로 인한 균열을 가합니다!`);
      }
    }
  }

  private getCurrentTurn(): number {
    return (this.getSession('current_turn') as number) || 0;
  }
} 
import { BaseAbility } from './BaseAbility';
import { AbilityContext, Player, ModifiableEvent, AttackEvent } from '../types/game.types';

export class ShadowInDarkness extends BaseAbility {
  constructor() {
    super('shadowInDarkness', '어둠 속 그림자', '공격 행동시 다양한 효과를 적용합니다.', 0, 3);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    // 이번 턴 효과 적용
    this.setTurn('ignore_damage_reduction', true, context.currentTurn);
    this.setTurn('reveal_ability_use', true, context.currentTurn);
    this.setTurn('ignore_evade', true, context.currentTurn);
    this.setTurn('crack_on_defend', true, context.currentTurn);

    return {
      success: true,
      message: `${context.player.name}이(가) 어둠 속 그림자를 발동합니다!`,
      target: context.player.id
    };
  }

  // 패시브: 공격 전 모든 효과 적용
  async onBeforeAttack(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getCurrentTurn();
    const data = event.data as AttackEvent;
    
    if (data.attacker !== this.ownerId) return;

    // 1. 가하는 피해 감소의 영향을 받지 않음
    if (this.getTurn('ignore_damage_reduction', currentTurn)) {
      data.ignoreDamageReduction = true;
      event.modified = true;
      console.log(`[어둠 속 그림자] ${this.ownerId}의 피해 감소 무시`);
    }

    // 2. 타겟이 능력을 사용했다면 공개하고 체력 1 회복
    if (this.getTurn('reveal_ability_use', currentTurn)) {
      const target = data.targetPlayer;
      if (target && (target as any).usedAbility) {
        // 능력 사용 공개
        const turnProcessor = this.getTurnProcessor();
        if (turnProcessor) {
          turnProcessor.revealAbilityUse(target.id, currentTurn);
        }
        
        // 체력 1 회복
        const attacker = this.getOwnerPlayer();
        if (attacker) {
          attacker.hp = Math.min(attacker.maxHp, attacker.hp + 1);
          console.log(`[어둠 속 그림자] ${attacker.name} 타겟 능력 사용 감지로 체력 1 회복`);
        }
      }
    }

    // 3. 타겟의 회피 확률이 100% 미만이라면 회피 무시
    if (this.getTurn('ignore_evade', currentTurn)) {
      const target = data.targetPlayer;
      if (target && (target as any).evadeChance < 100) {
        data.ignoreEvade = true;
        event.modified = true;
        console.log(`[어둠 속 그림자] ${target.name}의 회피 무시 (회피율: ${(target as any).evadeChance}%)`);
      }
    }

    // 4. 타겟이 방어를 행동했다면 균열 상태이상 부여
    if (this.getTurn('crack_on_defend', currentTurn)) {
      const target = data.targetPlayer;
      if (target && target.actionType === 'DEFEND') {
        // 균열 상태이상 부여
        this.applyStatusEffect(target.id, 'crack', 3, 1);
        console.log(`[어둠 속 그림자] ${target.name} 방어로 균열 부여`);
      }
    }
  }

  private getTurnProcessor(): any {
    // TurnProcessor 인스턴스 접근 (의존성 주입 필요)
    return null; // 실제 구현에서는 의존성 주입으로 해결
  }

  private getCurrentTurn(): number {
    return (this.getSession('current_turn') as number) || 0;
  }
} 
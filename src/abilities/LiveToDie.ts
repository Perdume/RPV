import { BaseAbility } from './BaseAbility';
import { AbilityContext, TypedModifiableEvent, TurnStartEvent, AttackEvent } from '../types/game.types';

export class LiveToDie extends BaseAbility {
  constructor() {
    super('liveToDie', '살고자 하면 죽고..', '죽고자 하면 산다. 이번 공격 행동은 다른 능력의 영향을 받지 않습니다. 공격이 성공했을 경우, 이하의 효과를 전부 적용합니다. 체력 1 회복, 자신의 모든 부정적 상태이상 제거, 이번 턴 모든 피해를 받지 않음, 이번 턴 다른 능력을 받지 않음. 능력 사용 후, 2턴째 종료시 사용 횟수를 1회 돌려받습니다.', 0, 1);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    const player = context.player;
    
    if (!player) {
      return {
        success: false,
        message: '플레이어를 찾을 수 없습니다.',
        damage: 0,
        heal: 0,
        death: false
      };
    }

    // 체력 4 이하 조건 확인
    if (player.hp > 4) {
      return {
        success: false,
        message: '체력이 4 이하여야 능력을 사용할 수 있습니다.',
        damage: 0,
        heal: 0,
        death: false
      };
    }

    // 이번 턴 효과 적용
    this.setTurn('live_to_die_active', true, context.currentTurn);
    this.setTurn('ignore_other_abilities', true, context.currentTurn);
    this.setTurn('damage_immunity', true, context.currentTurn);
    this.setTurn('ability_immunity', true, context.currentTurn);
    this.setTurn('cooldown_return', true, context.currentTurn + 2);

    return {
      success: true,
      message: `${this.name} 능력을 사용했습니다. 죽음의 문턱에서 살아남겠습니다.`,
      damage: 0,
      heal: 0,
      death: false
    };
  }

  // 공격이 성공했을 경우 효과 적용
  async onAfterAttack(event: TypedModifiableEvent<AttackEvent>): Promise<void> {
    if (this.getTurn('live_to_die_active', this.getCurrentTurn()) && event.data.attacker === this.ownerId && event.data.attackSuccess) {
      const player = event.data.attackerPlayer;
      if (player) {
        // 체력 1 회복
        player.hp = Math.min(player.maxHp, player.hp + 1);
        
        // 모든 부정적 상태이상 제거
        this.removeAllNegativeStatusEffects(player.id);
        
        console.log(`[살고자 하면 죽고..] ${this.ownerId}이(가) 공격 성공으로 체력을 회복하고 상태이상을 제거합니다!`);
      }
    }
  }

  // 이번 턴 모든 피해를 받지 않음
  async onBeforeDamage(event: any): Promise<void> {
    if (this.getTurn('damage_immunity', this.getCurrentTurn()) && event.data.target === this.ownerId) {
      event.cancelled = true;
      console.log(`[살고자 하면 죽고..] ${this.ownerId}이(가) 모든 피해를 무시합니다!`);
    }
  }

  // 이번 턴 다른 능력을 받지 않음
  async onBeforeAbilityEffect(event: any): Promise<void> {
    if (this.getTurn('ability_immunity', this.getCurrentTurn()) && event.data.target === this.ownerId) {
      event.cancelled = true;
      console.log(`[살고자 하면 죽고..] ${this.ownerId}이(가) 다른 능력의 영향을 무시합니다!`);
    }
  }

  // 2턴째 종료시 사용 횟수를 1회 돌려받습니다
  async onTurnEnd(event: any): Promise<void> {
    const turn = event.data.turn;
    if (this.getTurn('cooldown_return', turn)) {
      this.maxUses = Math.min(this.maxUses + 1, 1);
      console.log(`[살고자 하면 죽고..] ${this.ownerId}이(가) 능력 사용 횟수를 1회 회복합니다!`);
    }
  }

  private getCurrentTurn(): number {
    return (this.getSession('current_turn') as number) || 0;
  }

  private removeAllNegativeStatusEffects(playerId: number): void {
    // 부정적 상태이상 제거 로직
    console.log(`[살고자 하면 죽고..] ${playerId}의 모든 부정적 상태이상이 제거됩니다.`);
  }
} 
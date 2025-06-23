import { BaseAbility } from './BaseAbility';
import { AbilityContext, TypedModifiableEvent, TurnStartEvent, AttackEvent } from '../types/game.types';

export class EndOfDestruction extends BaseAbility {
  constructor() {
    super('endOfDestruction', '끝의 파멸', '이번 턴 "파멸의 징조"를 전부 소모하고 이하의 효과를 전부 적용합니다. 소모한 [파멸의 징조]만큼 공격 타겟을 추가로 지정할 수 있습니다. 소모한 [파멸의 징조]만큼 가하는 피해가 증가합니다. (최대 5) 소모한 [파멸의 징조/2]만큼 체력을 회복합니다. (소숫점 올림)', 0, 3);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    // 파멸의 징조 수치 확인
    const doomStacks = this.getStatusEffect(this.ownerId, 'doom_sign')?.stacks || 0;
    
    if (doomStacks === 0) {
      return {
        success: false,
        message: '파멸의 징조가 없어 능력을 사용할 수 없습니다.',
        damage: 0,
        heal: 0,
        death: false
      };
    }

    // 파멸의 징조 소모
    this.removeStatusEffect(this.ownerId, 'doom_sign');
    
    // 이번 턴 효과 적용
    this.setTurn('destruction_active', true, context.currentTurn);
    this.setTurn('additional_targets', doomStacks, context.currentTurn);
    this.setTurn('damage_boost', Math.min(doomStacks, 5), context.currentTurn);
    this.setTurn('heal_amount', Math.ceil(doomStacks / 2), context.currentTurn);

    // 체력 회복
    const healAmount = Math.ceil(doomStacks / 2);
    const player = context.player;
    if (player) {
      player.hp = Math.min(player.maxHp, player.hp + healAmount);
    }

    return {
      success: true,
      message: `${this.name} 능력을 사용했습니다. 파멸의 징조 ${doomStacks}개를 소모하여 힘을 얻었습니다.`,
      damage: 0,
      heal: healAmount,
      death: false
    };
  }

  // 패시브: 자신이 공격 행동을 하지 않을 때마다 "파멸의 징조" 상태이상을 1 얻습니다
  async onTurnEnd(event: any): Promise<void> {
    const turn = event.data.turn;
    const player = event.data.players?.find((p: any) => p.id === this.ownerId);
    
    if (player && player.actionType !== 'ATTACK') {
      // 파멸의 징조 1 추가
      this.applyStatusEffect(this.ownerId, {
        id: 'doom_sign',
        name: '파멸의 징조',
        description: '끝의 파멸 능력의 연료가 됩니다.',
        duration: -1, // 영구
        stackable: true,
        type: 'neutral'
      });
      console.log(`[끝의 파멸] ${this.ownerId}이(가) 공격하지 않아 파멸의 징조를 1 얻습니다!`);
    } else if (player && player.actionType === 'ATTACK') {
      // 공격 행동 시 파멸의 징조 초기화
      this.removeStatusEffect(this.ownerId, 'doom_sign');
      console.log(`[끝의 파멸] ${this.ownerId}이(가) 공격하여 파멸의 징조가 초기화됩니다!`);
    }
  }

  // 소모한 [파멸의 징조]만큼 가하는 피해가 증가합니다 (최대 5)
  async onBeforeAttack(event: TypedModifiableEvent<AttackEvent>): Promise<void> {
    if (this.getTurn('damage_boost', this.getCurrentTurn()) && event.data.attacker === this.ownerId) {
      const damageBoost = this.getTurn('damage_boost', this.getCurrentTurn()) as number;
      event.data.newDamage = (event.data.newDamage || event.data.damage) + damageBoost;
      console.log(`[끝의 파멸] ${this.ownerId}이(가) 파멸의 힘으로 피해가 ${damageBoost} 증가합니다!`);
    }
  }

  // 소모한 [파멸의 징조]만큼 공격 타겟을 추가로 지정할 수 있습니다
  async onAfterAttack(event: TypedModifiableEvent<AttackEvent>): Promise<void> {
    if (this.getTurn('additional_targets', this.getCurrentTurn()) && event.data.attacker === this.ownerId) {
      const additionalTargets = this.getTurn('additional_targets', this.getCurrentTurn()) as number;
      console.log(`[끝의 파멸] ${this.ownerId}이(가) 추가로 ${additionalTargets}개의 타겟을 공격할 수 있습니다!`);
      // 실제 추가 공격은 TurnProcessor에서 처리
    }
  }

  private getCurrentTurn(): number {
    return (this.getSession('current_turn') as number) || 0;
  }
} 
import { BaseAbility } from './BaseAbility';
import { AbilityContext, TypedModifiableEvent, TurnStartEvent, AttackEvent } from '../types/game.types';

export class PainfulMemory extends BaseAbility {
  constructor() {
    super('painfulMemory', '잠식되는 고통의 기억', '이 고통을.. 나만 겪을 순 없잖아? 이번 턴 이하의 효과 적용. 0~4중 임의의 체력 감소. 체력 1 이하로 감소하지 않음. 공격 성공시 타겟에게 "균열" 상태이상 부여. 다음 턴 "가하는 피해 1 증가" 얻음. 다음 턴 자신의 능력이 봉인됨.', 0, 3);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    // 0~4중 임의의 체력 감소
    const damageAmount = Math.floor(Math.random() * 5);
    const player = context.player;
    
    if (player) {
      const oldHp = player.hp;
      player.hp = Math.max(1, player.hp - damageAmount); // 체력 1 이하로 감소하지 않음
      const actualDamage = oldHp - player.hp;
      
      // 이번 턴 효과 적용
      this.setTurn('pain_active', true, context.currentTurn);
      this.setTurn('crack_on_attack', true, context.currentTurn);
      this.setTurn('next_turn_damage_boost', true, context.currentTurn + 1);
      this.setTurn('next_turn_ability_seal', true, context.currentTurn + 1);
      
      return {
        success: true,
        message: `${this.name} 능력을 사용했습니다. 체력이 ${actualDamage} 감소했습니다.`,
        damage: 0,
        heal: 0,
        death: false
      };
    }
    
    return {
      success: false,
      message: '플레이어를 찾을 수 없습니다.',
      damage: 0,
      heal: 0,
      death: false
    };
  }

  // 패시브 1: 연속 2턴째 공격 행동을 하지 않았다면, 매 턴 시작시 체력이 1 감소합니다
  async onTurnStart(event: TypedModifiableEvent<TurnStartEvent>): Promise<void> {
    const turn = event.data.turn;
    if (turn >= 3) { // 3번째 턴부터 적용
      const consecutiveNonAttackTurns = this.getSession('consecutive_non_attack_turns') as number || 0;
      
      if (consecutiveNonAttackTurns >= 2) {
        const player = event.data.players?.find((p: any) => p.id === this.ownerId);
        if (player) {
          player.hp = Math.max(1, player.hp - 1); // 체력 1 이하로 감소하지 않음
          console.log(`[고통의 기억] ${this.ownerId}이(가) 연속 공격하지 않아 체력이 1 감소합니다!`);
        }
      }
    }
  }

  // 패시브 2: 3번째 턴부터 적용됩니다. 이전 턴 감소한 체력 만큼 이번 턴 "가하는 피해 증가"를 얻습니다. (최대 4)
  async onTurnStart(event: TypedModifiableEvent<TurnStartEvent>): Promise<void> {
    const turn = event.data.turn;
    if (turn >= 3) {
      const lastTurnDamage = this.getSession('last_turn_damage') as number || 0;
      const damageBoost = Math.min(lastTurnDamage, 4);
      
      if (damageBoost > 0) {
        this.setTurn('damage_boost', damageBoost, turn);
        console.log(`[고통의 기억] ${this.ownerId}이(가) 이전 턴 피해로 인해 피해가 ${damageBoost} 증가합니다!`);
      }
    }
  }

  // 패시브 3: 다른 플레이어가 탈락하면, 이번 턴 자신은 탈락을 저항하고 (1 이하로 감소하지 않음) 다음 턴 체력을 [2 + 현재 탈락한 플레이어 수] 만큼 회복합니다
  async onDeath(event: any): Promise<void> {
    if (event.data.player !== this.ownerId) {
      const gameUsed = this.getSession('death_resistance_used') as boolean || false;
      
      if (!gameUsed) {
        this.setSession('death_resistance_used', true);
        this.setTurn('death_resistance', true, event.data.turn);
        this.setTurn('next_turn_heal', true, event.data.turn + 1);
        
        console.log(`[고통의 기억] ${this.ownerId}이(가) 다른 플레이어의 죽음으로 인해 탈락 저항을 활성화합니다!`);
      }
    }
  }

  // 공격 성공시 타겟에게 "균열" 상태이상 부여
  async onAfterAttack(event: TypedModifiableEvent<AttackEvent>): Promise<void> {
    if (this.getTurn('crack_on_attack', this.getCurrentTurn()) && event.data.attacker === this.ownerId && event.data.attackSuccess) {
      const target = event.data.targetPlayer;
      if (target) {
        this.applyStatusEffect(target.id, {
          id: 'crack',
          name: '균열',
          description: '턴 종료시 수치가 3 이상이라면 피해를 1 받고 제거됩니다.',
          duration: 3,
          stackable: true,
          type: 'debuff'
        });
        console.log(`[고통의 기억] ${this.ownerId}이(가) ${target.id}에게 균열을 가합니다!`);
      }
    }
  }

  // 다음 턴 "가하는 피해 1 증가" 얻음
  async onTurnStart(event: TypedModifiableEvent<TurnStartEvent>): Promise<void> {
    const turn = event.data.turn;
    if (this.getTurn('next_turn_damage_boost', turn)) {
      this.setTurn('damage_boost', 1, turn);
      console.log(`[고통의 기억] ${this.ownerId}이(가) 다음 턴 피해 증가를 얻습니다!`);
    }
  }

  // 다음 턴 자신의 능력이 봉인됨
  async onTurnStart(event: TypedModifiableEvent<TurnStartEvent>): Promise<void> {
    const turn = event.data.turn;
    if (this.getTurn('next_turn_ability_seal', turn)) {
      const player = event.data.players?.find((p: any) => p.id === this.ownerId);
      if (player) {
        player.isAbilitySealed = true;
        console.log(`[고통의 기억] ${this.ownerId}의 능력이 봉인됩니다!`);
      }
    }
  }

  private getCurrentTurn(): number {
    return (this.getSession('current_turn') as number) || 0;
  }
} 
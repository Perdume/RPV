import { BaseAbility } from './BaseAbility';
import { AbilityContext, Player, ModifiableEvent, AttackEvent } from '../types/game.types';

export class PainfulMemory extends BaseAbility {
  private consecutiveNonAttackTurns: number = 0;
  private lastTurnHpReduction: number = 0;
  private deathResistanceUsed: boolean = false;

  constructor() {
    super('painfulMemory', '잠식되는 고통의 기억', '복잡한 패시브 효과를 가진 능력입니다.', 0, 3);
  }

  async execute(context: AbilityContext, parameters: Record<string, any> = {}): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    // 0~4 중 임의의 체력 감소
    const hpReduction = Math.floor(Math.random() * 5);
    const player = context.player;
    
    if (player) {
      // 체력 1 이하로 감소하지 않음
      const newHp = Math.max(1, player.hp - hpReduction);
      const actualReduction = player.hp - newHp;
      player.hp = newHp;
      
      // 이번 턴 효과 적용
      this.setTurn('crack_on_attack', true, context.currentTurn);
      this.setTurn('damage_boost_next_turn', true, context.currentTurn);
      this.setTurn('ability_seal_next_turn', true, context.currentTurn);
      
      // 다음 턴 가하는 피해 1 증가
      this.setSession('damage_boost_next_turn', {
        turn: context.currentTurn + 1,
        amount: 1
      });
      
      // 다음 턴 능력 봉인
      this.setSession('ability_seal_next_turn', {
        turn: context.currentTurn + 1
      });

      return {
        success: true,
        message: `${player.name}이(가) 고통의 기억을 발동합니다! 체력 ${actualReduction} 감소`,
        target: player.id
      };
    }

    return { success: false, message: '플레이어를 찾을 수 없습니다.' };
  }

  // 패시브: 턴 시작시 모든 효과 적용
  async onTurnStart(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const player = this.getOwnerPlayer();
    
    if (player && player.actionType !== 'ATTACK') {
      this.consecutiveNonAttackTurns++;
      
      if (this.consecutiveNonAttackTurns >= 2) {
        player.hp = Math.max(1, player.hp - 1);
        this.lastTurnHpReduction = 1;
        console.log(`[고통의 기억] ${player.name} 연속 ${this.consecutiveNonAttackTurns}턴 공격하지 않아 체력 1 감소`);
      }
    } else if (player && player.actionType === 'ATTACK') {
      this.consecutiveNonAttackTurns = 0;
    }
    
    // 패시브 2: 3번째 턴부터 적용. 이전 턴 감소한 체력 만큼 이번 턴 "가하는 피해 증가"를 얻음 (최대 4)
    if (currentTurn >= 3 && this.lastTurnHpReduction > 0) {
      const damageBoost = Math.min(this.lastTurnHpReduction, 4);
      this.setTurn('damage_boost', damageBoost, currentTurn);
      console.log(`[고통의 기억] ${this.ownerId} 이전 턴 체력 감소로 피해 증가 ${damageBoost} 획득`);
      this.lastTurnHpReduction = 0;
    }
  }

  // 패시브 3: 다른 플레이어가 탈락하면, 이번 턴 자신은 탈락을 저항하고 다음 턴 체력 회복
  async onPlayerDeath(event: ModifiableEvent): Promise<void> {
    if (!this.deathResistanceUsed) {
      const deadPlayerId = (event.data as any).playerId;
      if (deadPlayerId !== this.ownerId) {
        this.deathResistanceUsed = true;
        
        // 이번 턴 탈락 저항 (1 이하로 감소하지 않음)
        this.setTurn('death_resistance', true, this.getSession('current_turn') as number || 0);
        
        // 다음 턴 체력 회복 [2 + 현재 탈락한 플레이어 수]
        const deadPlayersCount = this.getSession('dead_players_count') as number || 0;
        const healAmount = 2 + deadPlayersCount;
        
        this.setSession('heal_next_turn', {
          turn: (this.getSession('current_turn') as number || 0) + 1,
          amount: healAmount
        });
        
        console.log(`[고통의 기억] ${this.ownerId} 탈락 저항 활성화, 다음 턴 체력 ${healAmount} 회복`);
      }
    }
  }

  // 공격 성공시 타겟에게 균열 부여
  async onAfterAttack(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as AttackEvent;
    
    if (this.getTurn('crack_on_attack', currentTurn) && data.attacker === this.ownerId && data.attackSuccess) {
      const target = data.targetPlayer;
      if (target) {
        this.applyStatusEffect(target.id, 'crack', 3, 1);
        console.log(`[고통의 기억] ${target.name}에게 균열 부여`);
      }
    }
  }

  // 다음 턴 가하는 피해 증가
  async onBeforeAttack(event: ModifiableEvent): Promise<void> {
    const currentTurn = this.getSession('current_turn') as number || 0;
    const data = event.data as AttackEvent;
    
    if (this.getTurn('damage_boost', currentTurn) && data.attacker === this.ownerId) {
      const boostAmount = this.getTurn('damage_boost', currentTurn) as number;
      data.newDamage = (data.newDamage || data.damage) + boostAmount;
      event.modified = true;
      console.log(`[고통의 기억] ${this.ownerId} 피해 증가 ${boostAmount} 적용`);
    }
  }
} 
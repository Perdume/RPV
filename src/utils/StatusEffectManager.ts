import { StatusEffect, Player, GameEventType, ModifiableEvent } from '../types/game.types';
import { EventSystem } from './eventSystem';

export class StatusEffectManager {
  private static instance: StatusEffectManager | null = null;
  private effects: Map<number, StatusEffect[]> = new Map();
  private eventSystem: any; // EventSystem 타입은 나중에 import

  private constructor() {
    // 기본 상태이상 효과들 등록
    this.registerDefaultEffects();
  }

  public static getInstance(): StatusEffectManager {
    if (!StatusEffectManager.instance) {
      StatusEffectManager.instance = new StatusEffectManager();
    }
    return StatusEffectManager.instance;
  }

  // 🆕 EventSystem과 함께 초기화하는 메서드
  public static initializeWithEventSystem(eventSystem: EventSystem): StatusEffectManager {
    const instance = StatusEffectManager.getInstance();
    instance.setEventSystem(eventSystem);
    return instance;
  }

  // 🆕 EventSystem이 설정된 인스턴스 가져오기
  public static getInstanceWithEventSystem(eventSystem: EventSystem): StatusEffectManager {
    const instance = StatusEffectManager.getInstance();
    if (!instance.eventSystem) {
      instance.setEventSystem(eventSystem);
    }
    return instance;
  }

  // 🆕 EventSystem 설정 메서드
  public setEventSystem(eventSystem: any): void {
    this.eventSystem = eventSystem;
  }

  // 🆕 기본 상태이상 효과 등록
  private registerDefaultEffects(): void {
    // 기본 효과들은 이미 applyStatusEffect에서 처리되므로
    // 여기서는 추가 설정이 필요한 경우에만 구현
  }

  // 상태이상 적용
  public applyStatusEffect(playerId: number, effect: StatusEffect): void {
    const playerEffects = this.effects.get(playerId) || [];
    
    // 중첩 가능한 상태이상인지 확인
    const existingEffect = playerEffects.find(e => e.id === effect.id);
    
    if (existingEffect && effect.stackable) {
      // 중첩 가능한 경우 스택 증가
      existingEffect.stacks = (existingEffect.stacks || 1) + 1;
      existingEffect.duration = Math.max(existingEffect.duration, effect.duration);
    } else if (!existingEffect) {
      // 새로운 상태이상 추가
      const newEffect = { ...effect, stacks: 1 };
      playerEffects.push(newEffect);
      this.effects.set(playerId, playerEffects);
    }

    // 상태이상 적용 이벤트 발생
    this.emitStatusEffectApplied(playerId, effect);
  }

  // 상태이상 제거
  public removeStatusEffect(playerId: number, effectId: string): void {
    const playerEffects = this.effects.get(playerId) || [];
    const effectIndex = playerEffects.findIndex(e => e.id === effectId);
    
    if (effectIndex !== -1) {
      const removedEffect = playerEffects[effectIndex];
      playerEffects.splice(effectIndex, 1);
      this.effects.set(playerId, playerEffects);
      
      // 상태이상 제거 이벤트 발생
      this.emitStatusEffectRemoved(playerId, removedEffect);
    }
  }

  // 상태이상 체크
  public hasStatusEffect(playerId: number, effectId: string): boolean {
    const playerEffects = this.effects.get(playerId) || [];
    return playerEffects.some(e => e.id === effectId);
  }

  // 특정 상태이상 가져오기
  public getStatusEffect(playerId: number, effectId: string): StatusEffect | undefined {
    const playerEffects = this.effects.get(playerId) || [];
    return playerEffects.find(e => e.id === effectId);
  }

  // 플레이어의 모든 상태이상 가져오기
  public getPlayerStatusEffects(playerId: number): StatusEffect[] {
    return this.effects.get(playerId) || [];
  }

  // 🆕 Phase 3: 상태이상 처리 로직 추가
  public processTurnEnd(): void {
    for (const [playerId, effects] of this.effects.entries()) {
      const updatedEffects: StatusEffect[] = [];
      
      for (const effect of effects) {
        if (effect.duration === -1) {
          // 영구 상태이상은 그대로 유지
          updatedEffects.push(effect);
          continue;
        }
        
        // 지속시간 감소
        effect.duration--;
        
        if (effect.duration > 0) {
          updatedEffects.push(effect);
        } else {
          // 지속시간이 끝난 상태이상 제거
          this.removeStatusEffect(playerId, effect.id);
          
          // 제거 이벤트 발생
          if (this.eventSystem) {
            const event: ModifiableEvent = {
              type: GameEventType.STATUS_EFFECT_REMOVED,
              timestamp: Date.now(),
              data: {
                playerId,
                effectId: effect.id,
                effect
              },
              cancelled: false,
              modified: false
            };
            this.eventSystem.emit(event);
          }
        }
      }
      
      this.effects.set(playerId, updatedEffects);
    }
  }

  // 🆕 특수 상태이상 처리
  public processSpecialEffects(): void {
    for (const [playerId, effects] of this.effects.entries()) {
      for (const effect of effects) {
        // 균열 처리
        if (effect.id === 'crack' && (effect.stacks || 0) >= 3) {
          // 피해 1 적용
          const player = this.getPlayer(playerId);
          if (player) {
            player.hp = Math.max(0, player.hp - 1);
          }
          
          // 균열 제거
          this.removeStatusEffect(playerId, 'crack');
        }
        
        // 기타 특수 효과들...
      }
    }
  }

  // 🆕 플레이어 정보 가져오기
  private getPlayer(playerId: number): Player | null {
    // GameState에서 플레이어 정보를 가져와야 함
    // 실제 구현에서는 GameState 참조가 필요
    return null;
  }

  // 상태이상 효과 적용
  public processStatusEffects(players: Player[]): void {
    for (const player of players) {
      const effects = this.getPlayerStatusEffects(player.id);
      
      for (const effect of effects) {
        this.applyStatusEffectLogic(player, effect);
      }
    }
  }

  // 특정 상태이상의 효과 적용
  private applyStatusEffectLogic(player: Player, effect: StatusEffect): void {
    switch (effect.id) {
      case 'poison':
        // 독 데미지
        const poisonDamage = 1 * (effect.stacks || 1);
        player.hp = Math.max(0, player.hp - poisonDamage);
        break;
        
      case 'regeneration':
        // 재생 효과
        const healAmount = 1 * (effect.stacks || 1);
        player.hp = Math.min(player.maxHp, player.hp + healAmount);
        break;
        
      case 'invincible':
        // 무적 상태
        player.isInvincible = true;
        break;
        
      case 'weakness':
        // 약화 효과
        player.attack = Math.max(1, player.attack - (effect.stacks || 1));
        break;
        
      case 'strength':
        // 강화 효과
        player.attack += effect.stacks || 1;
        break;
        
      // 추가 상태이상들은 여기에 구현
    }
  }

  // 상태이상 적용 이벤트 발생
  private async emitStatusEffectApplied(playerId: number, effect: StatusEffect): Promise<void> {
    const event: ModifiableEvent = {
      type: GameEventType.STATUS_EFFECT_APPLIED,
      timestamp: Date.now(),
      data: {
        playerId,
        effect,
        source: effect.source
      },
      cancelled: false,
      modified: false
    };
    
    await this.eventSystem.emit(event);
  }

  // 상태이상 제거 이벤트 발생
  private async emitStatusEffectRemoved(playerId: number, effect: StatusEffect): Promise<void> {
    const event: ModifiableEvent = {
      type: GameEventType.STATUS_EFFECT_REMOVED,
      timestamp: Date.now(),
      data: {
        playerId,
        effect,
        source: effect.source
      },
      cancelled: false,
      modified: false
    };
    
    await this.eventSystem.emit(event);
  }

  // 모든 상태이상 초기화
  public clearAllStatusEffects(): void {
    this.effects.clear();
  }

  // 특정 플레이어의 모든 상태이상 초기화
  public clearPlayerStatusEffects(playerId: number): void {
    this.effects.delete(playerId);
  }

  // 상태이상 통계 정보
  public getStatusEffectStats(): { totalEffects: number; playersWithEffects: number } {
    let totalEffects = 0;
    let playersWithEffects = 0;
    
    for (const effects of this.effects.values()) {
      if (effects.length > 0) {
        playersWithEffects++;
        totalEffects += effects.length;
      }
    }
    
    return { totalEffects, playersWithEffects };
  }

  // 🆕 턴 효과 업데이트 (duration 감소)
  updateTurnEffects(currentTurn: number): void {
    for (const [playerId, effects] of this.effects.entries()) {
      const updatedEffects: StatusEffect[] = [];
      
      for (const effect of effects) {
        if (effect.duration > 0) {
          effect.duration--;
          if (effect.duration > 0) {
            updatedEffects.push(effect);
          } else {
            // duration이 0이 되면 제거 이벤트 발생
            this.emitStatusEffectRemoved(playerId, effect);
          }
        } else if (effect.duration === -1) {
          // 영구 효과는 유지
          updatedEffects.push(effect);
        }
      }
      
      this.effects.set(playerId, updatedEffects);
    }
  }
} 
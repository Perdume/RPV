import { StatusEffect, Player, GameEventType, ModifiableEvent, StatusEffectId } from '../types/game.types';
import { EventSystem } from './eventSystem';

// 🆕 상태이상 템플릿 인터페이스
interface StatusEffectTemplate {
  id: StatusEffectId;
  name: string;
  description: string;
  type: 'buff' | 'debuff' | 'neutral';
  stackable: boolean;
  maxStacks?: number;
  onTurnStart?: (playerId: number, stacks: number) => void;
  onTurnEnd?: (playerId: number, stacks: number) => void;
  onApply?: (playerId: number, stacks: number) => void;
  onRemove?: (playerId: number, stacks: number) => void;
  onDamageReceived?: (playerId: number, damage: number) => number;
}

export class StatusEffectManager {
  private static instance: StatusEffectManager | null = null;
  private effects: Map<number, StatusEffect[]> = new Map();
  private effectDefinitions: Map<StatusEffectId, StatusEffectTemplate> = new Map(); // 🆕 추가
  private eventSystem: EventSystem | null = null;
  private currentTurn: number = 0; // 🆕 추가

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
  public setEventSystem(eventSystem: EventSystem): void {
    this.eventSystem = eventSystem;
  }

  // 🆕 기본 상태이상 효과 등록
  private registerDefaultEffects(): void {
    // 균열
    this.effectDefinitions.set('crack', {
      id: 'crack',
      name: '균열',
      description: '턴 종료시 수치가 3 이상이라면 피해를 1 받고 제거됩니다.',
      type: 'debuff',
      stackable: true,
      maxStacks: 10,
      onTurnEnd: (playerId: number, stacks: number) => {
        if (stacks >= 3) {
          this.dealDamage(playerId, 1);
          this.removeStatusEffect(playerId, 'crack');
        }
      }
    });

    // 파멸의 징조
    this.effectDefinitions.set('doom_sign', {
      id: 'doom_sign',
      name: '파멸의 징조',
      description: '공격 행동시 초기화됩니다.',
      type: 'neutral',
      stackable: true,
      maxStacks: 20
    });

    // 전의 상실
    this.effectDefinitions.set('will_loss', {
      id: 'will_loss',
      name: '전의 상실',
      description: '3의 배수 턴마다 디버프를 받습니다.',
      type: 'debuff',
      stackable: false,
      onTurnStart: (playerId: number, stacks: number) => {
        if (this.currentTurn % 3 === 0) {
          // 가하는 피해 1 감소 또는 받는 피해 1 증가
          const effect = Math.random() < 0.5 ? 'damage_reduction' : 'damage_increase';
          this.applyStatusEffect(playerId, effect, 1, 1);
        }
      }
    });

    // 피해 감소
    this.effectDefinitions.set('damage_reduction', {
      id: 'damage_reduction',
      name: '피해 감소',
      description: '가하는 피해가 1 감소합니다.',
      type: 'debuff',
      stackable: true,
      maxStacks: 5
    });

    // 피해 증가
    this.effectDefinitions.set('damage_increase', {
      id: 'damage_increase',
      name: '피해 증가',
      description: '받는 피해가 1 증가합니다.',
      type: 'debuff',
      stackable: true,
      maxStacks: 5
    });
  }

  // 🆕 상태이상 적용 (타입 안전)
  public applyStatusEffect(playerId: number, effectId: StatusEffectId, duration: number = 1, stacks: number = 1): void {
    const template = this.effectDefinitions.get(effectId);
    if (!template) {
      console.error(`정의되지 않은 상태이상: ${effectId}`);
      return;
    }

    const effect = this.createEffectFromTemplate(template, duration, stacks);
    this.addEffectToPlayer(playerId, effect);
  }

  // 🆕 템플릿에서 상태이상 생성
  private createEffectFromTemplate(template: StatusEffectTemplate, duration: number, stacks: number): StatusEffect {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      duration,
      stackable: template.stackable,
      type: template.type,
      stacks,
      maxStacks: template.maxStacks,
      onApply: template.onApply,
      onRemove: template.onRemove,
      onTurnStart: template.onTurnStart,
      onTurnEnd: template.onTurnEnd,
      onDamageReceived: template.onDamageReceived
    };
  }

  // 🆕 플레이어에게 상태이상 추가
  private addEffectToPlayer(playerId: number, effect: StatusEffect): void {
    const playerEffects = this.effects.get(playerId) || [];
    
    // 중첩 가능한 상태이상인지 확인
    const existingEffect = playerEffects.find(e => e.id === effect.id);
    
    if (existingEffect && effect.stackable) {
      // 중첩 가능한 경우 스택 증가
      const newStacks = Math.min(
        (existingEffect.stacks || 1) + effect.stacks,
        effect.maxStacks || 999
      );
      existingEffect.stacks = newStacks;
      existingEffect.duration = Math.max(existingEffect.duration, effect.duration);
      
      console.log(`[상태이상] ${playerId}의 ${effect.name} 중첩: ${newStacks}`);
    } else if (!existingEffect) {
      // 새로운 상태이상 추가
      const newEffect = { ...effect };
      playerEffects.push(newEffect);
      this.effects.set(playerId, playerEffects);
      
      console.log(`[상태이상] ${playerId}에 ${effect.name} 적용`);
    }

    // 상태이상 적용 이벤트 발생
    this.emitStatusEffectApplied(playerId, effect);
  }

  // 🆕 턴 효과 처리
  public processTurnStart(currentTurn: number): void {
    this.currentTurn = currentTurn;
    
    for (const [playerId, effects] of this.effects.entries()) {
      effects.forEach(effect => {
        if (effect.onTurnStart) {
          effect.onTurnStart(playerId, effect.stacks);
        }
      });
    }
  }

  public processTurnEnd(currentTurn: number): void {
    this.currentTurn = currentTurn;
    
    for (const [playerId, effects] of this.effects.entries()) {
      const remainingEffects: StatusEffect[] = [];
      
      effects.forEach(effect => {
        // 턴 종료 효과 실행
        if (effect.onTurnEnd) {
          effect.onTurnEnd(playerId, effect.stacks);
        }
        
        // 지속시간 감소
        if (effect.duration > 0) {
          effect.duration--;
          if (effect.duration > 0) {
            remainingEffects.push(effect);
          } else {
            // 제거 시 효과
            if (effect.onRemove) {
              effect.onRemove(playerId, effect.stacks);
            }
            console.log(`[상태이상] ${playerId}의 ${effect.name} 지속시간 종료`);
          }
        } else if (effect.duration === -1) {
          // 영구 효과
          remainingEffects.push(effect);
        }
      });
      
      this.effects.set(playerId, remainingEffects);
    }
  }

  // 🆕 데미지 처리 헬퍼
  private dealDamage(playerId: number, damage: number): void {
    // 실제 구현에서는 GameState에서 플레이어를 찾아 데미지 적용
    console.log(`[상태이상] ${playerId}에게 ${damage} 데미지 적용`);
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
      // case 'poison':
      //   // 독 데미지
      //   const poisonDamage = 1 * (effect.stacks || 1);
      //   player.hp = Math.max(0, player.hp - poisonDamage);
      //   break;
      // case 'regeneration':
      //   // 재생 효과
      //   const healAmount = 1 * (effect.stacks || 1);
      //   player.hp = Math.min(player.maxHp, player.hp + healAmount);
      //   break;
      // case 'invincible':
      //   // 무적 상태
      //   player.isInvincible = true;
      //   break;
      // case 'weakness':
      //   // 약화 효과
      //   player.attack = Math.max(1, player.attack - (effect.stacks || 1));
      //   break;
      // case 'strength':
      //   // 강화 효과
      //   player.attack += effect.stacks || 1;
      //   break;
      // 추가 상태이상들은 여기에 구현
    }
  }

  // 상태이상 적용 이벤트 발생
  private async emitStatusEffectApplied(playerId: number, effect: StatusEffect): Promise<void> {
    if (!this.eventSystem) return;
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
    if (!this.eventSystem) return;
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
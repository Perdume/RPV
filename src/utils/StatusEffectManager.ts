import { StatusEffect, Player, PlayerStatus, GameEventType, ModifiableEvent, StatusEffectId } from '../types/game.types';
import { EventSystem } from './eventSystem';

// 🆕 상태이상 템플릿 인터페이스
interface StatusEffectTemplate {
  id: StatusEffectId;
  name: string;
  description: string;
  type: 'buff' | 'debuff' | 'neutral';
  stackable: boolean;
  maxStacks?: number;
  refreshDuration?: number; // 부여받을 때마다 남은 턴 수를 이 값으로 갱신 (예: 균열 3턴)
  onTurnStart?: (playerId: number, stacks: number) => void;
  onTurnEnd?: (playerId: number, stacks: number) => void;
  onApply?: (playerId: number, stacks: number) => void;
  onRemove?: (playerId: number, stacks: number) => void;
  onDamageReceived?: (playerId: number, damage: number) => number;
}

// 상태이상 표기: "균열 3 (2)" = 수치 3, 남은 턴 수 2 (영구 효과는 남은 턴 수 생략)
export function formatStatusEffect(effect: StatusEffect): string {
  const remainingTurns = effect.duration > 0 ? ` (${effect.duration})` : '';
  return `${effect.name || effect.id} ${effect.stacks ?? 1}${remainingTurns}`;
}

export class StatusEffectManager {
  private static instance: StatusEffectManager | null = null;
  private effects: Map<number, StatusEffect[]> = new Map();
  private effectDefinitions: Map<StatusEffectId, StatusEffectTemplate> = new Map(); // 🆕 추가
  private eventSystem: EventSystem | null = null;
  private currentTurn: number = 0; // 🆕 추가
  private players: Player[] = []; // 상태이상 피해 적용 대상 (TurnProcessor가 동기화)
  private pendingLogs: string[] = []; // 턴 로그에 남길 상태이상 결과
  // 다음 턴 등 지정한 턴 시작 시 부여할 상태이상
  private scheduledEffects: Array<{ playerId: number; effectId: StatusEffectId; turn: number; duration: number; stacks: number }> = [];

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

  // 상태이상 피해를 적용할 플레이어 목록 설정
  public setPlayers(players: Player[]): void {
    this.players = players;
  }

  // 턴 로그에 남길 상태이상 결과를 가져오고 비움
  public drainLogs(): string[] {
    const logs = this.pendingLogs;
    this.pendingLogs = [];
    return logs;
  }

  // 🆕 기본 상태이상 효과 등록
  private registerDefaultEffects(): void {
    // 균열
    this.effectDefinitions.set('crack', {
      id: 'crack',
      name: '균열',
      description: '턴 종료시 수치가 3 이상이라면 1의 피해를 받으며, 부여받을 때마다 남은 턴 수가 3턴으로 갱신됩니다.',
      type: 'debuff',
      stackable: true,
      maxStacks: 10,
      refreshDuration: 3,
      onTurnEnd: (playerId: number, stacks: number) => {
        if (stacks >= 3) {
          this.dealDamage(playerId, 1, '균열');
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

    // 가하는 피해 감소
    this.effectDefinitions.set('damage_reduction', {
      id: 'damage_reduction',
      name: '가하는 피해 감소',
      description: '수치만큼 이번 턴 가하는 피해가 감소합니다.',
      type: 'debuff',
      stackable: true,
      maxStacks: 5
    });

    // 받는 피해 증가
    this.effectDefinitions.set('damage_increase', {
      id: 'damage_increase',
      name: '받는 피해 증가',
      description: '이번 턴 받는 최종적 피해가 수치만큼 증가합니다. 피해를 받지 않았어도 공격을 받았다면 적용됩니다.',
      type: 'debuff',
      stackable: true,
      maxStacks: 5
    });

    // 가하는 피해 증가
    this.effectDefinitions.set('dealt_damage_increase', {
      id: 'dealt_damage_increase',
      name: '가하는 피해 증가',
      description: '수치만큼 이번 턴 가하는 피해가 증가합니다.',
      type: 'buff',
      stackable: true,
      maxStacks: 6
    });

    // 받는 피해 감소
    this.effectDefinitions.set('taken_damage_reduction', {
      id: 'taken_damage_reduction',
      name: '받는 피해 감소',
      description: '수치만큼 이번 턴 받는 최종 피해가 감소합니다.',
      type: 'buff',
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

    const effect = this.createEffectFromTemplate(template, template.refreshDuration ?? duration, stacks);
    this.addEffectToPlayer(playerId, effect);
  }

  // 지정한 턴이 시작될 때 상태이상을 부여 (예: 다음 턴 가하는 피해 증가)
  public scheduleStatusEffect(playerId: number, effectId: StatusEffectId, turn: number, duration: number = 1, stacks: number = 1): void {
    this.scheduledEffects.push({ playerId, effectId, turn, duration, stacks });
  }

  // 플레이어의 특정 상태이상 수치 (없으면 0)
  public getStacks(playerId: number, effectId: StatusEffectId): number {
    return this.getStatusEffect(playerId, effectId)?.stacks ?? 0;
  }

  // 두 플레이어의 번호가 교체될 때 상태이상도 함께 이동
  public swapPlayers(playerIdA: number, playerIdB: number): void {
    const effectsA = this.effects.get(playerIdA);
    const effectsB = this.effects.get(playerIdB);
    this.effects.delete(playerIdA);
    this.effects.delete(playerIdB);
    if (effectsA) this.effects.set(playerIdB, effectsA);
    if (effectsB) this.effects.set(playerIdA, effectsB);

    for (const scheduled of this.scheduledEffects) {
      if (scheduled.playerId === playerIdA) scheduled.playerId = playerIdB;
      else if (scheduled.playerId === playerIdB) scheduled.playerId = playerIdA;
    }
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
      existingEffect.duration = this.effectDefinitions.get(effect.id)?.refreshDuration
        ?? Math.max(existingEffect.duration, effect.duration);
      
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

    // 이번 턴에 부여하기로 예약된 상태이상 적용
    const dueEffects = this.scheduledEffects.filter(scheduled => scheduled.turn <= currentTurn);
    this.scheduledEffects = this.scheduledEffects.filter(scheduled => scheduled.turn > currentTurn);
    for (const scheduled of dueEffects) {
      this.applyStatusEffect(scheduled.playerId, scheduled.effectId, scheduled.duration, scheduled.stacks);
    }
    
    for (const [playerId, effects] of this.effects.entries()) {
      effects.forEach(effect => {
        if (effect.onTurnStart) {
          effect.onTurnStart(playerId, effect.stacks);
        }
      });
    }
  }

  // 턴 종료 효과 실행 후 지속시간을 1 감소시키고, 만료된 상태이상을 제거
  public processTurnEnd(currentTurn: number): void {
    this.currentTurn = currentTurn;

    for (const [playerId, effects] of this.effects.entries()) {
      const expiredEffects: StatusEffect[] = [];

      // 턴 종료 효과가 상태이상을 제거할 수 있으므로 복사본을 순회
      for (const effect of [...effects]) {
        // 턴 종료 효과 실행
        if (effect.onTurnEnd) {
          effect.onTurnEnd(playerId, effect.stacks);
        }

        // 턴 종료 효과로 이미 제거된 경우
        if (!this.getPlayerStatusEffects(playerId).includes(effect)) {
          continue;
        }

        // 지속시간 감소 (-1은 영구 효과)
        if (effect.duration === -1) continue;
        if (effect.duration > 0) {
          effect.duration--;
        }
        if (effect.duration <= 0) {
          expiredEffects.push(effect);
        }
      }

      if (expiredEffects.length === 0) continue;

      this.effects.set(
        playerId,
        this.getPlayerStatusEffects(playerId).filter(effect => !expiredEffects.includes(effect))
      );

      for (const effect of expiredEffects) {
        // 제거 시 효과
        if (effect.onRemove) {
          effect.onRemove(playerId, effect.stacks);
        }
        console.log(`[상태이상] ${playerId}의 ${effect.name} 지속시간 종료`);
        this.emitStatusEffectRemoved(playerId, effect);
      }
    }
  }

  // 상태이상으로 인한 피해 적용 (사망 판정은 TurnProcessor가 턴 종료 후 처리)
  private dealDamage(playerId: number, damage: number, source: string): void {
    const player = this.getPlayer(playerId);
    if (!player || player.status === PlayerStatus.DEAD) return;

    const oldHp = player.hp;
    player.hp = Math.max(0, player.hp - damage);
    this.pendingLogs.push(`[${source}] ${player.name}이(가) ${source}(으)로 ${damage}의 피해를 받았습니다. (체력: ${oldHp} → ${player.hp})`);
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

  // 🆕 플레이어 정보 가져오기
  private getPlayer(playerId: number): Player | null {
    return this.players.find(p => p.id === playerId) ?? null;
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
    this.scheduledEffects = [];
    this.pendingLogs = [];
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
} 
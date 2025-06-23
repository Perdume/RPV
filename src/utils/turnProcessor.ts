import { 
  Player, 
  PlayerStatus, 
  PlayerAction, 
  TurnResult, 
  GameState, 
  ActionType,
  DamageEvent,
  DefendEvent,
  ModifiableEvent,
  GameEventType,
  GameSnapshot,
  GameSessionData,
  StatusEffect
} from '../types/game.types';
import { EventSystem } from '../utils/eventSystem';
import { AbilityManager } from '../abilities/AbilityManager';
import { StatusEffectManager } from './StatusEffectManager';
import { DataManager } from './DataManager';

const DEATH_ZONE_TURN = 5;

export class TurnProcessor {
  private gameState: GameState;
  private eventSystem: EventSystem;
  private abilityManager: AbilityManager;
  private statusEffectManager: StatusEffectManager;
  private debugLogs: string[];
  private lastTurnHpChanges: Map<number, number> = new Map(); // 턴 시작 시 체력 기록용

  // 🆕 확장된 속성들
  private performanceMetrics: {
    totalTurns: number;
    averageTurnTime: number;
    errorCount: number;
    lastTurnTimestamp: number;
  } = {
    totalTurns: 0,
    averageTurnTime: 0,
    errorCount: 0,
    lastTurnTimestamp: 0
  };
  
  // 🆕 에러 처리
  private errorThreshold: number = 5; // 에러 임계값
  private isProcessingEnabled: boolean = true; // 처리 활성화 상태

  constructor(gameState: GameState, eventSystem: EventSystem, abilityManager?: AbilityManager) {
    this.gameState = gameState;
    this.eventSystem = eventSystem;
    this.debugLogs = [];
    this.statusEffectManager = StatusEffectManager.getInstance();
    
    // 외부에서 AbilityManager를 받으면 사용, 없으면 새로 생성
    if (abilityManager) {
      this.abilityManager = abilityManager;
    } else {
    this.abilityManager = new AbilityManager(this.eventSystem);
    }
    
    this.syncGameState();
    this.assignPlayerAbilities();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // 게임 상태 변경 시 AbilityManager 업데이트
    this.eventSystem.on(GameEventType.TURN_START, async () => {
      await this.syncGameState();
      await this.recordHpChanges();
      await this.processTurnStartEffects();
    });

    this.eventSystem.on(GameEventType.TURN_END, async () => {
      await this.syncGameState();
      await this.checkPerfectGuard();
      await this.processTurnEndEffects();
    });

    this.eventSystem.on(GameEventType.ATTACK_ACTION, async () => {
      await this.syncGameState();
    });

    this.eventSystem.on(GameEventType.DEFEND_ACTION, async () => {
      await this.syncGameState();
    });

    this.eventSystem.on(GameEventType.EVADE_ACTION, async () => {
      await this.syncGameState();
    });

    this.eventSystem.on(GameEventType.DEATH, async () => {
      await this.syncGameState();
    });
    
    // 🆕 새로운 이벤트 리스너들
    this.eventSystem.on(GameEventType.STATUS_EFFECT_APPLIED, async (event) => {
      await this.handleStatusEffectApplied(event);
    });
    
    this.eventSystem.on(GameEventType.STATUS_EFFECT_REMOVED, async (event) => {
      await this.handleStatusEffectRemoved(event);
    });
    
    this.eventSystem.on(GameEventType.ABILITY_CHAIN_TRIGGERED, async (event) => {
      await this.handleAbilityChainTriggered(event);
    });
  }

  // 🆕 턴 시작 효과 처리
  private async processTurnStartEffects(): Promise<void> {
    try {
      // 상태이상 턴 시작 효과 처리
      for (const player of this.gameState.players) {
        const effects = this.statusEffectManager.getPlayerStatusEffects(player.id);
        for (const effect of effects) {
          await this.applyStatusEffectTurnStart(player, effect);
        }
      }
    } catch (error) {
      this.handleError('턴 시작 효과 처리', error);
    }
  }
  
  // 🆕 턴 종료 효과 처리
  private async processTurnEndEffects(): Promise<void> {
    try {
      // 상태이상 턴 종료 효과 처리
      for (const player of this.gameState.players) {
        const effects = this.statusEffectManager.getPlayerStatusEffects(player.id);
        for (const effect of effects) {
          await this.applyStatusEffectTurnEnd(player, effect);
        }
      }
      
      // 상태이상 duration 감소
      this.statusEffectManager.updateTurnEffects(this.gameState.currentTurn);
      
    } catch (error) {
      this.handleError('턴 종료 효과 처리', error);
    }
  }
  
  // 🆕 상태이상 턴 시작 효과 적용
  private async applyStatusEffectTurnStart(player: Player, effect: StatusEffect): Promise<void> {
    switch (effect.id) {
      case 'regen':
        // 재생 효과
        if (player.hp < player.maxHp) {
          const healAmount = Math.min(2 * (effect.stacks || 1), player.maxHp - player.hp);
          player.hp += healAmount;
          console.log(`[상태이상] ${player.name} 재생 효과: +${healAmount} HP`);
        }
        break;
      case 'poison':
        // 독 효과
        const poisonDamage = 1 * (effect.stacks || 1);
        player.hp = Math.max(0, player.hp - poisonDamage);
        console.log(`[상태이상] ${player.name} 독 효과: -${poisonDamage} HP`);
        break;
    }
  }
  
  // 🆕 상태이상 턴 종료 효과 적용
  private async applyStatusEffectTurnEnd(player: Player, effect: StatusEffect): Promise<void> {
    switch (effect.id) {
      case 'weaken':
        // 약화 효과 (공격력 감소)
        player.attack = Math.max(1, player.attack - (effect.stacks || 1));
        break;
      case 'strengthen':
        // 강화 효과 (공격력 증가)
        player.attack += effect.stacks || 1;
        break;
    }
  }
  
  // 🆕 상태이상 적용 이벤트 처리
  private async handleStatusEffectApplied(event: ModifiableEvent): Promise<void> {
    const { targetId, effectId, duration, stacks } = event.data;
    console.log(`[이벤트] 상태이상 적용: 플레이어 ${targetId}에 ${effectId} (${duration}턴, ${stacks}중첩)`);
  }
  
  // 🆕 상태이상 제거 이벤트 처리
  private async handleStatusEffectRemoved(event: ModifiableEvent): Promise<void> {
    const { targetId, effectId } = event.data;
    console.log(`[이벤트] 상태이상 제거: 플레이어 ${targetId}에서 ${effectId}`);
  }
  
  // 🆕 능력 체인 트리거 이벤트 처리
  private async handleAbilityChainTriggered(event: ModifiableEvent): Promise<void> {
    const { chainId, triggerAbility } = event.data;
    console.log(`[이벤트] 능력 체인 트리거: ${chainId} (트리거: ${triggerAbility})`);
    
    // 능력 체인 실행
    await this.abilityManager.executeAbilityChain(chainId, event);
  }
  
  // 🆕 에러 처리
  private handleError(context: string, error: any): void {
    this.performanceMetrics.errorCount++;
    console.error(`[TurnProcessor] ${context} 중 에러:`, error);
    
    if (this.performanceMetrics.errorCount > this.errorThreshold) {
      this.isProcessingEnabled = false;
      console.warn(`[TurnProcessor] 처리 비활성화됨 (에러 임계값 초과)`);
    }
  }
  
  // 🆕 성능 측정 시작
  private startPerformanceMeasurement(): void {
    this.performanceMetrics.lastTurnTimestamp = performance.now();
  }
  
  // 🆕 성능 측정 종료
  private endPerformanceMeasurement(): void {
    const turnTime = performance.now() - this.performanceMetrics.lastTurnTimestamp;
    this.performanceMetrics.totalTurns++;
    this.performanceMetrics.averageTurnTime = 
      (this.performanceMetrics.averageTurnTime * (this.performanceMetrics.totalTurns - 1) + turnTime) / 
      this.performanceMetrics.totalTurns;
  }
  
  // 🆕 성능 통계 가져오기
  public getPerformanceStats(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }
  
  // 🆕 처리 재활성화
  public reenableProcessing(): void {
    this.isProcessingEnabled = true;
    this.performanceMetrics.errorCount = 0;
  }

  private async recordHpChanges(): Promise<void> {
    // 턴 시작 시 모든 플레이어의 체력 기록
    this.gameState.players.forEach(player => {
      this.lastTurnHpChanges.set(player.id, player.hp);
    });
  }

  private async checkPerfectGuard(): Promise<void> {
    // 턴 종료 시 퍼펙트 가드 체크
    console.log('[퍼펙트 가드] 턴 종료 시 퍼펙트 가드 조건을 확인합니다.');
    
    this.gameState.players.forEach(player => {
      const startHp = this.lastTurnHpChanges.get(player.id);
      
      // 디버그 로그: 플레이어별 체력 변화 확인
      console.log(`[퍼펙트 가드] ${player.name} (ID: ${player.id}) 체력 변화 확인:`);
      console.log(`  - 턴 시작 시 체력: ${startHp}`);
      console.log(`  - 현재 체력: ${player.hp}`);
      console.log(`  - 체력 변화: ${startHp !== undefined ? (player.hp - startHp) : '알 수 없음'}`);
      console.log(`  - 현재 방어 게이지: ${player.defenseGauge}/${player.maxDefenseGauge}`);
      console.log(`  - 공격을 받았는가: ${player.wasAttacked}`);
      console.log(`  - 방어를 사용했는가: ${player.hasDefended}`);
      
      // 퍼펙트 가드 조건 확인
      const hasNoHpChange = startHp !== undefined && startHp === player.hp;
      const hasDefenseGaugeSpace = player.defenseGauge < player.maxDefenseGauge;
      const wasAttackedThisTurn = player.wasAttacked;
      
      console.log(`[퍼펙트 가드] ${player.name} 조건 확인:`);
      console.log(`  - 체력 변화 없음: ${hasNoHpChange}`);
      console.log(`  - 방어 게이지 여유 있음: ${hasDefenseGaugeSpace}`);
      console.log(`  - 이번 턴에 공격받음: ${wasAttackedThisTurn}`);
      
      // 퍼펙트 가드 조건: [공격받음] + [체력 변화 없음] + [방어 게이지 여유 있음] (방어 선택 여부와 무관)
      if (wasAttackedThisTurn && hasNoHpChange && hasDefenseGaugeSpace) {
        console.log(`[퍼펙트 가드] ${player.name}에게 퍼펙트 가드가 적용됩니다!`);
        
        // 방어 게이지 증가
        const oldDefenseGauge = player.defenseGauge;
        player.defenseGauge++;
        
        console.log(`[퍼펙트 가드] ${player.name} 방어 게이지 증가: ${oldDefenseGauge} → ${player.defenseGauge}`);
        
        // 퍼펙트 가드 이벤트 발생
        const event: ModifiableEvent = {
          type: GameEventType.PERFECT_GUARD,
          timestamp: Date.now(),
          data: { 
            player: player.id,
            playerName: player.name,
            oldDefenseGauge,
            newDefenseGauge: player.defenseGauge,
            startHp,
            currentHp: player.hp
          },
          cancelled: false,
          modified: false
        };
        
        console.log(`[퍼펙트 가드] ${player.name}에 대한 퍼펙트 가드 이벤트를 발생시킵니다.`);
        this.eventSystem.emit(event);
      } else {
        console.log(`[퍼펙트 가드] ${player.name}는 퍼펙트 가드 조건을 만족하지 않습니다.`);
        
        // 조건별 상세 로그
        if (!wasAttackedThisTurn) {
          console.log(`  - 이유: 이번 턴에 공격을 받지 않았습니다`);
        }
        if (!hasNoHpChange) {
          console.log(`  - 이유: 체력이 변화했습니다 (${startHp} → ${player.hp})`);
        }
        if (!hasDefenseGaugeSpace) {
          console.log(`  - 이유: 방어 게이지가 최대입니다 (${player.defenseGauge}/${player.maxDefenseGauge})`);
        }
      }
    });
    
    console.log('[퍼펙트 가드] 모든 플레이어의 퍼펙트 가드 확인이 완료되었습니다.');
  }

  private async syncGameState(): Promise<void> {
    // 게임 상태를 AbilityManager에 동기화
    this.abilityManager.setGameState({
      players: this.gameState.players
    });
    console.log('[상태 동기화] 게임 상태가 AbilityManager에 동기화되었습니다.');
  }

  private addDebugLog(message: string): void {
    this.debugLogs.push(message);
  }

  // 플레이어 능력 할당 메서드
  private assignPlayerAbilities(): void {
    // 디버거 플레이어 찾기
    const debuggerPlayer = this.gameState.players.find(p => p.name === '디버거');
    
    if (debuggerPlayer) {
      // 디버거 플레이어에게만 Debug 능력 할당
      this.abilityManager.assignAbility(debuggerPlayer.id, 'debug');
      debuggerPlayer.ability = 'debug';
      console.log(`[능력 할당] ${debuggerPlayer.name}에게 Debug 능력을 할당했습니다.`);
    }
  }

  // 턴 처리 전 백업
  async backupCurrentTurn(): Promise<void> {
    const currentTurn = this.gameState.currentTurn;
    const backupDir = `src/data/history/Turn_${currentTurn}`;
    
    try {
      // 1. 게임 상태 백업
      const gameData = await DataManager.loadGameSession();
      await DataManager.saveGameSnapshot({
        gameState: gameData,
        abilityStates: await this.captureAbilityStates(),
        metadata: {
          timestamp: Date.now(),
          turnNumber: currentTurn
        }
      });
      
      // 🆕 성능 메트릭 백업
      const performanceData = {
        turnProcessor: this.performanceMetrics,
        abilityManager: this.abilityManager.getPerformanceStats()
      };
      
      await DataManager.savePerformanceData(currentTurn, performanceData);
      
    } catch (error) {
      this.handleError('턴 백업', error);
    }
  }

  private async captureAbilityStates(): Promise<Record<string, any>> {
    const states: Record<string, any> = {};

    for (const player of this.gameState.players) {
        const ability = this.abilityManager.getPlayerAbility(player.id);
        if (ability) {
        states[`player_${player.id}`] = {
          abilityId: ability.id,
          cooldown: ability.cooldown,
          isActive: ability.isActive
        };
      }
    }

    return states;
  }

  async processTurn(actions: PlayerAction[]): Promise<TurnResult> {
    // 🆕 처리 비활성화 체크
    if (!this.isProcessingEnabled) {
      throw new Error('턴 처리가 비활성화되었습니다. 에러 임계값을 초과했습니다.');
    }
    
    // 🆕 성능 측정 시작
    this.startPerformanceMeasurement();
    
    try {
    const result = await this.processActionsInternal(actions);
    
      // 🆕 성능 측정 종료
      this.endPerformanceMeasurement();
    
    return result;
    } catch (error) {
      this.handleError('턴 처리', error);
      throw error;
    }
  }

  private async processActionsInternal(actions: PlayerAction[]): Promise<TurnResult> {
    const logs: string[] = [];
    const turnNumber = this.gameState.currentTurn + 1;

    // 디버그 로그 추가
    console.log(`[턴 시작] ${turnNumber}턴이 시작됩니다.`);

    logs.push(`=== 턴 ${turnNumber} 시작 ===`);
    logs.push(`입력된 행동 수: ${actions.length}`);
    logs.push(`현재 생존자 수: ${this.gameState.players.filter(p => p.status !== PlayerStatus.DEAD).length}`);

    // 턴 시작 시 플래그 초기화
    this.gameState.players.forEach(player => {
      player.wasAttacked = false;
      player.hasDefended = false;
      console.log(`[턴 시작] ${player.name}의 플래그 초기화: wasAttacked=false, hasDefended=false`);
    });

    // 1. 턴 시작 이벤트 (새로운 메서드 사용)
    await this.emitTurnStartEvent();

    // 2. 액션 처리
    await this.processActions(actions, logs);

    // 3. 상태 효과 업데이트
    this.updateStatusEffects(logs);

    // 4. 데스존 체크
    const isDeathZone = this.checkDeathZone(turnNumber, logs);

    // 5. 게임 상태 업데이트
    this.updateGameState(turnNumber, logs, isDeathZone);

    // 6. 턴 종료 이벤트 (새로운 메서드 사용)
    await this.emitTurnEndEvent();

    // 7. 능력 쿨다운 업데이트
    this.abilityManager.updateCooldowns();

    // 디버그 로그 추가
    console.log(`[턴 종료] ${turnNumber}턴이 종료됩니다.`);

    return {
      turnNumber,
      actions,
      logs,
      players: this.gameState.players,
      isDeathZone
    };
  }

  private async processActions(actions: PlayerAction[], logs: string[]): Promise<void> {
    // 1단계: 방어 선언 먼저 처리 (hasDefended 플래그 설정)
    for (const action of actions) {
      if (action.actionType === 'DEFEND') {
        const player = this.gameState.players.find(p => p.id === action.playerId);
        
        if (!player || player.status === PlayerStatus.DEAD) {
          continue;
        }

        player.actionType = action.actionType;
        await this.processDefend(player, logs);
      }
    }
    
    // 2단계: 회피 선언 처리 (evadeCount 증가)
    for (const action of actions) {
      if (action.actionType === 'EVADE') {
        const player = this.gameState.players.find(p => p.id === action.playerId);
        
        if (!player || player.status === PlayerStatus.DEAD) {
          continue;
        }

        player.actionType = action.actionType;
        await this.processEvade(player, logs);
      }
    }
    
    // 3단계: 공격과 능력 처리 (방어/회피 상태 확인)
    for (const action of actions) {
      if (action.actionType === 'ATTACK' || action.actionType === 'ABILITY') {
      const player = this.gameState.players.find(p => p.id === action.playerId);
      const target = this.gameState.players.find(p => p.id === action.targetId);
      
      if (!player || !target || player.status === PlayerStatus.DEAD) {
        continue;
      }

      // 액션 타입 설정
      player.actionType = action.actionType;
      console.log(`[액션 처리] ${player.name}의 ${action.actionType} 액션을 처리합니다.`);

      switch (action.actionType) {
        case 'ATTACK':
          await this.processAttack(player, target, logs);
          break;
        case 'ABILITY':
            if (action.abilityId) {
              await this.processAbility(player, action.abilityId, logs);
            } else {
              logs.push(`${player.name}의 능력 ID가 지정되지 않았습니다.`);
            }
          break;
        }
      }
    }
  }

  private async processAttack(attacker: Player, target: Player, logs: string[]): Promise<void> {
    console.log(`[공격 처리] ${attacker.name}이(가) ${target.name}을(를) 공격합니다.`);
    
    // Before Attack 이벤트 발생 (새로운 메서드 사용)
    const beforeAttackEvent = await this.emitBeforeAttackEvent(attacker.id, target.id);

    // 이벤트가 취소되면 공격 중단
    if (beforeAttackEvent.cancelled) {
      console.log(`[공격 처리] ${attacker.name}의 공격이 취소되었습니다.`);
      logs.push(`${attacker.name}의 공격이 취소되었습니다.`);
      return;
    }

    let finalTarget = target;
    let finalDamage = beforeAttackEvent.data.damage;

    // 타겟 변경 체크
    if (beforeAttackEvent.modified && beforeAttackEvent.data.newTarget) {
      const newTarget = this.gameState.players.find(p => p.id === beforeAttackEvent.data.newTarget);
      if (newTarget) {
        finalTarget = newTarget;
        console.log(`[공격 처리] 타겟이 ${target.name}에서 ${finalTarget.name}으로 변경되었습니다.`);
      }
    }

    // 데미지 변경 체크
    if (beforeAttackEvent.modified && beforeAttackEvent.data.newDamage !== undefined) {
      finalDamage = beforeAttackEvent.data.newDamage;
      console.log(`[공격 처리] 데미지가 ${beforeAttackEvent.data.damage}에서 ${finalDamage}으로 변경되었습니다.`);
    }

    // 공격 성공 여부 체크
    if (beforeAttackEvent.modified && beforeAttackEvent.data.attackSuccess === false) {
      console.log(`[공격 처리] ${attacker.name}의 공격이 실패했습니다.`);
      logs.push(`${attacker.name}의 공격이 실패했습니다.`);
      return;
    }

    // 공격 로그
    logs.push(`${attacker.name}이(가) ${finalTarget.name}을(를) 공격합니다! (데미지: ${finalDamage})`);
    finalTarget.wasAttacked = true;

    // 방어 체크 - 방어 선택 시 공격을 확정적으로 무효화
    if (finalTarget.hasDefended) {
      console.log(`[공격 처리] ${finalTarget.name}이(가) 방어로 공격을 무효화했습니다.`);
      
      // 게이지 소모 로직 제거 (이미 processDefend에서 처리됨)
      logs.push(`${finalTarget.name}이(가) 방어로 공격을 무효화했습니다!`);
      
      // 방어 이벤트 발생
      const defendEvent: ModifiableEvent = {
        type: GameEventType.DEFEND_ACTION,
        timestamp: Date.now(),
        data: {
          player: finalTarget.id,
          defenseGauge: finalTarget.defenseGauge,
          damageReduction: 1
        },
        cancelled: false,
        modified: false
      };
      await this.eventSystem.emit(defendEvent);
      return; // 데미지 없음
    }

    // 회피 선택한 경우만 회피 판정 실행
    if (finalTarget.actionType === 'EVADE') {
      console.log(`[공격 처리] ${finalTarget.name}이(가) 회피를 시도합니다.`);
      
      // Before Evade 이벤트 발생
      const beforeEvadeEvent: ModifiableEvent = {
        type: GameEventType.BEFORE_EVADE,
        timestamp: Date.now(),
        data: { player: finalTarget.id, attacker: attacker.id },
        cancelled: false,
        modified: false
      };
      await this.eventSystem.emit(beforeEvadeEvent);

      // 회피 판정
      const aliveCount = this.gameState.players.filter(p => p.status !== PlayerStatus.DEAD).length;
      const evadeChance = 5 * (aliveCount - finalTarget.evadeCount * 2);
      const isEvadeSuccess = Math.random() * 100 < Math.max(0, evadeChance);
      
      console.log(`[공격 처리] ${finalTarget.name}의 회피 판정: ${evadeChance}% 확률, 성공: ${isEvadeSuccess}`);

      // After Evade 이벤트 발생
      const afterEvadeEvent: ModifiableEvent = {
        type: GameEventType.AFTER_EVADE,
        timestamp: Date.now(),
        data: {
          player: finalTarget.id,
          attacker: attacker.id,
          success: isEvadeSuccess
        },
        cancelled: false,
        modified: false
      };
      await this.eventSystem.emit(afterEvadeEvent);

      if (isEvadeSuccess) {
        console.log(`[공격 처리] ${finalTarget.name}이(가) 회피에 성공했습니다.`);
        logs.push(`${finalTarget.name}이(가) 회피에 성공했습니다!`);
        return;
      }
    }
    // 회피 선택 안 했으면 바로 데미지 적용

    // 데미지 적용
    const oldHp = finalTarget.hp;
    finalTarget.hp -= finalDamage;
    
    console.log(`[공격 처리] ${finalTarget.name}에게 데미지 적용: ${oldHp} → ${finalTarget.hp} (데미지: ${finalDamage})`);

    // After Attack 이벤트 발생 (새로운 메서드 사용)
    await this.emitAfterAttackEvent(attacker.id, finalTarget.id, finalDamage);

    // 체력이 0 이하가 되면 사망 처리
    if (finalTarget.hp <= 0) {
      // Before Death 이벤트 발생 (새로운 메서드 사용)
      const beforeDeathEvent = await this.emitBeforeDeathEvent(finalTarget.id);
      
      // 이벤트가 취소되면 사망 방지
      if (beforeDeathEvent.cancelled) {
        console.log(`[공격 처리] ${finalTarget.name}의 사망이 방지되었습니다.`);
        finalTarget.hp = Math.max(1, finalTarget.hp); // 최소 1로 설정
        logs.push(`${finalTarget.name}의 사망이 방지되었습니다!`);
      } else {
        // 사망 처리
        finalTarget.hp = 0;
      finalTarget.status = PlayerStatus.DEAD;
        
        console.log(`[공격 처리] ${finalTarget.name}이(가) 사망했습니다.`);
        logs.push(`${finalTarget.name}이(가) 사망했습니다!`);
        
        // After Death 이벤트 발생 (새로운 메서드 사용)
        await this.emitAfterDeathEvent(finalTarget.id, attacker.id);
      }
    } else {
      logs.push(`${finalTarget.name}의 체력: ${oldHp} → ${finalTarget.hp}`);
    }
  }

  private async processDefend(player: Player, logs: string[]): Promise<void> {
    console.log(`[방어 처리] ${player.name}이(가) 방어를 시도합니다.`);
    
    // Before Defend 이벤트 발생
    const beforeDefendEvent: ModifiableEvent = {
      type: GameEventType.BEFORE_DEFEND,
      timestamp: Date.now(),
      data: { player: player.id },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(beforeDefendEvent);

    // 이벤트가 취소되었으면 중단
    if (beforeDefendEvent.cancelled) {
      console.log(`[방어 처리] ${player.name}의 방어가 취소되었습니다.`);
      logs.push(`${player.name}의 방어가 취소되었습니다.`);
      return;
    }

    // 방어 선택 시점에 게이지 소모하도록 수정
    if (player.defenseGauge > 0) {
      const oldDefenseGauge = player.defenseGauge;
      player.defenseGauge--; // 여기서 소모
      player.hasDefended = true;
      
      console.log(`[방어 처리] ${player.name}의 방어게이지를 소모합니다: ${oldDefenseGauge} → ${player.defenseGauge}`);
      console.log(`[방어 처리] ${player.name}의 hasDefended 플래그를 true로 설정합니다.`);
      console.log(`[방어 처리] ${player.name}의 방어가 성공했습니다!`);
    } else {
      // 방어 게이지 부족으로 방어 실패 처리
      console.log(`[방어 처리] ${player.name}의 방어게이지가 부족해 방어에 실패했습니다.`);
      logs.push(`${player.name}의 방어게이지가 부족해 방어에 실패했습니다.`);
      return;
    }
  }

  private async processEvade(player: Player, logs: string[]): Promise<void> {
    // 회피 행동 이벤트 발생
    const evadeEvent: ModifiableEvent = {
      type: GameEventType.EVADE_ACTION,
      timestamp: Date.now(),
      data: { player: player.id },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(evadeEvent);

    // 회피카운트 즉시 증가
    const oldEvadeCount = player.evadeCount;
    player.evadeCount++;
    console.log(`[회피 처리] ${player.name}이(가) 회피를 선택했습니다.`);
    console.log(`[회피 처리] ${player.name}의 회피카운트: ${oldEvadeCount} → ${player.evadeCount} (회피 선택으로 +1)`);
    logs.push(`${player.name}의 회피카운트가 증가했습니다. (현재 회피카운트: ${player.evadeCount})`);
  }

  private async processPass(player: Player, logs: string[]): Promise<void> {
    // 패스 행동 이벤트 발생
    const passEvent: ModifiableEvent = {
      type: GameEventType.PASS_ACTION,
      timestamp: Date.now(),
      data: { player: player.id },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(passEvent);

    // 회피카운트 감소
    if (player.evadeCount > 0) {
      player.evadeCount--;
      logs.push(`${player.name}의 회피카운트가 감소했습니다. (현재 회피카운트: ${player.evadeCount})`);
    }

    logs.push(`${player.name}이(가) 행동을 패스했습니다.`);
  }

  private async processAbility(player: Player, abilityInput: string, logs: string[]): Promise<void> {
    console.log(`[능력 처리] ${player.name}이(가) 능력을 사용합니다: ${abilityInput}`);

    // 능력 입력 파싱
    const parsedActions = this.parseAbilityInput(abilityInput);
    if (!parsedActions || parsedActions.length === 0) {
      console.log(`[능력 처리] 능력 입력 파싱 실패: ${abilityInput}`);
      logs.push(`${player.name}의 능력 사용이 실패했습니다. (잘못된 입력)`);
      return;
    }

    // 첫 번째 액션에서 능력 정보 추출
    const firstAction = parsedActions[0];
    if (!firstAction.abilityId) {
      console.log(`[능력 처리] 능력 ID가 없습니다: ${abilityInput}`);
      logs.push(`${player.name}의 능력 ID가 지정되지 않았습니다.`);
      return;
    }

    // 능력 실행
    try {
      const result = await this.abilityManager.executeAbility(
        player.id,
        firstAction.abilityId,
        [firstAction.targetId],
        {}
      );

      if (result.success) {
        console.log(`[능력 처리] ${player.name}의 능력 사용 성공: ${result.message}`);
        logs.push(`${player.name}: ${result.message}`);

        // 능력 결과에 따른 추가 처리
        if (result.damage) {
          // 데미지가 있는 경우 After Attack 이벤트 발생
          await this.emitAfterAttackEvent(player.id, result.target || 0, result.damage);
        }

        if (result.heal) {
          // 힐링이 있는 경우 Before/After Heal 이벤트 발생
          const beforeHealEvent = await this.emitBeforeHealEvent(result.target || player.id, result.heal);
          
          if (!beforeHealEvent.cancelled) {
            const targetPlayer = this.gameState.players.find(p => p.id === (result.target || player.id));
            if (targetPlayer) {
              const oldHp = targetPlayer.hp;
              const finalHealAmount = Math.min(result.heal, targetPlayer.maxHp - targetPlayer.hp);
              targetPlayer.hp = Math.min(targetPlayer.maxHp, targetPlayer.hp + result.heal);
              
              console.log(`[능력 처리] ${targetPlayer.name}의 체력 회복: ${oldHp} → ${targetPlayer.hp} (회복량: ${finalHealAmount})`);
              await this.emitAfterHealEvent(targetPlayer.id, result.heal, finalHealAmount);
            }
          }
        }

        if (result.death) {
          // 사망이 있는 경우 Before/After Death 이벤트 발생
          const beforeDeathEvent = await this.emitBeforeDeathEvent(result.target || player.id);
          
          if (!beforeDeathEvent.cancelled) {
            const targetPlayer = this.gameState.players.find(p => p.id === (result.target || player.id));
            if (targetPlayer) {
              targetPlayer.hp = 0;
              targetPlayer.status = PlayerStatus.DEAD;
              
              console.log(`[능력 처리] ${targetPlayer.name}이(가) 능력으로 사망했습니다.`);
              logs.push(`${targetPlayer.name}이(가) 사망했습니다!`);
              await this.emitAfterDeathEvent(targetPlayer.id, player.id);
            }
          }
        }
      } else {
        console.log(`[능력 처리] ${player.name}의 능력 사용 실패: ${result.message}`);
        logs.push(`${player.name}: ${result.message}`);
      }
    } catch (error) {
      console.log(`[능력 처리] ${player.name}의 능력 실행 중 오류: ${error}`);
      logs.push(`${player.name}의 능력 사용 중 오류가 발생했습니다.`);
    }
  }

  private calculateEvadeChance(player: Player): number {
    const aliveCount = this.gameState.players.filter(p => p.status !== PlayerStatus.DEAD).length;
    const chance = 5 * (aliveCount - player.evadeCount * 2);
    return Math.max(0, chance);
  }

  private calculateDamage(attacker: Player, target: Player): number {
    let damage = attacker.attack;
    
    // 방어력 감소
    if (target.defense > 0) {
      damage = Math.max(1, damage - target.defense);
    }
    
    // 데미지 감소 효과
    if (target.damageReduction > 0) {
      damage = Math.max(1, Math.floor(damage * (1 - target.damageReduction)));
    }
    
    return damage;
  }

  private updateStatusEffects(logs: string[]): void {
    this.gameState.players.forEach(player => {
      if (player.statusEffects.length > 0) {
        logs.push(`[상태효과] ${player.name}의 상태효과: ${player.statusEffects.join(', ')}`);
      }
    });
  }

  private checkDeathZone(turnNumber: number, logs: string[]): boolean {
    const isDeathZone = turnNumber >= DEATH_ZONE_TURN;
    if (isDeathZone) {
      logs.push(`[데스존] ${turnNumber}턴부터 데스존이 활성화되었습니다.`);
    }
    return isDeathZone;
  }

  private updateGameState(turnNumber: number, logs: string[], isDeathZone: boolean): void {
    this.gameState.currentTurn = turnNumber;
    this.gameState.isDeathZone = isDeathZone;
  }

  // Phase 2: 입력 파싱 확장
  /**
   * 입력 텍스트를 파싱하여 PlayerAction[]으로 변환
   * 예시: "1 -> 2", "1 -> 3,5", "1 -> 2,공격,능력"
   */
  public parseAbilityInput(input: string): PlayerAction[] {
    const actions: PlayerAction[] = [];
    const lines = input.split(/\n|;/).map(line => line.trim()).filter(Boolean);
    for (const line of lines) {
      // 예시: "1 -> 2,5,공격,예측"
      const [left, right] = line.split('->').map(s => s.trim());
      if (!left || !right) continue;
      const playerId = parseInt(left, 10);
      if (isNaN(playerId)) continue;
      // 오른쪽 파싱: "2,5,공격,예측"
      const parts = right.split(',').map(s => s.trim());
      const targetIds: number[] = [];
      let actionType: ActionType = 'ATTACK';
      let abilityId: string | undefined = undefined;
      let prediction: any = undefined;
      for (const part of parts) {
        if (/^\d+$/.test(part)) {
          targetIds.push(parseInt(part, 10));
        } else if (['공격','ATTACK','A'].includes(part.toUpperCase())) {
          actionType = 'ATTACK';
        } else if (['방어','DEFEND','D'].includes(part.toUpperCase())) {
          actionType = 'DEFEND';
        } else if (['회피','EVADE','E'].includes(part.toUpperCase())) {
          actionType = 'EVADE';
        } else if (['능력','ABILITY','B'].includes(part.toUpperCase())) {
          actionType = 'ABILITY';
        } else if (part.startsWith('예측') || part.toUpperCase().startsWith('PREDICT')) {
          prediction = { action: part, abilityUse: actionType === 'ABILITY' };
        } else {
          // abilityId로 간주
          abilityId = part;
        }
      }
      // 다중 타겟 지원
      if (targetIds.length === 0) targetIds.push(playerId); // 자기 자신
      for (const targetId of targetIds) {
        actions.push({
          playerId,
          targetId,
          actionType,
          abilityId,
          prediction
        });
      }
    }
    return actions;
  }

  // Phase 2: 이벤트 발생 메서드들
  private async emitTurnStartEvent(): Promise<void> {
    const event: ModifiableEvent = {
      type: GameEventType.TURN_START,
      timestamp: Date.now(),
      data: { 
        turn: this.gameState.currentTurn + 1,
        players: this.gameState.players
      },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(event);
  }

  private async emitTurnEndEvent(): Promise<void> {
    const event: ModifiableEvent = {
      type: GameEventType.TURN_END,
      timestamp: Date.now(),
      data: { 
        turn: this.gameState.currentTurn,
        players: this.gameState.players
      },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(event);
  }

  private async emitBeforeAttackEvent(attacker: number, target: number): Promise<ModifiableEvent> {
    const attackerPlayer = this.gameState.players.find(p => p.id === attacker);
    const targetPlayer = this.gameState.players.find(p => p.id === target);
    
    if (!attackerPlayer || !targetPlayer) {
      throw new Error(`플레이어를 찾을 수 없습니다: attacker=${attacker}, target=${target}`);
    }

    const damage = this.calculateDamage(attackerPlayer, targetPlayer);
    
    const event: ModifiableEvent = {
      type: GameEventType.BEFORE_ATTACK,
      timestamp: Date.now(),
      data: {
        attacker,
        target,
        damage,
        attackerPlayer,
        targetPlayer
      },
      cancelled: false,
      modified: false
    };
    
    await this.eventSystem.emit(event);
    return event;
  }

  private async emitAfterAttackEvent(attacker: number, target: number, damage: number, isCritical: boolean = false): Promise<void> {
    const event: ModifiableEvent = {
      type: GameEventType.AFTER_ATTACK,
      timestamp: Date.now(),
      data: {
        attacker,
        target,
        damage,
        isCritical,
        finalDamage: damage
      },
      cancelled: false,
      modified: false
    };
    
    await this.eventSystem.emit(event);
  }

  private async emitBeforeDeathEvent(playerId: number): Promise<ModifiableEvent> {
    const player = this.gameState.players.find(p => p.id === playerId);
    
    if (!player) {
      throw new Error(`플레이어를 찾을 수 없습니다: ${playerId}`);
    }

    const event: ModifiableEvent = {
      type: GameEventType.BEFORE_DEATH,
      timestamp: Date.now(),
      data: {
        playerId,
        player,
        currentHp: player.hp,
        maxHp: player.maxHp
      },
      cancelled: false,
      modified: false
    };
    
    await this.eventSystem.emit(event);
    return event;
  }

  private async emitAfterDeathEvent(playerId: number, killer?: number): Promise<void> {
    const event: ModifiableEvent = {
      type: GameEventType.AFTER_DEATH,
      timestamp: Date.now(),
      data: {
        playerId,
        killer,
        turn: this.gameState.currentTurn
      },
      cancelled: false,
      modified: false
    };
    
    await this.eventSystem.emit(event);
  }

  private async emitBeforeHealEvent(playerId: number, healAmount: number): Promise<ModifiableEvent> {
    const player = this.gameState.players.find(p => p.id === playerId);
    
    if (!player) {
      throw new Error(`플레이어를 찾을 수 없습니다: ${playerId}`);
    }

    const event: ModifiableEvent = {
      type: GameEventType.BEFORE_HEAL,
      timestamp: Date.now(),
      data: {
        playerId,
        player,
        healAmount,
        currentHp: player.hp,
        maxHp: player.maxHp
      },
      cancelled: false,
      modified: false
    };
    
    await this.eventSystem.emit(event);
    return event;
  }

  private async emitAfterHealEvent(playerId: number, healAmount: number, finalHealAmount: number): Promise<void> {
    const event: ModifiableEvent = {
      type: GameEventType.AFTER_HEAL,
      timestamp: Date.now(),
      data: {
        playerId,
        healAmount,
        finalHealAmount
      },
      cancelled: false,
      modified: false
    };
    
    await this.eventSystem.emit(event);
  }
}
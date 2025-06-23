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
import { Debug } from '../abilities/Debug';
import { DataManager } from './DataManager';

const DEATH_ZONE_TURN = 5;

export class TurnProcessor {
  private gameState: GameState;
  private eventSystem: EventSystem;
  private abilityManager: AbilityManager;
  private statusEffectManager: StatusEffectManager;
  private debug: Debug;
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
    
    this.debug = new Debug();
    
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
          this.addDebugLog(`[상태이상] ${player.name} 재생 효과: +${healAmount} HP`);
        }
        break;
      case 'poison':
        // 독 효과
        const poisonDamage = 1 * (effect.stacks || 1);
        player.hp = Math.max(0, player.hp - poisonDamage);
        this.addDebugLog(`[상태이상] ${player.name} 독 효과: -${poisonDamage} HP`);
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
    this.addDebugLog(`[이벤트] 상태이상 적용: 플레이어 ${targetId}에 ${effectId} (${duration}턴, ${stacks}중첩)`);
  }
  
  // 🆕 상태이상 제거 이벤트 처리
  private async handleStatusEffectRemoved(event: ModifiableEvent): Promise<void> {
    const { targetId, effectId } = event.data;
    this.addDebugLog(`[이벤트] 상태이상 제거: 플레이어 ${targetId}에서 ${effectId}`);
  }
  
  // 🆕 능력 체인 트리거 이벤트 처리
  private async handleAbilityChainTriggered(event: ModifiableEvent): Promise<void> {
    const { chainId, triggerAbility } = event.data;
    this.addDebugLog(`[이벤트] 능력 체인 트리거: ${chainId} (트리거: ${triggerAbility})`);
    
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
    this.addDebugLog('[퍼펙트 가드] 턴 종료 시 퍼펙트 가드 조건을 확인합니다.');
    
    this.gameState.players.forEach(player => {
      const startHp = this.lastTurnHpChanges.get(player.id);
      
      // 디버그 로그: 플레이어별 체력 변화 확인
      this.addDebugLog(`[퍼펙트 가드] ${player.name} (ID: ${player.id}) 체력 변화 확인:`);
      this.addDebugLog(`  - 턴 시작 시 체력: ${startHp}`);
      this.addDebugLog(`  - 현재 체력: ${player.hp}`);
      this.addDebugLog(`  - 체력 변화: ${startHp !== undefined ? (player.hp - startHp) : '알 수 없음'}`);
      this.addDebugLog(`  - 현재 방어 게이지: ${player.defenseGauge}/${player.maxDefenseGauge}`);
      this.addDebugLog(`  - 공격을 받았는가: ${player.wasAttacked}`);
      this.addDebugLog(`  - 방어를 사용했는가: ${player.hasDefended}`);
      
      // 퍼펙트 가드 조건 확인
      const hasNoHpChange = startHp !== undefined && startHp === player.hp;
      const hasDefenseGaugeSpace = player.defenseGauge < player.maxDefenseGauge;
      const wasAttackedThisTurn = player.wasAttacked;
      
      this.addDebugLog(`[퍼펙트 가드] ${player.name} 조건 확인:`);
      this.addDebugLog(`  - 체력 변화 없음: ${hasNoHpChange}`);
      this.addDebugLog(`  - 방어 게이지 여유 있음: ${hasDefenseGaugeSpace}`);
      this.addDebugLog(`  - 이번 턴에 공격받음: ${wasAttackedThisTurn}`);
      
      // 퍼펙트 가드 조건: [공격받음] + [체력 변화 없음] + [방어 게이지 여유 있음] (방어 선택 여부와 무관)
      if (wasAttackedThisTurn && hasNoHpChange && hasDefenseGaugeSpace) {
        this.addDebugLog(`[퍼펙트 가드] ${player.name}에게 퍼펙트 가드가 적용됩니다!`);
        
        // 방어 게이지 증가
        const oldDefenseGauge = player.defenseGauge;
        player.defenseGauge++;
        
        this.addDebugLog(`[퍼펙트 가드] ${player.name} 방어 게이지 증가: ${oldDefenseGauge} → ${player.defenseGauge}`);
        
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
        
        this.addDebugLog(`[퍼펙트 가드] ${player.name}에 대한 퍼펙트 가드 이벤트를 발생시킵니다.`);
        this.eventSystem.emit(event);
      } else {
        this.addDebugLog(`[퍼펙트 가드] ${player.name}는 퍼펙트 가드 조건을 만족하지 않습니다.`);
        
        // 조건별 상세 로그
        if (!wasAttackedThisTurn) {
          this.addDebugLog(`  - 이유: 이번 턴에 공격을 받지 않았습니다`);
        }
        if (!hasNoHpChange) {
          this.addDebugLog(`  - 이유: 체력이 변화했습니다 (${startHp} → ${player.hp})`);
        }
        if (!hasDefenseGaugeSpace) {
          this.addDebugLog(`  - 이유: 방어 게이지가 최대입니다 (${player.defenseGauge}/${player.maxDefenseGauge})`);
        }
      }
    });
    
    this.addDebugLog('[퍼펙트 가드] 모든 플레이어의 퍼펙트 가드 확인이 완료되었습니다.');
  }

  private async syncGameState(): Promise<void> {
    // 게임 상태를 AbilityManager에 동기화
    this.abilityManager.setGameState({
      players: this.gameState.players
    });
    this.addDebugLog('[상태 동기화] 게임 상태가 AbilityManager에 동기화되었습니다.');
  }

  private addDebugLog(message: string): void {
    this.debugLogs.push(message);
    this.debug.logEvent('Debug', { message });
  }

  // 플레이어 능력 할당 메서드
  private assignPlayerAbilities(): void {
    // 디버거 플레이어 찾기
    const debuggerPlayer = this.gameState.players.find(p => p.name === '디버거');
    
    if (debuggerPlayer) {
      // 디버거 플레이어에게만 Debug 능력 할당
      this.abilityManager.assignAbility(debuggerPlayer.id, 'debug');
      debuggerPlayer.ability = 'debug';
      this.addDebugLog(`[능력 할당] ${debuggerPlayer.name}에게 Debug 능력을 할당했습니다.`);
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
    this.addDebugLog(`[턴 시작] ${turnNumber}턴이 시작됩니다.`);

    logs.push(`=== 턴 ${turnNumber} 시작 ===`);
    logs.push(`입력된 행동 수: ${actions.length}`);
    logs.push(`현재 생존자 수: ${this.gameState.players.filter(p => p.status !== PlayerStatus.DEAD).length}`);

    // 턴 시작 시 플래그 초기화
    this.gameState.players.forEach(player => {
      player.wasAttacked = false;
      player.hasDefended = false;
      this.addDebugLog(`[턴 시작] ${player.name}의 플래그 초기화: wasAttacked=false, hasDefended=false`);
    });

    // 1. 턴 시작 이벤트
    const turnStartEvent: ModifiableEvent = {
      type: GameEventType.TURN_START,
      timestamp: Date.now(),
      data: { 
        turn: turnNumber,
        players: this.gameState.players
      },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(turnStartEvent);

    // 2. 액션 처리
    await this.processActions(actions, logs);

    // 3. 상태 효과 업데이트
    this.updateStatusEffects(logs);

    // 4. 데스존 체크
    const isDeathZone = this.checkDeathZone(turnNumber, logs);

    // 5. 게임 상태 업데이트
    this.updateGameState(turnNumber, logs, isDeathZone);

    // 6. 턴 종료 이벤트
    const turnEndEvent: ModifiableEvent = {
      type: GameEventType.TURN_END,
      timestamp: Date.now(),
      data: { 
        turn: turnNumber,
        players: this.gameState.players
      },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(turnEndEvent);

    // 7. 능력 쿨다운 업데이트
    this.abilityManager.updateCooldowns();

    // 디버그 로그 추가
    this.addDebugLog(`[턴 종료] ${turnNumber}턴이 종료됩니다.`);

    logs.push(`=== 턴 ${turnNumber} 종료 ===`);
    logs.push(`최종 생존자 수: ${this.gameState.players.filter(p => p.status !== PlayerStatus.DEAD).length}`);
    logs.push(`데스존 상태: ${isDeathZone ? '활성화' : '비활성화'}`);

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
        this.addDebugLog(`[액션 처리] ${player.name}의 ${action.actionType} 액션을 처리합니다.`);

        switch (action.actionType) {
          case 'ATTACK':
            await this.processAttack(player, target, logs);
            break;
          case 'ABILITY':
            await this.processAbility(player, target, action.abilityId, logs);
            break;
        }
      }
    }
  }

  private async processAttack(attacker: Player, target: Player, logs: string[]): Promise<void> {
    this.addDebugLog(`[공격 처리] ${attacker.name}이(가) ${target.name}을(를) 공격합니다.`);
    
    // 회피카운트 즉시 감소
    const oldEvadeCount = attacker.evadeCount;
    attacker.evadeCount = Math.max(0, attacker.evadeCount - 1);
    this.addDebugLog(`[공격 처리] ${attacker.name}의 회피카운트: ${oldEvadeCount} → ${attacker.evadeCount} (공격 액션으로 -1)`);
    if (oldEvadeCount !== attacker.evadeCount) {
      logs.push(`${attacker.name}의 회피카운트가 감소했습니다. (현재 회피카운트: ${attacker.evadeCount})`);
    }
    
    // Before Attack 이벤트 발생
    const beforeAttackEvent: ModifiableEvent = {
      type: GameEventType.BEFORE_ATTACK,
      timestamp: Date.now(),
      data: { attacker: attacker.id, target: target.id, damage: 1 },
      cancelled: false,
      modified: false
    };
    
    await this.eventSystem.emit(beforeAttackEvent);

    // 이벤트가 취소되었으면 중단
    if (beforeAttackEvent.cancelled) {
      this.addDebugLog(`[공격 처리] ${attacker.name}의 공격이 취소되었습니다.`);
      logs.push(`${attacker.name}의 공격이 취소되었습니다.`);
      return;
    }

    // 타겟 변경 확인
    const finalTarget = this.gameState.players.find(p => p.id === beforeAttackEvent.data.target);
    
    if (!finalTarget) {
      return;
    }

    // 타겟이 공격을 받았음을 표시
    finalTarget.wasAttacked = true;
    this.addDebugLog(`[공격 처리] ${finalTarget.name}의 wasAttacked 플래그를 true로 설정합니다.`);

    // 방어 체크 - 방어 선택 시 공격을 확정적으로 무효화
    if (finalTarget.hasDefended) {
      this.addDebugLog(`[공격 처리] ${finalTarget.name}이(가) 방어로 공격을 무효화했습니다.`);
      
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
      this.addDebugLog(`[공격 처리] ${finalTarget.name}이(가) 회피를 시도합니다.`);
      
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
      
      this.addDebugLog(`[공격 처리] ${finalTarget.name}의 회피 판정: ${evadeChance}% 확률, 성공: ${isEvadeSuccess}`);

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
        this.addDebugLog(`[공격 처리] ${finalTarget.name}이(가) 회피에 성공했습니다.`);
        logs.push(`${finalTarget.name}이(가) 회피에 성공했습니다!`);
        return;
      }
    }
    // 회피 선택 안 했으면 바로 데미지 적용

    // 데미지 적용
    const finalDamage = beforeAttackEvent.data.damage;
    
    const oldHp = finalTarget.hp;
    finalTarget.hp -= finalDamage;
    
    this.addDebugLog(`[공격 처리] ${finalTarget.name}에게 데미지 적용: ${oldHp} → ${finalTarget.hp} (데미지: ${finalDamage})`);

    // After Attack 이벤트 발생
    const afterAttackEvent: ModifiableEvent = {
      type: GameEventType.AFTER_ATTACK,
      timestamp: Date.now(),
      data: {
        attacker: attacker.id, 
        target: finalTarget.id,
        damage: finalDamage 
      },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(afterAttackEvent);

    logs.push(`${attacker.name}이(가) ${finalTarget.name}에게 ${finalDamage}의 데미지를 입혔습니다.`);

    // 사망 체크
    if (finalTarget.hp <= 0) {
      this.addDebugLog(`[공격 처리] ${finalTarget.name}이(가) 사망했습니다.`);
      finalTarget.status = PlayerStatus.DEAD;
      const deathEvent: ModifiableEvent = {
        type: GameEventType.DEATH,
        timestamp: Date.now(),
        data: { player: finalTarget.id, killer: attacker.id },
        cancelled: false,
        modified: false
      };
      await this.eventSystem.emit(deathEvent);
      logs.push(`${finalTarget.name}이(가) 탈락했습니다.`);
    }
  }

  private async processDefend(player: Player, logs: string[]): Promise<void> {
    this.addDebugLog(`[방어 처리] ${player.name}이(가) 방어를 시도합니다.`);
    
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
      this.addDebugLog(`[방어 처리] ${player.name}의 방어가 취소되었습니다.`);
      logs.push(`${player.name}의 방어가 취소되었습니다.`);
      return;
    }

    // 방어 선택 시점에 게이지 소모하도록 수정
    if (player.defenseGauge > 0) {
      const oldDefenseGauge = player.defenseGauge;
      player.defenseGauge--; // 여기서 소모
      player.hasDefended = true;
      
      this.addDebugLog(`[방어 처리] ${player.name}의 방어게이지를 소모합니다: ${oldDefenseGauge} → ${player.defenseGauge}`);
      this.addDebugLog(`[방어 처리] ${player.name}의 hasDefended 플래그를 true로 설정합니다.`);
      this.addDebugLog(`[방어 처리] ${player.name}의 방어가 성공했습니다!`);
    } else {
      // 방어 게이지 부족으로 방어 실패 처리
      this.addDebugLog(`[방어 처리] ${player.name}의 방어게이지가 부족해 방어에 실패했습니다.`);
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
    this.addDebugLog(`[회피 처리] ${player.name}이(가) 회피를 선택했습니다.`);
    this.addDebugLog(`[회피 처리] ${player.name}의 회피카운트: ${oldEvadeCount} → ${player.evadeCount} (회피 선택으로 +1)`);
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

  private async processAbility(player: Player, target: Player, abilityId: string | undefined, logs: string[]): Promise<void> {
    if (!abilityId) {
      this.addDebugLog(`[오류] ${player.name}의 능력 ID가 지정되지 않았습니다.`);
      return;
    }

    // 디버그 로그 추가
    this.addDebugLog(`[능력] ${player.name}이(가) ${abilityId} 능력을 사용합니다.`);

    const abilityEvent: ModifiableEvent = {
      type: GameEventType.ABILITY_USE,
      timestamp: Date.now(),
      data: {
        player: player.id,
        abilityId,
        target: target.id,
        players: this.gameState.players
      },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(abilityEvent);
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
}
import {
  Player,
  PlayerStatus,
  PlayerAction,
  TurnResult,
  GameState,
  ActionType,
  ModifiableEvent,
  GameEventType,
  StatusEffect,
  AttackEvent
} from '../types/game.types';
import { EventSystem } from '../utils/eventSystem';
import { AbilityManager } from '../abilities/AbilityManager';
import { StatusEffectManager, formatStatusEffect } from './StatusEffectManager';
import { DataManager } from './DataManager';
import { GameLogger } from './GameLogger';

// 위키 규칙 (https://github.com/Perdume/Numbers-game/wiki/규칙)
export const DEATH_ZONE_INTERVAL = 5;          // 데스존: 매 5턴마다 최대 체력 1 감소
const FOCUS_ATTACK_START_TURN = 3;      // 집중 공격: 3번째 턴부터 적용
const FOCUS_ATTACK_MIN_ATTACKERS = 3;   // 집중 공격: 한 턴에 3명 이상의 공격 타겟
const EARLY_PROTECTION_LAST_TURN = 2;   // 초반 보호: 2번째 턴까지
const EARLY_PROTECTION_MIN_HP = 1;      // 초반 보호: 체력이 이 값 아래로 감소하지 않음
const EARLY_PROTECTION_TRIGGER_HP = 3;  // 초반 보호: 체력이 3 이하로 감소하면 선택지
const EARLY_PROTECTION_HEAL_TO = 5;     // 초반 보호 선택지 1: 체력 5까지 회복
export const EXTREME_START_TURN = 10;          // 극한: 10번째 턴 이후
export const EXTREME_MAX_SURVIVORS = 5;        // 극한: 생존한 플레이어 5명 이하

// 초반 보호 선택지 2로 교체할 수 있는 특수형 능력 (운명 교차, 심판자 제외)
export const EARLY_PROTECTION_ABILITY_IDS = ['risingAshes', 'annihilation', 'playingDead'];

const FATE_CROSS_ABILITY_IDS = new Set(['fateCross', 'fateExchange']);
const BASIC_ACTION_TYPES = new Set<ActionType>(['ATTACK', 'DEFEND', 'EVADE', 'PASS']);

// 플레이어 customFlags 키 (번호가 교체되어도 플레이어를 따라감)
export const FATE_CROSS_TURN_FLAG = 'fateCrossTurn'; // 초반 보호로 운명 교차를 쓸 수 있는 턴
const EARLY_PROTECTION_OFFERED_FLAG = 'earlyProtectionOffered';

export type EarlyProtectionChoice =
  | { type: 'heal' }                         // 체력 5 회복 + 다음 턴 한정 운명 교차
  | { type: 'replace'; abilityId: string };  // 특수형 능력으로 교체

// 능력 입력 키워드 → 행동 타입 (대문자로 변환한 값으로 조회)
const ACTION_KEYWORDS = new Map<string, ActionType>([
  ['공격', 'ATTACK'], ['ATTACK', 'ATTACK'], ['A', 'ATTACK'],
  ['방어', 'DEFEND'], ['DEFEND', 'DEFEND'], ['D', 'DEFEND'],
  ['회피', 'EVADE'], ['EVADE', 'EVADE'], ['E', 'EVADE'],
  ['능력', 'ABILITY'], ['ABILITY', 'ABILITY'], ['B', 'ABILITY'],
]);

export class TurnProcessor {
  private gameState: GameState;
  private eventSystem: EventSystem;
  private abilityManager!: AbilityManager; // 🔧 수정: definite assignment assertion
  private statusEffectManager: StatusEffectManager;
  private debugLogs: string[];
  private lastTurnHpChanges: Map<number, number> = new Map(); // 턴 시작 시 체력 기록용
  private debugEnabled: boolean = false; // 상세 콘솔 로그 출력 여부

  // 처리 중인 턴의 상태
  private currentTurnNumber: number = 0;
  private turnLogs: string[] = [];
  private isExtremeActive: boolean = false; // 극한 (턴 시작 시 판정)
  private blockedDefenders: Set<Player> = new Set(); // 이번 턴 방어로 공격을 이미 1회 막은 플레이어

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

  private gameLogger: GameLogger = new GameLogger();

  constructor(
    gameState: GameState,
    eventSystem: EventSystem,
    abilityManager?: AbilityManager,
    options?: { debug?: boolean }
  ) {
    this.gameState = gameState;
    this.eventSystem = eventSystem;
    this.debugLogs = [];
    this.debugEnabled = options?.debug ?? false;
    this.statusEffectManager = StatusEffectManager.getInstance();

    // 🔧 AbilityManager 지연 초기화
    if (abilityManager) {
      this.abilityManager = abilityManager;
    } else {
      this.initializeAbilityManager();
    }

    this.syncGameState();
    this.assignPlayerAbilities();
    this.setupEventListeners();
  }

  setDebug(enabled: boolean): void {
    this.debugEnabled = enabled;
  }

  // 디버그 모드일 때만 콘솔에 출력
  private debug(message: string): void {
    if (this.debugEnabled) {
      console.log(message);
    }
  }

  // 🆕 AbilityManager 초기화 메서드
  private initializeAbilityManager(): void {
    this.abilityManager = new AbilityManager(this.eventSystem);
  }

  // 🆕 정리 메서드 추가
  dispose(): void {
    this.debug(`[TURN PROCESSOR] TurnProcessor dispose 시작`);

    // AbilityManager 정리
    this.abilityManager?.dispose();

    // StatusEffectManager 정리
    this.statusEffectManager.clearAllStatusEffects();

    // 데이터 정리
    this.lastTurnHpChanges.clear();
    this.debugLogs = [];

    // 성능 메트릭 리셋
    this.performanceMetrics = {
      totalTurns: 0,
      averageTurnTime: 0,
      errorCount: 0,
      lastTurnTimestamp: 0
    };

    this.debug(`[TURN PROCESSOR] TurnProcessor dispose 완료`);
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
      // 극한: 매 턴 시작시 균열을 1 얻음
      if (this.isExtremeActive) {
        for (const player of this.gameState.players) {
          if (player.status !== PlayerStatus.DEAD) {
            this.statusEffectManager.applyStatusEffect(player.id, 'crack', 3, 1);
          }
        }
      }

      // 상태이상 턴 시작 처리 (시작하는 턴 번호 기준, 예약된 상태이상 포함)
      this.statusEffectManager.processTurnStart(this.gameState.currentTurn + 1);

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
      // 상태이상 턴 종료 처리 (지속시간 감소와 만료 제거 포함)
      this.statusEffectManager.processTurnEnd(this.gameState.currentTurn);

      // 상태이상 턴 종료 효과 처리
      for (const player of this.gameState.players) {
        const effects = this.statusEffectManager.getPlayerStatusEffects(player.id);
        for (const effect of effects) {
          await this.applyStatusEffectTurnEnd(player, effect);
        }
      }
    } catch (error) {
      this.handleError('턴 종료 효과 처리', error);
    }
  }

  // 🆕 상태이상 턴 시작 효과 적용
  private async applyStatusEffectTurnStart(player: Player, effect: StatusEffect): Promise<void> {
    switch (effect.id) {
      case 'damage_reduction':
        // 가하는 피해 감소 효과
        this.debug(`[상태이상] ${player.name} 가하는 피해 감소 효과 적용`);
        break;
      case 'damage_increase':
        // 받는 피해 증가 효과
        this.debug(`[상태이상] ${player.name} 받는 피해 증가 효과 적용`);
        break;
      case 'will_loss':
        // 전의 상실 효과
        this.debug(`[상태이상] ${player.name} 전의 상실 효과 적용`);
        break;
    }
  }

  // 🆕 상태이상 턴 종료 효과 적용
  private async applyStatusEffectTurnEnd(player: Player, effect: StatusEffect): Promise<void> {
    switch (effect.id) {
      case 'crack':
        // 균열 효과
        this.debug(`[상태이상] ${player.name} 균열 효과 처리`);
        break;
      case 'doom_sign':
        // 파멸의 징조 효과
        this.debug(`[상태이상] ${player.name} 파멸의 징조 효과 처리`);
        break;
    }
  }

  // 🆕 상태이상 적용 이벤트 처리
  private async handleStatusEffectApplied(event: ModifiableEvent): Promise<void> {
    const data = event.data as { targetId: number; effectId: string; duration: number; stacks: number };
    this.debug(`[이벤트] 상태이상 적용: 플레이어 ${data.targetId}에 ${data.effectId} (${data.duration}턴, ${data.stacks}중첩)`);
  }

  // 🆕 상태이상 제거 이벤트 처리
  private async handleStatusEffectRemoved(event: ModifiableEvent): Promise<void> {
    const data = event.data as { targetId: number; effectId: string };
    this.debug(`[이벤트] 상태이상 제거: 플레이어 ${data.targetId}에서 ${data.effectId}`);
  }

  // 🆕 능력 체인 트리거 이벤트 처리
  private async handleAbilityChainTriggered(event: ModifiableEvent): Promise<void> {
    const data = event.data as { chainId: string; triggerAbility: string };
    this.debug(`[이벤트] 능력 체인 트리거: ${data.chainId} (트리거: ${data.triggerAbility})`);

    // 능력 체인 실행
    await this.abilityManager.executeAbilityChain(data.chainId, event);
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
    this.debug('[퍼펙트 가드] 턴 종료 시 퍼펙트 가드 조건을 확인합니다.');

    for (const player of this.gameState.players) {
      const startHp = this.lastTurnHpChanges.get(player.id);

      // 퍼펙트 가드 조건 확인
      const hasNoHpChange = startHp !== undefined && startHp === player.hp;
      const hasDefenseGaugeSpace = player.defenseGauge < player.maxDefenseGauge;
      const wasAttackedThisTurn = player.wasAttacked;

      if (this.debugEnabled) {
        this.logPerfectGuardCheck(player, startHp, hasNoHpChange, hasDefenseGaugeSpace);
      }

      // 퍼펙트 가드 조건: [방어를 행동함] + [공격 타겟으로 선택됨] + [체력 변화 없음] + [방어 게이지 여유 있음]
      if (player.hasDefended && wasAttackedThisTurn && hasNoHpChange && hasDefenseGaugeSpace) {
        // 방어 게이지 증가
        const oldDefenseGauge = player.defenseGauge;
        player.defenseGauge++;

        this.turnLogs.push(`[퍼펙트 가드] ${player.name}의 방어 게이지가 1 회복되었습니다. (${oldDefenseGauge} → ${player.defenseGauge})`);

        // 퍼펙트 가드 이벤트 발생 (완료를 기다리지 않음)
        this.eventSystem.emit(this.createEvent(GameEventType.PERFECT_GUARD, {
          player: player.id,
          playerName: player.name,
          oldDefenseGauge,
          newDefenseGauge: player.defenseGauge,
          startHp,
          currentHp: player.hp
        }));
      }
    }

    this.debug('[퍼펙트 가드] 모든 플레이어의 퍼펙트 가드 확인이 완료되었습니다.');
  }

  // 퍼펙트 가드 판정 상세 로그 (디버그 모드 전용)
  private logPerfectGuardCheck(
    player: Player,
    startHp: number | undefined,
    hasNoHpChange: boolean,
    hasDefenseGaugeSpace: boolean
  ): void {
    console.log(`[퍼펙트 가드] ${player.name} (ID: ${player.id}) 체력 변화 확인:`);
    console.log(`  - 턴 시작 시 체력: ${startHp}`);
    console.log(`  - 현재 체력: ${player.hp}`);
    console.log(`  - 체력 변화: ${startHp !== undefined ? (player.hp - startHp) : '알 수 없음'}`);
    console.log(`  - 현재 방어 게이지: ${player.defenseGauge}/${player.maxDefenseGauge}`);
    console.log(`  - 공격을 받았는가: ${player.wasAttacked}`);
    console.log(`  - 방어를 사용했는가: ${player.hasDefended}`);

    if (player.hasDefended && player.wasAttacked && hasNoHpChange && hasDefenseGaugeSpace) {
      console.log(`[퍼펙트 가드] ${player.name}에게 퍼펙트 가드가 적용됩니다!`);
      return;
    }

    console.log(`[퍼펙트 가드] ${player.name}는 퍼펙트 가드 조건을 만족하지 않습니다.`);
    if (!player.hasDefended) {
      console.log(`  - 이유: 이번 턴에 방어를 행동하지 않았습니다`);
    }
    if (!player.wasAttacked) {
      console.log(`  - 이유: 이번 턴에 공격을 받지 않았습니다`);
    }
    if (!hasNoHpChange) {
      console.log(`  - 이유: 체력이 변화했습니다 (${startHp} → ${player.hp})`);
    }
    if (!hasDefenseGaugeSpace) {
      console.log(`  - 이유: 방어 게이지가 최대입니다 (${player.defenseGauge}/${player.maxDefenseGauge})`);
    }
  }

  private async syncGameState(): Promise<void> {
    // 게임 상태를 AbilityManager와 StatusEffectManager에 동기화
    this.abilityManager.setGameState({
      players: this.gameState.players
    });
    this.statusEffectManager.setPlayers(this.gameState.players);
  }

  private addDebugLog(message: string): void {
    this.debugLogs.push(message);
  }

  private findPlayer(playerId: number): Player | undefined {
    return this.gameState.players.find(p => p.id === playerId);
  }

  private countAlivePlayers(): number {
    let count = 0;
    for (const player of this.gameState.players) {
      if (player.status !== PlayerStatus.DEAD) count++;
    }
    return count;
  }

  private getFlags(player: Player): Map<string, any> {
    if (!player.customFlags) {
      player.customFlags = new Map();
    }
    return player.customFlags;
  }

  private isEarlyProtectionTurn(): boolean {
    return this.currentTurnNumber <= EARLY_PROTECTION_LAST_TURN;
  }

  // 플레이어 능력 할당 메서드
  private assignPlayerAbilities(): void {
    // 디버거 플레이어 찾기
    const debuggerPlayer = this.gameState.players.find(p => p.name === '디버거');

    // 디버거 플레이어에게만 Debug 능력 할당 (등록된 경우에만)
    if (debuggerPlayer && this.abilityManager.assignAbility(debuggerPlayer.id, 'debug')) {
      debuggerPlayer.ability = 'debug';
      this.debug(`[능력 할당] ${debuggerPlayer.name}에게 Debug 능력을 할당했습니다.`);
    }
  }

  // 턴 처리 전 백업
  async backupCurrentTurn(): Promise<void> {
    const currentTurn = this.gameState.currentTurn;

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
    this.turnLogs = logs;
    this.currentTurnNumber = turnNumber;
    this.blockedDefenders.clear();

    this.debug(`[턴 시작] ${turnNumber}턴이 시작됩니다.`);

    const aliveCount = this.countAlivePlayers();
    logs.push(`=== 턴 ${turnNumber} 시작 ===`);
    logs.push(`입력된 행동 수: ${actions.length}`);
    logs.push(`현재 생존자 수: ${aliveCount}`);

    // 극한 |종막에 수렴한 함수|: 10번째 턴 이후 생존자 5명 이하
    this.isExtremeActive = turnNumber >= EXTREME_START_TURN && aliveCount <= EXTREME_MAX_SURVIVORS;
    if (this.isExtremeActive) {
      logs.push('[극한] 종막에 수렴한 함수: 모든 생존자가 균열을 1 얻으며, 체력을 회복할 수 없고 회피 카운트가 감소하지 않습니다.');
    }

    // 턴 시작 시 플래그 초기화, 이번 턴 기본 행동 기록 (입력이 없으면 패스)
    const basicActionTypes = this.collectBasicActionTypes(actions);
    for (const player of this.gameState.players) {
      player.wasAttacked = false;
      player.hasDefended = false;
      player.actionType = basicActionTypes.get(player.id) ?? 'PASS';
    }

    // 1. 턴 시작 이벤트
    await this.emitTurnStartEvent();

    // 2. 운명 교차: 턴 처리를 시작하기 전에 번호 교체
    this.processFateCross(actions, logs);

    // 3. 집중 공격 판정
    await this.checkFocusAttack(actions, turnNumber, logs);

    // 4. 액션 처리
    await this.processActions(actions, logs);

    // 5. 회피 카운트 증감
    this.updateEvadeCounts(logs);

    // 6. 게임 상태 업데이트
    const isDeathZone = turnNumber >= DEATH_ZONE_INTERVAL;
    this.updateGameState(turnNumber, logs, isDeathZone);

    // 7. 턴 종료 이벤트 (퍼펙트 가드, 상태이상 턴 종료 처리)
    await this.emitTurnEndEvent();
    logs.push(...this.statusEffectManager.drainLogs());

    // 8. 데스존
    this.applyDeathZone(turnNumber, logs);

    // 9. 상태이상·데스존 등으로 체력이 0 이하가 된 플레이어 처리
    await this.resolvePendingDeaths(logs);

    // 10. 상태이상 표시 갱신
    this.syncPlayerStatusEffects();
    this.updateStatusEffects(logs);

    // 11. 능력 쿨다운 업데이트
    this.abilityManager.updateCooldowns();

    // 12. 초반 보호 선택지
    const earlyProtectionCandidates = this.findEarlyProtectionCandidates(turnNumber, logs);

    this.debug(`[턴 종료] ${turnNumber}턴이 종료됩니다.`);

    return {
      turnNumber,
      actions,
      logs,
      players: this.gameState.players,
      isDeathZone,
      earlyProtectionCandidates
    };
  }

  // 플레이어별 이번 턴 기본 행동 (공격/방어/회피/패스)
  private collectBasicActionTypes(actions: PlayerAction[]): Map<number, ActionType> {
    const actionTypes = new Map<number, ActionType>();
    for (const action of actions) {
      if (BASIC_ACTION_TYPES.has(action.actionType) && !actionTypes.has(action.playerId)) {
        actionTypes.set(action.playerId, action.actionType);
      }
    }
    return actionTypes;
  }

  private isFateCrossAction(action: PlayerAction): boolean {
    return action.actionType === 'ABILITY' && !!action.abilityId && FATE_CROSS_ABILITY_IDS.has(action.abilityId);
  }

  // 운명 교차: 즉시 대상 플레이어와 번호가 교체되며, 행동은 변화시키지 않음
  private processFateCross(actions: PlayerAction[], logs: string[]): void {
    for (const action of actions) {
      if (!this.isFateCrossAction(action)) continue;

      const player = this.findPlayer(action.playerId);
      if (!player || player.status === PlayerStatus.DEAD) continue;

      const flags = this.getFlags(player);
      const isEarlyProtectionGrant = flags.get(FATE_CROSS_TURN_FLAG) === this.currentTurnNumber;
      const ownAbilityId = this.abilityManager.getPlayerAbility(player.id)?.id;
      const ownsFateCross = ownAbilityId !== undefined && FATE_CROSS_ABILITY_IDS.has(ownAbilityId);

      if (!isEarlyProtectionGrant && !ownsFateCross) {
        logs.push(`${player.name}: 운명 교차를 사용할 수 없습니다.`);
        continue;
      }
      if (!isEarlyProtectionGrant && player.abilityUses <= 0) {
        logs.push(`${player.name}: 남은 능력 사용 횟수가 없습니다.`);
        continue;
      }

      const target = this.findPlayer(action.targetId);
      if (!target || target === player || target.status === PlayerStatus.DEAD) {
        logs.push(`${player.name}: 운명 교차 대상이 올바르지 않습니다.`);
        continue;
      }

      const playerNumber = player.id;
      const targetNumber = target.id;
      this.swapPlayerNumbers(player, target, actions);

      if (isEarlyProtectionGrant) {
        flags.delete(FATE_CROSS_TURN_FLAG);
      } else {
        player.abilityUses--;
      }
      logs.push(`[운명 교차] ${player.name}과(와) ${target.name}의 번호가 교체되었습니다. (${playerNumber} ↔ ${targetNumber})`);
    }
  }

  // 번호(id)를 교체하고 번호 기준으로 관리되는 데이터도 함께 옮김
  private swapPlayerNumbers(playerA: Player, playerB: Player, actions: PlayerAction[]): void {
    const idA = playerA.id;
    const idB = playerB.id;
    playerA.id = idB;
    playerB.id = idA;

    this.abilityManager.swapPlayers(idA, idB);
    this.statusEffectManager.swapPlayers(idA, idB);

    const startHpA = this.lastTurnHpChanges.get(idA);
    const startHpB = this.lastTurnHpChanges.get(idB);
    if (startHpA !== undefined) this.lastTurnHpChanges.set(idB, startHpA);
    if (startHpB !== undefined) this.lastTurnHpChanges.set(idA, startHpB);

    // 각자의 행동은 그대로 유지 (공격 대상 번호는 바뀌지 않음)
    for (const action of actions) {
      if (action.playerId === idA) action.playerId = idB;
      else if (action.playerId === idB) action.playerId = idA;
    }

    this.gameState.players.sort((a, b) => a.id - b.id);
  }

  // 집중 공격: 3번째 턴부터, 한 턴에 3명 이상의 공격 타겟이 되면
  // 이번 턴 "받는 피해 1 감소", 다음 턴 "가하는 피해 1 증가"
  private async checkFocusAttack(actions: PlayerAction[], turnNumber: number, logs: string[]): Promise<void> {
    if (turnNumber < FOCUS_ATTACK_START_TURN) return;

    const attackersByTarget = new Map<number, number[]>();
    for (const action of actions) {
      if (action.actionType !== 'ATTACK' || action.playerId === action.targetId) continue;
      const attacker = this.findPlayer(action.playerId);
      if (!attacker || attacker.status === PlayerStatus.DEAD) continue;

      const attackers = attackersByTarget.get(action.targetId) ?? [];
      attackers.push(attacker.id);
      attackersByTarget.set(action.targetId, attackers);
    }

    for (const [targetId, attackerIds] of attackersByTarget) {
      const target = this.findPlayer(targetId);
      if (!target || target.status === PlayerStatus.DEAD || attackerIds.length < FOCUS_ATTACK_MIN_ATTACKERS) continue;

      this.statusEffectManager.applyStatusEffect(target.id, 'taken_damage_reduction', 1, 1);
      this.statusEffectManager.scheduleStatusEffect(target.id, 'dealt_damage_increase', turnNumber + 1, 1, 1);
      logs.push(`[집중 공격] ${target.name}이(가) ${attackerIds.length}명의 공격 타겟이 되어 이번 턴 받는 피해가 1 감소하고, 다음 턴 가하는 피해가 1 증가합니다.`);

      await this.emitEvent(GameEventType.FOCUS_ATTACK, { player: target.id, attackers: attackerIds, turn: turnNumber });
    }
  }

  private async processActions(actions: PlayerAction[], logs: string[]): Promise<void> {
    // 행동을 처리 단계별로 한 번에 분류 (입력 순서 유지)
    const defendActions: PlayerAction[] = [];
    const evadeActions: PlayerAction[] = [];
    const offensiveActions: PlayerAction[] = [];
    for (const action of actions) {
      switch (action.actionType) {
        case 'DEFEND':
          defendActions.push(action);
          break;
        case 'EVADE':
          evadeActions.push(action);
          break;
        case 'ATTACK':
          offensiveActions.push(action);
          break;
        case 'ABILITY':
          // 운명 교차는 턴 처리 시작 전에 이미 처리됨
          if (!this.isFateCrossAction(action)) {
            offensiveActions.push(action);
          }
          break;
      }
    }

    // 1단계: 방어 선언 먼저 처리 (hasDefended 플래그 설정)
    for (const action of defendActions) {
      const player = this.findPlayer(action.playerId);
      if (!player || player.status === PlayerStatus.DEAD) {
        continue;
      }
      await this.processDefend(player, logs);
    }

    // 2단계: 회피 선언 처리 (evadeCount 증가)
    for (const action of evadeActions) {
      const player = this.findPlayer(action.playerId);
      if (!player || player.status === PlayerStatus.DEAD) {
        continue;
      }
      await this.processEvade(player, logs);
    }

    // 3단계: 공격과 능력 처리 (방어/회피 상태 확인)
    for (const action of offensiveActions) {
      const player = this.findPlayer(action.playerId);
      if (!player || player.status === PlayerStatus.DEAD) {
        continue;
      }

      this.debug(`[액션 처리] ${player.name}의 ${action.actionType} 액션을 처리합니다.`);

      if (action.actionType === 'ABILITY') {
        await this.processAbility(player, action, logs);
        continue;
      }

      const target = this.findPlayer(action.targetId);
      if (target) {
        await this.processAttack(player, target, logs);
      }
    }
  }

  private async processAttack(attacker: Player, target: Player, logs: string[]): Promise<void> {
    this.debug(`[공격 처리] ${attacker.name}이(가) ${target.name}을(를) 공격합니다.`);

    // Before Attack 이벤트 발생
    const beforeAttackEvent = await this.emitBeforeAttackEvent(attacker.id, target.id);

    // 이벤트가 취소되면 공격 중단
    if (beforeAttackEvent.cancelled) {
      this.debug(`[공격 처리] ${attacker.name}의 공격이 취소되었습니다.`);
      logs.push(`${attacker.name}의 공격이 취소되었습니다.`);
      return;
    }

    const attackData = beforeAttackEvent.data as AttackEvent;
    let finalTarget = target;
    let finalDamage = attackData.damage;

    if (beforeAttackEvent.modified) {
      // 타겟 변경 체크
      if (attackData.newTarget) {
        const newTarget = this.findPlayer(attackData.newTarget);
        if (newTarget) {
          finalTarget = newTarget;
          this.debug(`[공격 처리] 타겟이 ${target.name}에서 ${finalTarget.name}으로 변경되었습니다.`);
        }
      }

      // 데미지 변경 체크
      if (attackData.newDamage !== undefined) {
        finalDamage = attackData.newDamage;
        this.debug(`[공격 처리] 데미지가 ${attackData.damage}에서 ${finalDamage}으로 변경되었습니다.`);
      }

      // 공격 성공 여부 체크
      if (attackData.attackSuccess === false) {
        this.debug(`[공격 처리] ${attacker.name}의 공격이 실패했습니다.`);
        logs.push(`${attacker.name}의 공격이 실패했습니다.`);
        return;
      }
    }

    // 공격 로그
    logs.push(`${attacker.name}이(가) ${finalTarget.name}을(를) 공격합니다! (데미지: ${finalDamage})`);
    finalTarget.wasAttacked = true;

    // 방어 체크 - 방어는 공격을 1회 확정적으로 무효화 (게이지는 processDefend에서 이미 소모됨)
    if (finalTarget.hasDefended && !this.blockedDefenders.has(finalTarget)) {
      this.blockedDefenders.add(finalTarget);
      this.debug(`[공격 처리] ${finalTarget.name}이(가) 방어로 공격을 무효화했습니다.`);
      logs.push(`${finalTarget.name}이(가) 방어로 공격을 무효화했습니다!`);

      await this.emitEvent(GameEventType.DEFEND_ACTION, {
        player: finalTarget.id,
        defenseGauge: finalTarget.defenseGauge,
        damageReduction: 1
      });
      return; // 데미지 없음
    }

    // 회피 선택한 경우만 회피 판정 실행 (선택 안 했으면 바로 데미지 적용)
    if (finalTarget.actionType === 'EVADE') {
      this.debug(`[공격 처리] ${finalTarget.name}이(가) 회피를 시도합니다.`);

      await this.emitEvent(GameEventType.BEFORE_EVADE, { player: finalTarget.id, attacker: attacker.id });

      // 회피 판정
      const evadeChance = this.calculateEvadeChance(finalTarget);
      const isEvadeSuccess = Math.random() * 100 < evadeChance;

      this.debug(`[공격 처리] ${finalTarget.name}의 회피 판정: ${evadeChance}% 확률, 성공: ${isEvadeSuccess}`);

      await this.emitEvent(GameEventType.AFTER_EVADE, {
        player: finalTarget.id,
        attacker: attacker.id,
        success: isEvadeSuccess
      });

      if (isEvadeSuccess) {
        this.debug(`[공격 처리] ${finalTarget.name}이(가) 회피에 성공했습니다.`);
        logs.push(`${finalTarget.name}이(가) 회피에 성공했습니다!`);
        return;
      }
    }

    // 받는 피해 증감 적용 후 데미지 적용 (초반 보호 중에는 체력 하한 유지)
    finalDamage = this.applyTakenDamageModifiers(finalTarget, finalDamage);
    const oldHp = finalTarget.hp;
    finalTarget.hp -= finalDamage;
    if (this.isEarlyProtectionTurn() && finalTarget.hp < EARLY_PROTECTION_MIN_HP) {
      finalTarget.hp = Math.min(oldHp, EARLY_PROTECTION_MIN_HP);
      logs.push(`[초반 보호] ${finalTarget.name}의 체력이 ${EARLY_PROTECTION_MIN_HP} 아래로 감소하지 않습니다.`);
    }

    this.debug(`[공격 처리] ${finalTarget.name}에게 데미지 적용: ${oldHp} → ${finalTarget.hp} (데미지: ${finalDamage})`);

    await this.emitAfterAttackEvent(attacker.id, finalTarget.id, finalDamage);

    // 체력이 0 이하가 되면 사망 처리
    if (finalTarget.hp <= 0) {
      const beforeDeathEvent = await this.emitBeforeDeathEvent(finalTarget.id);

      // 이벤트가 취소되면 사망 방지
      if (beforeDeathEvent.cancelled) {
        this.debug(`[공격 처리] ${finalTarget.name}의 사망이 방지되었습니다.`);
        finalTarget.hp = Math.max(1, finalTarget.hp); // 최소 1로 설정
        logs.push(`${finalTarget.name}의 사망이 방지되었습니다!`);
      } else {
        finalTarget.hp = 0;
        finalTarget.status = PlayerStatus.DEAD;

        this.debug(`[공격 처리] ${finalTarget.name}이(가) 사망했습니다.`);
        logs.push(`${finalTarget.name}이(가) 사망했습니다!`);

        await this.emitAfterDeathEvent(finalTarget.id, attacker.id);
      }
    } else {
      logs.push(`${finalTarget.name}의 체력: ${oldHp} → ${finalTarget.hp}`);
    }
  }

  private async processDefend(player: Player, logs: string[]): Promise<void> {
    this.debug(`[방어 처리] ${player.name}이(가) 방어를 시도합니다.`);

    if (player.isDefenseSealed) {
      logs.push(`${player.name}의 방어 행동이 봉인되어 방어에 실패했습니다.`);
      return;
    }

    const beforeDefendEvent = await this.emitEvent(GameEventType.BEFORE_DEFEND, { player: player.id });

    // 이벤트가 취소되었으면 중단
    if (beforeDefendEvent.cancelled) {
      this.debug(`[방어 처리] ${player.name}의 방어가 취소되었습니다.`);
      logs.push(`${player.name}의 방어가 취소되었습니다.`);
      return;
    }

    // 방어 선택 시점에 게이지 소모
    if (player.defenseGauge > 0) {
      const oldDefenseGauge = player.defenseGauge;
      player.defenseGauge--;
      player.hasDefended = true;

      this.debug(`[방어 처리] ${player.name}의 방어게이지를 소모합니다: ${oldDefenseGauge} → ${player.defenseGauge} (방어 성공)`);
    } else {
      // 방어 게이지 부족으로 방어 실패 처리
      this.debug(`[방어 처리] ${player.name}의 방어게이지가 부족해 방어에 실패했습니다.`);
      logs.push(`${player.name}의 방어게이지가 부족해 방어에 실패했습니다.`);
    }
  }

  private async processEvade(player: Player, logs: string[]): Promise<void> {
    await this.emitEvent(GameEventType.EVADE_ACTION, { player: player.id });

    // 회피카운트 즉시 증가
    const oldEvadeCount = player.evadeCount;
    player.evadeCount++;
    this.debug(`[회피 처리] ${player.name}의 회피카운트: ${oldEvadeCount} → ${player.evadeCount} (회피 선택으로 +1)`);
    logs.push(`${player.name}의 회피카운트가 증가했습니다. (현재 회피카운트: ${player.evadeCount})`);
  }

  // 회피 카운트: 회피 +1 (선언 시 반영), 방어 +0, 그 외 -1 (극한에서는 감소하지 않음)
  private updateEvadeCounts(logs: string[]): void {
    if (this.isExtremeActive) return;

    for (const player of this.gameState.players) {
      if (player.status === PlayerStatus.DEAD || player.evadeCount === 0) continue;
      if (player.actionType === 'EVADE' || player.actionType === 'DEFEND') continue;

      player.evadeCount--;
      logs.push(`${player.name}의 회피카운트가 감소했습니다. (현재 회피카운트: ${player.evadeCount})`);
    }
  }

  // 능력 행동을 실행할 능력 ID, 대상, 추가 입력으로 해석
  private resolveAbilityRequest(
    player: Player,
    action: PlayerAction
  ): { abilityId: string; targets: number[]; parameters: Record<string, any> } | null {
    const ownAbilityId = this.abilityManager.getPlayerAbility(player.id)?.id;

    // 로그 형식 텍스트 입력 지원: "<id> -> <id>, <?>"
    if (action.abilityId?.includes('->')) {
      const parsedAction = this.parseAbilityInput(action.abilityId)[0];
      const abilityId = parsedAction?.abilityId ?? ownAbilityId;
      if (!parsedAction || !abilityId) return null;
      return {
        abilityId,
        targets: [parsedAction.targetId],
        parameters: { targetId: parsedAction.targetId, prediction: parsedAction.prediction }
      };
    }

    const abilityId = action.abilityId ?? ownAbilityId;
    if (!abilityId) return null;

    const targetId = action.untargeted ? undefined : action.targetId;
    return {
      abilityId,
      targets: targetId === undefined ? [] : [targetId, ...(action.additionalTargets ?? [])],
      parameters: {
        targetId,
        additionalTargets: action.additionalTargets,
        input: action.abilityInput,
        prediction: action.prediction
      }
    };
  }

  private async processAbility(player: Player, action: PlayerAction, logs: string[]): Promise<void> {
    const request = this.resolveAbilityRequest(player, action);
    if (!request) {
      this.debug(`[능력 처리] 능력 입력 해석 실패: ${action.abilityId}`);
      logs.push(`${player.name}의 능력 사용이 실패했습니다. (능력 또는 입력이 없습니다)`);
      return;
    }

    this.debug(`[능력 처리] ${player.name}이(가) 능력을 사용합니다: ${request.abilityId}`);

    // 능력 봉인: 이번 턴 능력을 사용할 수 없음 (양자화는 봉인 상태에서도 사용 가능)
    if (player.isAbilitySealed && request.abilityId !== 'quantumization') {
      logs.push(`${player.name}: 능력이 봉인되어 사용할 수 없습니다.`);
      return;
    }
    if (player.abilityUses <= 0) {
      logs.push(`${player.name}: 남은 능력 사용 횟수가 없습니다.`);
      return;
    }

    try {
      const result = await this.abilityManager.executeAbility(
        player.id,
        request.abilityId,
        request.targets,
        request.parameters
      );

      logs.push(`${player.name}: ${result.message}`);
      if (!result.success) {
        this.debug(`[능력 처리] ${player.name}의 능력 사용 실패: ${result.message}`);
        return;
      }

      player.abilityUses = Math.max(0, player.abilityUses - 1);
      this.debug(`[능력 처리] ${player.name}의 능력 사용 성공: ${result.message}`);
      const resultTargetId = result.target ?? player.id;

      // 데미지가 있는 경우 After Attack 이벤트 발생
      if (result.damage) {
        await this.emitAfterAttackEvent(player.id, result.target ?? 0, result.damage);
      }

      // 힐링이 있는 경우 Before/After Heal 이벤트 발생 (극한에서는 회복 불가)
      if (result.heal) {
        if (this.isExtremeActive) {
          logs.push('[극한] 체력을 회복할 수 없습니다.');
        } else {
          const beforeHealEvent = await this.emitBeforeHealEvent(resultTargetId, result.heal);
          const targetPlayer = beforeHealEvent.cancelled ? undefined : this.findPlayer(resultTargetId);
          if (targetPlayer) {
            const oldHp = targetPlayer.hp;
            const finalHealAmount = Math.min(result.heal, targetPlayer.maxHp - targetPlayer.hp);
            targetPlayer.hp = Math.min(targetPlayer.maxHp, targetPlayer.hp + result.heal);

            this.debug(`[능력 처리] ${targetPlayer.name}의 체력 회복: ${oldHp} → ${targetPlayer.hp} (회복량: ${finalHealAmount})`);
            await this.emitAfterHealEvent(targetPlayer.id, result.heal, finalHealAmount);
          }
        }
      }

      // 사망이 있는 경우 Before/After Death 이벤트 발생
      if (result.death) {
        const targetPlayer = this.findPlayer(resultTargetId);
        if (targetPlayer && result.damage && this.isEarlyProtectionTurn()) {
          // 초반 보호: 피해로는 체력이 하한 아래로 감소하지 않음
          targetPlayer.hp = Math.max(targetPlayer.hp, EARLY_PROTECTION_MIN_HP);
          targetPlayer.status = PlayerStatus.ALIVE;
          logs.push(`[초반 보호] ${targetPlayer.name}의 체력이 ${EARLY_PROTECTION_MIN_HP} 아래로 감소하지 않습니다.`);
        } else if (targetPlayer) {
          const beforeDeathEvent = await this.emitBeforeDeathEvent(resultTargetId);
          if (beforeDeathEvent.cancelled) {
            targetPlayer.hp = Math.max(1, targetPlayer.hp);
            targetPlayer.status = PlayerStatus.ALIVE;
            logs.push(`${targetPlayer.name}의 사망이 방지되었습니다!`);
          } else {
            targetPlayer.hp = 0;
            targetPlayer.status = PlayerStatus.DEAD;

            this.debug(`[능력 처리] ${targetPlayer.name}이(가) 능력으로 사망했습니다.`);
            logs.push(`${targetPlayer.name}이(가) 사망했습니다!`);
            await this.emitAfterDeathEvent(targetPlayer.id, player.id);
          }
        }
      }
    } catch (error) {
      this.debug(`[능력 처리] ${player.name}의 능력 실행 중 오류: ${error}`);
      logs.push(`${player.name}의 능력 사용 중 오류가 발생했습니다.`);
    }
  }

  // 회피 확률 (최소 0%): 5 * ((생존한 플레이어 수) - 2*(본인의 회피 카운트))%
  private calculateEvadeChance(player: Player): number {
    const chance = 5 * (this.countAlivePlayers() - player.evadeCount * 2);
    return Math.max(0, chance);
  }

  // 가하는 피해: 공격력 + 가하는 피해 증가 - 가하는 피해 감소 (최소 0)
  private calculateDamage(attacker: Player): number {
    const increase = this.statusEffectManager.getStacks(attacker.id, 'dealt_damage_increase');
    const reduction = this.statusEffectManager.getStacks(attacker.id, 'damage_reduction');
    return Math.max(0, attacker.attack + increase - reduction);
  }

  // 받는 최종 피해: 받는 피해 증가는 피해가 0이어도 공격을 받았다면 적용 (최소 0)
  private applyTakenDamageModifiers(target: Player, damage: number): number {
    const increase = this.statusEffectManager.getStacks(target.id, 'damage_increase');
    const reduction = this.statusEffectManager.getStacks(target.id, 'taken_damage_reduction');
    return Math.max(0, damage + increase - reduction);
  }

  // 데스존: 매 5턴마다 생존자의 최대 체력 1 감소
  private applyDeathZone(turnNumber: number, logs: string[]): void {
    if (turnNumber % DEATH_ZONE_INTERVAL !== 0) return;

    for (const player of this.gameState.players) {
      if (player.status === PlayerStatus.DEAD) continue;
      player.maxHp = Math.max(0, player.maxHp - 1);
      player.hp = Math.min(player.hp, player.maxHp);
    }
    logs.push(`[데스존] ${turnNumber}턴 종료: 모든 생존자의 최대 체력이 1 감소합니다.`);
  }

  // 턴 종료 후 체력이 0 이하로 남은 생존자 처리 (균열·데스존 피해 등)
  private async resolvePendingDeaths(logs: string[]): Promise<void> {
    for (const player of this.gameState.players) {
      if (player.status === PlayerStatus.DEAD || player.hp > 0) continue;

      if (this.isEarlyProtectionTurn()) {
        player.hp = EARLY_PROTECTION_MIN_HP;
        logs.push(`[초반 보호] ${player.name}의 체력이 ${EARLY_PROTECTION_MIN_HP} 아래로 감소하지 않습니다.`);
        continue;
      }

      const beforeDeathEvent = await this.emitBeforeDeathEvent(player.id);
      if (beforeDeathEvent.cancelled) {
        player.hp = Math.max(1, player.hp);
        logs.push(`${player.name}의 사망이 방지되었습니다!`);
        continue;
      }

      player.hp = 0;
      player.status = PlayerStatus.DEAD;
      logs.push(`${player.name}이(가) 사망했습니다!`);
      await this.emitAfterDeathEvent(player.id);
    }
  }

  // 초반 보호: 2턴 안에 체력이 3 이하까지 감소한 플레이어는 선택지를 얻음 (1회)
  private findEarlyProtectionCandidates(turnNumber: number, logs: string[]): number[] {
    if (turnNumber > EARLY_PROTECTION_LAST_TURN) return [];

    const candidates: number[] = [];
    for (const player of this.gameState.players) {
      const startHp = this.lastTurnHpChanges.get(player.id);
      const hasDecreased = startHp !== undefined && player.hp < startHp;
      if (player.status === PlayerStatus.DEAD || !hasDecreased || player.hp > EARLY_PROTECTION_TRIGGER_HP) continue;

      const flags = this.getFlags(player);
      if (flags.get(EARLY_PROTECTION_OFFERED_FLAG)) continue;

      flags.set(EARLY_PROTECTION_OFFERED_FLAG, true);
      candidates.push(player.id);
      logs.push(`[초반 보호] ${player.name}의 체력이 ${EARLY_PROTECTION_TRIGGER_HP} 이하로 감소해 선택지를 얻습니다.`);
    }
    return candidates;
  }

  // 초반 보호 선택지 2로 고를 수 있는 특수형 능력 목록
  public getEarlyProtectionAbilityOptions(): Array<{ id: string; name: string }> {
    return EARLY_PROTECTION_ABILITY_IDS.flatMap(id => {
      const ability = this.abilityManager.getAbility(id);
      return ability ? [{ id, name: ability.name }] : [];
    });
  }

  // 초반 보호 선택 적용 (턴 사이에 GM이 입력) - 결과 로그 메시지를 반환
  public applyEarlyProtection(playerId: number, choice: EarlyProtectionChoice): string {
    const player = this.findPlayer(playerId);
    if (!player) {
      throw new Error(`플레이어를 찾을 수 없습니다: ${playerId}`);
    }

    if (choice.type === 'heal') {
      // 1. 체력을 5까지 회복하고, 다음 턴에 한정해서 운명 교차 적용
      const nextTurn = this.gameState.currentTurn + 1;
      player.hp = Math.min(player.maxHp, Math.max(player.hp, EARLY_PROTECTION_HEAL_TO));
      this.getFlags(player).set(FATE_CROSS_TURN_FLAG, nextTurn);
      return `[초반 보호] ${player.name}: 체력을 ${EARLY_PROTECTION_HEAL_TO}까지 회복하고, ${nextTurn}턴에 한해 운명 교차를 사용할 수 있습니다.`;
    }

    // 2. 특수형 능력들 중 하나로 교체 (운명 교차, 심판자 제외)
    if (!EARLY_PROTECTION_ABILITY_IDS.includes(choice.abilityId)) {
      throw new Error(`초반 보호로 교체할 수 없는 능력입니다: ${choice.abilityId}`);
    }
    const assignedAbilityId = this.abilityManager.assignAbility(player.id, choice.abilityId);
    const ability = assignedAbilityId ? this.abilityManager.getAbility(assignedAbilityId) : undefined;
    if (!assignedAbilityId || !ability) {
      throw new Error(`능력을 찾을 수 없습니다: ${choice.abilityId}`);
    }

    player.abilityId = assignedAbilityId;
    player.ability = ability.name;
    player.abilityUses = ability.maxUses;
    player.maxAbilityUses = ability.maxUses;
    return `[초반 보호] ${player.name}: 능력을 ${ability.name}(으)로 교체했습니다.`;
  }

  // 화면 표시용으로 StatusEffectManager의 상태이상을 플레이어에 반영
  private syncPlayerStatusEffects(): void {
    for (const player of this.gameState.players) {
      player.statusEffects = this.statusEffectManager.getPlayerStatusEffects(player.id).map(effect => ({ ...effect }));
    }
  }

  private updateStatusEffects(logs: string[]): void {
    this.gameState.players.forEach(player => {
      if (player.statusEffects.length > 0) {
        logs.push(`[상태이상] ${player.name}: ${player.statusEffects.map(formatStatusEffect).join(', ')}`);
      }
    });
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
          continue;
        }
        const upperPart = part.toUpperCase();
        const keywordType = ACTION_KEYWORDS.get(upperPart);
        if (keywordType) {
          actionType = keywordType;
        } else if (part.startsWith('예측') || upperPart.startsWith('PREDICT')) {
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
  private createEvent(type: GameEventType, data: unknown): ModifiableEvent {
    return {
      type,
      timestamp: Date.now(),
      data,
      cancelled: false,
      modified: false
    };
  }

  private async emitEvent(type: GameEventType, data: unknown): Promise<ModifiableEvent> {
    const event = this.createEvent(type, data);
    await this.eventSystem.emit(event);
    return event;
  }

  private async emitTurnStartEvent(): Promise<void> {
    await this.emitEvent(GameEventType.TURN_START, {
      turn: this.gameState.currentTurn + 1,
      players: this.gameState.players
    });
  }

  private async emitTurnEndEvent(): Promise<void> {
    await this.emitEvent(GameEventType.TURN_END, {
      turn: this.gameState.currentTurn,
      players: this.gameState.players
    });
  }

  private async emitBeforeAttackEvent(attacker: number, target: number): Promise<ModifiableEvent> {
    const attackerPlayer = this.findPlayer(attacker);
    const targetPlayer = this.findPlayer(target);

    if (!attackerPlayer || !targetPlayer) {
      throw new Error(`플레이어를 찾을 수 없습니다: attacker=${attacker}, target=${target}`);
    }

    return this.emitEvent(GameEventType.BEFORE_ATTACK, {
      attacker,
      target,
      damage: this.calculateDamage(attackerPlayer),
      attackerPlayer,
      targetPlayer
    });
  }

  private async emitAfterAttackEvent(attacker: number, target: number, damage: number, isCritical: boolean = false): Promise<void> {
    await this.emitEvent(GameEventType.AFTER_ATTACK, {
      attacker,
      target,
      damage,
      isCritical,
      finalDamage: damage
    });
  }

  private async emitBeforeDeathEvent(playerId: number): Promise<ModifiableEvent> {
    const player = this.findPlayer(playerId);

    if (!player) {
      throw new Error(`플레이어를 찾을 수 없습니다: ${playerId}`);
    }

    return this.emitEvent(GameEventType.BEFORE_DEATH, {
      playerId,
      player,
      currentHp: player.hp,
      maxHp: player.maxHp
    });
  }

  private async emitAfterDeathEvent(playerId: number, killer?: number): Promise<void> {
    await this.emitEvent(GameEventType.AFTER_DEATH, {
      playerId,
      killer,
      turn: this.gameState.currentTurn
    });
  }

  private async emitBeforeHealEvent(playerId: number, healAmount: number): Promise<ModifiableEvent> {
    const player = this.findPlayer(playerId);

    if (!player) {
      throw new Error(`플레이어를 찾을 수 없습니다: ${playerId}`);
    }

    return this.emitEvent(GameEventType.BEFORE_HEAL, {
      playerId,
      player,
      healAmount,
      currentHp: player.hp,
      maxHp: player.maxHp
    });
  }

  private async emitAfterHealEvent(playerId: number, healAmount: number, finalHealAmount: number): Promise<void> {
    await this.emitEvent(GameEventType.AFTER_HEAL, {
      playerId,
      healAmount,
      finalHealAmount
    });
  }

  // 로그 포맷 메서드
  private formatActionForLog(action: PlayerAction, turn: number): string {
    return this.gameLogger.formatAction(action, turn);
  }

  // 행동 숨김
  public hidePlayerAction(playerId: number, turn: number): void {
    this.gameLogger.hidePlayerAction(playerId, turn);
  }

  // 가짜 행동 기록
  public recordFakeAction(playerId: number, turn: number, fakeAction: string): void {
    this.gameLogger.recordFakeAction(playerId, turn, fakeAction);
  }

  // 능력 사용 공개
  public revealAbilityUse(playerId: number, turn: number): void {
    this.gameLogger.revealAbilityUse(playerId, turn);
  }
}

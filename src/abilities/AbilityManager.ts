import { EventSystem } from '../utils/eventSystem';
import { GameEventType, ModifiableEvent, Ability, Player, AbilityContext } from '../types/game.types';
import { BaseAbility } from './BaseAbility';
import { Debug } from './Debug';
import { StatusEffectManager } from '../utils/StatusEffectManager';

export class AbilityManager {
  private abilities: Map<string, Ability> = new Map();
  private playerAbilities: Map<number, BaseAbility> = new Map();
  private gameState: { players: Player[] } | null = null;
  private eventSystem: EventSystem;
  private logs: string[] = [];
  private variables: Map<string, any> = new Map();
  private currentTurn: number = 0;
  private players: Map<number, Player> = new Map();
  private isHandlersSetup: boolean = false; // 중복 핸들러 등록 방지
  
  // 🆕 확장된 속성들
  private abilityChains: Map<string, string[]> = new Map(); // 능력 체인 관리
  private executionQueue: Array<{ ability: BaseAbility; priority: number; timestamp: number }> = []; // 실행 큐
  private performanceMetrics: {
    totalExecutions: number;
    averageExecutionTime: number;
    errorCount: number;
    lastExecutionTimestamp: number;
  } = {
    totalExecutions: 0,
    averageExecutionTime: 0,
    errorCount: 0,
    lastExecutionTimestamp: 0
  };
  
  // 🆕 에러 처리
  private errorThreshold: number = 10; // 에러 임계값
  private disabledAbilities: Set<string> = new Set(); // 비활성화된 능력들

  constructor(eventSystem: EventSystem) {
    this.eventSystem = eventSystem;
    
    this.registerDefaultAbilities();
    this.setupEventHandlers();
  }

  private registerDefaultAbilities(): void {
    // Debug 능력 등록 (ID 매핑 수정)
    const debug = new Debug();
    this.abilities.set('디버그로거', debug); // data.json의 "ability" 값과 매칭
  }

  private setupEventHandlers(): void {
    // 중복 핸들러 등록 방지
    if (this.isHandlersSetup) {
      return;
    }
    
    // 각 이벤트 등록
    this.eventSystem.on(GameEventType.BEFORE_ATTACK, this.handleBeforeAttack.bind(this));
    this.eventSystem.on(GameEventType.AFTER_ATTACK, this.handleAfterAttack.bind(this));
    this.eventSystem.on(GameEventType.BEFORE_DEFEND, this.handleBeforeDefend.bind(this));
    this.eventSystem.on(GameEventType.AFTER_DEFEND, this.handleAfterDefend.bind(this));
    this.eventSystem.on(GameEventType.BEFORE_EVADE, this.handleBeforeEvade.bind(this));
    this.eventSystem.on(GameEventType.AFTER_EVADE, this.handleAfterEvade.bind(this));
    this.eventSystem.on(GameEventType.BEFORE_PASS, this.handleBeforePass.bind(this));
    this.eventSystem.on(GameEventType.AFTER_PASS, this.handleAfterPass.bind(this));

    // 기존 이벤트 핸들러
    this.eventSystem.on(GameEventType.TURN_START, this.handleTurnStart.bind(this));
    this.eventSystem.on(GameEventType.TURN_END, this.handleTurnEnd.bind(this));
    this.eventSystem.on(GameEventType.GAME_START, this.handleGameStart.bind(this));
    this.eventSystem.on(GameEventType.GAME_END, this.handleGameEnd.bind(this));
    this.eventSystem.on(GameEventType.PERFECT_GUARD, this.handlePerfectGuard.bind(this));
    this.eventSystem.on(GameEventType.DEATH, this.handleDeath.bind(this));
    this.eventSystem.on(GameEventType.FOCUS_ATTACK, this.handleFocusAttack.bind(this));
    
    // 🆕 새로운 이벤트 핸들러들
    this.eventSystem.on(GameEventType.STATUS_EFFECT_APPLIED, this.handleStatusEffectApplied.bind(this));
    this.eventSystem.on(GameEventType.STATUS_EFFECT_REMOVED, this.handleStatusEffectRemoved.bind(this));
    this.eventSystem.on(GameEventType.ABILITY_CHAIN_TRIGGERED, this.handleAbilityChainTriggered.bind(this));
    
    // 핸들러 설정 완료 표시
    this.isHandlersSetup = true;
  }

  setGameState(gameState: { players: Player[] }): void {
    this.gameState = gameState;
    this.logs = [];
    this.variables = new Map();
  }

  assignAbility(playerId: number, abilityId: string): void {
    const mappedAbilityId = this.mapAbilityId(abilityId);
    const ability = this.abilities.get(mappedAbilityId);
    if (ability) {
      (ability as BaseAbility).setOwner(playerId);
      (ability as BaseAbility).setAbilityManager(this);
      
      this.playerAbilities.set(playerId, ability as BaseAbility);
      console.log(`[ABILITY] Owner 설정 완료: Player ${playerId} -> ${mappedAbilityId}`);
    }
  }

  private mapAbilityId(abilityId: string): string {
    // 능력 ID 매핑 테이블
    const idMap: { [key: string]: string } = {
      '디버그 로거': '디버그로거',
      '디버그로거': '디버그로거',
      'debug': '디버그로거'
    };
    return idMap[abilityId] || abilityId;
  }

  private findPlayer(playerId: number): Player | undefined {
    return this.gameState?.players.find(p => p.id === playerId);
  }

  private createContext(player: Player, target?: Player): AbilityContext {
    return {
      event: {} as ModifiableEvent, // 임시 이벤트 객체
      player,
      target,
      players: this.gameState?.players || [],
      eventSystem: this.eventSystem,
      variables: this.variables,
      currentTurn: this.currentTurn,
      logs: this.logs,
      ability: this.playerAbilities.get(player.id) || {} as Ability,
      // 🆕 확장된 컨텍스트
      statusEffectManager: StatusEffectManager.getInstance(),
      performanceMetrics: this.performanceMetrics,
      errorCount: this.performanceMetrics.errorCount
    };
  }

  // 🆕 우선순위 기반 실행 시스템
  private async executeWithPriority(abilities: BaseAbility[], event: ModifiableEvent): Promise<void> {
    // 우선순위별로 정렬
    const sortedAbilities = abilities
      .filter(ability => !this.disabledAbilities.has(ability.id))
      .sort((a, b) => b.priority - a.priority);
    
    for (const ability of sortedAbilities) {
      try {
        const startTime = performance.now();
        await this.safeExecuteAbility(ability, event);
        const executionTime = performance.now() - startTime;
        
        // 성능 메트릭 업데이트
        this.updatePerformanceMetrics(executionTime);
        
      } catch (error) {
        this.handleAbilityError(ability, error);
      }
    }
  }
  
  // 🆕 안전한 능력 실행
  private async safeExecuteAbility(ability: BaseAbility, event: ModifiableEvent): Promise<void> {
    if (!ability.isActive) return;
    
    const startTime = performance.now();
    
    try {
      // 이벤트 타입에 따른 핸들러 호출
      switch (event.type) {
        case GameEventType.BEFORE_ATTACK:
          await ability.onBeforeAttack(event);
          break;
        case GameEventType.AFTER_ATTACK:
          await ability.onAfterAttack(event);
          break;
        case GameEventType.BEFORE_DEFEND:
          await ability.onBeforeDefend(event);
          break;
        case GameEventType.AFTER_DEFEND:
          await ability.onAfterDefend(event);
          break;
        case GameEventType.BEFORE_EVADE:
          await ability.onBeforeEvade(event);
          break;
        case GameEventType.AFTER_EVADE:
          await ability.onAfterEvade(event);
          break;
        case GameEventType.BEFORE_PASS:
          await ability.onBeforePass(event);
          break;
        case GameEventType.AFTER_PASS:
          await ability.onAfterPass(event);
          break;
        case GameEventType.TURN_START:
          await ability.onTurnStart(event);
          break;
        case GameEventType.TURN_END:
          await ability.onTurnEnd(event);
          break;
        case GameEventType.GAME_START:
          await ability.onGameStart(event);
          break;
        case GameEventType.GAME_END:
          await ability.onGameEnd(event);
          break;
        case GameEventType.DEATH:
          await ability.onDeath(event);
          break;
        case GameEventType.PERFECT_GUARD:
          await ability.onPerfectGuard(event);
          break;
        case GameEventType.FOCUS_ATTACK:
          await ability.onFocusAttack(event);
          break;
        case GameEventType.STATUS_EFFECT_APPLIED:
          await ability.onStatusEffectApplied(event);
          break;
        case GameEventType.STATUS_EFFECT_REMOVED:
          await ability.onStatusEffectRemoved(event);
          break;
        case GameEventType.ABILITY_CHAIN_TRIGGERED:
          await ability.onAbilityChainTriggered(event);
          break;
      }
      
    } catch (error) {
      throw error;
    }
  }
  
  // 🆕 에러 처리
  private handleAbilityError(ability: BaseAbility, error: any): void {
    this.performanceMetrics.errorCount++;
    console.error(`[AbilityManager] 능력 ${ability.id} 실행 중 에러:`, error);
    
    // 에러 임계값 초과시 능력 비활성화
    if (this.performanceMetrics.errorCount > this.errorThreshold) {
      this.disabledAbilities.add(ability.id);
      console.warn(`[AbilityManager] 능력 ${ability.id} 비활성화됨 (에러 임계값 초과)`);
    }
  }
  
  // 🆕 성능 메트릭 업데이트
  private updatePerformanceMetrics(executionTime: number): void {
    this.performanceMetrics.totalExecutions++;
    this.performanceMetrics.averageExecutionTime = 
      (this.performanceMetrics.averageExecutionTime * (this.performanceMetrics.totalExecutions - 1) + executionTime) / 
      this.performanceMetrics.totalExecutions;
    this.performanceMetrics.lastExecutionTimestamp = Date.now();
  }

  // 🆕 능력 체인 관리
  public registerAbilityChain(chainId: string, abilityIds: string[]): void {
    this.abilityChains.set(chainId, abilityIds);
  }
  
  public async executeAbilityChain(chainId: string, event: ModifiableEvent): Promise<void> {
    const chain = this.abilityChains.get(chainId);
    if (!chain) return;
    
    for (const abilityId of chain) {
      const ability = this.abilities.get(abilityId) as BaseAbility;
      if (ability && !this.disabledAbilities.has(abilityId)) {
        await this.safeExecuteAbility(ability, event);
      }
    }
  }

  // 시스템 이벤트 핸들러
  private async handleTurnStart(event: ModifiableEvent): Promise<void> {
    this.currentTurn = event.data.turn;
    const abilities = Array.from(this.playerAbilities.values());
    await this.executeWithPriority(abilities, event);
  }

  private async handleTurnEnd(event: ModifiableEvent): Promise<void> {
    const turnNumber = event.data.turn;
    
    // 모든 능력의 턴 변수 정리
    for (const ability of this.playerAbilities.values()) {
      if (ability instanceof BaseAbility) {
        ability.cleanupTurnVariables(turnNumber);
      }
    }
    
    // 기존 턴 종료 로직
    const abilities = Array.from(this.playerAbilities.values());
    await this.executeWithPriority(abilities, event);
  }

  private async handleGameStart(event: ModifiableEvent): Promise<void> {
    const abilities = Array.from(this.playerAbilities.values());
    await this.executeWithPriority(abilities, event);
  }

  private async handleGameEnd(event: ModifiableEvent): Promise<void> {
    const abilities = Array.from(this.playerAbilities.values());
    await this.executeWithPriority(abilities, event);
  }

  private async handlePerfectGuard(event: ModifiableEvent): Promise<void> {
    const { player, playerName, oldDefenseGauge, newDefenseGauge, startHp, currentHp } = event.data;
    
    console.log(`[AbilityManager] 퍼펙트 가드 이벤트 처리 시작:`);
    console.log(`  - 플레이어 ID: ${player}`);
    console.log(`  - 플레이어 이름: ${playerName}`);
    console.log(`  - 방어 게이지 변화: ${oldDefenseGauge} → ${newDefenseGauge}`);
    console.log(`  - 체력 변화: ${startHp} → ${currentHp}`);
    
    const playerObj = this.findPlayer(player);
    if (playerObj) {
      console.log(`[AbilityManager] 플레이어 ${playerName}을 찾았습니다. 능력들의 onPerfectGuard를 호출합니다.`);
      
      const abilities = Array.from(this.playerAbilities.values());
      await this.executeWithPriority(abilities, event);
    } else {
      console.error(`[AbilityManager] 플레이어 ID ${player}를 찾을 수 없습니다.`);
    }
    
    console.log(`[AbilityManager] 퍼펙트 가드 이벤트 처리 완료`);
  }

  private async handleDeath(event: ModifiableEvent): Promise<void> {
    const { player, killer } = event.data;
    const playerObj = this.findPlayer(player);
    const killerObj = killer ? this.findPlayer(killer) : undefined;
    
    if (playerObj) {
      const abilities = Array.from(this.playerAbilities.values());
      await this.executeWithPriority(abilities, event);
    }
  }

  private async handleFocusAttack(event: ModifiableEvent): Promise<void> {
    const { attacker, target } = event.data;
    const attackerPlayer = this.findPlayer(attacker);
    const targetPlayer = this.findPlayer(target);
    
    if (attackerPlayer) {
      const abilities = Array.from(this.playerAbilities.values());
      await this.executeWithPriority(abilities, event);
    }
  }

  // 🆕 새로운 이벤트 핸들러들
  private async handleStatusEffectApplied(event: ModifiableEvent): Promise<void> {
    const abilities = Array.from(this.playerAbilities.values());
    await this.executeWithPriority(abilities, event);
  }
  
  private async handleStatusEffectRemoved(event: ModifiableEvent): Promise<void> {
    const abilities = Array.from(this.playerAbilities.values());
    await this.executeWithPriority(abilities, event);
  }
  
  private async handleAbilityChainTriggered(event: ModifiableEvent): Promise<void> {
    const abilities = Array.from(this.playerAbilities.values());
    await this.executeWithPriority(abilities, event);
  }

  private async handleBeforeAttack(event: ModifiableEvent): Promise<void> {
    const { attacker, target } = event.data;
    const attackerPlayer = this.findPlayer(attacker);
    const targetPlayer = this.findPlayer(target);
    
    if (attackerPlayer) {
      const abilities = Array.from(this.playerAbilities.values());
      await this.executeWithPriority(abilities, event);
    }
  }

  private async handleAfterAttack(event: ModifiableEvent): Promise<void> {
    const { attacker, target, damage, isCritical } = event.data;
    const attackerPlayer = this.findPlayer(attacker);
    const targetPlayer = this.findPlayer(target);
    
    if (attackerPlayer) {
      const abilities = Array.from(this.playerAbilities.values());
      await this.executeWithPriority(abilities, event);
    }
  }

  private async handleBeforeDefend(event: ModifiableEvent): Promise<void> {
    const { defender } = event.data;
    const defenderPlayer = this.findPlayer(defender);
    
    if (defenderPlayer) {
      const abilities = Array.from(this.playerAbilities.values());
      await this.executeWithPriority(abilities, event);
    }
  }

  private async handleAfterDefend(event: ModifiableEvent): Promise<void> {
    const { defender, damageReduced } = event.data;
    const defenderPlayer = this.findPlayer(defender);
    
    if (defenderPlayer) {
      const abilities = Array.from(this.playerAbilities.values());
      await this.executeWithPriority(abilities, event);
    }
  }

  private async handleBeforeEvade(event: ModifiableEvent): Promise<void> {
    const { evader } = event.data;
    const evaderPlayer = this.findPlayer(evader);
    
    if (evaderPlayer) {
      const abilities = Array.from(this.playerAbilities.values());
      await this.executeWithPriority(abilities, event);
    }
  }

  private async handleAfterEvade(event: ModifiableEvent): Promise<void> {
    const { evader, success } = event.data;
    const evaderPlayer = this.findPlayer(evader);
    
    if (evaderPlayer) {
      const abilities = Array.from(this.playerAbilities.values());
      await this.executeWithPriority(abilities, event);
    }
  }

  private async handleBeforePass(event: ModifiableEvent): Promise<void> {
    const { player } = event.data;
    const playerObj = this.findPlayer(player);
    
    if (playerObj) {
      const abilities = Array.from(this.playerAbilities.values());
      await this.executeWithPriority(abilities, event);
    }
  }

  private async handleAfterPass(event: ModifiableEvent): Promise<void> {
    const { player } = event.data;
    const playerObj = this.findPlayer(player);
    
    if (playerObj) {
      const abilities = Array.from(this.playerAbilities.values());
      await this.executeWithPriority(abilities, event);
    }
  }

  updateCooldowns(): void {
    for (const ability of this.playerAbilities.values()) {
      ability.updateCooldown();
    }
  }

  getPlayerAbility(playerId: number): BaseAbility | undefined {
    return this.playerAbilities.get(playerId);
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  getVariables(): Map<string, any> {
    return new Map(this.variables);
  }

  registerAbility(ability: Ability): void {
    this.abilities.set(ability.id, ability);
  }

  getAbility(id: string): Ability | undefined {
    return this.abilities.get(id);
  }

  getAllAbilities(): Ability[] {
    return Array.from(this.abilities.values());
  }

  getPlayer(playerId: number): Player | null {
    return this.players.get(playerId) || null;
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  getEventSystem(): EventSystem {
    return this.eventSystem;
  }

  getCurrentTurn(): number {
    return this.currentTurn;
  }

  setPlayer(player: Player): void {
    this.players.set(player.id, player);
  }

  getPlayerAbilities(playerId: number): BaseAbility[] {
    const ability = this.playerAbilities.get(playerId);
    return ability ? [ability] : [];
  }

  // 🆕 새로운 메서드들
  
  // 성능 통계 가져오기
  getPerformanceStats(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }
  
  // 비활성화된 능력들 가져오기
  getDisabledAbilities(): string[] {
    return Array.from(this.disabledAbilities);
  }
  
  // 능력 재활성화
  reenableAbility(abilityId: string): void {
    this.disabledAbilities.delete(abilityId);
    this.performanceMetrics.errorCount = 0; // 에러 카운트 리셋
  }
  
  // 모든 능력 재활성화
  reenableAllAbilities(): void {
    this.disabledAbilities.clear();
    this.performanceMetrics.errorCount = 0;
  }
  
  // 능력 체인 목록 가져오기
  getAbilityChains(): Map<string, string[]> {
    return new Map(this.abilityChains);
  }
  
  // 로그 추가
  addLog(message: string): void {
    this.logs.push(`[${new Date().toISOString()}] ${message}`);
  }
} 
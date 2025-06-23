import { EventSystem } from '../utils/eventSystem';
import { GameEventType, ModifiableEvent, Ability, Player, AbilityContext } from '../types/game.types';
import { BaseAbility } from './BaseAbility';
import { StatusEffectManager } from '../utils/StatusEffectManager';

// 🆕 정적 import로 변경
import { MultipleStrike } from './MultipleStrike';
import { SniperRifle } from './SniperRifle';
import { Quantumization } from './Quantumization';
import { SwiftCounter } from './SwiftCounter';
import { Alzheimer } from './Alzheimer';
import { Judge } from './Judge';
import { Synchronize } from './Synchronize';
import { GhostSummoning } from './GhostSummoning';
import { Confusion } from './Confusion';
import { WeaponBreak } from './WeaponBreak';
import { PreemptivePrediction } from './PreemptivePrediction';
import { DiscordDissonance } from './DiscordDissonance';
import { EndOfDestruction } from './EndOfDestruction';
import { GreatFailure } from './GreatFailure';
import { LiveToDie } from './LiveToDie';
import { PainfulMemory } from './PainfulMemory';
import { ShadowInDarkness } from './ShadowInDarkness';
import { WoundAnalysis } from './WoundAnalysis';
import { TargetManipulation } from './TargetManipulation';
import { SuppressedFreedom } from './SuppressedFreedom';
import { Unseeable } from './Unseeable';
import { WillLoss } from './WillLoss';
import { FallenCrown } from './FallenCrown';
import { FateCross } from './FateCross';
import { BurningEmbers } from './BurningEmbers';
import { Annihilation } from './Annihilation';
import { PlayingDead } from './PlayingDead';

export class AbilityManager {
  private static instance: AbilityManager | null = null; // 🔧 추가: singleton 인스턴스
  
  private abilities: Map<string, Ability> = new Map();
  private playerAbilities: Map<number, BaseAbility> = new Map();
  private gameState: { players: Player[] } | null = null;
  private eventSystem!: EventSystem; // 🔧 수정: definite assignment assertion
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
    // 🔧 중복 생성 방지
    if (AbilityManager.instance) {
      console.warn('AbilityManager는 이미 인스턴스가 존재합니다.');
      return AbilityManager.instance;
    }
    
    this.eventSystem = eventSystem;
    
    this.registerDefaultAbilities();
    this.setupEventHandlers();
    
    AbilityManager.instance = this;
  }

  // 🆕 정리 메서드 추가
  dispose(): void {
    console.log(`[ABILITY MANAGER] AbilityManager dispose 시작`);
    
    // 이벤트 핸들러 제거
    if (this.eventSystem) {
      this.eventSystem.removeAllHandlers();
    }
    
    // 데이터 정리
    this.playerAbilities.clear();
    this.gameState = null;
    this.disabledAbilities.clear();
    this.abilities.clear();
    this.logs = [];
    this.variables.clear();
    this.players.clear();
    this.abilityChains.clear();
    this.executionQueue = [];
    
    // 성능 메트릭 리셋
    this.performanceMetrics = {
      totalExecutions: 0,
      averageExecutionTime: 0,
      errorCount: 0,
      lastExecutionTimestamp: 0
    };
    
    // 핸들러 설정 상태 리셋
    this.isHandlersSetup = false;
    
    // singleton 인스턴스 제거
    AbilityManager.instance = null;
    
    console.log(`[ABILITY MANAGER] AbilityManager dispose 완료`);
  }

  private registerDefaultAbilities(): void {
    // 🆕 Phase 4: ABILITY.md 능력들 등록 (정적 import)
    this.abilities.set('multipleStrike', new MultipleStrike());
    this.abilities.set('sniperRifle', new SniperRifle());
    this.abilities.set('quantumization', new Quantumization());
    this.abilities.set('swiftCounter', new SwiftCounter());
    this.abilities.set('alzheimer', new Alzheimer());
    this.abilities.set('judge', new Judge());
    this.abilities.set('synchronize', new Synchronize());
    this.abilities.set('ghostSummoning', new GhostSummoning());
    this.abilities.set('confusion', new Confusion());
    this.abilities.set('weaponBreak', new WeaponBreak());
    this.abilities.set('preemptivePrediction', new PreemptivePrediction());
    this.abilities.set('discordDissonance', new DiscordDissonance());
    this.abilities.set('endOfDestruction', new EndOfDestruction());
    this.abilities.set('greatFailure', new GreatFailure());
    this.abilities.set('liveToDie', new LiveToDie());
    this.abilities.set('painfulMemory', new PainfulMemory());
    this.abilities.set('shadowInDarkness', new ShadowInDarkness());
    this.abilities.set('woundAnalysis', new WoundAnalysis());
    
    // 🆕 Phase 5: 새로 구현한 능력들
    this.abilities.set('targetManipulation', new TargetManipulation());
    this.abilities.set('suppressedFreedom', new SuppressedFreedom());
    this.abilities.set('unseeable', new Unseeable());
    this.abilities.set('willLoss', new WillLoss());
    this.abilities.set('fallenCrown', new FallenCrown());
    this.abilities.set('fateCross', new FateCross());
    this.abilities.set('burningEmbers', new BurningEmbers());
    this.abilities.set('annihilation', new Annihilation());
    this.abilities.set('playingDead', new PlayingDead());

    // 🆕 Phase 5 중급 능력들 등록
    import('./WoundAnalysis').then(module => {
      const ability = new module.WoundAnalysis();
      this.abilities.set('woundAnalysis', ability);
    });

    import('./ShadowInDarkness').then(module => {
      const ability = new module.ShadowInDarkness();
      this.abilities.set('shadowInDarkness', ability);
    });

    import('./Synchronize').then(module => {
      const ability = new module.Synchronize();
      this.abilities.set('synchronize', ability);
    });

    import('./EndOfDestruction').then(module => {
      const ability = new module.EndOfDestruction();
      this.abilities.set('endOfDestruction', ability);
    });

    import('./PainfulMemory').then(module => {
      const ability = new module.PainfulMemory();
      this.abilities.set('painfulMemory', ability);
    });

    import('./DiscordDissonance').then(module => {
      const ability = new module.DiscordDissonance();
      this.abilities.set('discordDissonance', ability);
    });

    import('./WeaponBreak').then(module => {
      const ability = new module.WeaponBreak();
      this.abilities.set('weaponBreak', ability);
    });

    import('./Confusion').then(module => {
      const ability = new module.Confusion();
      this.abilities.set('confusion', ability);
    });

    import('./PreemptivePrediction').then(module => {
      const ability = new module.PreemptivePrediction();
      this.abilities.set('preemptivePrediction', ability);
    });

    import('./WillLoss').then(module => {
      const ability = new module.WillLoss();
      this.abilities.set('willLoss', ability);
    });

    import('./Unseeable').then(module => {
      const ability = new module.Unseeable();
      this.abilities.set('unseeable', ability);
    });

    // 🆕 Phase 7 최고난이도 능력들 등록
    import('./LiveToDie').then(module => {
      const ability = new module.LiveToDie();
      this.abilities.set('liveToDie', ability);
    });

    import('./GhostSummoning').then(module => {
      const ability = new module.GhostSummoning();
      this.abilities.set('ghostSummoning', ability);
    });

    import('./FallenCrown').then(module => {
      const ability = new module.FallenCrown();
      this.abilities.set('fallenCrown', ability);
    });

    import('./FateExchange').then(module => {
      const ability = new module.FateExchange();
      this.abilities.set('fateExchange', ability);
    });

    import('./RisingAshes').then(module => {
      const ability = new module.RisingAshes();
      this.abilities.set('risingAshes', ability);
    });

    import('./Judge').then(module => {
      const ability = new module.Judge();
      this.abilities.set('judge', ability);
    });
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
      (ability as BaseAbility).setAbilityManager(this as any);
      this.playerAbilities.set(playerId, ability as BaseAbility);
      console.log(`[ABILITY] Owner 설정 완료: Player ${playerId} -> ${mappedAbilityId}`);
    }
  }

  private mapAbilityId(abilityId: string): string {
    // 능력 ID 매핑 테이블 (실제 존재하는 능력들만)
    const idMap: { [key: string]: string } = {
      'multipleStrike': 'multipleStrike',
      '다중 타격': 'multipleStrike',
      'sniperRifle': 'sniperRifle',
      'HS.50 대물 저격소총': 'sniperRifle',
      'quantumization': 'quantumization',
      '양자화': 'quantumization',
      'swiftCounter': 'swiftCounter',
      '날렵한 반격': 'swiftCounter',
      'alzheimer': 'alzheimer',
      '알츠하이머': 'alzheimer',
      'judge': 'judge',
      '심판자': 'judge',
      'synchronize': 'synchronize',
      '동기화': 'synchronize',
      'ghostSummoning': 'ghostSummoning',
      '원귀 강령': 'ghostSummoning'
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
    const data = event.data as { turn: number };
    this.currentTurn = data.turn;
    const abilities = Array.from(this.playerAbilities.values());
    await this.executeWithPriority(abilities, event);
  }

  private async handleTurnEnd(event: ModifiableEvent): Promise<void> {
    const data = event.data as { turn: number };
    const turnNumber = data.turn;
    
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
    const data = event.data as { player: number; playerName: string; oldDefenseGauge: number; newDefenseGauge: number; startHp: number; currentHp: number };
    const { player, playerName, oldDefenseGauge, newDefenseGauge, startHp, currentHp } = data;
    
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
    const data = event.data as { player: number; killer?: number };
    const { player, killer } = data;
    const playerObj = this.findPlayer(player);
    const killerObj = killer ? this.findPlayer(killer) : undefined;
    
    if (playerObj) {
      const abilities = Array.from(this.playerAbilities.values());
      await this.executeWithPriority(abilities, event);
    }
  }

  private async handleFocusAttack(event: ModifiableEvent): Promise<void> {
    const data = event.data as { attacker: number; target: number };
    const { attacker, target } = data;
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
    const data = event.data as { attacker: number; target: number };
    const { attacker, target } = data;
    const attackerPlayer = this.findPlayer(attacker);
    const targetPlayer = this.findPlayer(target);
    if (attackerPlayer) {
      const abilities = Array.from(this.playerAbilities.values());
      await this.executeWithPriority(abilities, event);
    }
  }

  private async handleAfterAttack(event: ModifiableEvent): Promise<void> {
    const data = event.data as { attacker: number; target: number; damage: number; isCritical?: boolean };
    const { attacker, target, damage, isCritical } = data;
    const attackerPlayer = this.findPlayer(attacker);
    const targetPlayer = this.findPlayer(target);
    if (attackerPlayer) {
      const abilities = Array.from(this.playerAbilities.values());
      await this.executeWithPriority(abilities, event);
    }
  }

  private async handleBeforeDefend(event: ModifiableEvent): Promise<void> {
    const data = event.data as { defender: number };
    const { defender } = data;
    const defenderPlayer = this.findPlayer(defender);
    if (defenderPlayer) {
      const abilities = Array.from(this.playerAbilities.values());
      await this.executeWithPriority(abilities, event);
    }
  }

  private async handleAfterDefend(event: ModifiableEvent): Promise<void> {
    const data = event.data as { defender: number; damageReduced: number };
    const { defender, damageReduced } = data;
    const defenderPlayer = this.findPlayer(defender);
    if (defenderPlayer) {
      const abilities = Array.from(this.playerAbilities.values());
      await this.executeWithPriority(abilities, event);
    }
  }

  private async handleBeforeEvade(event: ModifiableEvent): Promise<void> {
    const data = event.data as { evader: number };
    const { evader } = data;
    const evaderPlayer = this.findPlayer(evader);
    if (evaderPlayer) {
      const abilities = Array.from(this.playerAbilities.values());
      await this.executeWithPriority(abilities, event);
    }
  }

  private async handleAfterEvade(event: ModifiableEvent): Promise<void> {
    const data = event.data as { evader: number; success: boolean };
    const { evader, success } = data;
    const evaderPlayer = this.findPlayer(evader);
    if (evaderPlayer) {
      const abilities = Array.from(this.playerAbilities.values());
      await this.executeWithPriority(abilities, event);
    }
  }

  private async handleBeforePass(event: ModifiableEvent): Promise<void> {
    const data = event.data as { player: number };
    const { player } = data;
    const playerObj = this.findPlayer(player);
    if (playerObj) {
      const abilities = Array.from(this.playerAbilities.values());
      await this.executeWithPriority(abilities, event);
    }
  }

  private async handleAfterPass(event: ModifiableEvent): Promise<void> {
    const data = event.data as { player: number };
    const { player } = data;
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
    this.logs.push(message);
  }

  // 🆕 Phase 2: 능력 실행 메서드
  public async executeAbility(
    playerId: number, 
    abilityName: string, 
    targets: number[] = [], 
    parameters: Record<string, any> = {}
  ): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    try {
      const player = this.findPlayer(playerId);
      if (!player) {
        return { success: false, message: '플레이어를 찾을 수 없습니다.' };
      }

      const ability = this.playerAbilities.get(playerId);
      if (!ability) {
        return { success: false, message: '플레이어에게 할당된 능력이 없습니다.' };
      }

      // 능력 실행을 위한 컨텍스트 생성
      const targetPlayer = targets.length > 0 ? this.findPlayer(targets[0]) : undefined;
      const context = this.createContext(player, targetPlayer);
      
      // 능력 실행
      const result = await ability.execute(context, parameters);
      
      return {
        success: true,
        message: result.message || `${abilityName} 능력을 사용했습니다.`,
        damage: result.damage,
        heal: result.heal,
        death: result.death,
        target: targets[0]
      };
      
    } catch (error) {
      console.error(`[ABILITY] 능력 실행 오류: ${error}`);
      return { success: false, message: '능력 실행 중 오류가 발생했습니다.' };
    }
  }
} 
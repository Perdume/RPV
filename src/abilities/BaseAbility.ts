import { Player, PlayerStatus, Ability, ModifiableEvent, AbilityContext, StatusEffect, StatusEffectId } from '../types/game.types';
import { AbilityManager } from './AbilityManager';
import { DataManager } from '../utils/DataManager';
import { StatusEffectManager } from '../utils/StatusEffectManager';
import { VariableSchema, schemas } from '../types/game.types';

// 변수 타입 정의
interface AbilityVariable<T = any> {
  value: T;
  type: 'permanent' | 'session' | 'turn';
  lastUpdated: number;
  schema?: VariableSchema<T>;
}

// 🆕 능력 체인 정보
interface AbilityChain {
  id: string;
  priority: number;
  condition?: () => boolean;
  nextAbility?: string;
}

// 🆕 조건부 실행 정보
interface ConditionalExecution {
  condition: () => boolean;
  priority: number;
  fallback?: () => void;
}

export abstract class BaseAbility implements Ability {
  id: string;
  name: string;
  description: string;
  isActive: boolean = true;
  cooldown: number = 0;
  maxCooldown: number;
  maxUses: number;
  protected ownerId: number | null = null;
  protected abilityManager: AbilityManager | null = null;
  
  // 🆕 확장된 속성들
  priority: number = 0; // 기본 우선순위
  executionTime: number = 0; // 실행 시간 추적
  errorCount: number = 0; // 에러 발생 횟수
  lastExecutionTime: number = 0; // 마지막 실행 시간
  
  // 통합된 변수 저장소
  private variables: Map<string, AbilityVariable> = new Map();
  
  // 🆕 상태이상 관리
  private statusEffects: Map<string, StatusEffect> = new Map();
  
  // 🆕 능력 체인 관리
  private abilityChains: Map<string, AbilityChain> = new Map();
  
  // 🆕 조건부 실행 관리
  private conditionalExecutions: Map<string, ConditionalExecution> = new Map();
  
  // 🆕 성능 모니터링
  private performanceMetrics: {
    totalExecutions: number;
    totalExecutionTime: number;
    averageExecutionTime: number;
    lastExecutionTimestamp: number;
    errorCount: number;
  } = {
    totalExecutions: 0,
    totalExecutionTime: 0,
    averageExecutionTime: 0,
    lastExecutionTimestamp: 0,
    errorCount: 0
  };

  constructor(id: string, name: string, description: string, maxCooldown: number = 0, maxUses: number) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.maxCooldown = maxCooldown;
    this.maxUses = maxUses;
  }

  // 능력 주인 설정
  setOwner(playerId: number): void {
    this.ownerId = playerId;
    console.log(`[${this.id}] Owner 설정: Player ${playerId}`);
    this.loadFromFile();
  }

  getOwner(): number | null {
    return this.ownerId;
  }

  getOwnerPlayer(): Player | null {
    if (!this.ownerId || !this.abilityManager) return null;
    return this.abilityManager.getPlayer(this.ownerId);
  }

  setAbilityManager(manager: AbilityManager): void {
    this.abilityManager = manager;
  }

  // === 통합된 변수 관리 시스템 ===

  // 영구 변수 (파일에 저장, 게임 재시작해도 유지)
  protected async setPermanent<T>(key: string, value: T, schema?: VariableSchema<T>): Promise<void> {
    if (schema && !schema.validate(value)) {
      console.error(`[${this.id}] 타입 검증 실패: ${key}`);
      return;
    }

    const variable: AbilityVariable<T> = {
      value,
      type: 'permanent',
      lastUpdated: Date.now(),
      schema
    };
    
    this.variables.set(`perm_${key}`, variable);
    await this.saveToFile();
    console.log(`[${this.id}] 영구 변수 저장: ${key} = ${JSON.stringify(value)}`);
  }

  protected getPermanent<T>(key: string, schema?: VariableSchema<T>): T {
    const variable = this.variables.get(`perm_${key}`) as AbilityVariable<T> | undefined;
    
    if (!variable) {
      return schema?.defaultValue as T;
    }
    
    if (schema && !schema.validate(variable.value)) {
      console.error(`[${this.id}] 타입 검증 실패: ${key}`);
      return schema.defaultValue as T;
    }
    
    return variable.value;
  }

  // 세션 변수 (메모리에만 저장, 롤백 대상)
  protected setSession<T>(key: string, value: T, schema?: VariableSchema<T>): void {
    if (schema && !schema.validate(value)) {
      console.error(`[${this.id}] 타입 검증 실패: ${key}`);
      return;
    }

    const variable: AbilityVariable<T> = {
      value,
      type: 'session',
      lastUpdated: Date.now(),
      schema
    };
    
    this.variables.set(`sess_${key}`, variable);
  }

  protected getSession<T>(key: string, schema?: VariableSchema<T>): T {
    const variable = this.variables.get(`sess_${key}`) as AbilityVariable<T> | undefined;
    
    if (!variable) {
      return schema?.defaultValue as T;
    }
    
    if (schema && !schema.validate(variable.value)) {
      console.error(`[${this.id}] 타입 검증 실패: ${key}`);
      return schema.defaultValue as T;
    }
    
    return variable.value;
  }

  // 턴 변수 (현재 턴에서만 유효)
  protected setTurn<T>(key: string, value: T, currentTurn: number, schema?: VariableSchema<T>): void {
    if (schema && !schema.validate(value)) {
      console.error(`[${this.id}] 타입 검증 실패: ${key}`);
      return;
    }

    const variable: AbilityVariable<T> = {
      value,
      type: 'turn',
      lastUpdated: Date.now(),
      schema
    };
    
    this.variables.set(`turn_${currentTurn}_${key}`, variable);
    console.log(`[${this.id}] 턴 변수 저장: ${key} = ${JSON.stringify(value)} (턴 ${currentTurn})`);
  }

  protected getTurn<T>(key: string, currentTurn: number, schema?: VariableSchema<T>): T {
    const variable = this.variables.get(`turn_${currentTurn}_${key}`) as AbilityVariable<T> | undefined;
    
    if (!variable) {
      return schema?.defaultValue as T;
    }
    
    if (schema && !schema.validate(variable.value)) {
      console.error(`[${this.id}] 타입 검증 실패: ${key}`);
      return schema.defaultValue as T;
    }
    
    return variable.value;
  }

  // 턴 종료시 해당 턴의 변수들 정리
  public cleanupTurnVariables(turnNumber: number): void {
    const keysToDelete: string[] = [];
    
    this.variables.forEach((variable, key) => {
      if (key.startsWith(`turn_${turnNumber}_`)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      this.variables.delete(key);
    });
    
    if (keysToDelete.length > 0) {
      console.log(`[${this.id}] 턴 ${turnNumber} 변수 ${keysToDelete.length}개 정리 완료`);
    }
  }

  // === 🆕 상태이상 관리 시스템 ===
  
  // 상태이상 적용
  protected applyStatusEffect(targetId: number, effectId: StatusEffectId, duration: number = 1, stacks: number = 1): boolean {
    if (!this.abilityManager) {
      console.error(`[${this.id}] AbilityManager not set`);
      return false;
    }

    const statusEffectManager = StatusEffectManager.getInstanceWithEventSystem(this.abilityManager.getEventSystem());
    
    const effect: StatusEffect = {
      id: effectId,
      name: effectId,
      description: `Applied by ${this.name}`,
      duration,
      stackable: true,
      type: 'debuff',
      stacks
    };

    try {
      statusEffectManager.applyStatusEffect(targetId, effect.id as StatusEffectId, effect.duration, effect.stacks);
      return true;
    } catch (error) {
      console.error(`[${this.id}] 상태이상 적용 실패:`, error);
      return false;
    }
  }
  
  // 상태이상 제거
  protected removeStatusEffect(targetId: number, effectId: string): boolean {
    try {
      const statusManager = StatusEffectManager.getInstance();
      statusManager.removeStatusEffect(targetId, effectId);
      this.statusEffects.delete(effectId);
      return true;
    } catch (error) {
      console.error(`[${this.id}] 상태이상 제거 실패:`, error);
      return false;
    }
  }
  
  // 상태이상 체크
  protected hasStatusEffect(targetId: number, effectId: string): boolean {
    const statusManager = StatusEffectManager.getInstance();
    return statusManager.hasStatusEffect(targetId, effectId);
  }
  
  // 상태이상 정보 가져오기
  protected getStatusEffect(targetId: number, effectId: string): StatusEffect | null {
    const statusManager = StatusEffectManager.getInstance();
    const effect = statusManager.getStatusEffect(targetId, effectId);
    return effect || null;
  }

  // === 🆕 능력 체인 시스템 ===
  
  // 능력 체인 등록
  protected registerAbilityChain(chainId: string, priority: number, condition?: () => boolean, nextAbility?: string): void {
    this.abilityChains.set(chainId, {
      id: chainId,
      priority,
      condition,
      nextAbility
    });
  }
  
  // 🆕 능력 체인 실행
  protected async executeAbilityChain(chainId: string, context: AbilityContext): Promise<void> {
    const chain = this.abilityChains.get(chainId);
    if (!chain) return;
    
    if (chain.condition && !chain.condition()) return;
    
    // 다음 능력 실행
    if (chain.nextAbility && this.abilityManager) {
      const nextAbility = this.abilityManager.getAbility(chain.nextAbility);
      if (nextAbility && 'onBeforeAttack' in nextAbility) {
        // BaseAbility의 메서드 호출
        const baseAbility = nextAbility as BaseAbility;
        await baseAbility.onBeforeAttack(context.event);
      }
    }
  }

  // === 🆕 조건부 실행 시스템 ===
  
  // 조건부 실행 등록
  protected registerConditionalExecution(executionId: string, condition: () => boolean, priority: number, fallback?: () => void): void {
    this.conditionalExecutions.set(executionId, {
      condition,
      priority,
      fallback
    });
  }
  
  // 조건부 실행 체크
  protected checkConditionalExecution(executionId: string): boolean {
    const execution = this.conditionalExecutions.get(executionId);
    if (!execution) return false;
    
    return execution.condition();
  }

  // === 🆕 성능 모니터링 ===
  
  // 실행 시간 측정 시작
  protected startPerformanceMeasurement(): void {
    this.lastExecutionTime = performance.now();
  }
  
  // 실행 시간 측정 종료
  protected endPerformanceMeasurement(): void {
    const executionTime = performance.now() - this.lastExecutionTime;
    this.performanceMetrics.totalExecutions++;
    this.performanceMetrics.totalExecutionTime += executionTime;
    this.performanceMetrics.averageExecutionTime = 
      this.performanceMetrics.totalExecutionTime / this.performanceMetrics.totalExecutions;
    this.performanceMetrics.lastExecutionTimestamp = Date.now();
  }
  
  // 성능 통계 가져오기
  public getPerformanceStats(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  // === 🆕 에러 처리 및 복구 ===
  
  // 안전한 실행 래퍼
  protected async safeExecute<T>(operation: () => Promise<T>, fallback?: T): Promise<T> {
    try {
      this.startPerformanceMeasurement();
      const result = await operation();
      this.endPerformanceMeasurement();
      return result;
    } catch (error) {
      this.errorCount++;
      console.error(`[${this.id}] 실행 중 에러 발생:`, error);
      if (fallback !== undefined) {
        return fallback;
      }
      throw error;
    }
  }
  
  // 에러 상태 리셋
  public resetErrorState(): void {
    this.errorCount = 0;
  }

  // === 파일 저장/로드 ===
  
  async loadFromFile(): Promise<void> {
    if (!this.ownerId) return;
    
    try {
      const data = await DataManager.loadAbilityData(this.ownerId, this.id);
      
      // 영구 변수만 로드
      if (data.variables) {
        Object.entries(data.variables).forEach(([key, value]) => {
          this.variables.set(`perm_${key}`, {
            value,
            type: 'permanent',
            lastUpdated: Date.now()
          });
        });
      }
      
      // 🆕 성능 메트릭 로드
      if (data.performanceMetrics) {
        this.performanceMetrics = { ...data.performanceMetrics };
      }
      
      // 🆕 에러 카운트 로드
      if (data.errorCount !== undefined) {
        this.errorCount = data.errorCount;
      }
      
    } catch (error) {
      console.log(`[${this.id}] 새로운 능력 - 빈 데이터로 시작`);
      this.variables.clear();
    }
  }

  async saveToFile(): Promise<void> {
    if (!this.ownerId) return;
    
    // 영구 변수만 저장
    const permanentVariables: Record<string, any> = {};
    this.variables.forEach((variable, key) => {
      if (variable.type === 'permanent') {
        const cleanKey = key.replace('perm_', '');
        permanentVariables[cleanKey] = variable.value;
      }
    });
    
    const data = {
      variables: permanentVariables,
      // 🆕 성능 메트릭 저장
      performanceMetrics: this.performanceMetrics,
      // 🆕 에러 카운트 저장
      errorCount: this.errorCount
    };
    
    await DataManager.saveAbilityData(this.ownerId, this.id, data);
  }
  
  public debugVariables(): void {
    console.log(`[${this.id}] === 변수 디버그 ===`);
    console.log(`[${this.id}] 총 변수 수: ${this.variables.size}`);
    
    this.variables.forEach((variable, key) => {
      console.log(`[${this.id}] ${key}: ${JSON.stringify(variable.value)} (${variable.type})`);
    });
    
    // 🆕 성능 통계 출력
    console.log(`[${this.id}] 성능 통계:`, this.performanceMetrics);
    console.log(`[${this.id}] 에러 횟수: ${this.errorCount}`);
    console.log(`[${this.id}] === 디버그 완료 ===`);
  }

  // === 기본 이벤트 핸들러들 ===
  async onBeforeAttack(event: ModifiableEvent): Promise<void> {}
  async onAfterAttack(event: ModifiableEvent): Promise<void> {}
  async onBeforeDefend(event: ModifiableEvent): Promise<void> {}
  async onAfterDefend(event: ModifiableEvent): Promise<void> {}
  async onBeforeEvade(event: ModifiableEvent): Promise<void> {}
  async onAfterEvade(event: ModifiableEvent): Promise<void> {}
  async onBeforePass(event: ModifiableEvent): Promise<void> {}
  async onAfterPass(event: ModifiableEvent): Promise<void> {}
  async onTurnStart(event: ModifiableEvent): Promise<void> {}
  async onTurnEnd(event: ModifiableEvent): Promise<void> {}
  async onGameStart(event: ModifiableEvent): Promise<void> {}
  async onGameEnd(event: ModifiableEvent): Promise<void> {}
  async onDeath(event: ModifiableEvent): Promise<void> {}
  async onPerfectGuard(event: ModifiableEvent): Promise<void> {}
  async onFocusAttack(event: ModifiableEvent): Promise<void> {}

  // 🆕 새로운 이벤트 핸들러들
  async onStatusEffectApplied(event: ModifiableEvent): Promise<void> {}
  async onStatusEffectRemoved(event: ModifiableEvent): Promise<void> {}
  async onAbilityChainTriggered(event: ModifiableEvent): Promise<void> {}
  async onConditionalExecutionFailed(event: ModifiableEvent): Promise<void> {}

  protected createContext(event: ModifiableEvent): AbilityContext {
    if (!this.abilityManager) {
      throw new Error('AbilityManager not set');
    }
    return {
      event,
      player: this.getOwnerPlayer()!,
      players: this.abilityManager.getAllPlayers(),
      eventSystem: this.abilityManager.getEventSystem(),
      variables: this.abilityManager.getVariables(),
      currentTurn: this.abilityManager.getCurrentTurn(),
      logs: this.abilityManager.getLogs(),
      ability: this,
      statusEffectManager: this.abilityManager ? 
        StatusEffectManager.getInstanceWithEventSystem(this.abilityManager.getEventSystem()) : 
        StatusEffectManager.getInstance(),
      performanceMetrics: this.performanceMetrics,
      errorCount: this.errorCount
    };
  }

  resetCooldown(): void {
    this.cooldown = this.maxCooldown;
  }

  isOnCooldown(): boolean {
    return this.cooldown > 0;
  }

  getRemainingCooldown(): number {
    return this.cooldown;
  }

  updateCooldown(): void {
    if (this.cooldown > 0) {
      this.cooldown--;
    }
  }

  protected addLog(context: AbilityContext, message: string): void {
    context.logs.push(message);
  }

  protected getRandomPlayer(context: AbilityContext, excludeIds: number[] = []): Player | null {
    const availablePlayers = context.players.filter(p => 
      p.status === PlayerStatus.ALIVE && 
      !excludeIds.includes(p.id) &&
      !p.hasDefended &&
      p.evadeCount === 0
    );
    
    if (availablePlayers.length === 0) return null;
    return availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
  }

  // 🆕 유틸리티 메서드들
  
  // 확률 계산
  protected rollChance(percentage: number): boolean {
    return Math.random() * 100 < percentage;
  }
  
  // 범위 내 랜덤 값
  protected randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  // 플레이어 거리 계산
  protected calculateDistance(player1: Player, player2: Player): number {
    return Math.abs(player1.id - player2.id);
  }
  
  // 🆕 능력 사용 가능 여부 체크 (하위 클래스에서 오버라이드 가능)
  protected canUseAbility(context: AbilityContext): boolean {
    return this.isActive && !this.isOnCooldown();
  }

  // 🆕 Phase 2: 능력 실행 메서드
  public async execute(
    context: AbilityContext, 
    parameters: Record<string, any> = {}
  ): Promise<{ success: boolean; message: string; damage?: number; heal?: number; death?: boolean; target?: number }> {
    try {
      // 기본 실행 가능 여부 체크
      if (!this.canUseAbility(context)) {
        return {
          success: false,
          message: '능력을 사용할 수 없습니다.',
          damage: 0,
          heal: 0,
          death: false
        };
      }

      // 하위 클래스에서 반드시 구현해야 하는 부분
      // 기본 구현은 성공만 반환
      return {
        success: true,
        message: `${this.name} 능력을 사용했습니다.`,
        damage: 0,
        heal: 0,
        death: false
      };
    } catch (error) {
      console.error(`[${this.id}] 능력 실행 오류: ${error}`);
      return {
        success: false,
        message: '능력 실행 중 오류가 발생했습니다.',
        damage: 0,
        heal: 0,
        death: false
      };
    }
  }
}
import { Player, PlayerStatus, Ability, ModifiableEvent, AbilityContext } from '../types/game.types';
import { AbilityManager } from './AbilityManager';
import { DataManager } from '../utils/DataManager';
import { VariableSchema, schemas } from '../types/game.types';

// 변수 타입 정의
interface AbilityVariable<T = any> {
  value: T;
  type: 'permanent' | 'session' | 'turn';
  lastUpdated: number;
  schema?: VariableSchema<T>;
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
  
  // 통합된 변수 저장소
  private variables: Map<string, AbilityVariable> = new Map();

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
      
      console.log(`[${this.id}] 영구 변수 로드 완료: ${Object.keys(data.variables || {}).length}개`);
    } catch (error) {
      console.log(`[${this.id}] 새로운 능력 - 빈 데이터로 시작`);
      this.variables.clear();
    }
  }

  async saveToFile(): Promise<void> {
    if (!this.ownerId) return;
    
    // 영구 변수만 파일에 저장
    const permanentVars: Record<string, any> = {};
    
    this.variables.forEach((variable, key) => {
      if (key.startsWith('perm_')) {
        const cleanKey = key.replace('perm_', '');
        permanentVars[cleanKey] = variable.value;
      }
    });
    
    await DataManager.saveAbilityData(this.ownerId, this.id, {
      playerId: this.ownerId,
      abilityId: this.id,
      variables: permanentVars,
      lastUpdated: new Date().toISOString()
    });
  }

  // === 변수 디버깅 도구 ===
  
  public debugVariables(): void {
    console.group(`[${this.id}] 변수 상태`);
    
    const categories = {
      '영구 변수': Array.from(this.variables.entries()).filter(([key]) => key.startsWith('perm_')),
      '세션 변수': Array.from(this.variables.entries()).filter(([key]) => key.startsWith('sess_')),
      '턴 변수': Array.from(this.variables.entries()).filter(([key]) => key.startsWith('turn_'))
    };
    
    Object.entries(categories).forEach(([category, vars]) => {
      if (vars.length > 0) {
        console.log(`\n${category}:`);
        vars.forEach(([key, variable]) => {
          const cleanKey = key.replace(/^(perm_|sess_|turn_\d+_)/, '');
          console.log(`  ${cleanKey}: ${JSON.stringify(variable.value)}`);
        });
      }
    });
    
    console.groupEnd();
  }

  // === 기존 메서드들 ===
  
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
      ability: this
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
}
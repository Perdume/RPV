import { Player, PlayerStatus, Ability, ModifiableEvent, AbilityContext } from '../types/game.types';
import { AbilityManager } from './AbilityManager';
import { DataManager } from '../utils/DataManager';

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
  private data: Map<string, any> = new Map();

  constructor(id: string, name: string, description: string, maxCooldown: number = 0, maxUses: number) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.maxCooldown = maxCooldown;
    this.maxUses = maxUses;
  }

  // 능력 주인 ID 설정
  setOwner(playerId: number): void {
    this.ownerId = playerId;
    console.log(`[BASE_ABILITY] setOwner 호출: ${playerId} -> ${this.id}`);
    this.loadFromFile(); // 주인 설정시 자동 로드
  }

  // 능력 주인 ID 가져오기
  getOwner(): number | null {
    console.log(`[BASE_ABILITY] getOwner 호출: ${this.ownerId} (${this.id})`);
    return this.ownerId;
  }

  // 능력 주인 플레이어 객체 가져오기
  getOwnerPlayer(): Player | null {
    if (!this.ownerId || !this.abilityManager) return null;
    return this.abilityManager.getPlayer(this.ownerId);
  }

  // AbilityManager 설정
  setAbilityManager(manager: AbilityManager): void {
    this.abilityManager = manager;
  }

  // 변수 설정 (자동 저장)
  protected async setVar(key: string, value: any): Promise<void> {
    this.data.set(key, value);
    await this.saveToFile();
  }

  // 변수 가져오기
  protected getVar(key: string, defaultValue?: any): any {
    return this.data.get(key) ?? defaultValue;
  }

  // 페이지 로드시 능력 변수 로드
  async loadFromFile(): Promise<void> {
    if (!this.ownerId) return;
    
    try {
      const data = await DataManager.loadAbilityData(this.ownerId, this.id);
      this.data = new Map(Object.entries(data.variables || {}));
      console.log(`[${this.id}] 변수 로드 완료:`, Object.keys(data.variables || {}));
    } catch (error) {
      console.log(`[${this.id}] 새로운 능력 - 빈 데이터로 시작`);
      this.data = new Map();
    }
  }

  // 능력 변수 저장
  async saveToFile(): Promise<void> {
    if (!this.ownerId) return;
    
    const saveData = {
      playerId: this.ownerId,
      abilityId: this.id,
      variables: Object.fromEntries(this.data),
      lastUpdated: new Date().toISOString()
    };
    
    await DataManager.saveAbilityData(this.ownerId, this.id, saveData);
  }

  // 이벤트 핸들러들
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

  // 컨텍스트 생성
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

  // 쿨다운 관리
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

  // 로그 헬퍼 메서드
  protected addLog(context: AbilityContext, message: string): void {
    context.logs.push(message);
  }

  // 랜덤 플레이어 선택 헬퍼 메서드
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

  // 영구 변수 (src/data/abilities/)
  protected async savePersistent(context: AbilityContext, key: string, value: any): Promise<void> {
    await DataManager.saveAbilityData(context.player.id, this.id, {
      playerId: context.player.id,
      abilityId: this.id,
      variables: { [key]: value },
      lastUpdated: new Date().toISOString()
    });
  }

  protected async loadPersistent(context: AbilityContext, key: string, defaultValue?: any): Promise<any> {
    const data = await DataManager.loadAbilityData(context.player.id, this.id);
    return data.variables[key] ?? defaultValue;
  }

  // 세션 변수 (메모리, 롤백 대상)
  protected setSessionVar(context: AbilityContext, key: string, value: any): void {
    const varKey = `${context.player.id}_${this.id}_${key}`;
    context.variables.set(varKey, value);
  }

  protected getSessionVar(context: AbilityContext, key: string, defaultValue?: any): any {
    const varKey = `${context.player.id}_${this.id}_${key}`;
    return context.variables.get(varKey) ?? defaultValue;
  }

  // 턴 변수 (턴 종료시 자동 삭제)
  protected setTurnVar(context: AbilityContext, key: string, value: any): void {
    const varKey = `turn_${context.currentTurn}_${context.player.id}_${this.id}_${key}`;
    context.variables.set(varKey, value);
  }

  protected getTurnVar(context: AbilityContext, key: string, defaultValue?: any): any {
    const varKey = `turn_${context.currentTurn}_${context.player.id}_${this.id}_${key}`;
    return context.variables.get(varKey) ?? defaultValue;
  }
} 
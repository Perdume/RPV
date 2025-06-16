import { Player, PlayerStatus, Ability, ModifiableEvent, AbilityContext } from '../types/game.types';
import { AbilityManager } from './AbilityManager';

export abstract class BaseAbility implements Ability {
  id: string;
  name: string;
  description: string;
  isActive: boolean = true;
  cooldown: number = 0;
  maxCooldown: number;
  maxUses: number;
  ownerId: number | null = null;
  abilityManager: AbilityManager | null = null;

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
  }

  // 능력 주인 ID 가져오기
  getOwner(): number | null {
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

  // Pre/Post 이벤트 핸들러
  async onBeforeAttack(event: ModifiableEvent): Promise<void> {}
  async onAfterAttack(event: ModifiableEvent): Promise<void> {}
  async onBeforeDefend(event: ModifiableEvent): Promise<void> {}
  async onAfterDefend(event: ModifiableEvent): Promise<void> {}
  async onBeforeEvade(event: ModifiableEvent): Promise<void> {}
  async onAfterEvade(event: ModifiableEvent): Promise<void> {}
  async onBeforePass(event: ModifiableEvent): Promise<void> {}
  async onAfterPass(event: ModifiableEvent): Promise<void> {}

  // 시스템 이벤트 핸들러
  async onTurnStart(event: ModifiableEvent): Promise<void> {}
  async onTurnEnd(event: ModifiableEvent): Promise<void> {}
  async onGameStart(event: ModifiableEvent): Promise<void> {}
  async onGameEnd(event: ModifiableEvent): Promise<void> {}
  async onDeath(event: ModifiableEvent): Promise<void> {}
  async onPerfectGuard(event: ModifiableEvent): Promise<void> {}
  async onFocusAttack(event: ModifiableEvent): Promise<void> {}

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

  // 변수 관리 헬퍼 메서드
  protected getVar(context: AbilityContext, key: string): any {
    return context.variables.get(`${context.player.id}_${key}`);
  }

  protected setVar(context: AbilityContext, key: string, value: any): void {
    context.variables.set(`${context.player.id}_${key}`, value);
  }

  protected deleteVar(context: AbilityContext, key: string): void {
    context.variables.delete(`${context.player.id}_${key}`);
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
} 
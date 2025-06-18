import { EventSystem } from '../utils/eventSystem';
import { GameEventType, ModifiableEvent, Ability, Player, AbilityContext } from '../types/game.types';
import { BaseAbility } from './BaseAbility';
import { Debug } from './Debug';

export class AbilityManager {
  private abilities: Map<string, Ability> = new Map();
  private playerAbilities: Map<number, BaseAbility> = new Map();
  private gameState: { players: Player[] } | null = null;
  private eventSystem: EventSystem;
  private logs: string[] = [];
  private variables: Map<string, any> = new Map();
  private currentTurn: number = 0;
  private players: Map<number, Player> = new Map();

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
    // Pre/Post 이벤트 핸들러
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
      ability: this.playerAbilities.get(player.id) || {} as Ability
    };
  }

  // 시스템 이벤트 핸들러
  private async handleTurnStart(event: ModifiableEvent): Promise<void> {
    this.currentTurn = event.data.turn;
    for (const ability of this.abilities.values()) {
      if (ability.isActive) {
        await ability.onTurnStart?.(event);
      }
    }
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
    for (const ability of this.abilities.values()) {
      if (ability.isActive) {
        await ability.onTurnEnd?.(event);
      }
    }
  }

  private async handleGameStart(event: ModifiableEvent): Promise<void> {
    for (const ability of this.abilities.values()) {
      if (ability.isActive) {
        await ability.onGameStart?.(event);
      }
    }
  }

  private async handleGameEnd(event: ModifiableEvent): Promise<void> {
    for (const ability of this.abilities.values()) {
      if (ability.isActive) {
        await ability.onGameEnd?.(event);
      }
    }
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
      
      for (const ability of this.abilities.values()) {
        if (ability.isActive) {
          console.log(`[AbilityManager] 능력 ${ability.id}의 onPerfectGuard 호출`);
          try {
            await ability.onPerfectGuard?.(event);
            console.log(`[AbilityManager] 능력 ${ability.id}의 onPerfectGuard 완료`);
          } catch (error) {
            console.error(`[AbilityManager] 능력 ${ability.id}의 onPerfectGuard에서 오류 발생:`, error);
          }
        } else {
          console.log(`[AbilityManager] 능력 ${ability.id}는 비활성화 상태입니다.`);
        }
      }
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
      for (const ability of this.abilities.values()) {
        if (ability.isActive) {
          await ability.onDeath?.(event);
        }
      }
    }
  }

  private async handleFocusAttack(event: ModifiableEvent): Promise<void> {
    const { attacker, target } = event.data;
    const attackerPlayer = this.findPlayer(attacker);
    const targetPlayer = this.findPlayer(target);
    
    if (attackerPlayer && targetPlayer) {
      for (const ability of this.abilities.values()) {
        if (ability.isActive) {
          await ability.onFocusAttack?.(event);
        }
      }
    }
  }

  private async handleBeforeAttack(event: ModifiableEvent): Promise<void> {
    for (const ability of this.abilities.values()) {
      if (ability.isActive) {
        await ability.onBeforeAttack?.(event);
      }
    }
  }

  private async handleAfterAttack(event: ModifiableEvent): Promise<void> {
    for (const ability of this.abilities.values()) {
      if (ability.isActive) {
        await ability.onAfterAttack?.(event);
      }
    }
  }

  private async handleBeforeDefend(event: ModifiableEvent): Promise<void> {
    for (const ability of this.abilities.values()) {
      if (ability.isActive) {
        await ability.onBeforeDefend?.(event);
      }
    }
  }

  private async handleAfterDefend(event: ModifiableEvent): Promise<void> {
    for (const ability of this.abilities.values()) {
      if (ability.isActive) {
        await ability.onAfterDefend?.(event);
      }
    }
  }

  private async handleBeforeEvade(event: ModifiableEvent): Promise<void> {
    for (const ability of this.abilities.values()) {
      if (ability.isActive) {
        await ability.onBeforeEvade?.(event);
      }
    }
  }

  private async handleAfterEvade(event: ModifiableEvent): Promise<void> {
    for (const ability of this.abilities.values()) {
      if (ability.isActive) {
        await ability.onAfterEvade?.(event);
      }
    }
  }

  private async handleBeforePass(event: ModifiableEvent): Promise<void> {
    const { player } = event.data;
    for (const ability of this.abilities.values()) {
      if (ability.isActive) {
        await ability.onBeforePass?.(event);
      }
    }
  }

  private async handleAfterPass(event: ModifiableEvent): Promise<void> {
    const { player } = event.data;
    for (const ability of this.abilities.values()) {
      if (ability.isActive) {
        await ability.onAfterPass?.(event);
      }
    }
  }

  updateCooldowns(): void {
    for (const ability of this.abilities.values()) {
      ability.updateCooldown();
    }
  }

  // 디버그용 메서드
  getPlayerAbility(playerId: number): BaseAbility | undefined {
    return this.playerAbilities.get(playerId);
  }

  getLogs(): string[] {
    return this.logs;
  }

  getVariables(): Map<string, any> {
    return this.variables;
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

  // 플레이어 가져오기
  getPlayer(playerId: number): Player | null {
    return this.players.get(playerId) || null;
  }

  // 모든 플레이어 가져오기
  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  // EventSystem 가져오기
  getEventSystem(): EventSystem {
    return this.eventSystem;
  }

  // 현재 턴 가져오기
  getCurrentTurn(): number {
    return this.currentTurn;
  }

  // 플레이어 설정
  setPlayer(player: Player): void {
    this.players.set(player.id, player);
  }

  // 플레이어의 모든 능력 가져오기
  getPlayerAbilities(playerId: number): BaseAbility[] {
    const ability = this.playerAbilities.get(playerId);
    return ability ? [ability] : [];
  }
} 
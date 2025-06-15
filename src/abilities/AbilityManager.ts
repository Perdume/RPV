import { EventSystem } from '../EventSystem';
import { GameEventType } from '../events';
import { BaseAbility } from './BaseAbility';
import { AbilityContext } from './Ability';
import { Player } from '../types/game.types';
import { Debug } from './Debug';

export class AbilityManager {
  private abilities: Map<string, BaseAbility> = new Map();
  private playerAbilities: Map<number, BaseAbility> = new Map();
  private gameState: { players: Player[] } | null = null;
  private eventSystem: EventSystem;
  private logs: string[] = [];
  private variables: Map<string, any> = new Map();

  constructor(eventSystem: EventSystem) {
    this.eventSystem = eventSystem;
    this.registerDefaultAbilities();
    this.setupEventListeners();
  }

  private registerDefaultAbilities(): void {
    // Debug 능력 등록
    const debug = new Debug();
    this.abilities.set('debug', debug);
  }

  private setupEventListeners(): void {
    this.eventSystem.on(GameEventType.TURN_START, this.handleTurnStart.bind(this));
    this.eventSystem.on(GameEventType.TURN_END, this.handleTurnEnd.bind(this));
    this.eventSystem.on(GameEventType.ATTACK, this.handleAttack.bind(this));
    this.eventSystem.on(GameEventType.DEFEND, this.handleDefend.bind(this));
    this.eventSystem.on(GameEventType.EVADE, this.handleEvade.bind(this));
    this.eventSystem.on(GameEventType.DEATH, this.handleDeath.bind(this));
    this.eventSystem.on(GameEventType.FOCUS_ATTACK, this.handleFocusAttack.bind(this));
    this.eventSystem.on(GameEventType.ABILITY_USE, this.handleAbilityUse.bind(this));
    this.eventSystem.on(GameEventType.GAME_START, this.handleGameStart.bind(this));
    this.eventSystem.on(GameEventType.GAME_END, this.handleGameEnd.bind(this));
  }

  setGameState(gameState: { players: Player[] }): void {
    this.gameState = gameState;
    // 게임 상태가 변경될 때마다 로그 초기화
    this.logs = [];
    this.variables = new Map();
  }

  assignAbility(playerId: number, abilityId: string): void {
    const ability = this.abilities.get(abilityId);
    if (ability) {
      this.playerAbilities.set(playerId, ability);
    }
  }

  private findPlayer(playerId: number): Player | undefined {
    return this.gameState?.players.find(p => p.id === playerId);
  }

  private createContext(player: Player, target?: Player): AbilityContext {
    return {
      player,
      target,
      players: this.gameState?.players || [],
      eventSystem: this.eventSystem,
      variables: this.variables,
      currentTurn: 0, // TODO: Get current turn from game state
      logs: this.logs
    };
  }

  private async handleTurnStart(event: any): Promise<void> {
    const { turn } = event.data;
    for (const [playerId, ability] of this.playerAbilities) {
      const player = this.findPlayer(playerId);
      if (player) {
        const context = this.createContext(player);
        context.currentTurn = turn;
        await ability.onTurnStart(context);
      }
    }
  }

  private async handleTurnEnd(event: any): Promise<void> {
    const { turn } = event.data;
    for (const [playerId, ability] of this.playerAbilities) {
      const player = this.findPlayer(playerId);
      if (player) {
        const context = this.createContext(player);
        context.currentTurn = turn;
        await ability.onTurnEnd(context);
      }
    }
  }

  private async handleAttack(event: any): Promise<void> {
    const { attacker, target } = event.data;
    const attackerPlayer = this.findPlayer(attacker);
    const targetPlayer = this.findPlayer(target);
    
    if (attackerPlayer && targetPlayer) {
      const ability = this.playerAbilities.get(attacker);
      if (ability) {
        const context = this.createContext(attackerPlayer, targetPlayer);
        await ability.onAttack(context);
      }
    }
  }

  private async handleDefend(event: any): Promise<void> {
    const { player } = event.data;
    const playerObj = this.findPlayer(player);
    if (playerObj) {
      const ability = this.playerAbilities.get(player);
      if (ability) {
        const context = this.createContext(playerObj);
        await ability.onDefend(context);
      }
    }
  }

  private async handleEvade(event: any): Promise<void> {
    const { player, attacker } = event.data;
    const playerObj = this.findPlayer(player);
    const attackerObj = attacker ? this.findPlayer(attacker) : undefined;
    
    if (playerObj) {
      const ability = this.playerAbilities.get(player);
      if (ability) {
        const context = this.createContext(playerObj, attackerObj);
        await ability.onEvade(context);
      }
    }
  }

  private async handleDeath(event: any): Promise<void> {
    const { player, killer } = event.data;
    const playerObj = this.findPlayer(player);
    const killerObj = killer ? this.findPlayer(killer) : undefined;
    
    if (playerObj) {
      const ability = this.playerAbilities.get(player);
      if (ability) {
        const context = this.createContext(playerObj, killerObj);
        await ability.onDeath(context);
      }
    }
  }

  private async handleFocusAttack(event: any): Promise<void> {
    const { attacker, target } = event.data;
    const attackerPlayer = this.findPlayer(attacker);
    const targetPlayer = this.findPlayer(target);
    
    if (attackerPlayer && targetPlayer) {
      const ability = this.playerAbilities.get(attacker);
      if (ability) {
        const context = this.createContext(attackerPlayer, targetPlayer);
        await ability.onFocusAttack(context);
      }
    }
  }

  private async handleAbilityUse(event: any): Promise<void> {
    const { player, target } = event.data;
    const playerObj = this.findPlayer(player);
    const targetObj = target ? this.findPlayer(target) : undefined;
    
    if (playerObj) {
      const ability = this.playerAbilities.get(player);
      if (ability) {
        const context = this.createContext(playerObj, targetObj);
        await ability.onAbilityUse(context);
      }
    }
  }

  private async handleGameStart(event: any): Promise<void> {
    for (const [playerId, ability] of this.playerAbilities) {
      const player = this.findPlayer(playerId);
      if (player) {
        const context = this.createContext(player);
        await ability.onGameStart(context);
      }
    }
  }

  private async handleGameEnd(event: any): Promise<void> {
    for (const [playerId, ability] of this.playerAbilities) {
      const player = this.findPlayer(playerId);
      if (player) {
        const context = this.createContext(player);
        await ability.onGameEnd(context);
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
} 
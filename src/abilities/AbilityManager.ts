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
  private currentTurn: number = 0;

  constructor(eventSystem: EventSystem) {
    this.eventSystem = eventSystem;
    this.registerDefaultAbilities();
    this.setupEventListeners();
  }

  private registerDefaultAbilities(): void {
    // Debug 능력 등록 (ID 매핑 수정)
    const debug = new Debug();
    this.abilities.set('디버그로거', debug); // data.json의 "ability" 값과 매칭
  }

  private setupEventListeners(): void {
    // 시스템 이벤트
    this.eventSystem.on(GameEventType.TURN_START, this.handleTurnStart.bind(this));
    this.eventSystem.on(GameEventType.TURN_END, this.handleTurnEnd.bind(this));
    this.eventSystem.on(GameEventType.GAME_START, this.handleGameStart.bind(this));
    this.eventSystem.on(GameEventType.GAME_END, this.handleGameEnd.bind(this));
    this.eventSystem.on(GameEventType.PERFECT_GUARD, this.handlePerfectGuard.bind(this));

    // 행동 이벤트
    this.eventSystem.on(GameEventType.ATTACK_ACTION, this.handleAttackAction.bind(this));
    this.eventSystem.on(GameEventType.DEFEND_ACTION, this.handleDefendAction.bind(this));
    this.eventSystem.on(GameEventType.EVADE_ACTION, this.handleEvadeAction.bind(this));
    this.eventSystem.on(GameEventType.PASS_ACTION, this.handlePassAction.bind(this));
    this.eventSystem.on(GameEventType.ABILITY_USE, this.handleAbilityUse.bind(this));

    // 결과 이벤트
    this.eventSystem.on(GameEventType.DAMAGE_DEALT, this.handleDamageDealt.bind(this));
    this.eventSystem.on(GameEventType.DEFENSE_CONSUMED, this.handleDefenseConsumed.bind(this));
    this.eventSystem.on(GameEventType.EVADE_SUCCESS, this.handleEvadeSuccess.bind(this));
    this.eventSystem.on(GameEventType.EVADE_FAIL, this.handleEvadeFail.bind(this));
    this.eventSystem.on(GameEventType.DEATH, this.handleDeath.bind(this));
    this.eventSystem.on(GameEventType.FOCUS_ATTACK, this.handleFocusAttack.bind(this));
  }

  setGameState(gameState: { players: Player[] }): void {
    this.gameState = gameState;
    this.logs = [];
    this.variables = new Map();
  }

  assignAbility(playerId: number, abilityId: string): void {
    // ID 매핑 처리
    const mappedAbilityId = this.mapAbilityId(abilityId);
    const ability = this.abilities.get(mappedAbilityId);
    if (ability) {
      this.playerAbilities.set(playerId, ability);
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
      player,
      target,
      players: this.gameState?.players || [],
      eventSystem: this.eventSystem,
      variables: this.variables,
      currentTurn: this.currentTurn,
      logs: this.logs
    };
  }

  // 시스템 이벤트 핸들러
  private async handleTurnStart(event: any): Promise<void> {
    const { turn } = event.data;
    this.currentTurn = turn;
    for (const [playerId, ability] of this.playerAbilities) {
      const player = this.findPlayer(playerId);
      if (player) {
        const context = this.createContext(player);
        await ability.onTurnStart(context);
      }
    }
  }

  private async handleTurnEnd(event: any): Promise<void> {
    const { turn } = event.data;
    this.currentTurn = turn;
    for (const [playerId, ability] of this.playerAbilities) {
      const player = this.findPlayer(playerId);
      if (player) {
        const context = this.createContext(player);
        await ability.onTurnEnd(context);
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

  private async handlePerfectGuard(event: any): Promise<void> {
    const { player } = event.data;
    const playerObj = this.findPlayer(player);
    if (playerObj) {
      const ability = this.playerAbilities.get(player);
      if (ability) {
        const context = this.createContext(playerObj);
        await ability.onPerfectGuard(context);
      }
    }
  }

  // 행동 이벤트 핸들러
  private async handleAttackAction(event: any): Promise<void> {
    const { attacker, target } = event.data;
    const attackerPlayer = this.findPlayer(attacker);
    const targetPlayer = this.findPlayer(target);
    
    if (attackerPlayer && targetPlayer) {
      const ability = this.playerAbilities.get(attacker);
      if (ability) {
        const context = this.createContext(attackerPlayer, targetPlayer);
        await ability.onAttackAction(context);
      }
    }
  }

  private async handleDefendAction(event: any): Promise<void> {
    const { player } = event.data;
    const playerObj = this.findPlayer(player);
    if (playerObj) {
      const ability = this.playerAbilities.get(player);
      if (ability) {
        const context = this.createContext(playerObj);
        await ability.onDefendAction(context);
      }
    }
  }

  private async handleEvadeAction(event: any): Promise<void> {
    const { player } = event.data;
    const playerObj = this.findPlayer(player);
    if (playerObj) {
      const ability = this.playerAbilities.get(player);
      if (ability) {
        const context = this.createContext(playerObj);
        await ability.onEvadeAction(context);
      }
    }
  }

  private async handlePassAction(event: any): Promise<void> {
    const { player } = event.data;
    const playerObj = this.findPlayer(player);
    if (playerObj) {
      const ability = this.playerAbilities.get(player);
      if (ability) {
        const context = this.createContext(playerObj);
        await ability.onPassAction(context);
      }
    }
  }

  // 결과 이벤트 핸들러
  private async handleDamageDealt(event: any): Promise<void> {
    const { attacker, target } = event.data;
    const attackerPlayer = this.findPlayer(attacker);
    const targetPlayer = this.findPlayer(target);
    
    if (attackerPlayer && targetPlayer) {
      const ability = this.playerAbilities.get(attacker);
      if (ability) {
        const context = this.createContext(attackerPlayer, targetPlayer);
        await ability.onDamageDealt(context);
      }
    }
  }

  private async handleDefenseConsumed(event: any): Promise<void> {
    const { player, attacker } = event.data;
    const playerObj = this.findPlayer(player);
    const attackerObj = attacker ? this.findPlayer(attacker) : undefined;
    
    if (playerObj) {
      const ability = this.playerAbilities.get(player);
      if (ability) {
        const context = this.createContext(playerObj, attackerObj);
        await ability.onDefenseConsumed(context);
      }
    }
  }

  private async handleEvadeSuccess(event: any): Promise<void> {
    const { player, attacker } = event.data;
    const playerObj = this.findPlayer(player);
    const attackerObj = attacker ? this.findPlayer(attacker) : undefined;
    
    if (playerObj) {
      const ability = this.playerAbilities.get(player);
      if (ability) {
        const context = this.createContext(playerObj, attackerObj);
        await ability.onEvadeSuccess(context);
      }
    }
  }

  private async handleEvadeFail(event: any): Promise<void> {
    const { player, attacker } = event.data;
    const playerObj = this.findPlayer(player);
    const attackerObj = attacker ? this.findPlayer(attacker) : undefined;
    
    if (playerObj) {
      const ability = this.playerAbilities.get(player);
      if (ability) {
        const context = this.createContext(playerObj, attackerObj);
        await ability.onEvadeFail(context);
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
import { EventSystem } from '../EventSystem';
import { GameEventType } from '../events';
import { Ability, AbilityContext } from './Ability';
import { BaseAbility } from './BaseAbility';
import { Player } from '../types/game.types';

interface AbilityInstance {
  ability: BaseAbility;
  currentCooldown: number;
  remainingUses: number;
}

export class AbilityManager {
  private abilities: Map<string, Ability>;
  private playerAbilities: Map<number, Ability>;
  private eventSystem: EventSystem;
  private gameState: any;

  constructor(eventSystem: EventSystem) {
    this.abilities = new Map();
    this.playerAbilities = new Map();
    this.eventSystem = eventSystem;
    this.setupEventListeners();
  }

  setGameState(gameState: any): void {
    this.gameState = gameState;
  }

  private setupEventListeners(): void {
    // 턴 시작 이벤트
    this.eventSystem.on(GameEventType.TURN_START, this.handleTurnStart.bind(this));

    // 턴 종료 이벤트
    this.eventSystem.on(GameEventType.TURN_END, this.handleTurnEnd.bind(this));

    // 공격 이벤트
    this.eventSystem.on(GameEventType.ATTACK, this.handleAttack.bind(this));

    // 방어 이벤트
    this.eventSystem.on(GameEventType.DEFEND, this.handleDefend.bind(this));

    // 회피 이벤트
    this.eventSystem.on(GameEventType.EVADE, this.handleEvade.bind(this));

    // 데미지 이벤트
    this.eventSystem.on(GameEventType.DAMAGE, this.handleDamage.bind(this));

    // 사망 이벤트
    this.eventSystem.on(GameEventType.DEATH, this.handleDeath.bind(this));

    // 능력 사용 이벤트
    this.eventSystem.on(GameEventType.ABILITY_USE, this.handleAbilityUse.bind(this));
  }

  private createContext(player: Player, target?: Player): AbilityContext {
    return {
      player,
      target,
      players: this.gameState?.players || [],
      eventSystem: this.eventSystem,
      logs: [],
      variables: new Map(),
      currentTurn: this.gameState?.currentTurn || 0
    };
  }

  public registerAbility(ability: Ability): void {
    this.abilities.set(ability.id, ability);
  }

  public assignAbility(playerId: number, abilityId: string): void {
    const ability = this.abilities.get(abilityId);
    if (ability) {
      this.playerAbilities.set(playerId, ability);
    }
  }

  public getPlayerAbility(playerId: number): Ability | undefined {
    return this.playerAbilities.get(playerId);
  }

  public getPlayerAbilities(playerId: number): Ability[] {
    const ability = this.playerAbilities.get(playerId);
    return ability ? [ability] : [];
  }

  public updateCooldowns(): void {
    for (const [playerId, ability] of this.playerAbilities) {
      if (ability.cooldown > 0) {
        ability.cooldown--;
      }
    }
  }

  private async handleTurnStart(event: any): Promise<void> {
    const player = this.findPlayer(event.data.playerId);
    if (!player) return;
        
    const ability = this.playerAbilities.get(player.id);
    if (ability?.onTurnStart) {
      const context = this.createContext(player);
      await ability.onTurnStart(context);
    }
  }

  private async handleTurnEnd(event: any): Promise<void> {
    const player = this.findPlayer(event.data.playerId);
    if (!player) return;

    const ability = this.playerAbilities.get(player.id);
    if (ability?.onTurnEnd) {
      const context = this.createContext(player);
      await ability.onTurnEnd(context);
    }
  }

  private async handleAttack(event: any): Promise<void> {
    const attacker = this.findPlayer(event.data.attacker);
    const target = this.findPlayer(event.data.target);
    if (!attacker || !target) return;

    const ability = this.playerAbilities.get(attacker.id);
    if (ability?.onAttack) {
      const context = this.createContext(attacker, target);
      await ability.onAttack(context);
    }
  }

  private async handleDefend(event: any): Promise<void> {
    const player = this.findPlayer(event.data.player);
    if (!player) return;

    const ability = this.playerAbilities.get(player.id);
    if (ability?.onDefend) {
      const context = this.createContext(player);
      await ability.onDefend(context);
    }
  }

  private async handleEvade(event: any): Promise<void> {
    const player = this.findPlayer(event.data.player);
    if (!player) return;

    const ability = this.playerAbilities.get(player.id);
    if (ability?.onEvade) {
      const context = this.createContext(player);
      await ability.onEvade(context);
      }
    }

  private async handleDamage(event: any): Promise<void> {
    const player = this.findPlayer(event.data.player);
    if (!player) return;

    const ability = this.playerAbilities.get(player.id);
    if (ability?.onDamage) {
      const context = this.createContext(player);
      await ability.onDamage(context);
    }
  }

  private async handleDeath(event: any): Promise<void> {
    const player = this.findPlayer(event.data.player);
    if (!player) return;

    const ability = this.playerAbilities.get(player.id);
    if (ability?.onDeath) {
      const context = this.createContext(player);
      await ability.onDeath(context);
    }
  }

  private async handleAbilityUse(event: any): Promise<void> {
    const playerId = event.data.playerId;
    const player = this.findPlayer(playerId);
    if (!player) return;

    const ability = this.playerAbilities.get(playerId);
    if (!ability) {
      console.error(`[오류] ${playerId}은(는) ${event.data.abilityId} 능력을 가지고 있지 않습니다.`);
      return;
    }

    if (ability.cooldown > 0) {
      console.error(`[오류] ${playerId}의 ${ability.name} 능력이 아직 쿨다운 중입니다. (${ability.cooldown}턴 남음)`);
      return;
    }

    if (ability.maxUses > 0 && player.abilityUses >= ability.maxUses) {
      console.error(`[오류] ${playerId}의 ${ability.name} 능력 사용 횟수가 모두 소진되었습니다.`);
      return;
    }

    const target = event.data.targetId ? this.findPlayer(event.data.targetId) : undefined;
    const context = this.createContext(player, target);

    try {
      await ability.use(context);
      player.abilityUses++;
      console.log(`[DEBUG] Ability ${ability.name} used successfully by player ${playerId}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      console.error(`[오류] ${playerId}의 ${ability.name} 능력 사용 중 오류가 발생했습니다: ${errorMessage}`);
    }
  }

  private findPlayer(playerId: number): Player | undefined {
    return this.gameState?.players.find((p: Player) => p.id === playerId);
  }
} 
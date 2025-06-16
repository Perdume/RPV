import { Player as GamePlayer, PlayerId, Action, PlayerStatus as GamePlayerStatus, GameStateData } from './types';
import { Player, PlayerStatus, ModifiableEvent, GameEventType } from './types/game.types';
import { GameState } from './GameState';
import { EventSystem } from './utils/eventSystem';
import { AbilityManager } from './abilities/AbilityManager';
import { Debug } from './abilities/Debug';

// Helper function to convert GamePlayerStatus to PlayerStatus
function convertPlayerStatus(status: GamePlayerStatus): PlayerStatus {
  switch (status) {
    case GamePlayerStatus.ALIVE:
      return PlayerStatus.ALIVE;
    case GamePlayerStatus.WOUNDED:
      return PlayerStatus.WOUNDED;
    case GamePlayerStatus.DEAD:
      return PlayerStatus.DEAD;
    case GamePlayerStatus.EVADING:
      return PlayerStatus.ALIVE;
    default:
      return PlayerStatus.ALIVE;
  }
}

export class GameEngine {
  private gameState: GameState;
  private eventSystem: EventSystem;
  private abilityManager: AbilityManager;
  private attackCounts: Map<PlayerId, Map<PlayerId, number>>;
  private debug: Debug;
  private debugLogs: string[];

  constructor() {
    this.gameState = new GameState();
    this.eventSystem = new EventSystem();
    this.abilityManager = new AbilityManager(this.eventSystem);
    this.attackCounts = new Map();
    this.debug = new Debug();
    this.debugLogs = [];

    this.addDebugLog('[초기화] GameEngine이 생성되었습니다.');
  }

  private addDebugLog(message: string): void {
    this.debugLogs.push(message);
    const firstPlayer = Array.from(this.gameState.players.values())[0];
    if (!firstPlayer) return;
    
    // Convert GamePlayer to Player type
    const player: Player = {
      ...firstPlayer,
      status: convertPlayerStatus(firstPlayer.status),
      isPerfectGuard: false,
      maxAbilityUses: 0,
      hasDefended: false,
      wasAttacked: false,
      isAbilitySealed: false,
      isDefenseSealed: false,
      damageReduction: 0,
      isGhost: false,
      currentTurn: this.gameState.currentTurn,
      noDamageTurns: 0,
      inactiveTurns: 0,
      actionType: firstPlayer.action as any,
      targetId: firstPlayer.target
    };
    
    this.debug.logEvent('Debug', { message });
  }

  loadGameState(data: GameStateData): void {
    this.gameState.loadFromData(data);
    
    // Reset attack counts
    this.attackCounts.clear();
    for (const player of this.gameState.getAlivePlayers()) {
      this.attackCounts.set(player.id, new Map());
    }

    this.addDebugLog('[게임 상태] 게임 상태가 로드되었습니다.');
  }

  addPlayer(player: GamePlayer): void {
    this.gameState.addPlayer(player);
    this.attackCounts.set(player.id, new Map());
    this.addDebugLog(`[플레이어] ${player.name}이(가) 게임에 참가했습니다.`);
  }

  async processTurn(): Promise<void> {
    if (this.gameState.gameOver) {
      this.addDebugLog('[게임 종료] 게임이 이미 종료되었습니다.');
      return;
    }

    this.addDebugLog(`[턴 시작] ${this.gameState.currentTurn}턴이 시작됩니다.`);

    // Emit turn start event
    const turnStartEvent: ModifiableEvent = {
      type: GameEventType.TURN_START,
      timestamp: Date.now(),
      data: { turn: this.gameState.currentTurn },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(turnStartEvent);

    // Process death zone
    this.gameState.processDeathZone();

    // Process player actions
    for (const player of this.gameState.getAlivePlayers()) {
      if (!player.action) continue;

      this.addDebugLog(`[액션] ${player.name}의 ${player.action} 액션을 처리합니다.`);

      switch (player.action) {
        case Action.ATTACK:
          if (player.target) {
            await this.processAttack(player, player.target);
          }
          break;
        case Action.DEFEND:
          await this.processDefend(player);
          break;
        case Action.EVADE:
          await this.processEvade(player);
          break;
      }
    }

    // Check for game over
    this.gameState.checkGameOver();

    // Reset turn state
    for (const player of this.gameState.players.values()) {
      player.action = undefined;
      player.target = undefined;
    }

    // Reset attack counts
    this.attackCounts.clear();
    for (const player of this.gameState.players.values()) {
      this.attackCounts.set(player.id, new Map());
    }

    // Update ability cooldowns
    this.abilityManager.updateCooldowns();

    this.gameState.currentTurn++;

    // Emit turn end event
    const turnEndEvent: ModifiableEvent = {
      type: GameEventType.TURN_END,
      timestamp: Date.now(),
      data: { turn: this.gameState.currentTurn - 1 },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(turnEndEvent);

    this.addDebugLog(`[턴 종료] ${this.gameState.currentTurn - 1}턴이 종료되었습니다.`);
  }

  private async processAttack(attacker: GamePlayer, targetId: PlayerId): Promise<void> {
    const target = this.gameState.getPlayer(targetId);
    if (!target || target.status === GamePlayerStatus.DEAD) {
      this.addDebugLog(`[공격 실패] ${attacker.name}의 공격이 실패했습니다.`);
      return;
    }

    this.addDebugLog(`[공격] ${attacker.name}이(가) ${target.name}을(를) 공격합니다.`);

    // Update attack count
    const targetCounts = this.attackCounts.get(attacker.id)!;
    targetCounts.set(targetId, (targetCounts.get(targetId) || 0) + 1);

    // Check for evade
    if (target.status === GamePlayerStatus.EVADING) {
      const evadeChance = this.calculateEvadeChance(target);
      if (Math.random() * 100 < evadeChance) {
        this.addDebugLog(`[회피 성공] ${target.name}이(가) 공격을 회피했습니다.`);
        const evadeEvent: ModifiableEvent = {
          type: GameEventType.EVADE_ACTION,
          timestamp: Date.now(),
          data: {
            player: targetId,
            attacker: attacker.id,
            success: true,
            chance: evadeChance
          },
          cancelled: false,
          modified: false
        };
        await this.eventSystem.emit(evadeEvent);
        return;
      }
    }

    // Calculate damage
    let damage = attacker.attack;
    const attackCount = targetCounts.get(targetId) || 0;
    if (attackCount >= 3) { // Focus attack threshold
      damage += 2; // Focus attack bonus
      this.addDebugLog(`[집중 공격] ${attacker.name}의 집중 공격이 발동되었습니다.`);
      const focusAttackEvent: ModifiableEvent = {
        type: GameEventType.FOCUS_ATTACK,
        timestamp: Date.now(),
        data: {
          attacker: attacker.id,
          target: targetId,
          damage,
          attackCount
        },
        cancelled: false,
        modified: false
      };
      await this.eventSystem.emit(focusAttackEvent);
    }

    // Apply damage
    if (target.defenseGauge > 0) {
      damage = Math.max(0, damage - 1);
      target.defenseGauge--;
      this.addDebugLog(`[방어] ${target.name}의 방어 게이지가 1 감소했습니다.`);
      const defendEvent: ModifiableEvent = {
        type: GameEventType.DEFEND_ACTION,
        timestamp: Date.now(),
        data: {
          player: targetId,
          defenseGauge: target.defenseGauge,
          damageReduction: 1
        },
        cancelled: false,
        modified: false
      };
      await this.eventSystem.emit(defendEvent);
    }

    const oldHp = target.hp;
    target.hp = Math.max(0, target.hp - damage);
    
    this.addDebugLog(`[데미지] ${target.name}이(가) ${damage}의 데미지를 입었습니다.`);
    
    const attackEvent: ModifiableEvent = {
      type: GameEventType.ATTACK_ACTION,
      timestamp: Date.now(),
      data: {
        attacker: attacker.id,
        target: targetId,
        damage,
        targetHp: target.hp
      },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(attackEvent);

    // Check for death
    if (target.hp <= 0) {
      target.status = GamePlayerStatus.DEAD;
      this.addDebugLog(`[사망] ${target.name}이(가) 탈락했습니다.`);
      const deathEvent: ModifiableEvent = {
        type: GameEventType.DEATH,
        timestamp: Date.now(),
        data: {
          player: targetId,
          killer: attacker.id,
          lastDamage: damage
        },
        cancelled: false,
        modified: false
      };
      await this.eventSystem.emit(deathEvent);
    }
  }

  private async processDefend(player: GamePlayer): Promise<void> {
    if (player.defenseGauge < player.maxDefenseGauge) {
      player.defenseGauge++;
      this.addDebugLog(`[방어] ${player.name}의 방어 게이지가 1 증가했습니다.`);
      const defendEvent: ModifiableEvent = {
        type: GameEventType.DEFEND_ACTION,
        timestamp: Date.now(),
        data: {
          player: player.id,
          defenseGauge: player.defenseGauge,
          damageReduction: 1
        },
        cancelled: false,
        modified: false
      };
      await this.eventSystem.emit(defendEvent);
    }
  }

  private async processEvade(player: GamePlayer): Promise<void> {
    player.status = GamePlayerStatus.EVADING;
    this.addDebugLog(`[회피] ${player.name}이(가) 회피 상태가 되었습니다.`);
    const evadeEvent: ModifiableEvent = {
      type: GameEventType.EVADE_ACTION,
      timestamp: Date.now(),
      data: {
        player: player.id,
        success: false,
        chance: this.calculateEvadeChance(player)
      },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(evadeEvent);
  }

  private calculateEvadeChance(player: GamePlayer): number {
    const survivorCount = this.gameState.survivors;
    if (survivorCount <= 0) return 0;
    
    const baseChance = 5 * (survivorCount - player.evadeCount * 2);
    return Math.min(100, Math.max(0, baseChance));
  }

  on(eventType: GameEventType, handler: (event: ModifiableEvent) => Promise<void>): void {
    this.eventSystem.on(eventType, handler);
  }

  getGameState(): GameStateData {
    return this.gameState.toJSON();
  }

  getEventHistory(): ModifiableEvent[] {
    return this.eventSystem.getEventHistory();
  }
} 
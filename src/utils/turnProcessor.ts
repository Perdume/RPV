import { 
  Player, 
  PlayerStatus, 
  PlayerAction, 
  TurnResult, 
  GameState, 
  ActionType,
  DamageEvent,
  DefendEvent
} from '../types/game.types';
import { AbilityContext } from '../abilities/Ability';
import { GameEventType } from '../events';
import { EventSystem } from '../EventSystem';
import { AbilityManager } from '../abilities/AbilityManager';
import { Debug } from '../abilities/Debug';

const DEATH_ZONE_TURN = 5;

export class TurnProcessor {
  private gameState: GameState;
  private eventSystem: EventSystem;
  private abilityManager: AbilityManager;
  private debug: Debug;
  private debugLogs: string[];

  constructor(gameState: GameState, eventSystem: EventSystem) {
    this.gameState = gameState;
    this.eventSystem = eventSystem;
    this.debugLogs = [];
    
    // AbilityManager 초기화
    this.abilityManager = new AbilityManager(this.eventSystem);
    this.debug = new Debug();
    
    // 게임 상태 동기화
    this.syncGameState();
    
    // 디버그 로그 추가
    this.addDebugLog('[초기화] TurnProcessor가 생성되었습니다.');
    
    // 플레이어들의 능력 할당
    this.assignPlayerAbilities();

    // 이벤트 리스너 설정
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // 게임 상태 변경 시 AbilityManager 업데이트
    this.eventSystem.on(GameEventType.TURN_START, () => {
      this.syncGameState();
    });

    this.eventSystem.on(GameEventType.TURN_END, () => {
      this.syncGameState();
    });

    this.eventSystem.on(GameEventType.ATTACK, () => {
      this.syncGameState();
    });

    this.eventSystem.on(GameEventType.DEFEND, () => {
      this.syncGameState();
    });

    this.eventSystem.on(GameEventType.EVADE, () => {
      this.syncGameState();
    });

    this.eventSystem.on(GameEventType.DEATH, () => {
      this.syncGameState();
    });
  }

  private syncGameState(): void {
    // 게임 상태를 AbilityManager에 동기화
    this.abilityManager.setGameState({
      players: this.gameState.players
    });
    this.addDebugLog('[상태 동기화] 게임 상태가 AbilityManager에 동기화되었습니다.');
  }

  private addDebugLog(message: string): void {
    this.debugLogs.push(message);
    this.debug.use({
      player: this.gameState.players[0],
      players: this.gameState.players,
      eventSystem: this.eventSystem,
      variables: new Map(),
      currentTurn: this.gameState.currentTurn,
      logs: this.debugLogs
    });
  }

  // 플레이어 능력 할당 메서드
  private assignPlayerAbilities(): void {
    // 모든 플레이어에게 Debug 능력 할당
    this.gameState.players.forEach(player => {
      // 기존 능력이 없는 경우에만 Debug 능력 할당
      if (!player.ability || player.ability === '없음') {
        // Debug 능력 등록
        this.abilityManager.assignAbility(player.id, 'debug');
        player.ability = 'debug';
        this.addDebugLog(`[능력 할당] ${player.name}에게 Debug 능력을 할당했습니다.`);
      } else {
        // 기존 능력이 있는 경우 해당 능력 등록
        this.abilityManager.assignAbility(player.id, player.ability);
        this.addDebugLog(`[능력 할당] ${player.name}은(는) 이미 ${player.ability} 능력을 가지고 있습니다.`);
      }
    });
  }

  public async processTurn(actions: PlayerAction[]): Promise<TurnResult> {
    const logs: string[] = [];
    const turnNumber = this.gameState.currentTurn + 1;

    // 디버그 로그 추가
    this.addDebugLog(`[턴 시작] ${turnNumber}턴이 시작됩니다.`);

    logs.push(`=== 턴 ${turnNumber} 시작 ===`);
    logs.push(`입력된 행동 수: ${actions.length}`);
    logs.push(`현재 생존자 수: ${this.gameState.players.filter(p => p.status !== PlayerStatus.DEAD).length}`);

    // 1. 턴 시작 이벤트
    await this.eventSystem.emit({
      type: GameEventType.TURN_START,
      timestamp: Date.now(),
      data: { 
        turn: turnNumber,
        players: this.gameState.players
      }
    });

    // 2. 액션 처리
    await this.processActions(actions, logs);

    // 3. 상태 효과 업데이트
    this.updateStatusEffects(logs);

    // 4. 데스존 체크
    const isDeathZone = this.checkDeathZone(turnNumber, logs);

    // 5. 게임 상태 업데이트
    this.updateGameState(turnNumber, logs, isDeathZone);

    // 6. 턴 종료 이벤트
    await this.eventSystem.emit({
      type: GameEventType.TURN_END,
      timestamp: Date.now(),
      data: { 
        turn: turnNumber,
        players: this.gameState.players
      }
    });

    // 7. 능력 쿨다운 업데이트
    this.abilityManager.updateCooldowns();

    // 디버그 로그 추가
    this.addDebugLog(`[턴 종료] ${turnNumber}턴이 종료됩니다.`);

    logs.push(`=== 턴 ${turnNumber} 종료 ===`);
    logs.push(`최종 생존자 수: ${this.gameState.players.filter(p => p.status !== PlayerStatus.DEAD).length}`);
    logs.push(`데스존 상태: ${isDeathZone ? '활성화' : '비활성화'}`);

    return {
      turnNumber,
      actions,
      logs,
      players: this.gameState.players,
      isDeathZone
    };
  }

  private async processActions(actions: PlayerAction[], logs: string[]): Promise<void> {
    for (const action of actions) {
      const player = this.gameState.players.find(p => p.id === action.playerId);
      const target = this.gameState.players.find(p => p.id === action.targetId);
      
      if (!player || !target || player.status === PlayerStatus.DEAD) {
        this.addDebugLog(`[오류] 유효하지 않은 액션: ${JSON.stringify(action)}`);
        continue;
      }

      // 디버그 로그 추가
      this.addDebugLog(`[액션 처리] ${player.name}의 ${action.actionType} 액션을 처리합니다.`);

      switch (action.actionType) {
        case 'ATTACK':
          await this.processAttack(player, target, logs);
          break;
        case 'DEFEND':
          await this.processDefend(player, logs);
          break;
        case 'EVADE':
          await this.processEvade(player, logs);
          break;
        case 'ABILITY':
          await this.processAbility(player, target, action.abilityId, logs);
          break;
      }
    }
  }

  private async processAttack(attacker: Player, target: Player, logs: string[]): Promise<void> {
    // 디버그 로그 추가
    this.addDebugLog(`[공격] ${attacker.name}이(가) ${target.name}을(를) 공격합니다.`);

    // 방어 게이지 체크
    if (target.defenseGauge > 0) {
      target.defenseGauge--;
      target.wasAttacked = true;
      logs.push(`[방어] ${target.name}의 방어 게이지가 1 감소했습니다. (남은 방어 게이지: ${target.defenseGauge})`);
      
      await this.eventSystem.emit({
        type: GameEventType.DEFEND,
        timestamp: Date.now(),
        data: {
          player: target.id,
          defenseGauge: target.defenseGauge,
          damageReduction: target.damageReduction,
          players: this.gameState.players
        }
      });
      return;
    }

    // 회피 시도
    const evadeChance = this.calculateEvadeChance(target);
    if (Math.random() < evadeChance) {
      target.evadeCount++;
      target.wasAttacked = true;
      logs.push(`[회피] ${target.name}이(가) 공격을 회피했습니다! (회피 횟수: ${target.evadeCount})`);
      
      await this.eventSystem.emit({
        type: GameEventType.EVADE,
        timestamp: Date.now(),
        data: {
          player: target.id,
          attacker: attacker.id,
          success: true,
          chance: evadeChance,
          players: this.gameState.players
        }
      });
      return;
    }

    // 데미지 계산 및 적용
    const damage = this.calculateDamage(attacker, target);
    if (damage > 0) {
      target.hp -= damage;
      target.wasAttacked = true;
      logs.push(`[공격] ${attacker.name}이(가) ${target.name}에게 ${damage}의 데미지를 입혔습니다. (남은 체력: ${target.hp})`);
      
      await this.eventSystem.emit({
        type: GameEventType.ATTACK,
        timestamp: Date.now(),
        data: {
          attacker: attacker.id,
          target: target.id,
          damage,
          targetHp: target.hp,
          players: this.gameState.players
        }
      });

      // 사망 체크
      if (target.hp <= 0) {
        target.status = PlayerStatus.DEAD;
        await this.eventSystem.emit({
          type: GameEventType.DEATH,
          timestamp: Date.now(),
          data: {
            player: target.id,
            killer: attacker.id,
            lastDamage: damage,
            players: this.gameState.players
          }
        });
        logs.push(`[사망] ${target.name}이(가) 탈락했습니다.`);
      }
    }
  }

  private async processDefend(player: Player, logs: string[]): Promise<void> {
    // 디버그 로그 추가
    this.addDebugLog(`[방어] ${player.name}이(가) 방어를 시도합니다.`);

    player.defenseGauge = Math.min(player.defenseGauge + 1, player.maxDefenseGauge);
    logs.push(`[방어] ${player.name}의 방어 게이지가 1 증가했습니다. (현재 방어 게이지: ${player.defenseGauge})`);
    
    await this.eventSystem.emit({
      type: GameEventType.DEFEND,
      timestamp: Date.now(),
      data: {
        player: player.id,
        defenseGauge: player.defenseGauge,
        damageReduction: player.damageReduction,
        players: this.gameState.players
      }
    });
  }

  private async processEvade(player: Player, logs: string[]): Promise<void> {
    // 디버그 로그 추가
    this.addDebugLog(`[회피] ${player.name}이(가) 회피를 시도합니다.`);

    player.evadeCount++;
    logs.push(`[회피] ${player.name}의 회피 카운트가 1 증가했습니다. (현재 회피 카운트: ${player.evadeCount})`);
    
    await this.eventSystem.emit({
      type: GameEventType.EVADE,
      timestamp: Date.now(),
      data: {
        player: player.id,
        success: true,
        chance: 1,
        players: this.gameState.players
      }
    });
  }

  private async processAbility(player: Player, target: Player, abilityId: string | undefined, logs: string[]): Promise<void> {
    if (!abilityId) {
      this.addDebugLog(`[오류] ${player.name}의 능력 ID가 지정되지 않았습니다.`);
      return;
    }

    // 디버그 로그 추가
    this.addDebugLog(`[능력] ${player.name}이(가) ${abilityId} 능력을 사용합니다.`);

    await this.eventSystem.emit({
      type: GameEventType.ABILITY_USE,
      timestamp: Date.now(),
      data: {
        player: player.id,
        abilityId,
        target: target.id,
        players: this.gameState.players
      }
    });
  }

  private calculateEvadeChance(player: Player): number {
    const aliveCount = this.gameState.players.filter(p => p.status !== PlayerStatus.DEAD).length;
    const chance = 5 * (aliveCount - player.evadeCount * 2);
    return Math.max(0, chance);
  }

  private calculateDamage(attacker: Player, target: Player): number {
    let damage = attacker.attack;
    
    // 방어력 감소
    if (target.defense > 0) {
      damage = Math.max(1, damage - target.defense);
    }
    
    // 데미지 감소 효과
    if (target.damageReduction > 0) {
      damage = Math.max(1, Math.floor(damage * (1 - target.damageReduction)));
    }
    
    return damage;
  }

  private updateStatusEffects(logs: string[]): void {
    this.gameState.players.forEach(player => {
      if (player.statusEffects.length > 0) {
        logs.push(`[상태효과] ${player.name}의 상태효과: ${player.statusEffects.join(', ')}`);
      }
    });
  }

  private checkDeathZone(turnNumber: number, logs: string[]): boolean {
    const isDeathZone = turnNumber >= DEATH_ZONE_TURN;
    if (isDeathZone) {
      logs.push(`[데스존] ${turnNumber}턴부터 데스존이 활성화되었습니다.`);
    }
    return isDeathZone;
  }

  private updateGameState(turnNumber: number, logs: string[], isDeathZone: boolean): void {
    this.gameState.currentTurn = turnNumber;
    this.gameState.isDeathZone = isDeathZone;
  }
}
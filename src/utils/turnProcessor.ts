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
  private lastTurnHpChanges: Map<number, number> = new Map(); // 턴 시작 시 체력 기록용

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
      this.recordHpChanges();
    });

    this.eventSystem.on(GameEventType.TURN_END, () => {
      this.syncGameState();
      this.checkPerfectGuard();
    });

    this.eventSystem.on(GameEventType.ATTACK_ACTION, () => {
      this.syncGameState();
    });

    this.eventSystem.on(GameEventType.DEFEND_ACTION, () => {
      this.syncGameState();
    });

    this.eventSystem.on(GameEventType.EVADE_ACTION, () => {
      this.syncGameState();
    });

    this.eventSystem.on(GameEventType.DEATH, () => {
      this.syncGameState();
    });
  }

  private recordHpChanges(): void {
    // 턴 시작 시 모든 플레이어의 체력 기록
    this.gameState.players.forEach(player => {
      this.lastTurnHpChanges.set(player.id, player.hp);
    });
  }

  private checkPerfectGuard(): void {
    // 턴 종료 시 퍼펙트 가드 체크
    this.gameState.players.forEach(player => {
      const startHp = this.lastTurnHpChanges.get(player.id);
      if (startHp !== undefined && startHp === player.hp) {
        // 체력 변화가 없고 방어게이지가 최대가 아닌 경우
        if (player.defenseGauge < 3) {
          player.defenseGauge++;
          this.eventSystem.emit({
            type: GameEventType.PERFECT_GUARD,
            timestamp: Date.now(),
            data: { player: player.id }
          });
        }
      }
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
    // 디버거 플레이어 찾기
    const debuggerPlayer = this.gameState.players.find(p => p.name === '디버거');
    
    if (debuggerPlayer) {
      // 디버거 플레이어에게만 Debug 능력 할당
      this.abilityManager.assignAbility(debuggerPlayer.id, 'debug');
      debuggerPlayer.ability = 'debug';
      this.addDebugLog(`[능력 할당] ${debuggerPlayer.name}에게 Debug 능력을 할당했습니다.`);
    }
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
    // 공격 행동 이벤트 발생
    await this.eventSystem.emit({
      type: GameEventType.ATTACK_ACTION,
      timestamp: Date.now(),
      data: { attacker: attacker.id, target: target.id }
    });

    // 회피 판정
    const evadeChance = 5 * (this.gameState.players.filter(p => p.status !== PlayerStatus.DEAD).length - target.evadeCount * 2);
    const isEvadeSuccess = Math.random() * 100 < evadeChance;

    if (isEvadeSuccess) {
      // 회피 성공
      await this.eventSystem.emit({
        type: GameEventType.EVADE_SUCCESS,
        timestamp: Date.now(),
        data: { player: target.id, attacker: attacker.id }
      });
      logs.push(`${target.name}이(가) 회피에 성공했습니다!`);
      return;
    }

    // 회피 실패
    await this.eventSystem.emit({
      type: GameEventType.EVADE_FAIL,
      timestamp: Date.now(),
      data: { player: target.id, attacker: attacker.id }
    });

    // 방어게이지 체크
    if (target.defenseGauge > 0) {
      target.defenseGauge--;
      await this.eventSystem.emit({
        type: GameEventType.DEFENSE_CONSUMED,
        timestamp: Date.now(),
        data: { player: target.id, attacker: attacker.id }
      });
      logs.push(`${target.name}의 방어게이지가 소모되었습니다. (남은 방어게이지: ${target.defenseGauge})`);
      return;
    }

    // 데미지 적용
    target.hp--;
    await this.eventSystem.emit({
      type: GameEventType.DAMAGE_DEALT,
      timestamp: Date.now(),
      data: { attacker: attacker.id, target: target.id, damage: 1 }
    });
    logs.push(`${attacker.name}이(가) ${target.name}에게 1의 데미지를 입혔습니다.`);

    // 사망 체크
    if (target.hp <= 0) {
      target.status = PlayerStatus.DEAD;
      await this.eventSystem.emit({
        type: GameEventType.DEATH,
        timestamp: Date.now(),
        data: { player: target.id, killer: attacker.id }
      });
      logs.push(`${target.name}이(가) 탈락했습니다.`);
    }
  }

  private async processDefend(player: Player, logs: string[]): Promise<void> {
    // 방어 행동 이벤트 발생
    await this.eventSystem.emit({
      type: GameEventType.DEFEND_ACTION,
      timestamp: Date.now(),
      data: { player: player.id }
    });

    if (player.defenseGauge < 3) {
      player.defenseGauge++;
      logs.push(`${player.name}의 방어게이지가 증가했습니다. (현재 방어게이지: ${player.defenseGauge})`);
    } else {
      logs.push(`${player.name}의 방어게이지가 이미 최대입니다.`);
    }
  }

  private async processEvade(player: Player, logs: string[]): Promise<void> {
    // 회피 행동 이벤트 발생
    await this.eventSystem.emit({
      type: GameEventType.EVADE_ACTION,
      timestamp: Date.now(),
      data: { player: player.id }
    });

    player.evadeCount++;
    logs.push(`${player.name}의 회피카운트가 증가했습니다. (현재 회피카운트: ${player.evadeCount})`);
  }

  private async processPass(player: Player, logs: string[]): Promise<void> {
    // 패스 행동 이벤트 발생
    await this.eventSystem.emit({
      type: GameEventType.PASS_ACTION,
      timestamp: Date.now(),
      data: { player: player.id }
    });

    // 회피카운트 감소
    if (player.evadeCount > 0) {
      player.evadeCount--;
      logs.push(`${player.name}의 회피카운트가 감소했습니다. (현재 회피카운트: ${player.evadeCount})`);
    }

    logs.push(`${player.name}이(가) 행동을 패스했습니다.`);
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
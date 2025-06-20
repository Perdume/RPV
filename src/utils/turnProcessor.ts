import { 
  Player, 
  PlayerStatus, 
  PlayerAction, 
  TurnResult, 
  GameState, 
  ActionType,
  DamageEvent,
  DefendEvent,
  ModifiableEvent,
  GameEventType,
  GameSnapshot,
  GameSessionData
} from '../types/game.types';
import { EventSystem } from '../utils/eventSystem';
import { AbilityManager } from '../abilities/AbilityManager';
import { Debug } from '../abilities/Debug';
import { DataManager } from './DataManager';

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
    this.eventSystem.on(GameEventType.TURN_START, async () => {
      await this.syncGameState();
      await this.recordHpChanges();
    });

    this.eventSystem.on(GameEventType.TURN_END, async () => {
      await this.syncGameState();
      await this.checkPerfectGuard();
    });

    this.eventSystem.on(GameEventType.ATTACK_ACTION, async () => {
      await this.syncGameState();
    });

    this.eventSystem.on(GameEventType.DEFEND_ACTION, async () => {
      await this.syncGameState();
    });

    this.eventSystem.on(GameEventType.EVADE_ACTION, async () => {
      await this.syncGameState();
    });

    this.eventSystem.on(GameEventType.DEATH, async () => {
      await this.syncGameState();
    });
  }

  private async recordHpChanges(): Promise<void> {
    // 턴 시작 시 모든 플레이어의 체력 기록
    this.gameState.players.forEach(player => {
      this.lastTurnHpChanges.set(player.id, player.hp);
    });
  }

  private async checkPerfectGuard(): Promise<void> {
    // 턴 종료 시 퍼펙트 가드 체크
    this.addDebugLog('[퍼펙트 가드] 턴 종료 시 퍼펙트 가드 조건을 확인합니다.');
    
    this.gameState.players.forEach(player => {
      const startHp = this.lastTurnHpChanges.get(player.id);
      
      // 디버그 로그: 플레이어별 체력 변화 확인
      this.addDebugLog(`[퍼펙트 가드] ${player.name} (ID: ${player.id}) 체력 변화 확인:`);
      this.addDebugLog(`  - 턴 시작 시 체력: ${startHp}`);
      this.addDebugLog(`  - 현재 체력: ${player.hp}`);
      this.addDebugLog(`  - 체력 변화: ${startHp !== undefined ? (player.hp - startHp) : '알 수 없음'}`);
      this.addDebugLog(`  - 현재 방어 게이지: ${player.defenseGauge}/${player.maxDefenseGauge}`);
      this.addDebugLog(`  - 공격을 받았는가: ${player.wasAttacked}`);
      this.addDebugLog(`  - 방어를 사용했는가: ${player.hasDefended}`);
      
      // 퍼펙트 가드 조건 확인
      const hasNoHpChange = startHp !== undefined && startHp === player.hp;
      const hasDefenseGaugeSpace = player.defenseGauge < player.maxDefenseGauge;
      const wasAttackedThisTurn = player.wasAttacked;
      const hasDefended = player.hasDefended;
      
      this.addDebugLog(`[퍼펙트 가드] ${player.name} 조건 확인:`);
      this.addDebugLog(`  - 체력 변화 없음: ${hasNoHpChange}`);
      this.addDebugLog(`  - 방어 게이지 여유 있음: ${hasDefenseGaugeSpace}`);
      this.addDebugLog(`  - 이번 턴에 공격받음: ${wasAttackedThisTurn}`);
      this.addDebugLog(`  - 방어를 사용함: ${hasDefended}`);
      
      // 퍼펙트 가드 조건: [방어 선택] + [공격받음] + [체력 변화 없음]
      if (hasDefended && wasAttackedThisTurn && hasNoHpChange && hasDefenseGaugeSpace) {
        this.addDebugLog(`[퍼펙트 가드] ${player.name}에게 퍼펙트 가드가 적용됩니다!`);
        
        // 방어 게이지 증가
        const oldDefenseGauge = player.defenseGauge;
        player.defenseGauge++;
        
        this.addDebugLog(`[퍼펙트 가드] ${player.name} 방어 게이지 증가: ${oldDefenseGauge} → ${player.defenseGauge}`);
        
        // 퍼펙트 가드 이벤트 발생
        const event: ModifiableEvent = {
          type: GameEventType.PERFECT_GUARD,
          timestamp: Date.now(),
          data: { 
            player: player.id,
            playerName: player.name,
            oldDefenseGauge,
            newDefenseGauge: player.defenseGauge,
            startHp,
            currentHp: player.hp
          },
          cancelled: false,
          modified: false
        };
        
        this.addDebugLog(`[퍼펙트 가드] ${player.name}에 대한 퍼펙트 가드 이벤트를 발생시킵니다.`);
        this.eventSystem.emit(event);
      } else {
        this.addDebugLog(`[퍼펙트 가드] ${player.name}는 퍼펙트 가드 조건을 만족하지 않습니다.`);
        
        // 조건별 상세 로그
        if (!hasDefended) {
          this.addDebugLog(`  - 이유: 방어를 사용하지 않았습니다`);
        }
        if (!wasAttackedThisTurn) {
          this.addDebugLog(`  - 이유: 이번 턴에 공격을 받지 않았습니다`);
        }
        if (!hasNoHpChange) {
          this.addDebugLog(`  - 이유: 체력이 변화했습니다 (${startHp} → ${player.hp})`);
        }
        if (!hasDefenseGaugeSpace) {
          this.addDebugLog(`  - 이유: 방어 게이지가 최대입니다 (${player.defenseGauge}/${player.maxDefenseGauge})`);
        }
      }
    });
    
    this.addDebugLog('[퍼펙트 가드] 모든 플레이어의 퍼펙트 가드 확인이 완료되었습니다.');
  }

  private async syncGameState(): Promise<void> {
    // 게임 상태를 AbilityManager에 동기화
    this.abilityManager.setGameState({
      players: this.gameState.players
    });
    this.addDebugLog('[상태 동기화] 게임 상태가 AbilityManager에 동기화되었습니다.');
  }

  private addDebugLog(message: string): void {
    this.debugLogs.push(message);
    this.debug.logEvent('Debug', { message });
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

  // 턴 처리 전 백업
  async backupCurrentTurn(): Promise<void> {
    const currentTurn = this.gameState.currentTurn;
    const backupDir = `src/data/history/Turn_${currentTurn}`;
    
    try {
      // 1. 게임 상태 백업
      const gameData = await DataManager.loadGameSession();
      await DataManager.saveGameSnapshot({
        gameState: gameData,
        abilityStates: await this.captureAbilityStates(),
        metadata: {
          timestamp: Date.now(),
          turnNumber: currentTurn
        }
      });
      
      console.log(`Turn ${currentTurn} 백업 완료`);
    } catch (error) {
      console.error(`Turn ${currentTurn} 백업 실패:`, error);
    }
  }

  // 능력 상태 캡처
  private async captureAbilityStates(): Promise<Record<string, any>> {
    const states: Record<string, any> = {};
    const players = this.gameState.players;

    for (const player of players) {
      if (player.ability !== '없음') {
        const ability = this.abilityManager.getPlayerAbility(player.id);
        if (ability) {
          states[`${player.id}_${ability.id}`] = await DataManager.loadAbilityData(player.id, ability.id);
        }
      }
    }

    return states;
  }

  async processTurn(actions: PlayerAction[]): Promise<TurnResult> {
    // 1. 현재 턴 백업
    await this.backupCurrentTurn();
    
    // 2. 기존 턴 처리 로직
    const result = await this.processActionsInternal(actions);
    
    // 3. 새로운 게임 상태 저장
    const sessionData: GameSessionData = {
      players: this.gameState.players,
      currentTurn: this.gameState.currentTurn,
      lastUpdated: new Date().toISOString()
    };
    await DataManager.saveGameSession(sessionData);
    
    return result;
  }

  private async processActionsInternal(actions: PlayerAction[]): Promise<TurnResult> {
    const logs: string[] = [];
    const turnNumber = this.gameState.currentTurn + 1;

    // 디버그 로그 추가
    this.addDebugLog(`[턴 시작] ${turnNumber}턴이 시작됩니다.`);

    logs.push(`=== 턴 ${turnNumber} 시작 ===`);
    logs.push(`입력된 행동 수: ${actions.length}`);
    logs.push(`현재 생존자 수: ${this.gameState.players.filter(p => p.status !== PlayerStatus.DEAD).length}`);

    // 턴 시작 시 플래그 초기화
    this.gameState.players.forEach(player => {
      player.wasAttacked = false;
      player.hasDefended = false;
      this.addDebugLog(`[턴 시작] ${player.name}의 플래그 초기화: wasAttacked=false, hasDefended=false`);
    });

    // 1. 턴 시작 이벤트
    const turnStartEvent: ModifiableEvent = {
      type: GameEventType.TURN_START,
      timestamp: Date.now(),
      data: { 
        turn: turnNumber,
        players: this.gameState.players
      },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(turnStartEvent);

    // 2. 액션 처리
    await this.processActions(actions, logs);

    // 3. 상태 효과 업데이트
    this.updateStatusEffects(logs);

    // 4. 데스존 체크
    const isDeathZone = this.checkDeathZone(turnNumber, logs);

    // 5. 게임 상태 업데이트
    this.updateGameState(turnNumber, logs, isDeathZone);

    // 6. 턴 종료 이벤트
    const turnEndEvent: ModifiableEvent = {
      type: GameEventType.TURN_END,
      timestamp: Date.now(),
      data: { 
        turn: turnNumber,
        players: this.gameState.players
      },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(turnEndEvent);

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

      // 액션 타입 설정
      player.actionType = action.actionType;
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

    // 회피카운트 변화 로직 추가
    this.addDebugLog('[회피카운트] 모든 액션 처리 후 회피카운트 변화를 적용합니다.');
    this.gameState.players.forEach(player => {
      if (player.status === PlayerStatus.DEAD) return;
      
      const oldEvadeCount = player.evadeCount;
      
      if (player.actionType === 'EVADE') {
        // +1
        player.evadeCount++;
        this.addDebugLog(`[회피카운트] ${player.name}의 회피카운트: ${oldEvadeCount} → ${player.evadeCount} (회피 선택으로 +1)`);
        logs.push(`${player.name}의 회피카운트가 증가했습니다. (현재 회피카운트: ${player.evadeCount})`);
      } else if (player.actionType === 'DEFEND') {
        // +0 (변화 없음)
        this.addDebugLog(`[회피카운트] ${player.name}의 회피카운트: ${oldEvadeCount} (방어 선택으로 변화 없음)`);
      } else if (player.actionType === 'ATTACK' || player.actionType === 'ABILITY') {
        // 그외: -1
        player.evadeCount = Math.max(0, player.evadeCount - 1);
        this.addDebugLog(`[회피카운트] ${player.name}의 회피카운트: ${oldEvadeCount} → ${player.evadeCount} (${player.actionType} 액션으로 -1)`);
        if (oldEvadeCount !== player.evadeCount) {
          logs.push(`${player.name}의 회피카운트가 감소했습니다. (현재 회피카운트: ${player.evadeCount})`);
        }
      } else {
        // 액션 타입이 없는 경우 (기본적으로 -1)
        player.evadeCount = Math.max(0, player.evadeCount - 1);
        this.addDebugLog(`[회피카운트] ${player.name}의 회피카운트: ${oldEvadeCount} → ${player.evadeCount} (액션 없음으로 -1)`);
        if (oldEvadeCount !== player.evadeCount) {
          logs.push(`${player.name}의 회피카운트가 감소했습니다. (현재 회피카운트: ${player.evadeCount})`);
        }
      }
    });
  }

  private async processAttack(attacker: Player, target: Player, logs: string[]): Promise<void> {
    this.addDebugLog(`[공격 처리] ${attacker.name}이(가) ${target.name}을(를) 공격합니다.`);
    
    // Before Attack 이벤트 발생
    const beforeAttackEvent: ModifiableEvent = {
      type: GameEventType.BEFORE_ATTACK,
      timestamp: Date.now(),
      data: { attacker: attacker.id, target: target.id, damage: 1 },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(beforeAttackEvent);

    // 이벤트가 취소되었으면 중단
    if (beforeAttackEvent.cancelled) {
      this.addDebugLog(`[공격 처리] ${attacker.name}의 공격이 취소되었습니다.`);
      logs.push(`${attacker.name}의 공격이 취소되었습니다.`);
      return;
    }

    // 타겟이 공격을 받았음을 표시
    target.wasAttacked = true;
    this.addDebugLog(`[공격 처리] ${target.name}의 wasAttacked 플래그를 true로 설정합니다.`);

    // 방어 체크 - 방어 선택 시 공격을 확정적으로 무효화
    if (target.hasDefended) {
      this.addDebugLog(`[공격 처리] ${target.name}이(가) 방어를 시도합니다.`);
      
      if (target.defenseGauge > 0) {
        // 방어게이지가 있으면 소모하고 공격 무효화
        target.defenseGauge--;
        this.addDebugLog(`[공격 처리] ${target.name}이(가) 방어게이지를 소모하여 공격을 무효화합니다.`);
        logs.push(`${target.name}이(가) 방어로 공격을 무효화했습니다! (남은 방어게이지: ${target.defenseGauge})`);
      } else {
        // 방어게이지가 없어도 방어는 성공 (규칙 우선)
        this.addDebugLog(`[공격 처리] ${target.name}이(가) 방어게이지 없이도 방어에 성공합니다.`);
        logs.push(`${target.name}이(가) 방어로 공격을 무효화했습니다! (방어게이지 부족했지만 방어 성공)`);
      }
      
      // 방어 이벤트 발생
      const defendEvent: ModifiableEvent = {
        type: GameEventType.DEFEND_ACTION,
        timestamp: Date.now(),
        data: {
          player: target.id,
          defenseGauge: target.defenseGauge,
          damageReduction: 1
        },
        cancelled: false,
        modified: false
      };
      await this.eventSystem.emit(defendEvent);
      return; // 데미지 없음
    }

    // Before Evade 이벤트 발생
    const beforeEvadeEvent: ModifiableEvent = {
      type: GameEventType.BEFORE_EVADE,
      timestamp: Date.now(),
      data: { player: target.id, attacker: attacker.id },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(beforeEvadeEvent);

    // 회피 판정
    const evadeChance = 5 * (this.gameState.players.filter(p => p.status !== PlayerStatus.DEAD).length - target.evadeCount * 2);
    const isEvadeSuccess = Math.random() * 100 < evadeChance;
    
    this.addDebugLog(`[공격 처리] ${target.name}의 회피 판정: ${evadeChance}% 확률, 성공: ${isEvadeSuccess}`);

    // After Evade 이벤트 발생
    const afterEvadeEvent: ModifiableEvent = {
      type: GameEventType.AFTER_EVADE,
      timestamp: Date.now(),
      data: {
        player: target.id,
        attacker: attacker.id,
        success: isEvadeSuccess
      },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(afterEvadeEvent);

    if (isEvadeSuccess) {
      this.addDebugLog(`[공격 처리] ${target.name}이(가) 회피에 성공했습니다.`);
      logs.push(`${target.name}이(가) 회피에 성공했습니다!`);
      return;
    }

    // 데미지 적용
    const finalDamage = beforeAttackEvent.data.damage;
    const oldHp = target.hp;
    target.hp -= finalDamage;
    
    this.addDebugLog(`[공격 처리] ${target.name}에게 데미지 적용: ${oldHp} → ${target.hp} (데미지: ${finalDamage})`);

    // After Attack 이벤트 발생
    const afterAttackEvent: ModifiableEvent = {
      type: GameEventType.AFTER_ATTACK,
      timestamp: Date.now(),
      data: {
        attacker: attacker.id, 
        target: target.id,
        damage: finalDamage 
      },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(afterAttackEvent);

    logs.push(`${attacker.name}이(가) ${target.name}에게 ${finalDamage}의 데미지를 입혔습니다.`);

    // 사망 체크
    if (target.hp <= 0) {
      this.addDebugLog(`[공격 처리] ${target.name}이(가) 사망했습니다.`);
      target.status = PlayerStatus.DEAD;
      const deathEvent: ModifiableEvent = {
        type: GameEventType.DEATH,
        timestamp: Date.now(),
        data: { player: target.id, killer: attacker.id },
        cancelled: false,
        modified: false
      };
      await this.eventSystem.emit(deathEvent);
      logs.push(`${target.name}이(가) 탈락했습니다.`);
    }
  }

  private async processDefend(player: Player, logs: string[]): Promise<void> {
    this.addDebugLog(`[방어 처리] ${player.name}이(가) 방어를 시도합니다.`);
    
    // Before Defend 이벤트 발생
    const beforeDefendEvent: ModifiableEvent = {
      type: GameEventType.BEFORE_DEFEND,
      timestamp: Date.now(),
      data: { player: player.id },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(beforeDefendEvent);

    // 이벤트가 취소되었으면 중단
    if (beforeDefendEvent.cancelled) {
      this.addDebugLog(`[방어 처리] ${player.name}의 방어가 취소되었습니다.`);
      logs.push(`${player.name}의 방어가 취소되었습니다.`);
      return;
    }

    // 방어 사용 플래그 설정 (방어게이지 소모는 공격받을 때만)
    player.hasDefended = true;
    this.addDebugLog(`[방어 처리] ${player.name}의 hasDefended 플래그를 true로 설정합니다.`);
    this.addDebugLog(`[방어 처리] ${player.name}의 현재 방어게이지: ${player.defenseGauge}/${player.maxDefenseGauge}`);

    // After Defend 이벤트 발생
    const afterDefendEvent: ModifiableEvent = {
      type: GameEventType.AFTER_DEFEND,
      timestamp: Date.now(),
      data: { 
        player: player.id,
        defenseGauge: player.defenseGauge
      },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(afterDefendEvent);
    
    this.addDebugLog(`[방어 처리] ${player.name}의 방어 처리가 완료되었습니다.`);
  }

  private async processEvade(player: Player, logs: string[]): Promise<void> {
    // 회피 행동 이벤트 발생
    const evadeEvent: ModifiableEvent = {
      type: GameEventType.EVADE_ACTION,
      timestamp: Date.now(),
      data: { player: player.id },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(evadeEvent);

    // 회피카운트 증가는 processActions에서 처리
    this.addDebugLog(`[회피 처리] ${player.name}이(가) 회피를 선택했습니다.`);
  }

  private async processPass(player: Player, logs: string[]): Promise<void> {
    // 패스 행동 이벤트 발생
    const passEvent: ModifiableEvent = {
      type: GameEventType.PASS_ACTION,
      timestamp: Date.now(),
      data: { player: player.id },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(passEvent);

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

    const abilityEvent: ModifiableEvent = {
      type: GameEventType.ABILITY_USE,
      timestamp: Date.now(),
      data: {
        player: player.id,
        abilityId,
        target: target.id,
        players: this.gameState.players
      },
      cancelled: false,
      modified: false
    };
    await this.eventSystem.emit(abilityEvent);
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
import { TurnProcessor } from './turnProcessor';
import { EventSystem } from '../EventSystem';
import { GameEventType } from '../events';
import { Player, PlayerStatus, PlayerAction, GameState } from '../types/game.types';

describe('TurnProcessor Event System Tests', () => {
  let turnProcessor: TurnProcessor;
  let eventSystem: EventSystem;
  let gameState: GameState;
  let capturedEvents: any[];

  beforeEach(() => {
    // 테스트용 플레이어 데이터
    const players: Player[] = [
      {
        id: 1,
        name: '디버거',
        hp: 5,
        maxHp: 5,
        defenseGauge: 3,
        maxDefenseGauge: 3,
        evadeCount: 0,
        abilityId: 'debug_logger',
        status: PlayerStatus.ALIVE,
        statusEffects: [],
        isPerfectGuard: false,
        defense: 3,
        maxDefense: 3,
        evasion: 0,
        attack: 1,
        ability: '디버그 로거',
        abilityUses: 1,
        maxAbilityUses: 1,
        pendingDefenseHeal: 0,
        hasDefended: false,
        wasAttacked: false,
        isAbilitySealed: false,
        isDefenseSealed: false,
        damageReduction: 0,
        isGhost: false,
        currentTurn: 1,
        noDamageTurns: 0,
        inactiveTurns: 0
      },
      {
        id: 2,
        name: '플레이어1',
        hp: 5,
        maxHp: 5,
        defenseGauge: 3,
        maxDefenseGauge: 3,
        evadeCount: 0,
        abilityId: 'none',
        status: PlayerStatus.ALIVE,
        statusEffects: [],
        isPerfectGuard: false,
        defense: 3,
        maxDefense: 3,
        evasion: 0,
        attack: 1,
        ability: '없음',
        abilityUses: 0,
        maxAbilityUses: 0,
        pendingDefenseHeal: 0,
        hasDefended: false,
        wasAttacked: false,
        isAbilitySealed: false,
        isDefenseSealed: false,
        damageReduction: 0,
        isGhost: false,
        currentTurn: 1,
        noDamageTurns: 0,
        inactiveTurns: 0
      }
    ];

    gameState = {
      players,
      currentTurn: 1,
      logs: [],
      isDeathZone: false
    };

    eventSystem = new EventSystem();
    turnProcessor = new TurnProcessor(gameState, eventSystem);

    // 이벤트 캐처 설정
    capturedEvents = [];
    
    // 모든 이벤트 타입에 대해 리스너 등록
    Object.values(GameEventType).forEach(eventType => {
      eventSystem.on(eventType, (event) => {
        capturedEvents.push({
          type: event.type,
          data: event.data,
          timestamp: event.timestamp
        });
        console.log(`[TEST EVENT] ${event.type}:`, event.data);
      });
    });
  });

  test('TURN_START 이벤트가 발생해야 함', async () => {
    const actions: PlayerAction[] = [
      { playerId: 1, targetId: 2, actionType: 'ATTACK' },
      { playerId: 2, targetId: 2, actionType: 'DEFEND' }
    ];

    const result = await turnProcessor.processTurn(actions);

    // TURN_START 이벤트 확인
    const turnStartEvents = capturedEvents.filter(e => e.type === GameEventType.TURN_START);
    expect(turnStartEvents).toHaveLength(1);
    expect(turnStartEvents[0].data.turn).toBe(2);

    console.log('✅ TURN_START 이벤트 발생 확인');
  });

  test('ATTACK 이벤트가 발생해야 함', async () => {
    const actions: PlayerAction[] = [
      { playerId: 1, targetId: 2, actionType: 'ATTACK' },
      { playerId: 2, targetId: 2, actionType: 'PASS' }
    ];

    const result = await turnProcessor.processTurn(actions);

    // ATTACK 이벤트 확인
    const attackEvents = capturedEvents.filter(e => e.type === GameEventType.ATTACK);
    expect(attackEvents).toHaveLength(1);
    expect(attackEvents[0].data.attacker).toBe(1);
    expect(attackEvents[0].data.target).toBe(2);
    expect(attackEvents[0].data.damage).toBe(1);

    console.log('✅ ATTACK 이벤트 발생 확인');
  });

  test('DEFEND 이벤트가 발생해야 함', async () => {
    const actions: PlayerAction[] = [
      { playerId: 1, targetId: 2, actionType: 'ATTACK' },
      { playerId: 2, targetId: 2, actionType: 'DEFEND' }
    ];

    const result = await turnProcessor.processTurn(actions);

    // DEFEND 이벤트 확인
    const defendEvents = capturedEvents.filter(e => e.type === GameEventType.DEFEND);
    expect(defendEvents).toHaveLength(1);
    expect(defendEvents[0].data.player).toBe(2);
    expect(defendEvents[0].data.damageReduction).toBe(1);

    console.log('✅ DEFEND 이벤트 발생 확인');
  });

  test('EVADE 이벤트가 발생해야 함', async () => {
    // 회피 확률을 100%로 만들기 위해 Math.random을 모킹
    const originalRandom = Math.random;
    Math.random = jest.fn(() => 0);

    const actions: PlayerAction[] = [
      { playerId: 1, targetId: 2, actionType: 'ATTACK' },
      { playerId: 2, targetId: 2, actionType: 'EVADE' }
    ];

    const result = await turnProcessor.processTurn(actions);

    // EVADE 이벤트 확인
    const evadeEvents = capturedEvents.filter(e => e.type === GameEventType.EVADE);
    expect(evadeEvents).toHaveLength(1);
    expect(evadeEvents[0].data.player).toBe(2);
    expect(evadeEvents[0].data.success).toBe(true);

    // Math.random 복원
    Math.random = originalRandom;

    console.log('✅ EVADE 이벤트 발생 확인');
  });

  test('DEATH 이벤트가 발생해야 함', async () => {
    // 플레이어2의 체력을 1로 설정
    gameState.players[1].hp = 1;

    const actions: PlayerAction[] = [
      { playerId: 1, targetId: 2, actionType: 'ATTACK' },
      { playerId: 2, targetId: 2, actionType: 'PASS' }
    ];

    const result = await turnProcessor.processTurn(actions);

    // DEATH 이벤트 확인
    const deathEvents = capturedEvents.filter(e => e.type === GameEventType.DEATH);
    expect(deathEvents).toHaveLength(1);
    expect(deathEvents[0].data.player).toBe(2);
    expect(deathEvents[0].data.killer).toBe(1);

    console.log('✅ DEATH 이벤트 발생 확인');
  });

  test('TURN_END 이벤트가 발생해야 함', async () => {
    const actions: PlayerAction[] = [
      { playerId: 1, targetId: 2, actionType: 'ATTACK' },
      { playerId: 2, targetId: 2, actionType: 'DEFEND' }
    ];

    const result = await turnProcessor.processTurn(actions);

    // TURN_END 이벤트 확인
    const turnEndEvents = capturedEvents.filter(e => e.type === GameEventType.TURN_END);
    expect(turnEndEvents).toHaveLength(1);
    expect(turnEndEvents[0].data.turn).toBe(2);

    console.log('✅ TURN_END 이벤트 발생 확인');
  });

  test('디버그 로거 능력이 작동해야 함', async () => {
    // 디버그 로거가 있는 플레이어의 능력 사용
    const actions: PlayerAction[] = [
      { playerId: 1, targetId: 1, actionType: 'ABILITY', abilityId: 'debug_logger' },
      { playerId: 2, targetId: 2, actionType: 'PASS' }
    ];

    const result = await turnProcessor.processTurn(actions);

    // 로그에서 디버그 메시지 확인
    const hasDebugLog = result.logs.some(log => 
      log.includes('[DEBUG]') || log.includes('디버그 로그')
    );
    
    expect(hasDebugLog).toBe(true);
    console.log('✅ 디버그 로거 능력 작동 확인');
    
    // 실제 로그 출력
    console.log('=== 실제 로그 ===');
    result.logs.forEach(log => console.log(log));
  });

  test('이벤트 발생 순서가 올바른지 확인', async () => {
    const actions: PlayerAction[] = [
      { playerId: 1, targetId: 2, actionType: 'ATTACK' },
      { playerId: 2, targetId: 2, actionType: 'DEFEND' }
    ];

    const result = await turnProcessor.processTurn(actions);

    // 이벤트 발생 순서 확인
    const eventTypes = capturedEvents.map(e => e.type);
    
    expect(eventTypes[0]).toBe(GameEventType.TURN_START);
    expect(eventTypes).toContain(GameEventType.DEFEND);
    expect(eventTypes[eventTypes.length - 1]).toBe(GameEventType.TURN_END);

    console.log('✅ 이벤트 발생 순서 확인');
    console.log('이벤트 순서:', eventTypes);
  });

  test('이벤트 데이터 무결성 확인', async () => {
    const actions: PlayerAction[] = [
      { playerId: 1, targetId: 2, actionType: 'ATTACK' },
      { playerId: 2, targetId: 2, actionType: 'PASS' }
    ];

    const result = await turnProcessor.processTurn(actions);

    // 모든 이벤트가 timestamp를 가지고 있는지 확인
    capturedEvents.forEach(event => {
      expect(event.timestamp).toBeDefined();
      expect(typeof event.timestamp).toBe('number');
      expect(event.data).toBeDefined();
    });

    console.log('✅ 이벤트 데이터 무결성 확인');
  });
}); 
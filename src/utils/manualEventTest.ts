// src/utils/manualEventTest.ts
// 브라우저 콘솔에서 직접 실행할 수 있는 테스트 코드

import { TurnProcessor } from './turnProcessor';
import { EventSystem } from './eventSystem';
import { GameEventType, ModifiableEvent } from '../types/game.types';
import { PlayerStatus } from '../types/game.types';
import { GameState } from '../types/game.types';

// 글로벌 테스트 함수
declare global {
  interface Window {
    testEvents: () => void;
    testRollback: () => void;
    testRedo: () => void;
  }
}

// 이벤트 테스트 함수들을 window에 등록
window.testEvents = async function() {
  console.log('🧪 이벤트 시스템 테스트 시작');
  
  const eventSystem = new EventSystem();
  const capturedEvents: ModifiableEvent[] = [];

  // 모든 이벤트 리스너 등록
  Object.values(GameEventType).forEach(eventType => {
    eventSystem.on(eventType, async (event: ModifiableEvent) => {
      capturedEvents.push(event);
      console.log(`📡 [${eventType}]`, event.data);
    });
  });

  const gameState: GameState = {
    players: [
      {
        id: 1,
        name: '플레이어 1',
        hp: 10,
        maxHp: 10,
        defenseGauge: 3,
        maxDefenseGauge: 3,
        evadeCount: 1,
        abilityId: 'multipleStrike',
        status: PlayerStatus.ALIVE,
        ability: '다중 타격',
        abilityUses: 3,
        maxAbilityUses: 3,
        pendingDefenseHeal: 0,
        hasDefended: false,
        wasAttacked: false,
        isAbilitySealed: false,
        isDefenseSealed: false,
        damageReduction: 0,
        isGhost: false,
        defense: 3,
        maxDefense: 3,
        evasion: 1,
        attack: 1,
        statusEffects: [],
        isPerfectGuard: false,
        targetId: undefined,
        actionType: undefined,
        currentTurn: 1,
        noDamageTurns: 0,
        inactiveTurns: 0,
        isInvincible: false,
        customFlags: new Map()
      },
      {
        id: 2,
        name: '플레이어 2',
        hp: 10,
        maxHp: 10,
        defenseGauge: 3,
        maxDefenseGauge: 3,
        evadeCount: 1,
        abilityId: 'sniperRifle',
        status: PlayerStatus.ALIVE,
        ability: 'HS.50 대물 저격소총',
        abilityUses: 3,
        maxAbilityUses: 3,
        pendingDefenseHeal: 0,
        hasDefended: false,
        wasAttacked: false,
        isAbilitySealed: false,
        isDefenseSealed: false,
        damageReduction: 0,
        isGhost: false,
        defense: 3,
        maxDefense: 3,
        evasion: 1,
        attack: 1,
        statusEffects: [],
        isPerfectGuard: false,
        targetId: undefined,
        actionType: undefined,
        currentTurn: 1,
        noDamageTurns: 0,
        inactiveTurns: 0,
        isInvincible: false,
        customFlags: new Map()
      }
    ],
    currentTurn: 1,
    logs: [],
    isDeathZone: false,
    turn: 1,
    survivors: [],
    deathZone: false,
    currentSession: 'test-session',
    statusEffects: new Map(),
    customGameFlags: new Map(),
    delayedEffects: [],
    gameHistory: []
  };

  const turnProcessor = new TurnProcessor(gameState, eventSystem);

  // 테스트 액션: 플레이어1이 플레이어2를 공격, 플레이어2가 방어
  const actions = [
    { playerId: 1, targetId: 2, actionType: 'ATTACK' as const },
    { playerId: 2, targetId: 2, actionType: 'DEFEND' as const }
  ];

  console.log('⚔️ 액션 실행:', actions);
  const result = await turnProcessor.processTurn(actions);

  console.log('📊 결과:');
  console.log('- 발생한 이벤트 수:', capturedEvents.length);
  console.log('- 로그 수:', result.logs.length);
  console.log('- 이벤트 타입들:', capturedEvents.map(e => e.type));
  
  result.logs.forEach(log => console.log('📝', log));
  
  return { capturedEvents, result };
};

window.testRollback = async function() {
  console.log('⏪ 롤백 테스트 시작');
  
  const eventSystem = new EventSystem();
  let eventCount = 0;

  // 모든 전투 이벤트 모니터링
  [GameEventType.ATTACK_ACTION, GameEventType.DEFEND_ACTION, GameEventType.EVADE_ACTION, GameEventType.DEATH].forEach(eventType => {
    eventSystem.on(eventType, async (event: ModifiableEvent) => {
      eventCount++;
      console.log(`⚡ [${eventCount}] ${eventType}:`, event.data);
    });
  });

  const gameState: GameState = {
    players: [
      {
        id: 1,
        name: '공격자',
        hp: 5,
        maxHp: 5,
        defenseGauge: 3,
        maxDefenseGauge: 3,
        evadeCount: 0,
        abilityId: 'none',
        status: PlayerStatus.ALIVE,
        ability: '없음',
        abilityUses: 0,
        maxAbilityUses: 0,
        statusEffects: [],
        isPerfectGuard: false,
        defense: 3,
        maxDefense: 3,
        evasion: 0,
        attack: 1,
        pendingDefenseHeal: 0,
        hasDefended: false,
        wasAttacked: false,
        isAbilitySealed: false,
        isDefenseSealed: false,
        damageReduction: 0,
        isGhost: false,
        currentTurn: 1,
        noDamageTurns: 0,
        inactiveTurns: 0,
        targetId: undefined,
        actionType: undefined,
        isInvincible: false,
        customFlags: new Map()
      },
      {
        id: 2,
        name: '방어자',
        hp: 1,
        maxHp: 5,
        defenseGauge: 0,
        maxDefenseGauge: 3,
        evadeCount: 0,
        abilityId: 'none',
        status: PlayerStatus.ALIVE,
        ability: '없음',
        abilityUses: 0,
        maxAbilityUses: 0,
        statusEffects: [],
        isPerfectGuard: false,
        defense: 3,
        maxDefense: 3,
        evasion: 0,
        attack: 1,
        pendingDefenseHeal: 0,
        hasDefended: false,
        wasAttacked: false,
        isAbilitySealed: false,
        isDefenseSealed: false,
        damageReduction: 0,
        isGhost: false,
        currentTurn: 1,
        noDamageTurns: 0,
        inactiveTurns: 0,
        targetId: undefined,
        actionType: undefined,
        isInvincible: false,
        customFlags: new Map()
      }
    ],
    currentTurn: 1,
    logs: [],
    isDeathZone: false,
    turn: 1,
    survivors: [],
    deathZone: false,
    currentSession: 'test-session',
    statusEffects: new Map(),
    customGameFlags: new Map(),
    delayedEffects: [],
    gameHistory: []
  };

  const turnProcessor = new TurnProcessor(gameState, eventSystem);
  
  // 첫 번째 턴 실행
  console.log('🎮 첫 번째 턴 실행');
  const actions1 = [
    { playerId: 1, targetId: 2, actionType: 'ATTACK' as const }
  ];
  await turnProcessor.processTurn(actions1);

  // 두 번째 턴 실행
  console.log('🎮 두 번째 턴 실행');
  const actions2 = [
    { playerId: 1, targetId: 2, actionType: 'ATTACK' as const }
  ];
  await turnProcessor.processTurn(actions2);

  // 롤백 실행
  console.log('⏪ 롤백 실행');
  const snapshot = eventSystem.rollback(1);
  if (snapshot) {
    console.log('📊 롤백 결과:');
    console.log('- 턴 번호:', snapshot.metadata.turnNumber);
    console.log('- 이벤트 수:', snapshot.eventHistory.length);
    console.log('- 플레이어 상태:', snapshot.gameState.players.map(p => ({
      name: p.name,
      hp: p.hp,
      status: p.status
    })));
  }

  return snapshot;
};

window.testRedo = async function() {
  console.log('⏩ 다시실행 테스트 시작');
  
  const eventSystem = new EventSystem();
  let eventCount = 0;

  // 모든 전투 이벤트 모니터링
  [GameEventType.ATTACK_ACTION, GameEventType.DEFEND_ACTION, GameEventType.EVADE_ACTION, GameEventType.DEATH].forEach(eventType => {
    eventSystem.on(eventType, async (event: ModifiableEvent) => {
      eventCount++;
      console.log(`⚡ [${eventCount}] ${eventType}:`, event.data);
    });
  });

  const gameState: GameState = {
    players: [
      {
        id: 1,
        name: '공격자',
        hp: 5,
        maxHp: 5,
        defenseGauge: 3,
        maxDefenseGauge: 3,
        evadeCount: 0,
        abilityId: 'none',
        status: PlayerStatus.ALIVE,
        ability: '없음',
        abilityUses: 0,
        maxAbilityUses: 0,
        statusEffects: [],
        isPerfectGuard: false,
        defense: 3,
        maxDefense: 3,
        evasion: 0,
        attack: 1,
        pendingDefenseHeal: 0,
        hasDefended: false,
        wasAttacked: false,
        isAbilitySealed: false,
        isDefenseSealed: false,
        damageReduction: 0,
        isGhost: false,
        currentTurn: 1,
        noDamageTurns: 0,
        inactiveTurns: 0,
        targetId: undefined,
        actionType: undefined,
        isInvincible: false,
        customFlags: new Map()
      },
      {
        id: 2,
        name: '방어자',
        hp: 1,
        maxHp: 5,
        defenseGauge: 0,
        maxDefenseGauge: 3,
        evadeCount: 0,
        abilityId: 'none',
        status: PlayerStatus.ALIVE,
        ability: '없음',
        abilityUses: 0,
        maxAbilityUses: 0,
        statusEffects: [],
        isPerfectGuard: false,
        defense: 3,
        maxDefense: 3,
        evasion: 0,
        attack: 1,
        pendingDefenseHeal: 0,
        hasDefended: false,
        wasAttacked: false,
        isAbilitySealed: false,
        isDefenseSealed: false,
        damageReduction: 0,
        isGhost: false,
        currentTurn: 1,
        noDamageTurns: 0,
        inactiveTurns: 0,
        targetId: undefined,
        actionType: undefined,
        isInvincible: false,
        customFlags: new Map()
      }
    ],
    currentTurn: 1,
    logs: [],
    isDeathZone: false,
    turn: 1,
    survivors: [],
    deathZone: false,
    currentSession: 'test-session',
    statusEffects: new Map(),
    customGameFlags: new Map(),
    delayedEffects: [],
    gameHistory: []
  };

  const turnProcessor = new TurnProcessor(gameState, eventSystem);
  
  // 첫 번째 턴 실행
  console.log('🎮 첫 번째 턴 실행');
  const actions1 = [
    { playerId: 1, targetId: 2, actionType: 'ATTACK' as const }
  ];
  await turnProcessor.processTurn(actions1);

  // 롤백 실행
  console.log('⏪ 롤백 실행');
  eventSystem.rollback(1);

  // 다시실행 실행
  console.log('⏩ 다시실행 실행');
  const snapshot = eventSystem.redo(1);
  if (snapshot) {
    console.log('📊 다시실행 결과:');
    console.log('- 턴 번호:', snapshot.metadata.turnNumber);
    console.log('- 이벤트 수:', snapshot.eventHistory.length);
    console.log('- 플레이어 상태:', snapshot.gameState.players.map(p => ({
      name: p.name,
      hp: p.hp,
      status: p.status
    })));
  }

  return snapshot;
};

// 사용 방법 안내
console.log(`
🧪 이벤트 테스트 함수들이 준비되었습니다!

사용법:
1. window.testEvents() - 전체 이벤트 시스템 테스트
2. window.testRollback() - 롤백 기능 테스트
3. window.testRedo() - 다시실행 기능 테스트

브라우저 콘솔에서 위 함수들을 실행해보세요!
`);

// React 컴포넌트에서 사용할 수 있는 훅
export function useEventTesting() {
  const runEventTest = () => {
    if (typeof window !== 'undefined' && window.testEvents) {
      return window.testEvents();
    }
  };

  const runRollbackTest = () => {
    if (typeof window !== 'undefined' && window.testRollback) {
      return window.testRollback();
    }
  };

  const runRedoTest = () => {
    if (typeof window !== 'undefined' && window.testRedo) {
      return window.testRedo();
    }
  };

  return { runEventTest, runRollbackTest, runRedoTest };
} 
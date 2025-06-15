// src/utils/manualEventTest.ts
// 브라우저 콘솔에서 직접 실행할 수 있는 테스트 코드

import { TurnProcessor } from './turnProcessor';
import { EventSystem } from '../EventSystem';
import { GameEventType } from '../events';
import { PlayerStatus } from '../types/game.types';

// 글로벌 테스트 함수
declare global {
  interface Window {
    testEvents: () => void;
    testDebugLogger: () => void;
    testCombat: () => void;
  }
}

// 이벤트 테스트 함수들을 window에 등록
window.testEvents = async function() {
  console.log('🧪 이벤트 시스템 테스트 시작');
  
  const eventSystem = new EventSystem();
  const capturedEvents: any[] = [];

  // 모든 이벤트 리스너 등록
  Object.values(GameEventType).forEach(eventType => {
    eventSystem.on(eventType, (event) => {
      capturedEvents.push(event);
      console.log(`📡 [${eventType}]`, event.data);
    });
  });

  const gameState = {
    players: [
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
        ability: '디버그 로거',
        abilityUses: 1,
        maxAbilityUses: 1,
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
        inactiveTurns: 0
      }
    ],
    currentTurn: 1,
    logs: [],
    isDeathZone: false
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

window.testDebugLogger = async function() {
  console.log('🐛 디버그 로거 테스트 시작');
  
  const eventSystem = new EventSystem();
  
  // TURN_START 이벤트 리스너만 등록
  eventSystem.on(GameEventType.TURN_START, (event) => {
    console.log('🎯 TURN_START 이벤트 감지!', event.data);
  });

  const gameState = {
    players: [
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
        ability: '디버그 로거',
        abilityUses: 1,
        maxAbilityUses: 1,
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
        inactiveTurns: 0
      }
    ],
    currentTurn: 1,
    logs: [],
    isDeathZone: false
  };

  const turnProcessor = new TurnProcessor(gameState, eventSystem);
  
  // 디버그 로거가 능력 사용
  const actions = [
    { playerId: 1, targetId: 1, actionType: 'ABILITY' as const, abilityId: 'debug_logger' }
  ];

  console.log('🎮 디버그 로거 능력 사용');
  const result = await turnProcessor.processTurn(actions);
  
  console.log('📋 결과 로그:');
  result.logs.forEach(log => console.log('📝', log));
  
  return result;
};

window.testCombat = async function() {
  console.log('⚔️ 전투 시스템 테스트 시작');
  
  const eventSystem = new EventSystem();
  let eventCount = 0;

  // 모든 전투 이벤트 모니터링
  [GameEventType.ATTACK, GameEventType.DEFEND, GameEventType.EVADE, GameEventType.DEATH].forEach(eventType => {
    eventSystem.on(eventType, (event) => {
      eventCount++;
      console.log(`⚡ [${eventCount}] ${eventType}:`, event.data);
    });
  });

  const gameState = {
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
        inactiveTurns: 0
      },
      {
        id: 2,
        name: '방어자',
        hp: 1, // 체력을 1로 설정해서 죽게 만들기
        maxHp: 5,
        defenseGauge: 0, // 방어게이지 없음
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
        inactiveTurns: 0
      }
    ],
    currentTurn: 1,
    logs: [],
    isDeathZone: false
  };

  const turnProcessor = new TurnProcessor(gameState, eventSystem);
  
  // 공격자가 방어자를 공격 (방어자는 방어게이지 없고 체력 1이라 죽음)
  const actions = [
    { playerId: 1, targetId: 2, actionType: 'ATTACK' as const },
    { playerId: 2, targetId: 2, actionType: 'PASS' as const }
  ];

  console.log('💥 치명적 공격 실행');
  const result = await turnProcessor.processTurn(actions);
  
  console.log(`📊 총 ${eventCount}개의 이벤트 발생`);
  console.log('📋 결과 로그:');
  result.logs.forEach(log => console.log('📝', log));
  
  return result;
};

// 사용 방법 안내
console.log(`
🧪 이벤트 테스트 함수들이 준비되었습니다!

사용법:
1. window.testEvents() - 전체 이벤트 시스템 테스트
2. window.testDebugLogger() - 디버그 로거 능력 테스트  
3. window.testCombat() - 전투 시스템 이벤트 테스트

브라우저 콘솔에서 위 함수들을 실행해보세요!
`);

// React 컴포넌트에서 사용할 수 있는 훅
export function useEventTesting() {
  const runEventTest = () => {
    if (typeof window !== 'undefined' && window.testEvents) {
      return window.testEvents();
    }
  };

  const runDebugTest = () => {
    if (typeof window !== 'undefined' && window.testDebugLogger) {
      return window.testDebugLogger();
    }
  };

  const runCombatTest = () => {
    if (typeof window !== 'undefined' && window.testCombat) {
      return window.testCombat();
    }
  };

  return { runEventTest, runDebugTest, runCombatTest };
} 
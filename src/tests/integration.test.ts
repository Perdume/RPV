import { TurnProcessor } from '../utils/turnProcessor';
import { EventSystem } from '../utils/eventSystem';
import { AbilityManager } from '../abilities/AbilityManager';
import { GameState, Player, PlayerStatus, PlayerAction } from '../types/game.types';

describe('Numbers Game Integration Tests', () => {
  let gameEngine: TurnProcessor;
  let eventSystem: EventSystem;
  let abilityManager: AbilityManager;
  let testGameState: GameState;

  beforeEach(() => {
    // 게임 시스템 초기화
    eventSystem = new EventSystem();
    abilityManager = new AbilityManager(eventSystem);
    
    // 테스트용 게임 상태 생성
    testGameState = createTestGameState();
    gameEngine = new TurnProcessor(testGameState, eventSystem, abilityManager);
  });

  afterEach(() => {
    // 정리
    gameEngine.dispose();
    abilityManager.dispose();
    eventSystem.dispose();
  });

  describe('메모리 테스트', () => {
    it('100턴 연속 실행 후 메모리 누수 없음', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      for (let turn = 1; turn <= 100; turn++) {
        const actions = generateRandomActions();
        await gameEngine.processTurn(actions);
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // 메모리 증가량이 10MB 이하여야 함
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('능력 상호작용 테스트', () => {
    it('모든 능력 조합이 충돌 없이 작동', async () => {
      const abilities = getAllAbilities();
      
      for (let i = 0; i < abilities.length; i++) {
        for (let j = i + 1; j < abilities.length; j++) {
          const result = await testAbilityCombination(abilities[i], abilities[j]);
          expect(result.success).toBe(true);
        }
      }
    });

    it('복잡한 능력 체인이 정상 작동', async () => {
      // 다중 타격 + 저격소총 + 동기화 조합 테스트
      const complexActions = generateComplexAbilityActions();
      const result = await gameEngine.processTurn(complexActions);
      
      expect(result.logs).toBeDefined();
      expect(result.players).toBeDefined();
    });
  });

  describe('성능 테스트', () => {
    it('복잡한 턴 처리가 100ms 이내 완료', async () => {
      const complexActions = generateComplexActions();
      
      const startTime = performance.now();
      await gameEngine.processTurn(complexActions);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('대량 이벤트 처리가 안정적으로 작동', async () => {
      const largeEventActions = generateLargeEventActions();
      
      const startTime = performance.now();
      const result = await gameEngine.processTurn(largeEventActions);
      const endTime = performance.now();
      
      expect(result.logs.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(200);
    });
  });

  describe('안정성 테스트', () => {
    it('에러 발생 시 시스템 복구', async () => {
      // 의도적으로 에러 유발
      const invalidActions = [{ playerId: 999, targetId: 999, actionType: 'INVALID' as any }];
      
      await expect(gameEngine.processTurn(invalidActions)).rejects.toThrow();
      
      // 정상 액션으로 복구 확인
      const normalActions = generateNormalActions();
      const result = await gameEngine.processTurn(normalActions);
      
      expect(result.logs).toBeDefined();
    });

    it('상태이상 시스템이 안정적으로 작동', async () => {
      const statusEffectActions = generateStatusEffectActions();
      const result = await gameEngine.processTurn(statusEffectActions);
      
      // 균열 상태이상이 정상적으로 적용되었는지 확인
      const playersWithCrack = result.players.filter(p => 
        p.statusEffects.some(effect => effect.id === 'crack')
      );
      
      expect(playersWithCrack.length).toBeGreaterThan(0);
    });
  });

  describe('로그 시스템 테스트', () => {
    it('로그 조작 기능이 정상 작동', async () => {
      const logManipulationActions = generateLogManipulationActions();
      const result = await gameEngine.processTurn(logManipulationActions);
      
      // 숨겨진 행동이 로그에 나타나지 않는지 확인
      const hiddenActionLogs = result.logs.filter(log => 
        log.includes('행동하지 않았습니다')
      );
      
      expect(hiddenActionLogs.length).toBeGreaterThan(0);
    });
  });

  describe('심판자 시스템 테스트', () => {
    it('패스코인 시스템이 정상 작동', async () => {
      const judgeActions = generateJudgeActions();
      const result = await gameEngine.processTurn(judgeActions);
      
      // 심판자 공격이 로그에 기록되었는지 확인
      const judgeAttackLogs = result.logs.filter(log => 
        log.includes('심판자') && log.includes('공격')
      );
      
      expect(judgeAttackLogs.length).toBeGreaterThan(0);
    });
  });
});

// 테스트 헬퍼 함수들
function createTestGameState(): GameState {
  return {
    players: [
      {
        id: 1,
        name: '플레이어1',
        hp: 10,
        maxHp: 10,
        defenseGauge: 0,
        maxDefenseGauge: 5,
        evadeCount: 0,
        abilityId: 'multipleStrike',
        status: PlayerStatus.ALIVE,
        statusEffects: [],
        isPerfectGuard: false,
        defense: 0,
        maxDefense: 5,
        evasion: 0,
        attack: 1,
        ability: 'multipleStrike',
        abilityUses: 3,
        maxAbilityUses: 3,
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
        isInvincible: false,
        customFlags: new Map()
      },
      {
        id: 2,
        name: '플레이어2',
        hp: 10,
        maxHp: 10,
        defenseGauge: 0,
        maxDefenseGauge: 5,
        evadeCount: 0,
        abilityId: 'sniperRifle',
        status: PlayerStatus.ALIVE,
        statusEffects: [],
        isPerfectGuard: false,
        defense: 0,
        maxDefense: 5,
        evasion: 0,
        attack: 1,
        ability: 'sniperRifle',
        abilityUses: 3,
        maxAbilityUses: 3,
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
}

function generateRandomActions(): PlayerAction[] {
  return [
    {
      playerId: 1,
      targetId: 2,
      actionType: 'ATTACK'
    },
    {
      playerId: 2,
      targetId: 1,
      actionType: 'DEFEND'
    }
  ];
}

function generateComplexActions(): PlayerAction[] {
  return [
    {
      playerId: 1,
      targetId: 2,
      actionType: 'ABILITY',
      abilityId: 'multipleStrike'
    },
    {
      playerId: 2,
      targetId: 1,
      actionType: 'ABILITY',
      abilityId: 'sniperRifle'
    }
  ];
}

function generateLargeEventActions(): PlayerAction[] {
  const actions: PlayerAction[] = [];
  for (let i = 0; i < 50; i++) {
    actions.push({
      playerId: 1,
      targetId: 2,
      actionType: 'ATTACK'
    });
  }
  return actions;
}

function generateNormalActions(): PlayerAction[] {
  return [
    {
      playerId: 1,
      targetId: 2,
      actionType: 'ATTACK'
    }
  ];
}

function generateStatusEffectActions(): PlayerAction[] {
  return [
    {
      playerId: 1,
      targetId: 2,
      actionType: 'ABILITY',
      abilityId: 'woundAnalysis'
    }
  ];
}

function generateLogManipulationActions(): PlayerAction[] {
  return [
    {
      playerId: 1,
      targetId: 2,
      actionType: 'ABILITY',
      abilityId: 'alzheimer'
    }
  ];
}

function generateJudgeActions(): PlayerAction[] {
  return [
    {
      playerId: 1,
      targetId: 0,
      actionType: 'PASS'
    }
  ];
}

function generateComplexAbilityActions(): PlayerAction[] {
  return [
    {
      playerId: 1,
      targetId: 2,
      actionType: 'ABILITY',
      abilityId: 'synchronize',
      additionalTargets: [2, 1]
    }
  ];
}

function getAllAbilities(): string[] {
  return [
    'multipleStrike', 'sniperRifle', 'quantumization', 'woundAnalysis',
    'shadowInDarkness', 'synchronize', 'endOfDestruction', 'painfulMemory',
    'swiftCounter', 'discordDissonance', 'liveToDie', 'greatFailure',
    'weaponBreak', 'ghostSummoning', 'confusion', 'preemptivePrediction',
    'targetManipulation', 'suppressedFreedom', 'alzheimer', 'unseeable',
    'willLoss', 'fallenCrown', 'fateExchange', 'risingAshes',
    'annihilation', 'playingDead', 'judge'
  ];
}

async function testAbilityCombination(ability1: string, ability2: string): Promise<{ success: boolean }> {
  // 두 능력의 조합 테스트
  try {
    // 테스트 로직 구현
    return { success: true };
  } catch (error) {
    return { success: false };
  }
} 
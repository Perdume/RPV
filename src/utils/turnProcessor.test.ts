import { TurnProcessor } from './turnProcessor';
import { EventSystem } from './eventSystem';
import { StatusEffectManager } from './StatusEffectManager';
import { AbilityManager } from '../abilities/AbilityManager';
import { GameEventType, GameState, Player, PlayerAction, PlayerStatus } from '../types/game.types';

// 위키 규칙 기준 테스트: https://github.com/Perdume/Numbers-game/wiki

function createPlayer(id: number, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: `P${id}`,
    hp: 7,
    maxHp: 7,
    defenseGauge: 3,
    maxDefenseGauge: 3,
    evadeCount: 0,
    abilityId: '',
    status: PlayerStatus.ALIVE,
    statusEffects: [],
    isPerfectGuard: false,
    defense: 0,
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
    currentTurn: 0,
    noDamageTurns: 0,
    inactiveTurns: 0,
    isInvincible: false,
    customFlags: new Map(),
    ...overrides
  };
}

// completedTurns: 이미 끝난 턴 수 (다음에 처리하는 턴 = completedTurns + 1)
function createGameState(players: Player[], completedTurns: number): GameState {
  return {
    players,
    currentTurn: completedTurns,
    logs: [],
    isDeathZone: false,
    turn: completedTurns,
    survivors: [],
    deathZone: false,
    currentSession: 'test',
    statusEffects: new Map(),
    customGameFlags: new Map(),
    delayedEffects: [],
    gameHistory: []
  };
}

const attack = (playerId: number, targetId: number): PlayerAction => ({ playerId, targetId, actionType: 'ATTACK' });
const defend = (playerId: number): PlayerAction => ({ playerId, targetId: playerId, actionType: 'DEFEND' });
const evade = (playerId: number): PlayerAction => ({ playerId, targetId: playerId, actionType: 'EVADE' });
const pass = (playerId: number): PlayerAction => ({ playerId, targetId: playerId, actionType: 'PASS' });
const useAbility = (playerId: number, targetId: number, abilityId?: string): PlayerAction =>
  ({ playerId, targetId, actionType: 'ABILITY', abilityId });

describe('TurnProcessor (위키 규칙)', () => {
  let eventSystem: EventSystem;
  let statusEffects: StatusEffectManager;
  let abilityManager: AbilityManager;
  let processor: TurnProcessor;
  let players: Player[];

  // 기본값: 5턴이 끝난 상태에서 6턴 처리 (초반 보호·데스존·극한 미적용, 집중 공격 적용)
  function setup(playerCount: number, completedTurns: number = 5, overrides: Record<number, Partial<Player>> = {}): Player[] {
    players = Array.from({ length: playerCount }, (_, index) => createPlayer(index + 1, overrides[index + 1]));
    processor = new TurnProcessor(createGameState(players, completedTurns), eventSystem, abilityManager);
    return [...players];
  }

  const byNumber = (id: number): Player => players.find(p => p.id === id)!;
  const emittedTypes = (): GameEventType[] => eventSystem.getEventHistory().map(event => event.type);

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    eventSystem = new EventSystem();
    statusEffects = StatusEffectManager.initializeWithEventSystem(eventSystem);
    statusEffects.clearAllStatusEffects();
    abilityManager = new AbilityManager(eventSystem);
  });

  afterEach(() => {
    processor.dispose();
    abilityManager.dispose();
    eventSystem.dispose();
    jest.restoreAllMocks();
  });

  describe('기본 행동', () => {
    it('공격이 성공하면 타겟에게 1의 피해를 가한다', async () => {
      setup(3);

      await processor.processTurn([attack(1, 2)]);

      expect(byNumber(2).hp).toBe(6);
      const beforeAttack = eventSystem.getEventHistory().find(event => event.type === GameEventType.BEFORE_ATTACK);
      expect(beforeAttack?.data).toMatchObject({ attacker: 1, target: 2, damage: 1 });
      expect(emittedTypes()).toContain(GameEventType.AFTER_ATTACK);
    });

    it('방어는 공격을 1회만 무효화하고, 방어 게이지를 소모한다', async () => {
      setup(4);

      await processor.processTurn([defend(1), attack(2, 1), attack(3, 1)]);

      expect(byNumber(1).hp).toBe(6);
      expect(byNumber(1).defenseGauge).toBe(2);
    });

    it('방어 게이지가 없으면 방어에 실패한다', async () => {
      setup(3, 5, { 1: { defenseGauge: 0 } });

      const result = await processor.processTurn([defend(1), attack(2, 1)]);

      expect(byNumber(1).hp).toBe(6);
      expect(result.logs).toContain('P1의 방어게이지가 부족해 방어에 실패했습니다.');
    });

    it('퍼펙트 가드: 방어를 행동하고 공격 타겟이 되었는데 체력 변화가 없으면 방어 게이지를 1 회복한다', async () => {
      setup(3);

      const result = await processor.processTurn([defend(1), attack(2, 1)]);

      expect(byNumber(1).hp).toBe(7);
      expect(byNumber(1).defenseGauge).toBe(3);
      expect(result.logs.some(log => log.startsWith('[퍼펙트 가드] P1'))).toBe(true);
      expect(emittedTypes()).toContain(GameEventType.PERFECT_GUARD);
    });

    it('퍼펙트 가드: 방어를 행동하지 않았다면 체력 변화가 없어도 발동하지 않는다', async () => {
      setup(3, 5, { 1: { defenseGauge: 2 } });
      jest.spyOn(Math, 'random').mockReturnValue(0);

      await processor.processTurn([evade(1), attack(2, 1)]);

      expect(byNumber(1).hp).toBe(7);
      expect(byNumber(1).defenseGauge).toBe(2);
    });

    it('회피 확률은 5 × (생존자 수 − 2 × 회피 카운트)% 이다 - 성공', async () => {
      setup(5);
      // 회피 선언으로 회피 카운트 1 → 5 × (5 − 2) = 15%
      jest.spyOn(Math, 'random').mockReturnValue(0.149);

      const result = await processor.processTurn([evade(1), attack(2, 1)]);

      expect(byNumber(1).hp).toBe(7);
      expect(result.logs).toContain('P1이(가) 회피에 성공했습니다!');
    });

    it('회피 확률은 5 × (생존자 수 − 2 × 회피 카운트)% 이다 - 실패', async () => {
      setup(5);
      jest.spyOn(Math, 'random').mockReturnValue(0.15);

      await processor.processTurn([evade(1), attack(2, 1)]);

      expect(byNumber(1).hp).toBe(6);
    });

    it('회피 카운트: 회피 +1, 방어 +0, 그 외(공격·패스) −1', async () => {
      setup(4, 5, {
        1: { evadeCount: 1 },
        2: { evadeCount: 1 },
        3: { evadeCount: 1 },
        4: { evadeCount: 1 }
      });

      await processor.processTurn([evade(1), defend(2), attack(3, 2), pass(4)]);

      expect(players.map(p => p.evadeCount)).toEqual([2, 1, 0, 0]);
    });

    it('행동을 입력하지 않은 플레이어는 패스로 처리된다', async () => {
      setup(2, 5, { 2: { evadeCount: 2 } });

      await processor.processTurn([]);

      expect(byNumber(2).evadeCount).toBe(1);
    });
  });

  describe('상태이상', () => {
    it('받는 피해 증가는 받는 최종 피해를 수치만큼 늘린다', async () => {
      setup(3);
      statusEffects.applyStatusEffect(2, 'damage_increase', 1, 1);

      await processor.processTurn([attack(1, 2)]);

      expect(byNumber(2).hp).toBe(5);
    });

    it('가하는 피해 감소는 가하는 피해를 수치만큼 줄인다', async () => {
      setup(3);
      statusEffects.applyStatusEffect(1, 'damage_reduction', 1, 1);

      await processor.processTurn([attack(1, 2)]);

      expect(byNumber(2).hp).toBe(7);
    });

    it('균열: 수치가 3 이상이면 턴 종료시 1의 피해를 받고, 남은 턴 수가 다할 때까지 유지된다', async () => {
      setup(2);
      statusEffects.applyStatusEffect(1, 'crack', 3, 3);

      const firstTurn = await processor.processTurn([]);
      expect(byNumber(1).hp).toBe(6);
      expect(statusEffects.getStatusEffect(1, 'crack')).toMatchObject({ stacks: 3, duration: 2 });
      expect(firstTurn.logs.some(log => log.startsWith('[균열] P1'))).toBe(true);
      expect(firstTurn.logs).toContain('[상태이상] P1: 균열 3 (2)');

      await processor.processTurn([]);
      expect(byNumber(1).hp).toBe(5);
      expect(statusEffects.getStatusEffect(1, 'crack')?.duration).toBe(1);

      await processor.processTurn([]);
      expect(byNumber(1).hp).toBe(4);
      expect(statusEffects.hasStatusEffect(1, 'crack')).toBe(false);
    });

    it('균열을 부여받을 때마다 남은 턴 수가 3턴으로 갱신된다', async () => {
      setup(2);
      statusEffects.applyStatusEffect(1, 'crack', 1, 1);
      await processor.processTurn([]);
      expect(statusEffects.getStatusEffect(1, 'crack')?.duration).toBe(2);

      statusEffects.applyStatusEffect(1, 'crack', 1, 1);

      expect(statusEffects.getStatusEffect(1, 'crack')).toMatchObject({ stacks: 2, duration: 3 });
    });

    it('상태이상의 남은 턴 수는 한 턴에 1씩만 감소한다', async () => {
      setup(2);
      statusEffects.applyStatusEffect(1, 'doom_sign', 3, 1);

      await processor.processTurn([]);

      expect(statusEffects.getStatusEffect(1, 'doom_sign')?.duration).toBe(2);
    });

    it('균열 피해로 체력이 0이 되면 탈락한다', async () => {
      setup(2, 5, { 2: { hp: 1 } });
      statusEffects.applyStatusEffect(2, 'crack', 3, 3);

      const result = await processor.processTurn([]);

      expect(byNumber(2).status).toBe(PlayerStatus.DEAD);
      expect(result.logs).toContain('P2이(가) 사망했습니다!');
      expect(emittedTypes()).toContain(GameEventType.AFTER_DEATH);
    });
  });

  describe('특수 규칙', () => {
    it('집중 공격: 3명 이상의 공격 타겟이 되면 이번 턴 받는 피해 1 감소, 다음 턴 가하는 피해 1 증가', async () => {
      setup(4);

      const result = await processor.processTurn([attack(2, 1), attack(3, 1), attack(4, 1)]);
      expect(byNumber(1).hp).toBe(7);
      expect(result.logs.some(log => log.startsWith('[집중 공격] P1'))).toBe(true);
      expect(emittedTypes()).toContain(GameEventType.FOCUS_ATTACK);

      await processor.processTurn([attack(1, 2)]);
      expect(byNumber(2).hp).toBe(5);
    });

    it('집중 공격은 3번째 턴부터 적용된다', async () => {
      setup(4, 1);

      const result = await processor.processTurn([attack(2, 1), attack(3, 1), attack(4, 1)]);

      expect(byNumber(1).hp).toBe(4);
      expect(result.logs.some(log => log.startsWith('[집중 공격]'))).toBe(false);
    });

    it('데스존: 매 5턴마다 생존자의 최대 체력이 1 감소한다', async () => {
      setup(2, 4);

      const fifthTurn = await processor.processTurn([]);
      expect(players.map(p => [p.hp, p.maxHp])).toEqual([[6, 6], [6, 6]]);
      expect(fifthTurn.logs.some(log => log.startsWith('[데스존]'))).toBe(true);

      await processor.processTurn([]);
      expect(players.map(p => p.maxHp)).toEqual([6, 6]);
    });

    it('초반 보호: 2번째 턴까지 체력이 1 아래로 감소하지 않는다', async () => {
      setup(4, 0, { 1: { hp: 2 } });

      await processor.processTurn([attack(2, 1), attack(3, 1), attack(4, 1)]);

      expect(byNumber(1).hp).toBe(1);
      expect(byNumber(1).status).toBe(PlayerStatus.ALIVE);
    });

    it('초반 보호: 2턴 안에 체력이 3 이하로 감소하면 선택지를 한 번 얻는다', async () => {
      setup(3, 0, { 1: { hp: 4 } });

      const firstTurn = await processor.processTurn([attack(2, 1)]);
      expect(firstTurn.earlyProtectionCandidates).toEqual([1]);

      const secondTurn = await processor.processTurn([attack(2, 1)]);
      expect(secondTurn.earlyProtectionCandidates).toEqual([]);

      const thirdTurn = await processor.processTurn([attack(3, 2), attack(1, 2), attack(1, 3)]);
      expect(thirdTurn.earlyProtectionCandidates).toEqual([]);
    });

    it('초반 보호 선택 1: 체력 5 회복 후 다음 턴 운명 교차로 번호를 교체한다 (행동은 그대로)', async () => {
      const [personA, personB, personC] = setup(3, 0, { 1: { hp: 4 } });
      await processor.processTurn([attack(2, 1)]);

      processor.applyEarlyProtection(1, { type: 'heal' });
      expect(personA.hp).toBe(5);

      // A가 3번과 번호를 교체한 뒤, 1번을 노린 B의 공격은 1번이 된 C가 받고, A의 공격은 그대로 2번(B)에게 간다
      const result = await processor.processTurn([useAbility(1, 3, 'fateCross'), attack(1, 2), attack(2, 1)]);

      expect([personA.id, personB.id, personC.id]).toEqual([3, 2, 1]);
      expect(players[0]).toBe(personC);
      expect(personA.hp).toBe(5);
      expect(personB.hp).toBe(6);
      expect(personC.hp).toBe(6);
      expect(result.logs).toContain('[운명 교차] P1과(와) P3의 번호가 교체되었습니다. (1 ↔ 3)');
    });

    it('운명 교차는 초반 보호로 허용된 턴이 아니면 사용할 수 없다', async () => {
      const [personA] = setup(3);

      const result = await processor.processTurn([useAbility(1, 3, 'fateCross')]);

      expect(personA.id).toBe(1);
      expect(result.logs).toContain('P1: 운명 교차를 사용할 수 없습니다.');
    });

    it('초반 보호 선택 2: 특수형 능력(운명 교차, 심판자 제외)으로 교체한다', async () => {
      setup(3, 0, { 1: { hp: 4 } });
      await processor.processTurn([attack(2, 1)]);

      processor.applyEarlyProtection(1, { type: 'replace', abilityId: 'risingAshes' });

      expect(abilityManager.getPlayerAbility(1)?.id).toBe('risingAshes');
      expect(byNumber(1)).toMatchObject({ ability: '다시 불타는 잿더미', abilityUses: 4, maxAbilityUses: 4 });
      expect(processor.getEarlyProtectionAbilityOptions().map(option => option.id))
        .toEqual(['risingAshes', 'annihilation', 'playingDead']);
      expect(() => processor.applyEarlyProtection(1, { type: 'replace', abilityId: 'judge' })).toThrow();
    });

    it('극한: 10번째 턴 이후 생존자가 5명 이하면 매 턴 균열 1을 얻고 회피 카운트가 감소하지 않는다', async () => {
      setup(3, 9, { 1: { evadeCount: 2 } });

      const result = await processor.processTurn([attack(1, 2)]);

      expect(result.logs.some(log => log.startsWith('[극한]'))).toBe(true);
      expect(byNumber(1).evadeCount).toBe(2);
      expect(players.map(p => statusEffects.getStacks(p.id, 'crack'))).toEqual([1, 1, 1]);
    });

    it('극한은 생존자가 6명 이상이면 활성화되지 않는다', async () => {
      setup(6, 9);

      const result = await processor.processTurn([]);

      expect(result.logs.some(log => log.startsWith('[극한]'))).toBe(false);
      expect(statusEffects.getStacks(1, 'crack')).toBe(0);
    });
  });

  describe('능력 사용', () => {
    it('능력을 사용하면 사용 횟수가 1 감소하고, 남은 횟수가 없으면 사용할 수 없다', async () => {
      setup(3, 5, { 1: { abilityUses: 1 } });
      expect(abilityManager.assignAbility(1, '다중 타격')).toBe('multipleStrike');

      await processor.processTurn([useAbility(1, 2, 'multipleStrike')]);
      expect(byNumber(2).hp).toBe(6);
      expect(byNumber(1).abilityUses).toBe(0);

      const result = await processor.processTurn([useAbility(1, 2, 'multipleStrike')]);
      expect(byNumber(2).hp).toBe(6);
      expect(result.logs).toContain('P1: 남은 능력 사용 횟수가 없습니다.');
    });

    it('능력이 봉인되면 사용할 수 없다', async () => {
      setup(3, 5, { 1: { abilityUses: 2, isAbilitySealed: true } });
      abilityManager.assignAbility(1, 'multipleStrike');

      const result = await processor.processTurn([useAbility(1, 2)]);

      expect(byNumber(2).hp).toBe(7);
      expect(result.logs).toContain('P1: 능력이 봉인되어 사용할 수 없습니다.');
    });

    it('로그 형식("<id> -> <id>") 입력은 플레이어의 능력으로 처리한다', async () => {
      setup(3, 5, { 1: { abilityUses: 2 } });
      abilityManager.assignAbility(1, 'multipleStrike');

      await processor.processTurn([useAbility(1, 1, '1 -> 2')]);

      expect(byNumber(2).hp).toBe(6);
      expect(byNumber(1).abilityUses).toBe(1);
    });
  });

  describe('입력 파싱과 턴 이벤트', () => {
    it('능력 로그 입력을 파싱한다', () => {
      setup(2);

      expect(processor.parseAbilityInput('1 -> 3,5')).toMatchObject([
        { playerId: 1, targetId: 3, actionType: 'ATTACK' },
        { playerId: 1, targetId: 5, actionType: 'ATTACK' }
      ]);
      expect(processor.parseAbilityInput('2 -> 4, 방어')[0]).toMatchObject({ playerId: 2, targetId: 4, actionType: 'DEFEND' });
      expect(processor.parseAbilityInput('3 -> 1, 능력, 예측공격')[0]).toMatchObject({
        actionType: 'ABILITY',
        prediction: { action: '예측공격', abilityUse: true }
      });
      expect(processor.parseAbilityInput('잘못된 입력')).toEqual([]);
    });

    it('TURN_START와 TURN_END는 처리하는 턴 번호를 전달하고, 모든 이벤트에 타임스탬프가 있다', async () => {
      setup(2);

      const result = await processor.processTurn([attack(1, 2)]);

      const history = eventSystem.getEventHistory();
      expect(result.turnNumber).toBe(6);
      expect(history[0]).toMatchObject({ type: GameEventType.TURN_START, data: { turn: 6 } });
      expect(history.find(event => event.type === GameEventType.TURN_END)?.data).toMatchObject({ turn: 6 });
      history.forEach(event => expect(typeof event.timestamp).toBe('number'));
    });
  });
});

import { GameEngine } from '../GameEngine';
import { Player, PlayerStatus, Action } from '../types';
import { SPECIAL_ABILITIES } from './special';

describe('Special Abilities', () => {
  let engine: GameEngine;
  let player1: Player;
  let player2: Player;
  let player3: Player;

  beforeEach(() => {
    engine = new GameEngine();
    
    player1 = {
      id: 1,
      name: 'Player 1',
      hp: 3,
      maxHp: 3,
      attack: 1,
      status: PlayerStatus.ALIVE,
      defenseGauge: 2,
      maxDefenseGauge: 3,
      evadeCount: 0,
      ability: '없음',
      abilityUses: 0,
      statusEffects: [],
      pendingDefenseHeal: 0,
      defense: 3,
      maxDefense: 3,
      evasion: 0,
      abilityId: 'none'
    };

    player2 = {
      id: 2,
      name: 'Player 2',
      hp: 3,
      maxHp: 3,
      attack: 1,
      status: PlayerStatus.ALIVE,
      defenseGauge: 2,
      maxDefenseGauge: 3,
      evadeCount: 0,
      ability: '없음',
      abilityUses: 0,
      statusEffects: [],
      pendingDefenseHeal: 0,
      defense: 3,
      maxDefense: 3,
      evasion: 0,
      abilityId: 'none'
    };

    player3 = {
      id: 3,
      name: 'Player 3',
      hp: 3,
      maxHp: 3,
      attack: 1,
      status: PlayerStatus.ALIVE,
      defenseGauge: 2,
      maxDefenseGauge: 3,
      evadeCount: 0,
      ability: '없음',
      abilityUses: 0,
      statusEffects: [],
      pendingDefenseHeal: 0,
      defense: 3,
      maxDefense: 3,
      evasion: 0,
      abilityId: 'none'
    };

    engine.addPlayer(player1);
    engine.addPlayer(player2);
    engine.addPlayer(player3);
  });

  test('타겟 조작: 다른 플레이어의 공격 대상을 변경', async () => {
    engine.assignAbility(player1.id, 'target_manipulation');
    
    player2.action = Action.ATTACK;
    player2.target = player3.id;
    
    await engine.processTurn();
    
    // 타겟 조작 능력이 발동되어 player2의 공격이 player1을 향하게 됨
    expect(player3.hp).toBe(3); // 원래 타겟은 데미지를 받지 않음
    expect(player1.hp).toBe(2); // 새로운 타겟이 데미지를 받음
  });

  test('억압된 자유: 공격을 받을 때마다 공격력 증가', async () => {
    engine.assignAbility(player1.id, 'oppressed_freedom');
    
    // player1이 공격을 받음
    player2.action = Action.ATTACK;
    player2.target = player1.id;
    await engine.processTurn();
    
    // player1이 공격함
    player1.action = Action.ATTACK;
    player1.target = player2.id;
    await engine.processTurn();
    
    expect(player2.hp).toBe(1); // 공격력이 증가하여 2의 데미지를 줌
  });

  test('다중 타격: 여러 대상을 공격', async () => {
    engine.assignAbility(player1.id, 'multi_strike');
    
    player1.action = Action.ATTACK;
    player1.target = player2.id;
    await engine.processTurn();
    
    expect(player2.hp).toBe(1);
    expect(player3.hp).toBe(1); // 추가 타겟도 데미지를 받음
  });

  test('양자화: 데미지 무시 확률', async () => {
    engine.assignAbility(player1.id, 'quantum_state');
    
    // 여러 번 공격을 시도
    for (let i = 0; i < 10; i++) {
      player2.action = Action.ATTACK;
      player2.target = player1.id;
      await engine.processTurn();
    }
    
    // 평균적으로 5번 정도는 데미지를 무시해야 함
    expect(player1.hp).toBeGreaterThan(0);
  });

  test('날렵한 반격: 회피 성공 시 반격', async () => {
    engine.assignAbility(player1.id, 'swift_counter');
    
    player1.action = Action.EVADE;
    player2.action = Action.ATTACK;
    player2.target = player1.id;
    await engine.processTurn();
    
    // 회피에 성공했다면 반격 데미지를 줌
    expect(player2.hp).toBeLessThan(3);
  });

  test('무장 파열: 공격력 증가와 방어 게이지 소진', async () => {
    engine.assignAbility(player1.id, 'weapon_burst');
    
    player1.action = Action.ATTACK;
    player1.target = player2.id;
    await engine.processTurn();
    
    expect(player2.hp).toBe(1); // 공격력이 2배가 되어 2의 데미지를 줌
    expect(player1.defenseGauge).toBe(0); // 방어 게이지가 소진됨
  });

  test('원귀 강령: 죽은 플레이어의 능력 사용', async () => {
    engine.assignAbility(player1.id, 'spirit_summoning');
    
    // player2를 죽임
    player2.hp = 0;
    player2.status = PlayerStatus.DEAD;
    
    // player1이 player2의 능력을 사용
    player1.action = Action.ATTACK;
    player1.target = player3.id;
    await engine.processTurn();
    
    // player2의 능력이 발동되어야 함
    expect(player3.hp).toBeLessThan(3);
  });

  test('초월 방어: 방어 게이지 증가와 데미지 감소', async () => {
    engine.assignAbility(player1.id, 'transcendent_defense');
    
    player1.action = Action.DEFEND;
    await engine.processTurn();
    
    expect(player1.defenseGauge).toBe(6); // 방어 게이지가 6으로 증가
    
    // 공격을 받음
    player2.action = Action.ATTACK;
    player2.target = player1.id;
    await engine.processTurn();
    
    expect(player1.hp).toBe(3); // 데미지가 1 감소되어 데미지를 받지 않음
  });

  test('대실패: 공격 실패 시 다음 공격 데미지 증가', async () => {
    engine.assignAbility(player1.id, 'great_failure');
    
    // 첫 번째 공격 실패
    player1.action = Action.ATTACK;
    player1.target = player2.id;
    player2.defenseGauge = 3; // 방어 게이지로 데미지를 완전히 막음
    await engine.processTurn();
    
    // 두 번째 공격
    player1.action = Action.ATTACK;
    player1.target = player2.id;
    await engine.processTurn();
    
    expect(player2.hp).toBe(0); // 데미지가 2배가 되어 즉사
  });

  test('체인지: HP 교환', async () => {
    engine.assignAbility(player1.id, 'change');
    
    player1.hp = 1;
    player2.hp = 3;
    
    player1.action = Action.ATTACK;
    player1.target = player2.id;
    await engine.processTurn();
    
    // HP가 교환되어야 함
    expect(player1.hp).toBe(3);
    expect(player2.hp).toBe(1);
  });

  test('should have all required ability properties', () => {
    SPECIAL_ABILITIES.forEach(ability => {
      expect(ability).toHaveProperty('id');
      expect(ability).toHaveProperty('name');
      expect(ability).toHaveProperty('description');
      expect(ability).toHaveProperty('cooldown');
      expect(ability).toHaveProperty('maxUses');
      expect(ability).toHaveProperty('onAttack');
      expect(ability).toHaveProperty('onDefend');
      expect(ability).toHaveProperty('onEvade');
      expect(ability).toHaveProperty('onDeath');
      expect(ability).toHaveProperty('onTurnStart');
      expect(ability).toHaveProperty('onTurnEnd');
    });
  });

  test('should have valid ability IDs', () => {
    const validIds = [
      'target_manipulation',
      'oppressed_freedom',
      'multi_strike',
      'perfect_guard',
      'quantum_state'
    ];

    SPECIAL_ABILITIES.forEach(ability => {
      expect(validIds).toContain(ability.id);
    });
  });

  test('should have valid cooldown values', () => {
    SPECIAL_ABILITIES.forEach(ability => {
      expect(ability.cooldown).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(ability.cooldown)).toBe(true);
    });
  });

  test('should have valid max uses values', () => {
    SPECIAL_ABILITIES.forEach(ability => {
      expect(ability.maxUses).toBeGreaterThan(0);
      expect(Number.isInteger(ability.maxUses)).toBe(true);
    });
  });

  test('should have valid ability names', () => {
    SPECIAL_ABILITIES.forEach(ability => {
      expect(ability.name).toBeTruthy();
      expect(typeof ability.name).toBe('string');
    });
  });

  test('should have valid ability descriptions', () => {
    SPECIAL_ABILITIES.forEach(ability => {
      expect(ability.description).toBeTruthy();
      expect(typeof ability.description).toBe('string');
    });
  });
}); 
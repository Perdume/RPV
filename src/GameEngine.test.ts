import { GameEngine } from './GameEngine';
import { Player, PlayerStatus, Action } from './types';

describe('GameEngine', () => {
  let engine: GameEngine;
  let player1: Player;
  let player2: Player;

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

    engine.addPlayer(player1);
    engine.addPlayer(player2);
  });

  test('should process basic attack', async () => {
    player1.action = Action.ATTACK;
    player1.target = player2.id;

    await engine.processTurn();

    expect(player2.hp).toBe(2);
    expect(player2.status).toBe(PlayerStatus.ALIVE);
  });

  test('should process defend action', async () => {
    player1.action = Action.DEFEND;
    await engine.processTurn();

    expect(player1.defenseGauge).toBe(3);
  });

  test('should process evade action', async () => {
    player1.action = Action.EVADE;
    await engine.processTurn();

    expect(player1.status).toBe(PlayerStatus.EVADING);
  });

  test('should handle death', async () => {
    player1.action = Action.ATTACK;
    player1.target = player2.id;
    player2.hp = 1;

    await engine.processTurn();

    expect(player2.hp).toBe(0);
    expect(player2.status).toBe(PlayerStatus.DEAD);
  });

  test('should process death zone', async () => {
    // Simulate 10 turns
    for (let i = 0; i < 10; i++) {
      await engine.processTurn();
    }

    const gameState = engine.getGameState();
    expect(gameState.deathZone.stage).toBe(2);
    expect(gameState.deathZone.maxHpReduction).toBe(2);
  });
}); 
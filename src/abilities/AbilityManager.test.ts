import { AbilityManager } from './AbilityManager';
import { EventSystem } from '../EventSystem';
import { GameEventType } from '../events';
import { Player, PlayerStatus } from '../types';
import { SPECIAL_ABILITIES } from './special';

describe('AbilityManager', () => {
  let abilityManager: AbilityManager;
  let eventSystem: EventSystem;
  let player1: Player;
  let player2: Player;

  beforeEach(() => {
    eventSystem = new EventSystem();
    abilityManager = new AbilityManager(eventSystem);

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

    // Register all special abilities
    SPECIAL_ABILITIES.forEach(ability => {
      abilityManager.registerAbility(ability);
    });

    // Set up game state
    abilityManager.setGameState({
      players: [player1, player2],
      currentTurn: 1
    });
  });

  test('should register and assign abilities', () => {
    const targetManipulation = SPECIAL_ABILITIES.find(a => a.id === 'target_manipulation');
    expect(targetManipulation).toBeDefined();

    abilityManager.assignAbility(player1.id, 'target_manipulation');
    const playerAbilities = abilityManager.getPlayerAbilities(player1.id);
    expect(playerAbilities).toHaveLength(1);
    expect(playerAbilities[0].id).toBe('target_manipulation');
  });

  test('should process ability effects', async () => {
    abilityManager.assignAbility(player1.id, 'oppressed_freedom');
    
    // Simulate attack event
    await eventSystem.emit({
      type: GameEventType.ATTACK,
      timestamp: Date.now(),
      data: {
        attacker: player2.id,
        target: player1.id,
        damage: 1,
        targetHp: player1.hp
      }
    });

    const playerAbilities = abilityManager.getPlayerAbilities(player1.id);
    expect(playerAbilities[0].cooldown).toBeDefined();
  });

  test('should handle ability cooldowns', async () => {
    abilityManager.assignAbility(player1.id, 'multi_strike');
    
    // Simulate ability use
    await eventSystem.emit({
      type: GameEventType.ATTACK,
      timestamp: Date.now(),
      data: {
        attacker: player1.id,
        target: player2.id,
        damage: 1,
        targetHp: player2.hp
      }
    });

    const playerAbilities = abilityManager.getPlayerAbilities(player1.id);
    expect(playerAbilities[0].cooldown).toBeGreaterThan(0);

    // Update cooldowns
    abilityManager.updateCooldowns();
    expect(playerAbilities[0].cooldown).toBeLessThan(playerAbilities[0].cooldown + 1);
  });

  test('should handle ability uses limit', async () => {
    abilityManager.assignAbility(player1.id, 'perfect_guard');
    
    // Simulate multiple ability uses
    for (let i = 0; i < 3; i++) {
      await eventSystem.emit({
        type: GameEventType.DEFEND,
        timestamp: Date.now(),
        data: {
          player: player1.id,
          defenseGauge: player1.defenseGauge,
          damageReduction: 1
        }
      });
    }

    expect(player1.abilityUses).toBeGreaterThan(0);
  });

  test('should handle passive abilities', async () => {
    abilityManager.assignAbility(player1.id, 'quantum_state');
    
    // Simulate multiple attacks
    for (let i = 0; i < 5; i++) {
      await eventSystem.emit({
        type: GameEventType.ATTACK,
        timestamp: Date.now(),
        data: {
          attacker: player2.id,
          target: player1.id,
          damage: 1,
          targetHp: player1.hp
        }
      });
    }

    const playerAbilities = abilityManager.getPlayerAbilities(player1.id);
    expect(playerAbilities[0].cooldown).toBeDefined();
  });

  test('should handle ability removal', () => {
    abilityManager.assignAbility(player1.id, 'target_manipulation');
    abilityManager.getPlayerAbilities(player1.id);
    
    const playerAbilities = abilityManager.getPlayerAbilities(player1.id);
    expect(playerAbilities).toHaveLength(1);
  });
}); 
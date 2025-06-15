import { EventSystem } from '../EventSystem';
import { Player } from '../types/game.types';

export interface AbilityContext {
  player: Player;
  target?: Player;
  players: Player[];
  eventSystem: EventSystem;
  logs: string[];
  variables: Map<string, any>;
  currentTurn: number;
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  maxUses: number;
  cooldown: number;

  use(context: AbilityContext): Promise<void>;
  
  onTurnStart?(context: AbilityContext): Promise<void>;
  onTurnEnd?(context: AbilityContext): Promise<void>;
  onAttack?(context: AbilityContext): Promise<void>;
  onDefend?(context: AbilityContext): Promise<void>;
  onEvade?(context: AbilityContext): Promise<void>;
  onDamage?(context: AbilityContext): Promise<void>;
  onDeath?(context: AbilityContext): Promise<void>;
} 
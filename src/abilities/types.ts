import { PlayerId } from '../types';
import { GameEventType } from '../types/game.types';

export interface AbilityEffect {
  type: string;
  value: any;
  duration?: number;
  target?: PlayerId;
}

export interface AbilityTrigger {
  eventType: GameEventType;
  condition?: (event: any) => boolean;
  priority?: number;
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  maxUses?: number;
  triggers: AbilityTrigger[];
  effects: AbilityEffect[];
  isPassive?: boolean;
  isActive?: boolean;
}

export interface AbilityInstance {
  ability: Ability;
  owner: PlayerId;
  currentCooldown: number;
  remainingUses?: number;
  activeEffects: Map<string, AbilityEffect>;
  variables: Map<string, any>;
}

export interface AbilityManager {
  registerAbility(ability: Ability): void;
  unregisterAbility(abilityId: string): void;
  assignAbility(playerId: PlayerId, abilityId: string): void;
  removeAbility(playerId: PlayerId, abilityId: string): void;
  getPlayerAbilities(playerId: PlayerId): AbilityInstance[];
  processAbilityEffects(playerId: PlayerId): void;
  updateCooldowns(): void;
} 
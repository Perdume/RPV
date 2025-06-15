export enum PlayerStatus {
  ALIVE = 'ALIVE',
  WOUNDED = 'WOUNDED',
  DEAD = 'DEAD'
}

export type ActionType = 'ATTACK' | 'DEFEND' | 'ABILITY' | 'PASS' | 'EVADE';

export interface PlayerAction {
  playerId: number;
  targetId: number;
  actionType: ActionType;
  abilityId?: string;
}

export type PlayerId = number;

export interface DamageEvent {
  attacker: PlayerId;
  target: PlayerId;
  damage: number;
  players: Player[];
}

export interface Player {
  id: number;
  name: string;
  hp: number;
  maxHp: number;
  defenseGauge: number;
  maxDefenseGauge: number;
  evadeCount: number;
  abilityId: string;
  status: PlayerStatus;
  statusEffects: string[];
  isPerfectGuard: boolean;
  defense: number;
  maxDefense: number;
  evasion: number;
  attack: number;
  ability: string;
  abilityUses: number;
  maxAbilityUses: number;
  pendingDefenseHeal: number;
  hasDefended: boolean;
  wasAttacked: boolean;
  isAbilitySealed: boolean;
  isDefenseSealed: boolean;
  damageReduction: number;
  isGhost: boolean;
  targetId?: number;
  actionType?: ActionType;
  currentTurn: number;
  noDamageTurns: number;
  inactiveTurns: number;
}

export interface GameState {
  players: Player[];
  currentTurn: number;
  logs: string[];
  isDeathZone: boolean;
}

export interface TurnResult {
  turnNumber: number;
  actions: PlayerAction[];
  logs: string[];
  players: Player[];
  isDeathZone: boolean;
}

export interface DefendEvent {
  player: PlayerId;
  defenseGauge: number;
  damageReduction: number;
} 
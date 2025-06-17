import { EventSystem } from '../utils/eventSystem';

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
  turn: number;
  survivors: Player[];
  deathZone: boolean;
  currentSession: string;
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

export interface ModifiableEvent {
  type: GameEventType;
  timestamp: number;
  data: any;
  cancelled: boolean;
  modified: boolean;
}

export enum GameEventType {
  // 시스템 이벤트
  GAME_START = 'GAME_START',
  GAME_END = 'GAME_END',
  TURN_START = 'TURN_START',
  TURN_END = 'TURN_END',
  DEATH = 'DEATH',
  PERFECT_GUARD = 'PERFECT_GUARD',
  FOCUS_ATTACK = 'FOCUS_ATTACK',
  
  // Pre/Post 이벤트 패턴
  BEFORE_ATTACK = 'BEFORE_ATTACK',
  AFTER_ATTACK = 'AFTER_ATTACK',
  BEFORE_DEFEND = 'BEFORE_DEFEND',
  AFTER_DEFEND = 'AFTER_DEFEND',
  BEFORE_EVADE = 'BEFORE_EVADE',
  AFTER_EVADE = 'AFTER_EVADE',
  BEFORE_PASS = 'BEFORE_PASS',
  AFTER_PASS = 'AFTER_PASS',
  
  // 행동 이벤트
  ATTACK_ACTION = 'ATTACK_ACTION',
  DEFEND_ACTION = 'DEFEND_ACTION',
  EVADE_ACTION = 'EVADE_ACTION',
  PASS_ACTION = 'PASS_ACTION',
  ABILITY_USE = 'ABILITY_USE',
  
  // 결과 이벤트
  DAMAGE_DEALT = 'DAMAGE_DEALT',
  DEFENSE_CONSUMED = 'DEFENSE_CONSUMED',
  EVADE_SUCCESS = 'EVADE_SUCCESS',
  EVADE_FAIL = 'EVADE_FAIL'
}

export interface GameEvent extends ModifiableEvent {
  // 기존 GameEvent 인터페이스 유지
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  cooldown: number;
  maxCooldown: number;
  maxUses: number;
  updateCooldown(): void;
  onBeforeAttack?(event: ModifiableEvent): Promise<void>;
  onAfterAttack?(event: ModifiableEvent): Promise<void>;
  onBeforeDefend?(event: ModifiableEvent): Promise<void>;
  onAfterDefend?(event: ModifiableEvent): Promise<void>;
  onBeforeEvade?(event: ModifiableEvent): Promise<void>;
  onAfterEvade?(event: ModifiableEvent): Promise<void>;
  onBeforePass?(event: ModifiableEvent): Promise<void>;
  onAfterPass?(event: ModifiableEvent): Promise<void>;
  onTurnStart?(event: ModifiableEvent): Promise<void>;
  onTurnEnd?(event: ModifiableEvent): Promise<void>;
  onGameStart?(event: ModifiableEvent): Promise<void>;
  onGameEnd?(event: ModifiableEvent): Promise<void>;
  onDeath?(event: ModifiableEvent): Promise<void>;
  onPerfectGuard?(event: ModifiableEvent): Promise<void>;
  onFocusAttack?(event: ModifiableEvent): Promise<void>;
}

export interface AbilityContext {
  event: ModifiableEvent;
  player: Player;
  target?: Player;
  players: Player[];
  eventSystem: EventSystem;
  variables: Map<string, any>;
  currentTurn: number;
  logs: string[];
  ability: Ability;
}

export interface GameSessionData {
  players: Player[];
  currentTurn: number;
  lastUpdated: string;
}

export interface AbilityData {
  playerId: number;
  abilityId: string;
  variables: Record<string, any>;
  lastUpdated: string;
}

export interface GameSnapshot {
  gameState: GameSessionData;
  abilityStates: Record<string, any>;
  metadata: {
    timestamp: number;
    turnNumber: number;
  };
}

// 변수 스키마 인터페이스
export interface VariableSchema<T> {
  validate(value: any): value is T;
  defaultValue?: T;
}

// 기본 스키마들
export const schemas = {
  number: {
    validate: (value: any): value is number => typeof value === 'number',
    defaultValue: 0
  },
  boolean: {
    validate: (value: any): value is boolean => typeof value === 'boolean',
    defaultValue: false
  },
  string: {
    validate: (value: any): value is string => typeof value === 'string',
    defaultValue: ''
  },
  array: {
    validate: (value: any): value is any[] => Array.isArray(value),
    defaultValue: [] as any[]
  }
} as const; 
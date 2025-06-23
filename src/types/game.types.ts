import { EventSystem } from '../utils/eventSystem';

export enum PlayerStatus {
  ALIVE = 'ALIVE',
  WOUNDED = 'WOUNDED',
  DEAD = 'DEAD'
}

export type ActionType = 'ATTACK' | 'DEFEND' | 'ABILITY' | 'PASS' | 'EVADE';

// 🆕 상태이상 시스템
export interface StatusEffect {
  id: string;
  name: string;
  description: string;
  duration: number; // -1이면 영구
  stackable: boolean;
  type: 'buff' | 'debuff' | 'neutral';
  stacks?: number; // 중첩 가능한 경우
  source?: number; // 상태이상을 준 플레이어 ID
}

export interface PlayerAction {
  playerId: number;
  targetId: number;
  actionType: ActionType;
  abilityId?: string;
  
  // 🆕 특수 입력 지원
  additionalTargets?: number[];  // 동기화용
  prediction?: {                 // 선제예측용
    action: string;
    abilityUse: boolean;
  };
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
  statusEffects: StatusEffect[]; // 🆕 StatusEffect[]로 변경
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
  
  // 🆕 추가 프로퍼티들
  isInvincible: boolean;         // 무적 상태
  customFlags: Map<string, any>; // 커스텀 플래그
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
  
  // 🆕 새로 추가
  statusEffects: Map<number, StatusEffect[]>;
  customGameFlags: Map<string, any>;
  delayedEffects: DelayedEffect[];
  gameHistory: GameHistoryEvent[];
}

// 🆕 새로운 인터페이스들
export interface DelayedEffect {
  id: string;
  playerId?: number;
  timing: string;
  effect: () => void;
  turns: number;
}

export interface GameHistoryEvent {
  turn: number;
  type: string;
  data: any;
  timestamp: number;
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
  preventDefault?: () => void; // 🆕 추가
}

export interface GameEvent extends ModifiableEvent {
  // 기존 GameEvent 인터페이스 유지
}

export enum GameEventType {
  // 기존 이벤트들
  GAME_START = 'GAME_START',
  GAME_END = 'GAME_END',
  TURN_START = 'TURN_START',
  TURN_END = 'TURN_END',
  DEATH = 'DEATH',
  
  // 액션 이벤트
  ATTACK = 'ATTACK',
  DEFEND = 'DEFEND',
  EVADE = 'EVADE',
  ATTACK_ACTION = 'ATTACK_ACTION',
  DEFEND_ACTION = 'DEFEND_ACTION',
  EVADE_ACTION = 'EVADE_ACTION',
  PASS_ACTION = 'PASS_ACTION',
  ABILITY_USE = 'ABILITY_USE',
  ABILITY_EFFECT = 'ABILITY_EFFECT',
  
  // 전처리/후처리 이벤트
  BEFORE_ATTACK = 'BEFORE_ATTACK',
  AFTER_ATTACK = 'AFTER_ATTACK',
  BEFORE_DEFEND = 'BEFORE_DEFEND',
  AFTER_DEFEND = 'AFTER_DEFEND',
  BEFORE_EVADE = 'BEFORE_EVADE',
  AFTER_EVADE = 'AFTER_EVADE',
  BEFORE_PASS = 'BEFORE_PASS',
  AFTER_PASS = 'AFTER_PASS',
  
  // 특수 이벤트
  PERFECT_GUARD = 'PERFECT_GUARD',
  FOCUS_ATTACK = 'FOCUS_ATTACK',
  HP_CHANGE = 'HP_CHANGE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  STAT_CHANGE = 'STAT_CHANGE',
  DEATH_ZONE = 'DEATH_ZONE',
  DAMAGE_DEALT = 'DAMAGE_DEALT',
  DEFENSE_CONSUMED = 'DEFENSE_CONSUMED',
  EVADE_SUCCESS = 'EVADE_SUCCESS',
  EVADE_FAIL = 'EVADE_FAIL',
  ABILITY_TRIGGER = 'ABILITY_TRIGGER',
  
  // 🆕 새로 추가된 이벤트들
  BEFORE_DEATH = 'BEFORE_DEATH',
  AFTER_DEATH = 'AFTER_DEATH',
  BEFORE_HEAL = 'BEFORE_HEAL',
  AFTER_HEAL = 'AFTER_HEAL',
  STATUS_EFFECT_APPLIED = 'STATUS_EFFECT_APPLIED',
  STATUS_EFFECT_REMOVED = 'STATUS_EFFECT_REMOVED',
  ABILITY_CHAIN_TRIGGERED = 'ABILITY_CHAIN_TRIGGERED'
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
  
  // 🆕 새로운 이벤트 훅들
  onBeforeDeath?(event: ModifiableEvent): Promise<void>;
  onAfterDeath?(event: ModifiableEvent): Promise<void>;
  onBeforeHeal?(event: ModifiableEvent): Promise<void>;
  onAfterHeal?(event: ModifiableEvent): Promise<void>;
  onStatusEffectApplied?(event: ModifiableEvent): Promise<void>;
  onStatusEffectRemoved?(event: ModifiableEvent): Promise<void>;
  onAnyEvent?(event: ModifiableEvent): Promise<void>; // 모든 이벤트 감지
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
  statusEffectManager: any;
  performanceMetrics: {
    totalExecutions: number;
    averageExecutionTime: number;
    errorCount: number;
    lastExecutionTimestamp: number;
  };
  errorCount: number;
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
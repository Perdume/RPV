import { EventSystem } from '../utils/eventSystem';

export enum PlayerStatus {
  ALIVE = 'ALIVE',
  WOUNDED = 'WOUNDED',
  DEAD = 'DEAD'
}

export type ActionType = 'ATTACK' | 'DEFEND' | 'ABILITY' | 'PASS' | 'EVADE';

// 🆕 상태이상 시스템
export interface StatusEffect {
  id: StatusEffectId; // 🔧 string → StatusEffectId
  name: string;
  description: string;
  duration: number; // -1이면 영구
  stackable: boolean;
  type: 'buff' | 'debuff' | 'neutral';
  stacks: number; // 🔧 optional 제거
  maxStacks?: number; // 🆕 최대 중첩 수
  source?: number; // 상태이상을 준 플레이어 ID
  
  // 🆕 이벤트 핸들러 추가
  onApply?: (playerId: number, stacks: number) => void;
  onRemove?: (playerId: number, stacks: number) => void;
  onTurnStart?: (playerId: number, stacks: number) => void;
  onTurnEnd?: (playerId: number, stacks: number) => void;
  onDamageReceived?: (playerId: number, damage: number) => number; // 데미지 수정
}

export interface PlayerAction {
  playerId: number;
  targetId: number;
  actionType: ActionType;
  abilityId?: string;
  
  // 🆕 행동 수정을 위한 속성들
  damage?: number;
  defenseGauge?: number;
  evadeCount?: number;
  
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

export interface ModifiableEvent<T = unknown> {
  type: GameEventType;
  timestamp: number;
  data: T;
  cancelled: boolean;
  modified: boolean;
  preventDefault?: () => void;
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

// 🆕 구체적인 이벤트 데이터 타입들
export interface TurnStartEvent {
  turn: number;
  players: Player[];
  statusEffectManager?: any;
  eventSystem?: any;
}

export interface TurnEndEvent {
  turn: number;
  players: Player[];
  statusEffectManager?: any;
}

export interface AttackEvent {
  attacker: number;
  target: number;
  damage: number;
  attackerPlayer?: Player;
  targetPlayer?: Player;
  ignoreDefense?: boolean;
  ignoreEvade?: boolean;
  ignoreDamageReduction?: boolean;
  newTarget?: number;
  newDamage?: number;
  attackSuccess?: boolean;
}

export interface DefendEvent {
  player: number;
  defenseGauge: number;
  damageReduction: number;
}

export interface EvadeEvent {
  player: number;
  attacker?: number;
  success: boolean;
  chance: number;
  noEvadeCountIncrease?: boolean;
}

export interface DeathEvent {
  player: number;
  killer?: number;
  lastDamage?: number;
  playerName?: string;
  oldDefenseGauge?: number;
  newDefenseGauge?: number;
  startHp?: number;
  currentHp?: number;
}

export interface StatusEffectEvent {
  targetId: number;
  effectId: string;
  duration: number;
  stacks: number;
  effect?: StatusEffect;
}

export interface AbilityChainEvent {
  chainId: string;
  triggerAbility: string;
}

// 🆕 추가 이벤트 타입들
export interface FocusAttackEvent {
  attacker: number;
  target: number;
  damage: number;
}

export interface StatChangeEvent {
  player: number;
  stat: string;
  oldValue: number;
  newValue: number;
  reason?: string;
}

export interface StatusChangeEvent {
  player: number;
  oldStatus: string;
  newStatus: string;
}

export interface AbilityUseEvent {
  player: number;
  abilityId: string;
  target?: number;
}

export interface AbilityEffectEvent {
  player: number;
  abilityId: string;
  effect: any;
}

// 🆕 이벤트 데이터 타입 매핑
export type EventDataMap = {
  [GameEventType.TURN_START]: TurnStartEvent;
  [GameEventType.TURN_END]: TurnEndEvent;
  [GameEventType.BEFORE_ATTACK]: AttackEvent;
  [GameEventType.AFTER_ATTACK]: AttackEvent;
  [GameEventType.BEFORE_DEFEND]: DefendEvent;
  [GameEventType.AFTER_DEFEND]: DefendEvent;
  [GameEventType.BEFORE_EVADE]: EvadeEvent;
  [GameEventType.AFTER_EVADE]: EvadeEvent;
  [GameEventType.DEATH]: DeathEvent;
  [GameEventType.STATUS_EFFECT_APPLIED]: StatusEffectEvent;
  [GameEventType.STATUS_EFFECT_REMOVED]: StatusEffectEvent;
  [GameEventType.ABILITY_CHAIN_TRIGGERED]: AbilityChainEvent;
  [GameEventType.FOCUS_ATTACK]: FocusAttackEvent;
  [GameEventType.HP_CHANGE]: StatChangeEvent;
  [GameEventType.STAT_CHANGE]: StatChangeEvent;
  [GameEventType.STATUS_CHANGE]: StatusChangeEvent;
  [GameEventType.ABILITY_USE]: AbilityUseEvent;
  [GameEventType.ABILITY_EFFECT]: AbilityEffectEvent;
}

// 🆕 타입 안전한 ModifiableEvent
export interface TypedModifiableEvent<T = any> extends ModifiableEvent {
  data: T;
}

// 🆕 능력 ID 유니온 타입 추가
export type AbilityId = 
  | 'multipleStrike' | 'sniperRifle' | 'quantumization' | 'woundAnalysis'
  | 'shadowInDarkness' | 'synchronize' | 'endOfDestruction' | 'painfulMemory'
  | 'swiftCounter' | 'discordDissonance' | 'liveToDie' | 'greatFailure'
  | 'weaponBreak' | 'ghostSummoning' | 'confusion' | 'preemptivePrediction'
  | 'targetManipulation' | 'suppressedFreedom' | 'alzheimer' | 'unseeable'
  | 'willLoss' | 'fallenCrown' | 'fateCross' | 'burningEmbers'
  | 'annihilation' | 'playingDead' | 'judge';

// 🆕 상태이상 ID 타입
export type StatusEffectId = 
  | 'crack' | 'doom_sign' | 'will_loss' | 'damage_reduction' 
  | 'damage_increase' | 'ability_seal' | 'action_seal' | 'ghost'
  | 'emphasized' | 'pass_coin'; 
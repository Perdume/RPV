import { PlayerId, DamageEvent } from './types/game.types';

export enum GameEventType {
  // 기본 이벤트
  ATTACK = 'ATTACK',
  DEFEND = 'DEFEND',
  EVADE = 'EVADE',
  DEATH = 'DEATH',
  TURN_START = 'TURN_START',
  TURN_END = 'TURN_END',
  DAMAGE = 'DAMAGE',
  
  // 특수 이벤트
  FOCUS_ATTACK = 'FOCUS_ATTACK',
  PERFECT_GUARD = 'PERFECT_GUARD',
  DEATH_ZONE = 'DEATH_ZONE',
  
  // 능력 관련 이벤트
  ABILITY_USE = 'ABILITY_USE',
  ABILITY_TRIGGER = 'ABILITY_TRIGGER',
  ABILITY_EFFECT = 'ABILITY_EFFECT',
  
  // 상태 변경 이벤트
  HP_CHANGE = 'HP_CHANGE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  STAT_CHANGE = 'STAT_CHANGE'
}

export interface GameEvent {
  type: GameEventType;
  timestamp: number;
  data: any;
}

export interface AttackEvent {
  attacker: PlayerId;
  target: PlayerId;
  damage: number;
  targetHp: number;
}

export interface DefendEvent {
  player: PlayerId;
  defenseGauge: number;
  damageReduction: number;
}

export interface EvadeEvent {
  player: PlayerId;
  attacker?: PlayerId;
  success: boolean;
  chance: number;
}

export interface DeathEvent {
  player: PlayerId;
  killer: PlayerId;
  lastDamage: number;
}

export interface FocusAttackEvent {
  attacker: PlayerId;
  target: PlayerId;
  damage: number;
  attackCount: number;
}

export interface HpChangeEvent {
  player: PlayerId;
  oldValue: number;
  newValue: number;
  maxHp: number;
  reason: string;
}

export interface StatusChangeEvent {
  player: PlayerId;
  oldStatus: string;
  newStatus: string;
  reason: string;
}

export interface AbilityUseEvent {
  player: PlayerId;
  abilityId: string;
  sourceEvent: GameEvent;
}

export interface AbilityEffectEvent {
  player: PlayerId;
  abilityId: string;
  effect: any;
  sourceEvent: GameEvent;
}

export interface StatChangeEvent extends GameEvent {
  type: GameEventType.STAT_CHANGE;
  data: {
    player: PlayerId;
    stat: string;
    oldValue: number;
    newValue: number;
    reason?: string;
  };
}

export type GameEventHandler = (event: GameEvent) => void | Promise<void>; 
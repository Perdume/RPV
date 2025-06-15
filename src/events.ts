import { PlayerId, DamageEvent } from './types/game.types';

export enum GameEventType {
  // 시스템 이벤트
  GAME_START = 'GAME_START',
  GAME_END = 'GAME_END',
  TURN_START = 'TURN_START',
  TURN_END = 'TURN_END',
  PERFECT_GUARD = 'PERFECT_GUARD',

  // 행동 이벤트 (플레이어가 의도적으로 한 행동)
  ATTACK_ACTION = 'ATTACK_ACTION',
  DEFEND_ACTION = 'DEFEND_ACTION',
  EVADE_ACTION = 'EVADE_ACTION',
  PASS_ACTION = 'PASS_ACTION',
  ABILITY_USE = 'ABILITY_USE',

  // 결과 이벤트 (행동의 결과로 발생)
  DAMAGE_DEALT = 'DAMAGE_DEALT',
  DEFENSE_CONSUMED = 'DEFENSE_CONSUMED',
  EVADE_SUCCESS = 'EVADE_SUCCESS',
  EVADE_FAIL = 'EVADE_FAIL',
  DEATH = 'DEATH',
  FOCUS_ATTACK = 'FOCUS_ATTACK',
  
  // 특수 이벤트
  DEATH_ZONE = 'DEATH_ZONE',
  
  // 능력 관련 이벤트
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
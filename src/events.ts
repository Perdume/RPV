import { PlayerId, GameEventType } from './types/game.types';

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
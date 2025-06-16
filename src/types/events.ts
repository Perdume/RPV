export enum GameEventType {
  // 기존 이벤트들...
  TURN_START = 'TURN_START',
  TURN_END = 'TURN_END',
  DEATH = 'DEATH',
  GAME_END = 'GAME_END',
  
  // Pre/Post 이벤트 패턴
  BEFORE_ATTACK = 'BEFORE_ATTACK',
  AFTER_ATTACK = 'AFTER_ATTACK',
  BEFORE_DEFEND = 'BEFORE_DEFEND',
  AFTER_DEFEND = 'AFTER_DEFEND',
  BEFORE_EVADE = 'BEFORE_EVADE',
  AFTER_EVADE = 'AFTER_EVADE',
  BEFORE_PASS = 'BEFORE_PASS',
  AFTER_PASS = 'AFTER_PASS',
  
  // 기존 행동 이벤트들...
  ATTACK_ACTION = 'ATTACK_ACTION',
  DEFEND_ACTION = 'DEFEND_ACTION',
  EVADE_ACTION = 'EVADE_ACTION',
  PASS_ACTION = 'PASS_ACTION',
  
  // 기존 결과 이벤트들...
  DAMAGE_DEALT = 'DAMAGE_DEALT',
  DEFENSE_CONSUMED = 'DEFENSE_CONSUMED',
  EVADE_SUCCESS = 'EVADE_SUCCESS',
  EVADE_FAIL = 'EVADE_FAIL',
  PERFECT_GUARD = 'PERFECT_GUARD'
}

export interface ModifiableEvent {
  type: GameEventType;
  timestamp: number;
  data: any;
  cancelled: boolean;
  modified: boolean;
}

export interface GameEvent extends ModifiableEvent {
  // 기존 GameEvent 인터페이스 유지
} 
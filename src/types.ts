export type PlayerId = number;

export enum PlayerStatus {
  ALIVE = 'alive',
  WOUNDED = 'wounded',
  DEAD = 'dead',
  EVADING = 'evading'
}

export enum Action {
  ATTACK = 'ATTACK',
  DEFEND = 'DEFEND',
  EVADE = 'EVADE'
}

export interface Player {
  id: number;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  status: PlayerStatus;
  defenseGauge: number;
  maxDefenseGauge: number;
  evadeCount: number;
  ability: string;
  abilityUses: number;
  statusEffects: any[];
  pendingDefenseHeal: number;
  defense: number;
  maxDefense: number;
  evasion: number;
  abilityId: string;
  action?: Action;
  target?: number;
}

export interface DeathZone {
  stage: number;
  maxHpReduction: number;
  nextReduction: number;
}

export interface GameStateData {
  turn: number;
  survivors: number;
  deathZone: DeathZone;
  players: Player[];
} 
import { EventSystem } from '../EventSystem';
import { Player, ModifiableEvent } from '../types/game.types';

export interface AbilityContext {
  player: Player;
  target?: Player;
  players: Player[];
  eventSystem: EventSystem;
  logs: string[];
  variables: Map<string, any>;
  currentTurn: number;
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  cooldown: number;
  maxCooldown: number;

  // Pre/Post 이벤트 핸들러
  onBeforeAttack?: (event: ModifiableEvent) => Promise<void>;
  onAfterAttack?: (event: ModifiableEvent) => Promise<void>;
  onBeforeDefend?: (event: ModifiableEvent) => Promise<void>;
  onAfterDefend?: (event: ModifiableEvent) => Promise<void>;
  onBeforeEvade?: (event: ModifiableEvent) => Promise<void>;
  onAfterEvade?: (event: ModifiableEvent) => Promise<void>;
  onBeforePass?: (event: ModifiableEvent) => Promise<void>;
  onAfterPass?: (event: ModifiableEvent) => Promise<void>;

  // 시스템 이벤트 핸들러
  onTurnStart?: (event: ModifiableEvent) => Promise<void>;
  onTurnEnd?: (event: ModifiableEvent) => Promise<void>;
  onGameStart?: (event: ModifiableEvent) => Promise<void>;
  onGameEnd?: (event: ModifiableEvent) => Promise<void>;
  onDeath?: (event: ModifiableEvent) => Promise<void>;
  onPerfectGuard?: (event: ModifiableEvent) => Promise<void>;

  // 쿨다운 관리
  resetCooldown(): void;
  isOnCooldown(): boolean;
  getRemainingCooldown(): number;
} 
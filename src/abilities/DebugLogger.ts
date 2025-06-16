import { BaseAbility } from './BaseAbility';
import { ModifiableEvent } from '../types/game.types';

export class DebugLogger extends BaseAbility {
  constructor() {
    super('debug_logger', 'Debug Logger', '디버그 로그를 출력합니다.', 0);
  }

  async onBeforeAttack(event: ModifiableEvent): Promise<void> {
    console.log('[DebugLogger] Before Attack:', event.data);
  }

  async onAfterAttack(event: ModifiableEvent): Promise<void> {
    console.log('[DebugLogger] After Attack:', event.data);
  }

  async onBeforeDefend(event: ModifiableEvent): Promise<void> {
    console.log('[DebugLogger] Before Defend:', event.data);
  }

  async onAfterDefend(event: ModifiableEvent): Promise<void> {
    console.log('[DebugLogger] After Defend:', event.data);
  }

  async onBeforeEvade(event: ModifiableEvent): Promise<void> {
    console.log('[DebugLogger] Before Evade:', event.data);
  }

  async onAfterEvade(event: ModifiableEvent): Promise<void> {
    console.log('[DebugLogger] After Evade:', event.data);
  }

  async onBeforePass(event: ModifiableEvent): Promise<void> {
    console.log('[DebugLogger] Before Pass:', event.data);
  }

  async onAfterPass(event: ModifiableEvent): Promise<void> {
    console.log('[DebugLogger] After Pass:', event.data);
  }

  async onTurnStart(event: ModifiableEvent): Promise<void> {
    console.log('[DebugLogger] Turn Start:', event.data);
  }

  async onTurnEnd(event: ModifiableEvent): Promise<void> {
    console.log('[DebugLogger] Turn End:', event.data);
  }

  async onGameStart(event: ModifiableEvent): Promise<void> {
    console.log('[DebugLogger] Game Start:', event.data);
  }

  async onGameEnd(event: ModifiableEvent): Promise<void> {
    console.log('[DebugLogger] Game End:', event.data);
  }

  async onDeath(event: ModifiableEvent): Promise<void> {
    console.log('[DebugLogger] Death:', event.data);
  }

  async onPerfectGuard(event: ModifiableEvent): Promise<void> {
    console.log('[DebugLogger] Perfect Guard:', event.data);
  }

  async onFocusAttack(event: ModifiableEvent): Promise<void> {
    console.log('[DebugLogger] Focus Attack:', event.data);
  }
} 
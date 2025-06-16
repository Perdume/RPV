import { BaseAbility } from './BaseAbility';
import { ModifiableEvent, AbilityContext } from '../types/game.types';

export class Debug extends BaseAbility {
  private logs: string[] = [];
  private isDebugging: boolean = false;

  constructor() {
    super('디버그로거', '디버그 로거', '디버그 로그를 출력합니다.', 0, 0);
  }

  async onBeforeAttack(event: ModifiableEvent): Promise<void> {
    const owner = this.getOwner();
    console.log("[ABILITY DEBUG] OWNER: "+ owner);
    if (owner === event.data.attacker) {
      event.data.damage = 10;
    }
    this.logEvent('Before Attack', event);
  }

  async onAfterAttack(event: ModifiableEvent): Promise<void> {
    this.logEvent('After Attack', event);
  }

  async onBeforeDefend(event: ModifiableEvent): Promise<void> {
    this.logEvent('Before Defend', event);
  }

  async onAfterDefend(event: ModifiableEvent): Promise<void> {
    this.logEvent('After Defend', event);
  }

  async onBeforeEvade(event: ModifiableEvent): Promise<void> {
    this.logEvent('Before Evade', event);
  }

  async onAfterEvade(event: ModifiableEvent): Promise<void> {
    this.logEvent('After Evade', event);
  }

  async onBeforePass(event: ModifiableEvent): Promise<void> {
    this.logEvent('Before Pass', event);
  }

  async onAfterPass(event: ModifiableEvent): Promise<void> {
    this.logEvent('After Pass', event);
  }

  async onTurnStart(event: ModifiableEvent): Promise<void> {
    this.logEvent('Turn Start', event);
  }

  async onTurnEnd(event: ModifiableEvent): Promise<void> {
    this.logEvent('Turn End', event);
  }

  async onGameStart(event: ModifiableEvent): Promise<void> {
    this.logEvent('Game Start', event);
  }

  async onGameEnd(event: ModifiableEvent): Promise<void> {
    this.logEvent('Game End', event);
  }

  async onDeath(event: ModifiableEvent): Promise<void> {
    this.logEvent('Death', event);
  }

  async onPerfectGuard(event: ModifiableEvent): Promise<void> {
    this.logEvent('Perfect Guard', event);
  }

  async onFocusAttack(event: ModifiableEvent): Promise<void> {
    this.logEvent('Focus Attack', event);
  }

  // 로그 추가 메서드
  public logEvent(eventName: string, event: ModifiableEvent | { message: string }): void {
    if (this.isDebugging) return; // 무한 루프 방지
    
    const owner = this.getOwner();
    const debugMessage = `[ABILITY DEBUG] ${eventName} (Owner: ${owner}): ${JSON.stringify(event)}`;
    this.logs.push(debugMessage);
    console.log(debugMessage); // F12 콘솔에 출력
  }

  // 로그 초기화 메서드
  clearLogs(): void {
    this.logs = [];
  }

  // 로그 출력 메서드
  printLogs(): void {
    this.isDebugging = true; // 디버그 모드 시작
    console.log('=== Debug Logs ===');
    this.logs.forEach(log => console.log(log));
    console.log('=================');
    this.isDebugging = false; // 디버그 모드 종료
  }
} 
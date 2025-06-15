import { BaseAbility } from './BaseAbility';
import { AbilityContext } from './Ability';
import { GameEventType } from '../events';

export class Debug extends BaseAbility {
  private logs: string[] = [];

  constructor() {
    super('debug', 999, '디버그 로그 출력', 0);
  }

  // 이벤트 핸들러 추가
  async onTurnStart(context: AbilityContext): Promise<void> {
    this.addLog(context, `[턴 시작] ${context.currentTurn}턴이 시작되었습니다.`);
  }

  async onTurnEnd(context: AbilityContext): Promise<void> {
    this.addLog(context, `[턴 종료] ${context.currentTurn}턴이 종료되었습니다.`);
  }

  async onAttack(context: AbilityContext): Promise<void> {
    const { player, players } = context;
    const target = players.find(p => p.id === player.targetId);
    if (!target) return;

    this.addLog(context, `[공격] ${player.name}이(가) ${target.name}을(를) 공격합니다.`);
  }

  async onDefend(context: AbilityContext): Promise<void> {
    const { player } = context;
    this.addLog(context, `[방어] ${player.name}이(가) 방어를 시도합니다.`);
  }

  async onEvade(context: AbilityContext): Promise<void> {
    const { player } = context;
    this.addLog(context, `[회피] ${player.name}이(가) 회피를 시도합니다.`);
  }

  async onDeath(context: AbilityContext): Promise<void> {
    const { player } = context;
    this.addLog(context, `[사망] ${player.name}이(가) 탈락했습니다.`);
  }

  async onFocusAttack(context: AbilityContext): Promise<void> {
    const { player, players } = context;
    const target = players.find(p => p.id === player.targetId);
    if (!target) return;

    this.addLog(context, `[집중 공격] ${player.name}이(가) ${target.name}에게 집중 공격을 시도합니다.`);
  }

  async onAbilityUse(context: AbilityContext): Promise<void> {
    const { player } = context;
    this.addLog(context, `[능력 사용] ${player.name}이(가) 능력을 사용합니다.`);
  }

  async onGameStart(context: AbilityContext): Promise<void> {
    this.addLog(context, '[게임 시작] 새로운 게임이 시작되었습니다.');
  }

  async onGameEnd(context: AbilityContext): Promise<void> {
    this.addLog(context, '[게임 종료] 게임이 종료되었습니다.');
  }

  // 로그 추가 메서드
  protected addLog(context: AbilityContext, message: string): void {
    const debugMessage = `[ABILITY DEBUG] ${message}`;
    this.logs.push(debugMessage);
    console.log(debugMessage); // F12 콘솔에 출력
  }

  // 기존 use 메서드 수정
  async use(context: AbilityContext): Promise<void> {
    this.addLog(context, `[디버그] ${context.player.name}의 디버그 로그를 출력합니다.`);
    this.logs.forEach(log => console.log(log));
  }

  // 로그 초기화 메서드
  clearLogs(): void {
    this.logs = [];
  }
} 
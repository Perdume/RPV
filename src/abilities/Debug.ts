import { BaseAbility } from './BaseAbility';
import { AbilityContext } from './Ability';
import { GameEventType } from '../events';

export class Debug extends BaseAbility {
  private logs: string[] = [];
  private isDebugging: boolean = false;

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

  async onAttackAction(context: AbilityContext): Promise<void> {
    const { player, target } = context;
    if (!target) return;
    this.addLog(context, `[공격 행동] ${player.name}이(가) ${target.name}을(를) 공격합니다.`);
  }

  async onDefendAction(context: AbilityContext): Promise<void> {
    const { player } = context;
    this.addLog(context, `[방어 행동] ${player.name}이(가) 방어를 시도합니다. (방어게이지 +1)`);
  }

  async onEvadeAction(context: AbilityContext): Promise<void> {
    const { player } = context;
    this.addLog(context, `[회피 행동] ${player.name}이(가) 회피를 시도합니다. (회피카운트 +1)`);
  }

  async onPassAction(context: AbilityContext): Promise<void> {
    const { player } = context;
    this.addLog(context, `[패스 행동] ${player.name}이(가) 행동을 패스합니다.`);
  }

  async onDamageDealt(context: AbilityContext): Promise<void> {
    const { player, target } = context;
    if (!target) return;
    this.addLog(context, `[데미지 발생] ${player.name}이(가) ${target.name}에게 데미지를 입혔습니다.`);
  }

  async onDefenseConsumed(context: AbilityContext): Promise<void> {
    const { player } = context;
    this.addLog(context, `[방어게이지 소모] ${player.name}의 방어게이지가 소모되었습니다. (방어게이지 -1)`);
  }

  async onEvadeSuccess(context: AbilityContext): Promise<void> {
    const { player } = context;
    this.addLog(context, `[회피 성공] ${player.name}이(가) 공격을 회피했습니다.`);
  }

  async onEvadeFail(context: AbilityContext): Promise<void> {
    const { player } = context;
    this.addLog(context, `[회피 실패] ${player.name}의 회피가 실패했습니다.`);
  }

  async onDeath(context: AbilityContext): Promise<void> {
    const { player } = context;
    this.addLog(context, `[사망] ${player.name}이(가) 탈락했습니다.`);
  }

  async onPerfectGuard(context: AbilityContext): Promise<void> {
    const { player } = context;
    this.addLog(context, `[퍼펙트 가드] ${player.name}의 방어 횟수가 1회복되었습니다.`);
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
    if (this.isDebugging) return; // 무한 루프 방지
    
    const debugMessage = `[ABILITY DEBUG] ${message}`;
    this.logs.push(debugMessage);
    console.log(debugMessage); // F12 콘솔에 출력
  }

  // 기존 use 메서드 수정
  async use(context: AbilityContext): Promise<void> {
    this.isDebugging = true; // 디버그 모드 시작
    this.addLog(context, `[디버그] ${context.player.name}의 디버그 로그를 출력합니다.`);
    this.logs.forEach(log => console.log(log));
    this.isDebugging = false; // 디버그 모드 종료
  }

  // 로그 초기화 메서드
  clearLogs(): void {
    this.logs = [];
  }
} 
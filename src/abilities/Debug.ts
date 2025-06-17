import { BaseAbility } from './BaseAbility';
import { ModifiableEvent } from '../types/game.types';
import { schemas } from '../types/game.types';

export class Debug extends BaseAbility {
  constructor() {
    super('디버그로거', '디버그 로거', '디버그 로그를 출력합니다.', 0, 0);
  }

  async onBeforeAttack(event: ModifiableEvent): Promise<void> {
    const owner = this.getOwner();
    console.log(`[DEBUG] Owner: ${owner}, 공격자: ${event.data.attacker}`);
    
    if (owner === event.data.attacker) {
      // 공격 횟수 카운트 (영구 변수)
      const attackCount = this.getPermanent<number>('attack_count', schemas.number);
      await this.setPermanent('attack_count', attackCount + 1, schemas.number);
      
      // 이번 턴 공격 여부 (턴 변수)
      this.setTurn('attacked_this_turn', true, event.data.turn || 0, schemas.boolean);
      
      // 데미지 부스트 (세션 변수)
      const currentBoost = this.getSession<number>('damage_boost', schemas.number);
      event.data.damage = event.data.damage * currentBoost;
      
      console.log(`[DEBUG] 데미지 부스트 적용! (${currentBoost}배)`);
      console.log(`[DEBUG] 총 공격 횟수: ${attackCount + 1}회`);
    }
    
    this.logEvent('Before Attack', event);
  }

  async onAfterAttack(event: ModifiableEvent): Promise<void> {
    // 공격 성공 시 부스트 증가
    if (this.getOwner() === event.data.attacker) {
      const currentBoost = this.getSession<number>('damage_boost', schemas.number);
      this.setSession('damage_boost', currentBoost + 0.1, schemas.number);
    }
    
    this.logEvent('After Attack', event);
  }

  async onBeforeDefend(event: ModifiableEvent): Promise<void> {
    const _owner = this.getOwner(); // 의도적으로 사용하지 않는 변수
    this.logEvent('Before Defend', event);
  }

  async onAfterDefend(event: ModifiableEvent): Promise<void> {
    const _owner = this.getOwner(); // 의도적으로 사용하지 않는 변수
    this.logEvent('After Defend', event);
  }

  async onBeforeEvade(event: ModifiableEvent): Promise<void> {
    const _owner = this.getOwner(); // 의도적으로 사용하지 않는 변수
    this.logEvent('Before Evade', event);
  }

  async onAfterEvade(event: ModifiableEvent): Promise<void> {
    const _owner = this.getOwner(); // 의도적으로 사용하지 않는 변수
    this.logEvent('After Evade', event);
  }

  async onBeforePass(event: ModifiableEvent): Promise<void> {
    const _owner = this.getOwner(); // 의도적으로 사용하지 않는 변수
    this.logEvent('Before Pass', event);
  }

  async onAfterPass(event: ModifiableEvent): Promise<void> {
    const _owner = this.getOwner(); // 의도적으로 사용하지 않는 변수
    this.logEvent('After Pass', event);
  }

  async onTurnStart(event: ModifiableEvent): Promise<void> {
    const owner = this.getOwner();
    if (!owner) return;

    // 턴 시작 시 로그 개수 제한
    const maxLogs = this.getPermanent<number>('max_logs', schemas.number);
    const logs = this.getSession<string[]>('debug_logs', schemas.array);
    
    if (logs.length > maxLogs) {
      const trimmedLogs = logs.slice(-maxLogs);
      this.setSession('debug_logs', trimmedLogs, schemas.array);
      console.log(`[DEBUG] 로그 정리: ${logs.length - maxLogs}개 삭제`);
    }

    this.logEvent('Turn Start', event);
  }

  async onTurnEnd(event: ModifiableEvent): Promise<void> {
    const turnNumber = event.data.turn;
    
    // 이번 턴 공격 여부 확인
    const attackedThisTurn = this.getTurn<boolean>('attacked_this_turn', turnNumber, schemas.boolean);
    if (attackedThisTurn) {
      console.log(`[DEBUG] 턴 ${turnNumber}: 공격을 실행했습니다.`);
    }
    
    // 턴 변수 정리
    this.cleanupTurnVariables(turnNumber);
    
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

  // 로그 관리
  public logEvent(eventName: string, event: ModifiableEvent | { message: string }): void {
    const owner = this.getOwner();
    const debugMessage = `[ABILITY DEBUG] ${eventName} (Owner: ${owner}): ${JSON.stringify(event)}`;
    
    // 세션 변수로 로그 저장
    const logs = this.getSession<string[]>('debug_logs', schemas.array);
    logs.push(debugMessage);
    this.setSession('debug_logs', logs, schemas.array);
    
    console.log(debugMessage);
  }

  // 모든 변수 상태 출력
  public printStatus(): void {
    console.log('=== Debug 능력 상태 ===');
    
    const attackCount = this.getPermanent<number>('attack_count', schemas.number);
    const damageBoost = this.getSession<number>('damage_boost', schemas.number);
    const logs = this.getSession<string[]>('debug_logs', schemas.array);
    
    console.log(`총 공격 횟수: ${attackCount}회`);
    console.log(`현재 데미지 부스트: ${damageBoost.toFixed(1)}배`);
    console.log(`저장된 로그 수: ${logs.length}개`);
    
    this.debugVariables();
  }

  // 로그 초기화
  clearLogs(): void {
    this.setSession('debug_logs', [], schemas.array);
    console.log('[DEBUG] 로그가 초기화되었습니다.');
  }

  // 통계 리셋
  async resetStats(): Promise<void> {
    await this.setPermanent('attack_count', 0, schemas.number);
    this.setSession('damage_boost', 1, schemas.number);
    this.clearLogs();
    console.log('[DEBUG] 모든 통계가 리셋되었습니다.');
  }

  // 변수 테스트
  async testVariables(): Promise<void> {
    console.group('=== 변수 테스트 시작 ===');
    
    // 1. 영구 변수 테스트
    console.log('\n1. 영구 변수 테스트');
    await this.setPermanent('test_number', 42, schemas.number);
    await this.setPermanent('test_string', 'Hello', schemas.string);
    await this.setPermanent('test_boolean', true, schemas.boolean);
    await this.setPermanent('test_array', ['a', 'b', 'c'], schemas.array);
    
    // 2. 세션 변수 테스트
    console.log('\n2. 세션 변수 테스트');
    this.setSession('session_number', 100, schemas.number);
    this.setSession('session_string', 'World', schemas.string);
    this.setSession('session_boolean', false, schemas.boolean);
    this.setSession('session_array', [1, 2, 3], schemas.array);
    
    // 3. 턴 변수 테스트
    console.log('\n3. 턴 변수 테스트');
    const currentTurn = 1;
    this.setTurn('turn_number', 999, currentTurn, schemas.number);
    this.setTurn('turn_string', 'Turn Test', currentTurn, schemas.string);
    this.setTurn('turn_boolean', true, currentTurn, schemas.boolean);
    this.setTurn('turn_array', ['x', 'y', 'z'], currentTurn, schemas.array);
    
    // 4. 변수 읽기 테스트
    console.log('\n4. 변수 읽기 테스트');
    console.log('영구 변수:', {
      number: this.getPermanent('test_number', schemas.number),
      string: this.getPermanent('test_string', schemas.string),
      boolean: this.getPermanent('test_boolean', schemas.boolean),
      array: this.getPermanent('test_array', schemas.array)
    });
    
    console.log('세션 변수:', {
      number: this.getSession('session_number', schemas.number),
      string: this.getSession('session_string', schemas.string),
      boolean: this.getSession('session_boolean', schemas.boolean),
      array: this.getSession('session_array', schemas.array)
    });
    
    console.log('턴 변수:', {
      number: this.getTurn('turn_number', currentTurn, schemas.number),
      string: this.getTurn('turn_string', currentTurn, schemas.string),
      boolean: this.getTurn('turn_boolean', currentTurn, schemas.boolean),
      array: this.getTurn('turn_array', currentTurn, schemas.array)
    });
    
    // 5. 턴 변수 정리 테스트
    console.log('\n5. 턴 변수 정리 테스트');
    this.cleanupTurnVariables(currentTurn);
    console.log('정리 후 턴 변수:', {
      number: this.getTurn('turn_number', currentTurn, schemas.number),
      string: this.getTurn('turn_string', currentTurn, schemas.string),
      boolean: this.getTurn('turn_boolean', currentTurn, schemas.boolean),
      array: this.getTurn('turn_array', currentTurn, schemas.array)
    });
    
    console.groupEnd();
  }
} 
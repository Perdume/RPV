import { AbilityManager } from './AbilityManager';
import { BaseAbility } from './BaseAbility';
import { EventSystem } from '../utils/eventSystem';
import { AbilityContext, GameEventType, ModifiableEvent } from '../types/game.types';

// onTurnStart만 재정의해서 호출 순서를 기록하는 테스트용 능력
class RecordingAbility extends BaseAbility {
  constructor(id: string, priority: number, private calls: string[]) {
    super(id, id, '테스트용 능력', 0, 1);
    this.priority = priority;
  }

  async onTurnStart(event: ModifiableEvent): Promise<void> {
    this.calls.push(this.id);
  }
}

// 이벤트 핸들러를 재정의하지 않은 능력
class SilentAbility extends BaseAbility {
  constructor(id: string) {
    super(id, id, '테스트용 능력', 2, 1);
  }

  async execute(context: AbilityContext): Promise<{ success: boolean; message: string }> {
    return { success: false, message: '대상이 없습니다.' };
  }
}

class FailingAbility extends BaseAbility {
  constructor(id: string) {
    super(id, id, '테스트용 능력', 0, 1);
  }

  async onTurnStart(event: ModifiableEvent): Promise<void> {
    throw new Error('실패');
  }
}

const turnStartEvent = (turn: number): ModifiableEvent => ({
  type: GameEventType.TURN_START,
  timestamp: Date.now(),
  data: { turn, players: [] },
  cancelled: false,
  modified: false
});

describe('AbilityManager', () => {
  let eventSystem: EventSystem;
  let abilityManager: AbilityManager;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    eventSystem = new EventSystem();
    abilityManager = new AbilityManager(eventSystem);
  });

  afterEach(() => {
    abilityManager.dispose();
    eventSystem.dispose();
    jest.restoreAllMocks();
  });

  it('능력 ID나 표시 이름(공백 무시)으로 능력을 찾아 할당한다', () => {
    expect(abilityManager.resolveAbilityId('다중타격')).toBe('multipleStrike');
    expect(abilityManager.resolveAbilityId('HS.50 대물 저격소총')).toBe('sniperRifle');
    expect(abilityManager.resolveAbilityId('다시 불타는 잿더미')).toBe('risingAshes');
    expect(abilityManager.resolveAbilityId('운명 교차')).toBe('fateCross');
    expect(abilityManager.resolveAbilityId('없음')).toBeNull();

    expect(abilityManager.assignAbility(1, '상처 파악')).toBe('woundAnalysis');
    expect(abilityManager.getPlayerAbility(1)?.id).toBe('woundAnalysis');
    expect(abilityManager.assignAbility(2, '없음')).toBeNull();
    expect(abilityManager.getPlayerAbility(2)).toBeUndefined();
  });

  it('이벤트를 우선순위가 높은 능력부터, 해당 핸들러를 재정의한 능력에만 전달한다', async () => {
    const calls: string[] = [];
    abilityManager.registerAbility(new RecordingAbility('low', 1, calls));
    abilityManager.registerAbility(new RecordingAbility('high', 5, calls));
    abilityManager.registerAbility(new SilentAbility('silent'));
    abilityManager.assignAbility(1, 'low');
    abilityManager.assignAbility(2, 'silent');
    abilityManager.assignAbility(3, 'high');

    await eventSystem.emit(turnStartEvent(1));

    expect(calls).toEqual(['high', 'low']);
    expect(abilityManager.getPerformanceStats().totalExecutions).toBe(2);
    expect(abilityManager.getCurrentTurn()).toBe(1);
  });

  it('새 능력이 할당되면 우선순위 순서를 다시 계산한다', async () => {
    const calls: string[] = [];
    abilityManager.registerAbility(new RecordingAbility('first', 1, calls));
    abilityManager.registerAbility(new RecordingAbility('urgent', 9, calls));
    abilityManager.assignAbility(1, 'first');
    await eventSystem.emit(turnStartEvent(1));

    abilityManager.assignAbility(2, 'urgent');
    await eventSystem.emit(turnStartEvent(2));

    expect(calls).toEqual(['first', 'urgent', 'first']);
  });

  it('비활성화된 능력과 에러가 반복되어 꺼진 능력은 실행하지 않는다', async () => {
    const calls: string[] = [];
    const inactive = new RecordingAbility('inactive', 1, calls);
    inactive.isActive = false;
    abilityManager.registerAbility(inactive);
    abilityManager.registerAbility(new FailingAbility('failing'));
    abilityManager.assignAbility(1, 'inactive');
    abilityManager.assignAbility(2, 'failing');

    for (let turn = 1; turn <= 11; turn++) {
      await eventSystem.emit(turnStartEvent(turn));
    }

    expect(calls).toEqual([]);
    expect(abilityManager.getDisabledAbilities()).toEqual(['failing']);

    abilityManager.reenableAbility('failing');
    expect(abilityManager.getDisabledAbilities()).toEqual([]);
  });

  it('쿨다운을 턴마다 1씩 줄인다', () => {
    const ability = new SilentAbility('cooldown');
    abilityManager.registerAbility(ability);
    abilityManager.assignAbility(1, 'cooldown');
    ability.resetCooldown();

    abilityManager.updateCooldowns();

    expect(ability.getRemainingCooldown()).toBe(1);
  });

  it('번호가 교체되면 능력도 주인을 따라 이동한다', () => {
    abilityManager.assignAbility(1, 'multipleStrike');
    abilityManager.assignAbility(3, 'sniperRifle');

    abilityManager.swapPlayers(1, 3);

    expect(abilityManager.getPlayerAbility(3)?.id).toBe('multipleStrike');
    expect(abilityManager.getPlayerAbility(1)?.id).toBe('sniperRifle');
    expect(abilityManager.getPlayerAbility(3)?.getOwner()).toBe(3);
  });

  it('능력 실행 실패를 그대로 결과로 돌려준다', async () => {
    abilityManager.registerAbility(new SilentAbility('silent'));
    abilityManager.assignAbility(1, 'silent');
    abilityManager.setGameState({ players: [{ id: 1, name: 'P1' } as any] });

    const result = await abilityManager.executeAbility(1, 'silent', [], {});

    expect(result).toMatchObject({ success: false, message: '대상이 없습니다.' });
  });
});

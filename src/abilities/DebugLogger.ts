import { BaseAbility } from './BaseAbility';
import { AbilityContext } from './Ability';
import { GameEventType } from '../events';

export class DebugLogger extends BaseAbility {
  id = 'debug_logger';
  name = 'Debug Logger';
  description = '디버그 로그를 출력합니다.';
  maxUses = 1;
  cooldown = 0;

  async use(context: AbilityContext): Promise<void> {
    this.addLog(context, `[DEBUG] ${context.player.name}의 디버그 로그가 출력되었습니다.`);
  }
} 
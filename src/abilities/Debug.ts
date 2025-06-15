import { BaseAbility } from './BaseAbility';
import { AbilityContext } from './Ability';

export class Debug extends BaseAbility {
  id = 'debug';
  name = 'Debug';
  description = '모든 행동과 이벤트를 로그로 출력합니다.';
  maxUses = 1;
  cooldown = 0;

  async use(context: AbilityContext): Promise<void> {
    const { player, players, logs, variables } = context;
    
    // 현재 턴의 모든 플레이어 행동 로깅
    players.forEach(p => {
      if (p.actionType) {
        logs.push(`[EVENT DEBUG] 플레이어 ${p.name}의 행동: ${p.actionType}`);
        if (p.targetId) {
          const target = players.find(pl => pl.id === p.targetId);
          if (target) {
            logs.push(`[EVENT DEBUG] 대상: ${target.name}`);
          }
        }
      }
    });

    // 현재 플레이어의 상태 로깅
    logs.push(`[EVENT DEBUG] ${player.name} 상태:`);
    logs.push(`[EVENT DEBUG] - HP: ${player.hp}`);
    logs.push(`[EVENT DEBUG] - 방어력: ${player.defense}`);
    logs.push(`[EVENT DEBUG] - 능력: ${player.ability}`);
    logs.push(`[EVENT DEBUG] - 행동: ${player.actionType || '없음'}`);
    if (player.targetId) {
      const target = players.find(p => p.id === player.targetId);
      if (target) {
        logs.push(`[EVENT DEBUG] - 대상: ${target.name}`);
      }
    }

    // 게임 변수 로깅
    logs.push('[EVENT DEBUG] 게임 변수:');
    Object.entries(variables).forEach(([key, value]) => {
      logs.push(`[EVENT DEBUG] - ${key}: ${value}`);
    });
  }
} 
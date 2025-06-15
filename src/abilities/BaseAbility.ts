import { Player, PlayerStatus } from '../types/game.types';
import { Ability, AbilityContext } from './Ability';

export abstract class BaseAbility implements Ability {
  id: string;
  name: string;
  description: string;
  maxUses: number;
  cooldown: number;
  maxCooldown: number;

  constructor(
    id: string,
    maxUses: number,
    description: string,
    cooldown: number = 0
  ) {
    this.id = id;
    this.name = this.formatName(id);
    this.description = description;
    this.maxUses = maxUses;
    this.cooldown = cooldown;
    this.maxCooldown = cooldown;
  }

  protected formatName(id: string): string {
    return id
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // 기본 이벤트 핸들러들
  async onTurnStart(context: AbilityContext): Promise<void> {}
  async onTurnEnd(context: AbilityContext): Promise<void> {}
  async onAttack(context: AbilityContext): Promise<void> {}
  async onDefend(context: AbilityContext): Promise<void> {}
  async onEvade(context: AbilityContext): Promise<void> {}
  async onDeath(context: AbilityContext): Promise<void> {}
  async onFocusAttack(context: AbilityContext): Promise<void> {}
  async onAbilityUse(context: AbilityContext): Promise<void> {}
  async onGameStart(context: AbilityContext): Promise<void> {}
  async onGameEnd(context: AbilityContext): Promise<void> {}

  // 시스템 이벤트 핸들러
  async onPerfectGuard(context: AbilityContext): Promise<void> {}

  // 행동 이벤트 핸들러
  async onAttackAction(context: AbilityContext): Promise<void> {}
  async onDefendAction(context: AbilityContext): Promise<void> {}
  async onEvadeAction(context: AbilityContext): Promise<void> {}
  async onPassAction(context: AbilityContext): Promise<void> {}

  // 결과 이벤트 핸들러
  async onDamageDealt(context: AbilityContext): Promise<void> {}
  async onDefenseConsumed(context: AbilityContext): Promise<void> {}
  async onEvadeSuccess(context: AbilityContext): Promise<void> {}
  async onEvadeFail(context: AbilityContext): Promise<void> {}

  // 능력 사용 시 호출
  abstract use(context: AbilityContext): Promise<void>;
  
  // 쿨다운 업데이트
  updateCooldown(): void {
    if (this.cooldown > 0) {
      this.cooldown--;
    }
  }

  resetCooldown(): void {
    this.cooldown = this.maxCooldown;
  }

  isOnCooldown(): boolean {
    return this.cooldown > 0;
  }

  getRemainingCooldown(): number {
    return this.cooldown;
  }

  // 변수 관리 헬퍼 메서드
  protected getVar(context: AbilityContext, key: string): any {
    return context.variables.get(`${context.player.id}_${key}`);
  }

  protected setVar(context: AbilityContext, key: string, value: any): void {
    context.variables.set(`${context.player.id}_${key}`, value);
  }

  protected deleteVar(context: AbilityContext, key: string): void {
    context.variables.delete(`${context.player.id}_${key}`);
  }

  // 로그 헬퍼 메서드
  protected addLog(context: AbilityContext, message: string): void {
    context.logs.push(message);
  }

  // 랜덤 플레이어 선택 헬퍼 메서드
  protected getRandomPlayer(context: AbilityContext, excludeIds: number[] = []): Player | null {
    const availablePlayers = context.players.filter(p => 
      p.status === PlayerStatus.ALIVE && 
      !excludeIds.includes(p.id) &&
      !p.hasDefended &&
      p.evadeCount === 0
    );
    
    if (availablePlayers.length === 0) return null;
    return availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
  }
} 
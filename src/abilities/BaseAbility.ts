import { Player, PlayerStatus } from '../types/game.types';
import { Ability, AbilityContext } from './Ability';

export abstract class BaseAbility implements Ability {
  id: string;
  name: string;
  description: string;
  maxUses: number;
  cooldown: number;

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
  }

  protected formatName(id: string): string {
    return id
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // 능력 사용 시 호출
  abstract use(context: AbilityContext): Promise<void>;
  
  // 턴 시작 시 호출
  async onTurnStart(context: AbilityContext): Promise<void> {
    // 기본 구현은 빈 메서드
  }
  
  // 턴 종료 시 호출
  async onTurnEnd(context: AbilityContext): Promise<void> {
    // 기본 구현은 빈 메서드
  }
  
  // 공격 받을 때 호출
  async onAttack(context: AbilityContext): Promise<void> {
    // 기본 구현은 빈 메서드
  }
  
  // 방어할 때 호출
  async onDefend(context: AbilityContext): Promise<void> {
    // 기본 구현은 빈 메서드
  }
  
  // 회피할 때 호출
  async onEvade(context: AbilityContext): Promise<void> {
    // 기본 구현은 빈 메서드
  }

  async onDamage(context: AbilityContext): Promise<void> {
    // 기본 구현은 빈 메서드
  }

  async onDeath(context: AbilityContext): Promise<void> {
    // 기본 구현은 빈 메서드
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
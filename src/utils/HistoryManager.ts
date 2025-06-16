import { GameState, GameSnapshot, AbilityData } from '../types/game.types';
import { AbilityManager } from '../abilities/AbilityManager';
import { DataManager } from './DataManager';

export class HistoryManager {
  private snapshots: GameSnapshot[] = [];
  private currentIndex: number = -1;

  // 스냅샷 생성
  async createSnapshot(gameState: GameState, abilityManager: AbilityManager): Promise<void> {
    const snapshot: GameSnapshot = {
      gameState: this.cloneGameState(gameState),
      abilityStates: await this.captureAbilityStates(abilityManager),
      metadata: {
        timestamp: Date.now(),
        turnNumber: gameState.currentTurn
      }
    };

    // 현재 인덱스 이후 스냅샷 제거 (새로운 분기 생성)
    this.snapshots = this.snapshots.slice(0, this.currentIndex + 1);
    this.snapshots.push(snapshot);
    this.currentIndex = this.snapshots.length - 1;

    // 파일에 저장
    await DataManager.saveGameSnapshot(snapshot);
  }

  // 롤백
  async rollback(steps: number = 1): Promise<GameSnapshot | null> {
    if (this.currentIndex - steps < 0) return null;
    
    this.currentIndex -= steps;
    const snapshot = this.snapshots[this.currentIndex];
    
    // 파일 시스템의 능력 데이터도 롤백
    await this.restoreAbilityFiles(snapshot.abilityStates);
    
    return snapshot;
  }

  // 재실행
  async redo(steps: number = 1): Promise<GameSnapshot | null> {
    if (this.currentIndex + steps >= this.snapshots.length) return null;
    
    this.currentIndex += steps;
    const snapshot = this.snapshots[this.currentIndex];
    
    // 파일 시스템의 능력 데이터도 복원
    await this.restoreAbilityFiles(snapshot.abilityStates);
    
    return snapshot;
  }

  // 게임 상태 복제
  private cloneGameState(gameState: GameState): GameState {
    return JSON.parse(JSON.stringify(gameState));
  }

  // 능력 상태 캡처
  private async captureAbilityStates(abilityManager: AbilityManager): Promise<Record<string, AbilityData>> {
    const states: Record<string, AbilityData> = {};
    const players = abilityManager.getAllPlayers();

    for (const player of players) {
      const abilities = abilityManager.getPlayerAbilities(player.id);
      for (const ability of abilities) {
        const data = await DataManager.loadAbilityData(player.id, ability.id);
        states[`${player.id}_${ability.id}`] = data;
      }
    }

    return states;
  }

  // 능력 파일 복원
  private async restoreAbilityFiles(states: Record<string, AbilityData>): Promise<void> {
    for (const [key, data] of Object.entries(states)) {
      const [playerId, abilityId] = key.split('_');
      await DataManager.saveAbilityData(Number(playerId), abilityId, data);
    }
  }
} 
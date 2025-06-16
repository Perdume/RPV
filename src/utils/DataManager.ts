import { PlayerRecord, GameRecord, AbilityRecord } from '../types/records.types';
import { GameSessionData } from '../types/game.types';

export class DataManager {
  // 세션 데이터 (Data/)
  static async loadGameSession(): Promise<GameSessionData> {
    try {
      const response = await fetch('/Data/data.json');
      if (!response.ok) {
        throw new Error('Failed to load game session data');
      }
      return await response.json();
    } catch (error) {
      console.error('Error loading game session:', error);
      throw error;
    }
  }

  static async saveGameSession(data: GameSessionData): Promise<void> {
    try {
      const response = await fetch('/Data/data.json', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data, null, 2),
      });
      if (!response.ok) {
        throw new Error('Failed to save game session data');
      }
    } catch (error) {
      console.error('Error saving game session:', error);
      throw error;
    }
  }

  // 플레이어 기록 (src/data/records/)
  static async loadPlayerRecord(playerId: number): Promise<PlayerRecord | null> {
    try {
      const response = await fetch(`/src/data/records/player_${playerId}.json`);
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error(`Error loading player record for ${playerId}:`, error);
      return null;
    }
  }

  static async savePlayerRecord(playerId: number, record: PlayerRecord): Promise<void> {
    try {
      const response = await fetch(`/src/data/records/player_${playerId}.json`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record, null, 2),
      });
      if (!response.ok) {
        throw new Error(`Failed to save player record for ${playerId}`);
      }
    } catch (error) {
      console.error(`Error saving player record for ${playerId}:`, error);
      throw error;
    }
  }

  // 게임 기록 (src/data/records/)
  static async loadGameRecord(gameId: string): Promise<GameRecord | null> {
    try {
      const response = await fetch(`/src/data/records/game_${gameId}.json`);
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error(`Error loading game record for ${gameId}:`, error);
      return null;
    }
  }

  static async saveGameRecord(record: GameRecord): Promise<void> {
    try {
      const response = await fetch(`/src/data/records/game_${record.gameId}.json`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record, null, 2),
      });
      if (!response.ok) {
        throw new Error(`Failed to save game record for ${record.gameId}`);
      }
    } catch (error) {
      console.error(`Error saving game record for ${record.gameId}:`, error);
      throw error;
    }
  }

  // 능력 기록 (src/data/records/)
  static async loadAbilityRecord(abilityId: string): Promise<AbilityRecord | null> {
    try {
      const response = await fetch(`/src/data/records/ability_${abilityId}.json`);
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error(`Error loading ability record for ${abilityId}:`, error);
      return null;
    }
  }

  static async saveAbilityRecord(abilityId: string, record: AbilityRecord): Promise<void> {
    try {
      const response = await fetch(`/src/data/records/ability_${abilityId}.json`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record, null, 2),
      });
      if (!response.ok) {
        throw new Error(`Failed to save ability record for ${abilityId}`);
      }
    } catch (error) {
      console.error(`Error saving ability record for ${abilityId}:`, error);
      throw error;
    }
  }

  // 게임 히스토리 (src/data/history/)
  static async loadGameHistory(gameId: string): Promise<GameRecord[]> {
    try {
      const response = await fetch(`/src/data/history/game_${gameId}_history.json`);
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error(`Error loading game history for ${gameId}:`, error);
      return [];
    }
  }

  static async saveGameHistory(gameId: string, history: GameRecord[]): Promise<void> {
    try {
      const response = await fetch(`/src/data/history/game_${gameId}_history.json`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(history, null, 2),
      });
      if (!response.ok) {
        throw new Error(`Failed to save game history for ${gameId}`);
      }
    } catch (error) {
      console.error(`Error saving game history for ${gameId}:`, error);
      throw error;
    }
  }
} 
import { PlayerRecord, GameRecord, AbilityRecord } from '../types/records.types';
import { GameSessionData, AbilityData, GameSnapshot } from '../types/game.types';
import { initFileSystem } from './fsInit';
import { promises as fs } from 'fs';
import path from 'path';

interface FileSystemError extends Error {
  code?: string;
}

export class DataManager {
  private static readonly DATA_DIR = path.join(process.cwd(), 'src', 'data');
  private static readonly ABILITIES_DIR = path.join(DataManager.DATA_DIR, 'abilities');
  
  // 저장 큐와 디바운싱
  private static saveQueue = new Set<string>();
  private static saveTimeout: NodeJS.Timeout | null = null;
  private static readonly DEBOUNCE_DELAY = 1000; // 1초

  // 파일 크기 제한
  private static readonly MAX_FILE_SIZE = 1024 * 1024; // 1MB

  static {
    // 디렉토리 초기화
    this.initializeDirectories();
  }

  private static async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.DATA_DIR, { recursive: true });
      await fs.mkdir(this.ABILITIES_DIR, { recursive: true });
    } catch (error) {
      console.error('[DataManager] 디렉토리 초기화 실패:', error);
    }
  }

  // 저장 요청을 큐에 추가하고 디바운싱
  private static queueSave(filePath: string): void {
    this.saveQueue.add(filePath);
    
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      this.processSaveQueue();
    }, this.DEBOUNCE_DELAY);
  }

  // 큐에 있는 모든 저장 요청 처리
  private static async processSaveQueue(): Promise<void> {
    const savePromises = Array.from(this.saveQueue).map(async (filePath) => {
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        const parsedData = JSON.parse(data);
        
        // 파일 크기 검증
        if (JSON.stringify(parsedData).length > this.MAX_FILE_SIZE) {
          console.error(`[DataManager] 파일 크기 초과: ${filePath}`);
          return;
        }
        
        await fs.writeFile(filePath, JSON.stringify(parsedData, null, 2));
        console.log(`[DataManager] 저장 완료: ${filePath}`);
      } catch (error) {
        console.error(`[DataManager] 저장 실패: ${filePath}`, error);
      }
    });
    
    await Promise.all(savePromises);
    this.saveQueue.clear();
  }

  private static ensureFsInitialized() {
    if (!window.fs) {
      initFileSystem();
    }
  }

  // 게임 세션 데이터 로드
  static async loadGameSession(): Promise<GameSessionData> {
    this.ensureFsInitialized();
    try {
      const content = await window.fs!.readFile('Data/data.json', { encoding: 'utf8' });
      return JSON.parse(content);
    } catch (error) {
      const fsError = error as FileSystemError;
      if (fsError.code === 'ENOENT') {
        // 파일이 없는 경우 기본 데이터 생성
        const defaultData: GameSessionData = {
          players: [],
          currentTurn: 0,
          lastUpdated: new Date().toISOString()
        };
        await this.saveGameSession(defaultData);
        return defaultData;
      }
      console.error('게임 세션 로드 실패:', fsError.message);
      throw fsError;
    }
  }

  // 게임 세션 데이터 저장
  static async saveGameSession(data: GameSessionData): Promise<void> {
    this.ensureFsInitialized();
    try {
      const content = JSON.stringify(data, null, 2);
      await window.fs!.writeFile('Data/data.json', content, { encoding: 'utf8' });
    } catch (error) {
      const fsError = error as FileSystemError;
      console.error('게임 세션 저장 실패:', fsError.message);
      throw fsError;
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

  // 게임 스냅샷 저장
  static async saveGameSnapshot(snapshot: GameSnapshot): Promise<void> {
    this.ensureFsInitialized();
    try {
      const turnNumber = snapshot.metadata.turnNumber;
      const dir = `src/data/history/Turn_${turnNumber}`;
      const content = JSON.stringify(snapshot, null, 2);
      await window.fs!.writeFile(`${dir}/data.json`, content, { encoding: 'utf8' });
    } catch (error) {
      const fsError = error as FileSystemError;
      console.error('게임 스냅샷 저장 실패:', fsError.message);
      throw fsError;
    }
  }

  // 플레이어 통계 저장
  static async savePlayerStats(playerId: number, stats: any): Promise<void> {
    try {
      const response = await fetch(`/src/data/records/player_stats.json`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stats, null, 2),
      });
      if (!response.ok) {
        throw new Error(`Failed to save player stats for ${playerId}`);
      }
    } catch (error) {
      console.error(`Error saving player stats for ${playerId}:`, error);
      throw error;
    }
  }

  // 능력 통계 저장
  static async saveAbilityStats(abilityId: string, stats: any): Promise<void> {
    try {
      const response = await fetch(`/src/data/records/ability_stats.json`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stats, null, 2),
      });
      if (!response.ok) {
        throw new Error(`Failed to save ability stats for ${abilityId}`);
      }
    } catch (error) {
      console.error(`Error saving ability stats for ${abilityId}:`, error);
      throw error;
    }
  }

  // 능력 데이터 로드
  static async loadAbilityData(playerId: number, abilityId: string): Promise<any> {
    const filePath = path.join(this.ABILITIES_DIR, `${playerId}_${abilityId}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.log(`[DataManager] 새로운 능력 데이터: ${playerId}_${abilityId}`);
      return { variables: {} };
    }
  }

  // 능력 데이터 저장
  static async saveAbilityData(playerId: number, abilityId: string, data: any): Promise<void> {
    const filePath = path.join(this.ABILITIES_DIR, `${playerId}_${abilityId}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    this.queueSave(filePath);
  }

  // 게임 스냅샷 로드
  static async loadGameSnapshot(turnNumber: number): Promise<GameSnapshot | null> {
    this.ensureFsInitialized();
    
    const key = `snapshot_turn_${turnNumber}`;
    
    try {
      if (window.electron?.ipcRenderer) {
        // Electron 환경: 파일 시스템에서 로드
        const content = await window.fs!.readFile(`src/data/history/Turn_${turnNumber}/data.json`, { encoding: 'utf8' });
        return JSON.parse(content);
      } else {
        // 웹 환경: localStorage에서 로드
        const content = localStorage.getItem(key);
        return content ? JSON.parse(content) : null;
      }
    } catch (error) {
      console.error('게임 스냅샷 로드 실패:', error);
      // 폴백: localStorage에서 시도
      const content = localStorage.getItem(key);
      return content ? JSON.parse(content) : null;
    }
  }

  // 능력 데이터 삭제
  static async deleteAbilityData(playerId: number, abilityId: string): Promise<void> {
    const filePath = path.join(this.ABILITIES_DIR, `${playerId}_${abilityId}.json`);
    try {
      await fs.unlink(filePath);
      console.log(`[DataManager] 데이터 삭제 완료: ${playerId}_${abilityId}`);
    } catch (error) {
      console.error(`[DataManager] 데이터 삭제 실패: ${playerId}_${abilityId}`, error);
    }
  }
} 
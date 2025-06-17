import { PlayerRecord, GameRecord, AbilityRecord } from '../types/records.types';
import { GameSessionData, AbilityData, GameSnapshot } from '../types/game.types';
import { initFileSystem } from './fsInit';

interface FileSystemError extends Error {
  code?: string;
}

export class DataManager {
  private static readonly DATA_DIR = 'src/data';
  private static readonly ABILITIES_DIR = `${DataManager.DATA_DIR}/abilities`;
  
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
      await window.fs!.ensureDirectory(this.DATA_DIR);
      await window.fs!.ensureDirectory(this.ABILITIES_DIR);
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
        const data = await window.fs!.readFile(filePath, { encoding: 'utf8' });
        const parsedData = JSON.parse(data);
        
        // 파일 크기 검증
        if (JSON.stringify(parsedData).length > this.MAX_FILE_SIZE) {
          console.error(`[DataManager] 파일 크기 초과: ${filePath}`);
          return;
        }
        
        await window.fs!.writeFile(filePath, JSON.stringify(parsedData, null, 2), { encoding: 'utf8' });
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
    
    const key = `snapshot_turn_${snapshot.metadata.turnNumber}`;
    const content = JSON.stringify(snapshot, null, 2);
    
    try {
      if (!window.electron?.ipcRenderer) {
        // 웹 환경: localStorage 사용
        localStorage.setItem(key, content);
      } else {
        // Electron 환경: 파일 저장
        await window.fs!.writeFile(`src/data/history/${key}.json`, content, { encoding: 'utf8' });
      }
    } catch (error) {
      console.error('게임 스냅샷 저장 실패:', error);
      throw error;
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
    this.ensureFsInitialized();
    
    const fileName = `ability_${playerId}_${abilityId}.json`;
    
    try {
      // 웹 환경에서는 localStorage 사용
      if (!window.electron?.ipcRenderer) {
        const stored = localStorage.getItem(fileName);
        return stored ? JSON.parse(stored) : { variables: {} };
      }
      
      // Electron 환경에서는 파일 시스템 사용
      const content = await window.fs!.readFile(`src/data/abilities/${fileName}`, { encoding: 'utf8' });
      return JSON.parse(content);
    } catch (error) {
      console.log(`[DataManager] 새로운 능력 데이터: ${playerId}_${abilityId}`);
      return { variables: {} };
    }
  }

  // 능력 데이터 저장
  static async saveAbilityData(playerId: number, abilityId: string, data: any): Promise<void> {
    this.ensureFsInitialized();
    
    const fileName = `ability_${playerId}_${abilityId}.json`;
    const content = JSON.stringify(data, null, 2);
    
    try {
      // 웹 환경에서는 localStorage 사용
      if (!window.electron?.ipcRenderer) {
        localStorage.setItem(fileName, content);
        console.log(`[DataManager] localStorage 저장: ${fileName}`);
        return;
      }
      
      // Electron 환경에서는 파일 시스템 사용
      await window.fs!.writeFile(`src/data/abilities/${fileName}`, content, { encoding: 'utf8' });
      console.log(`[DataManager] 파일 저장: ${fileName}`);
    } catch (error) {
      console.error(`[DataManager] 저장 실패: ${fileName}`, error);
      throw error;
    }
  }

  // 게임 스냅샷 로드
  static async loadGameSnapshot(turnNumber: number): Promise<GameSnapshot | null> {
    this.ensureFsInitialized();
    
    const key = `snapshot_turn_${turnNumber}`;
    
    try {
      if (!window.electron?.ipcRenderer) {
        // 웹 환경: localStorage에서 로드
        const content = localStorage.getItem(key);
        return content ? JSON.parse(content) : null;
      } else {
        // Electron 환경: 파일에서 로드
        const content = await window.fs!.readFile(`src/data/history/${key}.json`, { encoding: 'utf8' });
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('게임 스냅샷 로드 실패:', error);
      return null;
    }
  }

  // 능력 데이터 삭제
  static async deleteAbilityData(playerId: number, abilityId: string): Promise<void> {
    const filePath = `${this.ABILITIES_DIR}/${playerId}_${abilityId}.json`;
    try {
      // 파일 삭제는 지원하지 않으므로 빈 파일로 덮어쓰기
      await window.fs!.writeFile(filePath, '', { encoding: 'utf8' });
      console.log(`[DataManager] 데이터 삭제 완료: ${playerId}_${abilityId}`);
    } catch (error) {
      console.error(`[DataManager] 데이터 삭제 실패: ${playerId}_${abilityId}`, error);
    }
  }
} 
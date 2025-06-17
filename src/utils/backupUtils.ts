import { DataManager } from './DataManager';

export class BackupUtils {
  // 모든 백업된 턴 목록 가져오기
  static getBackupTurns(): number[] {
    const turns: number[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('snapshot_turn_')) {
        const turnNumber = parseInt(key.replace('snapshot_turn_', ''));
        if (!isNaN(turnNumber)) {
          turns.push(turnNumber);
        }
      }
    }
    return turns.sort((a, b) => a - b);
  }

  // 백업 상태 확인
  static checkBackupStatus(): void {
    const turns = this.getBackupTurns();
    console.log('📁 백업된 턴 목록:', turns);
    console.log('💾 총 백업 크기:', this.getBackupSize());
  }

  // 백업 크기 계산
  static getBackupSize(): string {
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('snapshot_turn_') || key?.startsWith('ability:')) {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += new Blob([value]).size;
        }
      }
    }
    return `${(totalSize / 1024).toFixed(2)} KB`;
  }

  // 특정 턴 백업 복원
  static async restoreTurn(turnNumber: number): Promise<boolean> {
    try {
      const snapshot = await DataManager.loadGameSnapshot(turnNumber);
      if (snapshot) {
        console.log(`[복원] Turn ${turnNumber} 백업 데이터:`, snapshot);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Turn ${turnNumber} 복원 실패:`, error);
      return false;
    }
  }

  // 백업 정리 (오래된 백업 삭제)
  static cleanOldBackups(keepLastN: number = 10): void {
    const turns = this.getBackupTurns();
    if (turns.length > keepLastN) {
      const turnsToDelete = turns.slice(0, turns.length - keepLastN);
      turnsToDelete.forEach(turn => {
        localStorage.removeItem(`snapshot_turn_${turn}`);
      });
      console.log(`[정리] ${turnsToDelete.length}개의 오래된 백업을 삭제했습니다.`);
    }
  }

  // 자동 백업 상태 모니터링
  static monitorBackupStatus(): void {
    const turns = this.getBackupTurns();
    const latestTurn = Math.max(...turns);
    const backupCount = turns.length;
    
    console.log('📊 백업 상태 리포트:');
    console.log(`- 최신 백업 턴: ${latestTurn}`);
    console.log(`- 총 백업 수: ${backupCount}`);
    console.log(`- 백업 용량: ${this.getBackupSize()}`);
    console.log('- 백업된 턴들:', turns);
    
    // 백업 무결성 검사
    this.validateBackups();
  }

  // 백업 무결성 검사
  static validateBackups(): boolean {
    const turns = this.getBackupTurns();
    let corruptedCount = 0;
    
    turns.forEach(turn => {
      try {
        const key = `snapshot_turn_${turn}`;
        const data = localStorage.getItem(key);
        if (data) {
          JSON.parse(data); // JSON 파싱 테스트
        }
      } catch (error) {
        console.warn(`[검증] Turn ${turn} 백업이 손상되었습니다.`);
        corruptedCount++;
      }
    });
    
    if (corruptedCount === 0) {
      console.log('✅ 모든 백업이 정상입니다.');
      return true;
    } else {
      console.warn(`⚠️ ${corruptedCount}개의 백업이 손상되었습니다.`);
      return false;
    }
  }

  // 실시간 백업 크기 모니터링
  static getDetailedBackupInfo(): void {
    console.group('📁 상세 백업 정보');
    
    const turns = this.getBackupTurns();
    turns.forEach(turn => {
      const key = `snapshot_turn_${turn}`;
      const data = localStorage.getItem(key);
      if (data) {
        const size = new Blob([data]).size;
        const snapshot = JSON.parse(data);
        console.log(`Turn ${turn}: ${(size/1024).toFixed(2)}KB (플레이어 ${snapshot.gameState.players.length}명)`);
      }
    });
    
    console.groupEnd();
  }
} 
import { EventSystem } from './eventSystem';
import { ModifiableEvent, GameEventType } from '../types/game.types';

export class OptimizedEventSystem extends EventSystem {
  private eventQueue: ModifiableEvent[] = [];
  private batchSize: number = 10;
  private processingTimeout: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;

  async emit(event: ModifiableEvent): Promise<void> {
    // 이벤트를 큐에 추가
    this.eventQueue.push(event);
    
    // 배치 처리 스케줄링
    if (!this.processingTimeout && !this.isProcessing) {
      this.processingTimeout = setTimeout(() => {
        this.processBatch();
      }, 0);
    }
  }

  private async processBatch(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.processingTimeout = null;
    
    try {
      const batch = this.eventQueue.splice(0, this.batchSize);
      
      // 배치별로 처리
      for (const event of batch) {
        await super.emit(event);
      }
      
      // 큐에 더 있으면 다음 배치 처리
      if (this.eventQueue.length > 0) {
        this.processingTimeout = setTimeout(() => {
          this.processBatch();
        }, 0);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // 즉시 처리 (긴급한 이벤트용)
  async emitImmediate(event: ModifiableEvent): Promise<void> {
    await super.emit(event);
  }

  // 큐 상태 조회
  getQueueStatus(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.eventQueue.length,
      isProcessing: this.isProcessing
    };
  }

  // 큐 정리
  clearQueue(): void {
    this.eventQueue = [];
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }
  }

  // 배치 크기 조정
  setBatchSize(size: number): void {
    this.batchSize = Math.max(1, size);
  }
} 
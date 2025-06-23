export class GameErrorHandler {
  private errorCounts: Map<string, number> = new Map();
  private maxErrors: number = 10;
  private errorCallbacks: Map<string, (error: GameError) => void> = new Map();
  private disabledSystems: Set<string> = new Set();
  private errorLog: GameError[] = [];

  handleError(context: string, error: any): void {
    const gameError = this.createGameError(context, error);
    
    // 에러 카운트 증가
    const currentCount = this.errorCounts.get(context) || 0;
    this.errorCounts.set(context, currentCount + 1);
    
    // 에러 로그에 추가
    this.errorLog.push(gameError);
    
    // 임계값 초과 시 시스템 보호
    if (currentCount >= this.maxErrors) {
      this.disableSystem(context);
    }
    
    // 에러 로깅
    console.error(`[${context}] 에러 발생 (${currentCount + 1}/${this.maxErrors}):`, gameError);
    
    // 콜백 실행
    const callback = this.errorCallbacks.get(context);
    if (callback) {
      callback(gameError);
    }
  }

  private createGameError(context: string, originalError: any): GameError {
    return {
      context,
      message: originalError.message || '알 수 없는 에러',
      timestamp: Date.now(),
      stack: originalError.stack,
      recoverable: this.isRecoverableError(originalError),
      severity: this.determineSeverity(originalError)
    };
  }

  private isRecoverableError(error: any): boolean {
    // 복구 가능한 에러 판별 로직
    if (error.fatal) return false;
    if (error.code === 'SYSTEM_CRITICAL') return false;
    if (error.message?.includes('메모리 부족')) return false;
    return true;
  }

  private determineSeverity(error: any): 'low' | 'medium' | 'high' | 'critical' {
    if (error.fatal || error.code === 'SYSTEM_CRITICAL') return 'critical';
    if (error.message?.includes('메모리')) return 'high';
    if (error.message?.includes('타임아웃')) return 'medium';
    return 'low';
  }

  private disableSystem(context: string): void {
    this.disabledSystems.add(context);
    console.warn(`[에러 핸들러] ${context} 시스템을 임시 비활성화합니다.`);
  }

  // 에러 복구
  recoverSystem(context: string): void {
    this.errorCounts.set(context, 0);
    this.disabledSystems.delete(context);
    console.log(`[에러 핸들러] ${context} 시스템을 복구합니다.`);
  }

  // 시스템 활성화 상태 확인
  isSystemEnabled(context: string): boolean {
    return !this.disabledSystems.has(context);
  }

  // 에러 콜백 등록
  registerErrorCallback(context: string, callback: (error: GameError) => void): void {
    this.errorCallbacks.set(context, callback);
  }

  // 에러 콜백 제거
  removeErrorCallback(context: string): void {
    this.errorCallbacks.delete(context);
  }

  // 에러 통계 조회
  getErrorStats(): { 
    totalErrors: number; 
    disabledSystems: number; 
    errorCounts: Map<string, number> 
  } {
    return {
      totalErrors: this.errorLog.length,
      disabledSystems: this.disabledSystems.size,
      errorCounts: new Map(this.errorCounts)
    };
  }

  // 에러 로그 조회
  getErrorLog(limit: number = 100): GameError[] {
    return this.errorLog.slice(-limit);
  }

  // 에러 로그 정리
  clearErrorLog(): void {
    this.errorLog = [];
  }

  // 특정 컨텍스트의 에러만 조회
  getErrorsByContext(context: string): GameError[] {
    return this.errorLog.filter(error => error.context === context);
  }

  // 복구 가능한 에러만 조회
  getRecoverableErrors(): GameError[] {
    return this.errorLog.filter(error => error.recoverable);
  }

  // 심각도별 에러 조회
  getErrorsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): GameError[] {
    return this.errorLog.filter(error => error.severity === severity);
  }

  // 모든 시스템 재활성화
  enableAllSystems(): void {
    this.disabledSystems.clear();
    this.errorCounts.clear();
    console.log(`[에러 핸들러] 모든 시스템을 재활성화합니다.`);
  }

  // 에러 임계값 설정
  setMaxErrors(context: string, maxErrors: number): void {
    this.maxErrors = Math.max(1, maxErrors);
  }
}

interface GameError {
  context: string;
  message: string;
  timestamp: number;
  stack?: string;
  recoverable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
} 
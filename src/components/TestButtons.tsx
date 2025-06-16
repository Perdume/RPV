import React from 'react';
import { useEventTesting } from '../utils/manualEventTest';

export const TestButtons: React.FC = () => {
  const { runEventTest, runRollbackTest, runRedoTest } = useEventTesting();

  return (
    <div className="fixed bottom-4 right-4 flex gap-2">
      <button
        onClick={runEventTest}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        이벤트 테스트
      </button>
      <button
        onClick={runRollbackTest}
        className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
      >
        롤백 테스트
      </button>
      <button
        onClick={runRedoTest}
        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
      >
        다시실행 테스트
      </button>
    </div>
  );
}; 
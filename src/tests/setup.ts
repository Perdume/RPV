// Jest 테스트 설정
import { TextEncoder, TextDecoder } from 'util';

// Node.js 환경에서 필요한 전역 객체 설정
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// 성능 API 모킹
global.performance = {
  now: () => Date.now(),
} as any;

// 콘솔 경고 무시 (테스트 중 불필요한 경고 숨김)
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  if (args[0]?.includes?.('deprecated') || args[0]?.includes?.('legacy')) {
    return;
  }
  originalWarn(...args);
}; 
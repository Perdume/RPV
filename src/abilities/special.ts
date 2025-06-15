import { Ability } from './Ability';
import { Debug } from './Debug';

// Create debug ability instance
const debug = new Debug('debug', 999, 'Debug ability', 0);

// Export debug ability as an array
export const SPECIAL_ABILITIES: Ability[] = [
  debug
]; 
import { Ability } from './Ability';
import { Debug } from './Debug';

// Create debug ability instance
const debug = new Debug();

// Export debug ability as an array
export const SPECIAL_ABILITIES: Ability[] = [
  debug
]; 
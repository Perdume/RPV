export interface PlayerRecord {
  totalGames: number;
  wins: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalHealingDone: number;
  totalDefenseUsed: number;
  totalEvades: number;
  favoriteAbility: string;
  mostUsedAbility: string;
  highestDamageDealt: number;
  longestSurvival: number;
  gamesPlayed: {
    gameId: string;
    startTime: string;
    endTime: string;
    result: 'win' | 'lose' | 'draw';
    finalTurn: number;
    abilitiesUsed: string[];
    damageDealt: number;
    damageTaken: number;
    healingDone: number;
    defenseUsed: number;
    evades: number;
  }[];
  abilityStats: {
    [abilityId: string]: {
      timesUsed: number;
      totalDamage: number;
      totalHealing: number;
      totalDefense: number;
      wins: number;
      lastUsed: string;
    };
  };
}

export interface GameRecord {
  gameId: string;
  startTime: string;
  endTime: string;
  players: {
    id: number;
    name: string;
    ability: string;
    result: 'win' | 'lose' | 'draw';
    finalTurn: number;
    damageDealt: number;
    damageTaken: number;
    healingDone: number;
    defenseUsed: number;
    evades: number;
  }[];
  totalTurns: number;
  winner: number | null;
  deathZoneActivated: boolean;
  deathZoneStage: number;
  logs: string[];
}

export interface AbilityRecord {
  abilityId: string;
  totalUses: number;
  totalDamage: number;
  totalHealing: number;
  totalDefense: number;
  wins: number;
  gamesPlayed: number;
  lastUsed: string;
  averageDamage: number;
  averageHealing: number;
  averageDefense: number;
  winRate: number;
} 
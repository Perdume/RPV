import { PlayerRecord, GameRecord, AbilityRecord } from '../types/records.types';
import { Player, PlayerStatus } from '../types/game.types';
import { DataManager } from './DataManager.js';

interface AbilityStats {
  timesUsed: number;
  totalDamage: number;
  totalHealing: number;
  totalDefense: number;
  wins: number;
  lastUsed: string;
}

export class RecordsManager {
  private static instance: RecordsManager;
  private currentGameId: string;
  private gameStartTime: string;
  private playerStats: Map<number, {
    damageDealt: number;
    damageTaken: number;
    healingDone: number;
    defenseUsed: number;
    evades: number;
    abilitiesUsed: Set<string>;
  }>;

  private constructor() {
    this.currentGameId = `game_${Date.now()}`;
    this.gameStartTime = new Date().toISOString();
    this.playerStats = new Map();
  }

  static getInstance(): RecordsManager {
    if (!RecordsManager.instance) {
      RecordsManager.instance = new RecordsManager();
    }
    return RecordsManager.instance;
  }

  // 게임 시작시 초기화
  initializeGame(players: Player[]): void {
    players.forEach(player => {
      this.playerStats.set(player.id, {
        damageDealt: 0,
        damageTaken: 0,
        healingDone: 0,
        defenseUsed: 0,
        evades: 0,
        abilitiesUsed: new Set()
      });
    });
  }

  // 전투 통계 업데이트
  updateCombatStats(
    playerId: number,
    type: 'damageDealt' | 'damageTaken' | 'healingDone' | 'defenseUsed' | 'evades',
    amount: number
  ): void {
    const stats = this.playerStats.get(playerId);
    if (stats) {
      stats[type] += amount;
    }
  }

  // 능력 사용 기록
  recordAbilityUse(playerId: number, abilityId: string): void {
    const stats = this.playerStats.get(playerId);
    if (stats) {
      stats.abilitiesUsed.add(abilityId);
    }
  }

  // 게임 종료시 기록 저장
  async saveGameRecord(
    players: Player[],
    currentTurn: number,
    isDeathZone: boolean,
    deathZoneStage: number,
    logs: string[]
  ): Promise<void> {
    const gameRecord: GameRecord = {
      gameId: this.currentGameId,
      startTime: this.gameStartTime,
      endTime: new Date().toISOString(),
      players: players.map(player => {
        const stats = this.playerStats.get(player.id);
        return {
          id: player.id,
          name: player.name,
          ability: player.ability,
          result: this.determinePlayerResult(player),
          finalTurn: currentTurn,
          damageDealt: stats?.damageDealt || 0,
          damageTaken: stats?.damageTaken || 0,
          healingDone: stats?.healingDone || 0,
          defenseUsed: stats?.defenseUsed || 0,
          evades: stats?.evades || 0
        };
      }),
      totalTurns: currentTurn,
      winner: this.determineWinner(players),
      deathZoneActivated: isDeathZone,
      deathZoneStage,
      logs
    };

    // 게임 기록 저장
    await DataManager.saveGameRecord(gameRecord);

    // 플레이어 기록 업데이트
    await this.updatePlayerRecords(gameRecord);

    // 능력 기록 업데이트
    await this.updateAbilityRecords(gameRecord);
  }

  // 플레이어 결과 결정
  private determinePlayerResult(player: Player): 'win' | 'lose' | 'draw' {
    if (player.status === PlayerStatus.DEAD) return 'lose';
    if (player.status === PlayerStatus.ALIVE) return 'win';
    return 'draw';
  }

  // 승자 결정
  private determineWinner(players: Player[]): number | null {
    const alivePlayers = players.filter(p => p.status === PlayerStatus.ALIVE);
    if (alivePlayers.length === 1) {
      return alivePlayers[0].id;
    }
    return null;
  }

  // 플레이어 기록 업데이트
  private async updatePlayerRecords(gameRecord: GameRecord): Promise<void> {
    for (const playerData of gameRecord.players) {
      const playerRecord = await DataManager.loadPlayerRecord(playerData.id) || this.createEmptyPlayerRecord();
      
      // 기본 통계 업데이트
      playerRecord.totalGames++;
      if (playerData.result === 'win') playerRecord.wins++;
      playerRecord.totalDamageDealt += playerData.damageDealt;
      playerRecord.totalDamageTaken += playerData.damageTaken;
      playerRecord.totalHealingDone += playerData.healingDone;
      playerRecord.totalDefenseUsed += playerData.defenseUsed;
      playerRecord.totalEvades += playerData.evades;

      // 최고 기록 업데이트
      playerRecord.highestDamageDealt = Math.max(
        playerRecord.highestDamageDealt,
        playerData.damageDealt
      );
      playerRecord.longestSurvival = Math.max(
        playerRecord.longestSurvival,
        gameRecord.totalTurns
      );

      // 게임 기록 추가
      playerRecord.gamesPlayed.push({
        gameId: gameRecord.gameId,
        startTime: gameRecord.startTime,
        endTime: gameRecord.endTime,
        result: playerData.result,
        finalTurn: gameRecord.totalTurns,
        abilitiesUsed: Array.from(this.playerStats.get(playerData.id)?.abilitiesUsed || []),
        damageDealt: playerData.damageDealt,
        damageTaken: playerData.damageTaken,
        healingDone: playerData.healingDone,
        defenseUsed: playerData.defenseUsed,
        evades: playerData.evades
      });

      // 능력 통계 업데이트
      const stats = this.playerStats.get(playerData.id);
      if (stats) {
        for (const abilityId of stats.abilitiesUsed) {
          if (!playerRecord.abilityStats[abilityId]) {
            playerRecord.abilityStats[abilityId] = {
              timesUsed: 0,
              totalDamage: 0,
              totalHealing: 0,
              totalDefense: 0,
              wins: 0,
              lastUsed: gameRecord.endTime
            };
          }
          const abilityStats = playerRecord.abilityStats[abilityId];
          abilityStats.timesUsed++;
          abilityStats.lastUsed = gameRecord.endTime;
          if (playerData.result === 'win') abilityStats.wins++;
        }
      }

      // 선호 능력 업데이트
      const mostUsedAbility = Object.entries(playerRecord.abilityStats)
        .sort((a, b) => (b[1] as AbilityStats).timesUsed - (a[1] as AbilityStats).timesUsed)[0];
      if (mostUsedAbility) {
        playerRecord.mostUsedAbility = mostUsedAbility[0];
      }

      await DataManager.savePlayerRecord(playerData.id, playerRecord);
    }
  }

  // 능력 기록 업데이트
  private async updateAbilityRecords(gameRecord: GameRecord): Promise<void> {
    for (const playerData of gameRecord.players) {
      const stats = this.playerStats.get(playerData.id);
      if (!stats) continue;

      for (const abilityId of stats.abilitiesUsed) {
        const abilityRecord = await DataManager.loadAbilityRecord(abilityId) || this.createEmptyAbilityRecord(abilityId);
        
        abilityRecord.totalUses++;
        abilityRecord.gamesPlayed++;
        abilityRecord.lastUsed = gameRecord.endTime;
        
        if (playerData.result === 'win') abilityRecord.wins++;
        
        // 평균 계산
        abilityRecord.averageDamage = abilityRecord.totalDamage / abilityRecord.totalUses;
        abilityRecord.averageHealing = abilityRecord.totalHealing / abilityRecord.totalUses;
        abilityRecord.averageDefense = abilityRecord.totalDefense / abilityRecord.totalUses;
        abilityRecord.winRate = abilityRecord.wins / abilityRecord.gamesPlayed;

        await DataManager.saveAbilityRecord(abilityId, abilityRecord);
      }
    }
  }

  // 빈 플레이어 기록 생성
  private createEmptyPlayerRecord(): PlayerRecord {
    return {
      totalGames: 0,
      wins: 0,
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      totalHealingDone: 0,
      totalDefenseUsed: 0,
      totalEvades: 0,
      favoriteAbility: '',
      mostUsedAbility: '',
      highestDamageDealt: 0,
      longestSurvival: 0,
      gamesPlayed: [],
      abilityStats: {}
    };
  }

  // 빈 능력 기록 생성
  private createEmptyAbilityRecord(abilityId: string): AbilityRecord {
    return {
      abilityId,
      totalUses: 0,
      totalDamage: 0,
      totalHealing: 0,
      totalDefense: 0,
      wins: 0,
      gamesPlayed: 0,
      lastUsed: '',
      averageDamage: 0,
      averageHealing: 0,
      averageDefense: 0,
      winRate: 0
    };
  }
} 
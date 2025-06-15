import { Player, PlayerId, PlayerStatus, GameStateData } from './types';

export class GameState {
  players: Map<PlayerId, Player>;
  currentTurn: number;
  gameOver: boolean;
  survivors: number;
  deathZone: {
    stage: number;
    maxHpReduction: number;
    nextReduction: number;
  };

  constructor() {
    this.players = new Map();
    this.currentTurn = 1;
    this.gameOver = false;
    this.survivors = 0;
    this.deathZone = {
      stage: 1,
      maxHpReduction: 1,
      nextReduction: 10
    };
  }

  loadFromData(data: GameStateData): void {
    this.currentTurn = data.turn;
    this.survivors = data.survivors;
    this.deathZone = data.deathZone;
    
    this.players.clear();
    for (const player of data.players) {
      this.players.set(player.id, { ...player });
    }
  }

  addPlayer(player: Player): void {
    this.players.set(player.id, player);
    this.survivors++;
  }

  getPlayer(id: PlayerId): Player | undefined {
    return this.players.get(id);
  }

  getAlivePlayers(): Player[] {
    return Array.from(this.players.values()).filter(
      player => player.status === PlayerStatus.ALIVE
    );
  }

  processDeathZone(): void {
    if (this.currentTurn >= this.deathZone.nextReduction) {
      this.deathZone.stage++;
      this.deathZone.maxHpReduction++;
      this.deathZone.nextReduction += 10;

      // Apply HP reduction to all players
      for (const player of this.players.values()) {
        if (player.status === PlayerStatus.ALIVE) {
          const oldHp = player.hp;
          player.hp = Math.max(0, player.hp - this.deathZone.maxHpReduction);
          
          if (player.hp <= 0) {
            player.status = PlayerStatus.DEAD;
            this.survivors--;
          }
        }
      }
    }
  }

  checkGameOver(): void {
    const alivePlayers = this.getAlivePlayers();
    this.gameOver = alivePlayers.length <= 1;
  }

  toJSON(): GameStateData {
    return {
      turn: this.currentTurn,
      survivors: this.survivors,
      deathZone: this.deathZone,
      players: Array.from(this.players.values())
    };
  }
} 
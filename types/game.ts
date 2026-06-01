export type TimeControl = 'bullet' | 'blitz' | 'rapid' | 'classical';
export type GameResult = 'white' | 'black' | 'draw';
export type Termination = 'checkmate' | 'resign' | 'timeout' | 'draw' | 'abandoned';

export interface GamePlayer {
  userId: string;
  username: string;
  rating: number;
  ratingChange?: number;
}

export interface GameAccuracy {
  white: number;
  black: number;
}

export interface Game {
  _id: string;
  players: {
    white: GamePlayer;
    black: GamePlayer;
  };
  pgn: string;
  fen: string;
  result?: GameResult;
  termination?: Termination;
  timeControl: string;
  timeControlCategory: TimeControl;
  opening?: string;
  accuracy?: GameAccuracy;
  status: 'waiting' | 'active' | 'completed';
  createdAt: string;
  endedAt?: string;
}

export interface MoveRecord {
  san: string;
  from: string;
  to: string;
  fen: string;
  timestamp: number;
}

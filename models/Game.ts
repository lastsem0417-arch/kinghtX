import mongoose, { Schema, Document, Model } from 'mongoose';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface IGamePlayer {
  userId: mongoose.Types.ObjectId;
  username: string;
  rating: number;
  ratingChange?: number;
}

export interface IGame extends Document {
  players: {
    white: IGamePlayer;
    black: IGamePlayer;
  };
  pgn: string;
  fen: string;
  result?: 'white' | 'black' | 'draw';
  termination?: 'checkmate' | 'resign' | 'timeout' | 'draw' | 'abandoned';
  timeControl: string;
  timeControlCategory: 'bullet' | 'blitz' | 'rapid' | 'classical';
  opening?: string;
  accuracy?: {
    white: number;
    black: number;
  };
  status: 'waiting' | 'active' | 'completed';
  roomId: string;
  createdAt: Date;
  endedAt?: Date;
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const GamePlayerSchema = new Schema<IGamePlayer>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    rating: { type: Number, required: true },
    ratingChange: { type: Number },
  },
  { _id: false }
);

// ─── Main Schema ──────────────────────────────────────────────────────────────

const GameSchema = new Schema<IGame>(
  {
    players: {
      white: { type: GamePlayerSchema, required: true },
      black: { type: GamePlayerSchema, required: true },
    },
    pgn: { type: String, default: '' },
    fen: {
      type: String,
      default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    },
    result: {
      type: String,
      enum: ['white', 'black', 'draw'],
    },
    termination: {
      type: String,
      enum: ['checkmate', 'resign', 'timeout', 'draw', 'abandoned'],
    },
    timeControl: { type: String, required: true },
    timeControlCategory: {
      type: String,
      enum: ['bullet', 'blitz', 'rapid', 'classical'],
      required: true,
    },
    opening: { type: String, default: '' },
    accuracy: {
      white: { type: Number },
      black: { type: Number },
    },
    status: {
      type: String,
      enum: ['waiting', 'active', 'completed'],
      default: 'waiting',
    },
    roomId: { type: String, required: true, unique: true },
    endedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

GameSchema.index({ 'players.white.userId': 1, createdAt: -1 });
GameSchema.index({ 'players.black.userId': 1, createdAt: -1 });
GameSchema.index({ status: 1 });
GameSchema.index({ roomId: 1 });

// ─── Model ────────────────────────────────────────────────────────────────────

const Game: Model<IGame> =
  mongoose.models.Game ?? mongoose.model<IGame>('Game', GameSchema);

export default Game;

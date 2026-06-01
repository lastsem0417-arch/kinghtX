import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPuzzle extends Document {
  puzzleId: string; // Source ID (e.g. Lichess)
  fen: string;
  moves: string[]; // Solution moves (e.g., ["e2e4", "e7e5"])
  rating: number;
  ratingDeviation: number;
  popularity: number;
  themes: string[];
  gameUrl?: string;
  createdAt: Date;
}

const PuzzleSchema = new Schema<IPuzzle>(
  {
    puzzleId: { type: String, required: true, unique: true },
    fen: { type: String, required: true },
    moves: [{ type: String, required: true }],
    rating: { type: Number, required: true, index: true },
    ratingDeviation: { type: Number, required: true },
    popularity: { type: Number, required: true },
    themes: [{ type: String, index: true }],
    gameUrl: { type: String },
  },
  {
    timestamps: true,
  }
);

const Puzzle: Model<IPuzzle> =
  mongoose.models.Puzzle ?? mongoose.model<IPuzzle>('Puzzle', PuzzleSchema);

export default Puzzle;

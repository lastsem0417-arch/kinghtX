import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Puzzle from '@/models/Puzzle';
import User from '@/models/User';
import { getSession } from '@/lib/session';

// Sample puzzles to seed if empty
const samplePuzzles = [
  {
    puzzleId: 'scholar_mate',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    moves: ['h5f7'],
    rating: 600,
    ratingDeviation: 80,
    popularity: 95,
    themes: ['mate', 'mateIn1', 'opening', 'short'],
    gameUrl: 'https://lichess.org/study',
  },
  {
    puzzleId: 'back_rank_mate',
    fen: '6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1',
    moves: ['e1e8'],
    rating: 800,
    ratingDeviation: 75,
    popularity: 98,
    themes: ['mate', 'mateIn1', 'backRankMate', 'endgame'],
    gameUrl: 'https://lichess.org/study',
  },
  {
    puzzleId: 'bishop_sacrifice',
    fen: 'rn1qkbnr/ppp2ppp/3p4/4p3/2B1P1b1/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 4',
    moves: ['c4f7', 'e8f7', 'f3g5', 'f7e8', 'd1g4'],
    rating: 1100,
    ratingDeviation: 60,
    popularity: 90,
    themes: ['tactics', 'fork', 'sacrifice', 'opening'],
    gameUrl: 'https://lichess.org/study',
  }
];

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    // 1. Seed puzzles if database is empty
    const count = await Puzzle.countDocuments();
    if (count === 0) {
      await Puzzle.insertMany(samplePuzzles);
      console.log('Seeded sample chess puzzles successfully.');
    }

    // 2. Fetch user's current puzzle rating
    let userRating = 800;
    const session = await getSession();
    if (session) {
      const user = await User.findById(session.userId);
      if (user) {
        userRating = user.rating.puzzle ?? 800;
      }
    }

    // 3. Query puzzle near user's rating (±200 range)
    let puzzle = await Puzzle.findOne({
      rating: { $gte: userRating - 250, $lte: userRating + 250 }
    });

    // 4. Fallback to any puzzle if none in range
    if (!puzzle) {
      puzzle = await Puzzle.findOne().sort({ rating: 1 });
    }

    return NextResponse.json({ puzzle, userRating });
  } catch (err: any) {
    console.error('Error fetching random puzzle:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

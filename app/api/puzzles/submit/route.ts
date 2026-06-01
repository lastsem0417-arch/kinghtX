import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import Puzzle from '@/models/Puzzle';
import { getSession } from '@/lib/session';

// POST /api/puzzles/submit
// Receives { puzzleId, success } and updates user's puzzle rating accordingly
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { puzzleId, success } = await req.json();

    if (!puzzleId || typeof success !== 'boolean') {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    await connectToDatabase();

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const puzzle = await Puzzle.findOne({ puzzleId });
    if (!puzzle) {
      return NextResponse.json({ error: 'Puzzle not found' }, { status: 404 });
    }

    // Basic Elo rating change
    // If user solves a harder puzzle, they gain more. If they fail an easy one, they lose more.
    // Let's implement a simple difficulty-scaled Elo adjustment:
    const diff = puzzle.rating - user.rating.puzzle;
    let ratingChange = 0;

    if (success) {
      // Correct solution: gain between +5 and +25 depending on difficulty
      ratingChange = Math.max(5, Math.min(25, Math.round(15 + diff * 0.05)));
    } else {
      // Incorrect solution: lose between -5 and -20 depending on difficulty
      ratingChange = Math.max(-20, Math.min(-5, Math.round(-10 + diff * 0.05)));
    }

    const newRating = Math.max(100, user.rating.puzzle + ratingChange);
    
    // Save to user
    await User.findByIdAndUpdate(session.userId, {
      $set: { 'rating.puzzle': newRating }
    });

    return NextResponse.json({ 
      success: true, 
      ratingChange, 
      newRating 
    });
  } catch (err: any) {
    console.error('Error submitting puzzle solution:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

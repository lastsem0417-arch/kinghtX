import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import Game from '@/models/Game';
import User from '@/models/User';
import { getSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      white,
      black,
      pgn,
      fen,
      result,
      termination,
      timeControl = 'Unlimited',
      timeControlCategory = 'classical',
      userColor,
    } = body;

    if (!white || !black || !userColor) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectToDatabase();

    const dummyId = new mongoose.Types.ObjectId('000000000000000000000000');
    const userObjectId = new mongoose.Types.ObjectId(session.userId);

    // 1. Fetch user to update rating
    const user = await User.findById(userObjectId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentRating = user.rating.rapid ?? 1200;
    const opponentRating = userColor === 'white' ? (black.rating ?? 1200) : (white.rating ?? 1200);

    // Score calculation
    let score = 0.5; // default draw
    if (result === 'draw') {
      score = 0.5;
    } else if (result === userColor) {
      score = 1;
    } else {
      score = 0;
    }

    // expected score formula
    const expected = 1 / (1 + Math.pow(10, (opponentRating - currentRating) / 400));
    const kFactor = 17;
    const ratingChange = Math.round(kFactor * (score - expected));
    const newRating = Math.max(100, currentRating + ratingChange);

    // Update user rating and match statistics
    user.rating.rapid = newRating;
    if (score === 1) {
      user.stats.wins = (user.stats.wins ?? 0) + 1;
    } else if (score === 0) {
      user.stats.losses = (user.stats.losses ?? 0) + 1;
    } else {
      user.stats.draws = (user.stats.draws ?? 0) + 1;
    }

    const players = {
      white: {
        userId: userColor === 'white' ? userObjectId : dummyId,
        username: white.username,
        rating: userColor === 'white' ? currentRating : white.rating,
        ratingChange: userColor === 'white' ? ratingChange : 0,
      },
      black: {
        userId: userColor === 'black' ? userObjectId : dummyId,
        username: black.username,
        rating: userColor === 'black' ? currentRating : black.rating,
        ratingChange: userColor === 'black' ? ratingChange : 0,
      },
    };

    const roomId = 'local_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();

    const newGame = new Game({
      players,
      pgn: pgn || '',
      fen: fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      result,
      termination,
      timeControl,
      timeControlCategory,
      status: 'completed',
      roomId,
      endedAt: new Date(),
    });

    await newGame.save();

    // Push to user game history
    user.gameHistory.push(newGame._id as mongoose.Types.ObjectId);
    await user.save();

    return NextResponse.json({
      success: true,
      gameId: newGame._id,
      roomId,
      ratingChange,
      newRating
    });
  } catch (err: any) {
    console.error('Error saving local game:', err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}

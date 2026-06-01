import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import Game from '@/models/Game';
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

    const players = {
      white: {
        userId: userColor === 'white' ? userObjectId : dummyId,
        username: white.username,
        rating: white.rating,
      },
      black: {
        userId: userColor === 'black' ? userObjectId : dummyId,
        username: black.username,
        rating: black.rating,
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

    return NextResponse.json({ success: true, gameId: newGame._id, roomId });
  } catch (err: any) {
    console.error('Error saving local game:', err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}

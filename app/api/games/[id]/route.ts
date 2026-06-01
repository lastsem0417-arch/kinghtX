import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Game from '@/models/Game';
import { getSession } from '@/lib/session';

// GET /api/games/[id] — returns game record by roomId or Mongo ID
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Find game by roomId OR by _id
    let game = await Game.findOne({ roomId: id });

    if (!game && id.match(/^[0-9a-fA-F]{24}$/)) {
      game = await Game.findById(id);
    }

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json({ game });
  } catch (err: any) {
    console.error('Error fetching game details:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

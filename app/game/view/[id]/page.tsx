import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connectToDatabase } from '@/lib/mongodb';
import Game from '@/models/Game';
import GameReplay from '@/components/chess/GameReplay';

export const dynamic = 'force-dynamic';

interface GameViewPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: GameViewPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `KnightX — Game Replay #${id.substring(0, 8)}`,
    description: `Replay and analyze this completed chess match on KnightX.`,
  };
}

export default async function GameViewPage({ params }: GameViewPageProps) {
  const { id } = await params;

  await connectToDatabase();

  // Find game by roomId OR by _id
  let gameRecord = await Game.findOne({ roomId: id });
  
  if (!gameRecord && id.match(/^[0-9a-fA-F]{24}$/)) {
    gameRecord = await Game.findById(id);
  }

  if (!gameRecord) {
    notFound();
  }

  // Convert mongoose document to a plain object for client component safety
  const gameData = {
    _id: gameRecord._id.toString(),
    players: {
      white: {
        username: gameRecord.players.white.username,
        rating: gameRecord.players.white.rating,
        ratingChange: gameRecord.players.white.ratingChange || 0,
      },
      black: {
        username: gameRecord.players.black.username,
        rating: gameRecord.players.black.rating,
        ratingChange: gameRecord.players.black.ratingChange || 0,
      },
    },
    pgn: gameRecord.pgn,
    fen: gameRecord.fen,
    result: gameRecord.result,
    termination: gameRecord.termination,
    timeControl: gameRecord.timeControl,
    timeControlCategory: gameRecord.timeControlCategory,
    roomId: gameRecord.roomId,
    createdAt: gameRecord.createdAt.toISOString(),
  };

  return <GameReplay game={gameData} />;
}

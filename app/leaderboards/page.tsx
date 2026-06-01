import type { Metadata } from 'next';
import Link from 'next/link';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
import { Trophy, Zap, Clock, Rocket, ShieldAlert } from 'lucide-react';

export const metadata: Metadata = {
  title: 'KnightX — Global Leaderboards',
  description: 'View the top-rated chess players globally on KnightX.',
};

export default async function LeaderboardPage() {
  await connectToDatabase();

  // Fetch top 10 for each category
  const topRapid = await User.find({}).sort({ 'rating.rapid': -1 }).limit(10);
  const topBlitz = await User.find({}).sort({ 'rating.blitz': -1 }).limit(10);
  const topBullet = await User.find({}).sort({ 'rating.bullet': -1 }).limit(10);
  const topPuzzle = await User.find({}).sort({ 'rating.puzzle': -1 }).limit(10);

  const session = await getSession();

  const getRankEmoji = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}`;
  };

  return (
    <main className="min-h-screen bg-[#161412] text-white flex flex-col md:flex-row">
      
      {/* ─── SIDE NAVIGATION BAR (Chess.com style) ─── */}
      <aside className="w-full md:w-[68px] md:min-h-screen bg-[#161412] border-b md:border-b-0 md:border-r border-white/[0.06] flex md:flex-col items-center py-4 px-2 justify-between shrink-0">
        <div className="flex md:flex-col items-center gap-4 w-full">
          <Link href="/dashboard" className="text-[#81b64c] text-3xl font-black md:mb-6">♞</Link>
          <nav className="flex md:flex-col gap-2 flex-1 items-center justify-center md:justify-start">
            <Link href="/play" title="Play" className="w-12 h-12 flex items-center justify-center rounded-xl text-[#7a7a6e] hover:text-white hover:bg-[#272522] transition-all">♟</Link>
            <Link href="/puzzles" title="Puzzles" className="w-12 h-12 flex items-center justify-center rounded-xl text-[#7a7a6e] hover:text-white hover:bg-[#272522] transition-all">🧩</Link>
            <Link href="/leaderboards" title="Leaderboards" className="w-12 h-12 flex items-center justify-center rounded-xl text-[#81b64c] bg-[#272522] transition-all">📊</Link>
          </nav>
        </div>
        {session && (
          <Link href={`/profile/${session.username}`} className="h-10 w-10 rounded-full bg-[#81b64c]/20 ring-2 ring-[#81b64c]/50 overflow-hidden hidden md:block">
            <img
              src="https://www.chess.com/bundles/web/images/user-image.007dad08.svg"
              alt="me"
              className="h-full w-full object-cover opacity-60"
            />
          </Link>
        )}
      </aside>

      {/* ─── MAIN CONTENT CONTAINER ─── */}
      <div className="flex-grow max-w-6xl mx-auto w-full p-4 md:p-8 space-y-8 overflow-y-auto">
        <div className="border-b border-white/[0.06] pb-4">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3">
            <Trophy className="h-9 w-9 text-yellow-400" />
            Global Rankings
          </h1>
          <p className="text-sm text-[#7a7a6e] mt-1">
            Top 10 players on the platform classified by category
          </p>
        </div>

        {/* ─── LEADERBOARD CARDS GRID ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* RAPID LEADERBOARD */}
          <div className="bg-[#1a1917] border border-white/[0.08] rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-4 mb-4">
              <Clock className="h-5 w-5 text-green-400" />
              <h2 className="text-base font-black uppercase tracking-wider">⏱ Rapid Rankings</h2>
            </div>
            <Table ranking={topRapid} categoryKey="rapid" currentUsername={session?.username} emojiFunc={getRankEmoji} />
          </div>

          {/* BLITZ LEADERBOARD */}
          <div className="bg-[#1a1917] border border-white/[0.08] rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-4 mb-4">
              <Zap className="h-5 w-5 text-yellow-400" />
              <h2 className="text-base font-black uppercase tracking-wider">⚡ Blitz Rankings</h2>
            </div>
            <Table ranking={topBlitz} categoryKey="blitz" currentUsername={session?.username} emojiFunc={getRankEmoji} />
          </div>

          {/* BULLET LEADERBOARD */}
          <div className="bg-[#1a1917] border border-white/[0.08] rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-4 mb-4">
              <Rocket className="h-5 w-5 text-blue-400" />
              <h2 className="text-base font-black uppercase tracking-wider">🚀 Bullet Rankings</h2>
            </div>
            <Table ranking={topBullet} categoryKey="bullet" currentUsername={session?.username} emojiFunc={getRankEmoji} />
          </div>

          {/* PUZZLE LEADERBOARD */}
          <div className="bg-[#1a1917] border border-white/[0.08] rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-4 mb-4">
              <Trophy className="h-5 w-5 text-purple-400" />
              <h2 className="text-base font-black uppercase tracking-wider">🧩 Puzzle Rankings</h2>
            </div>
            <Table ranking={topPuzzle} categoryKey="puzzle" currentUsername={session?.username} emojiFunc={getRankEmoji} />
          </div>

        </div>
      </div>

    </main>
  );
}

interface TableProps {
  ranking: any[];
  categoryKey: string;
  currentUsername?: string;
  emojiFunc: (i: number) => string;
}

function Table({ ranking, categoryKey, currentUsername, emojiFunc }: TableProps) {
  if (ranking.length === 0) {
    return (
      <div className="text-[#6e6a66] text-xs py-10 text-center flex flex-col items-center gap-1.5">
        <ShieldAlert className="h-8 w-8 text-[#5e5b57] animate-pulse" />
        No players ranked in this category yet.
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-[#7a7a6e] font-bold border-b border-white/[0.04]">
          <th className="text-left py-2 px-1 w-[48px]">Rank</th>
          <th className="text-left py-2 px-2">Player</th>
          <th className="text-right py-2 px-2">Elo</th>
        </tr>
      </thead>
      <tbody>
        {ranking.map((player, index) => {
          const isMe = player.username === currentUsername;
          return (
            <tr 
              key={player._id.toString()}
              className={`
                border-b border-white/[0.03] transition-colors hover:bg-white/[0.01]
                ${isMe ? 'bg-[#81b64c]/5 font-bold' : ''}
              `}
            >
              <td className="py-3 px-1 text-center font-bold text-xs select-none">
                {emojiFunc(index)}
              </td>
              <td className="py-3 px-2">
                <Link 
                  href={`/profile/${player.username}`} 
                  className={`hover:text-[#81b64c] transition-colors flex items-center gap-2`}
                >
                  <span className={isMe ? 'text-[#81b64c]' : 'text-white'}>
                    {player.username}
                  </span>
                  {player.rating.rapid >= 2000 && (
                    <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-extrabold px-1 rounded">
                      GM
                    </span>
                  )}
                </Link>
              </td>
              <td className="py-3 px-2 text-right font-mono text-xs">
                {player.rating[categoryKey]}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

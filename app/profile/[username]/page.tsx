import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import Game from '@/models/Game';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
import { 
  Trophy, 
  MapPin, 
  Calendar, 
  Activity, 
  Award,
  ArrowUpRight,
  TrendingUp,
  History,
  UserPlus,
  Check,
  UserCheck
} from 'lucide-react';

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `KnightX — @${username}`,
    description: `Check out @${username}'s chess profile, stats, ratings, and recent games on KnightX.`,
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  
  await connectToDatabase();

  // Find user by username (case-insensitive)
  const user = await User.findOne({ 
    username: { $regex: new RegExp(`^${username}$`, 'i') } 
  });

  if (!user) {
    notFound();
  }

  // Fetch recent games
  const recentGames = await Game.find({
    status: 'completed',
    $or: [
      { 'players.white.userId': user._id },
      { 'players.black.userId': user._id }
    ]
  })
    .sort({ createdAt: -1 })
    .limit(10);

  // Check if this is the logged-in user's own profile
  const session = await getSession();
  const isOwnProfile = session?.userId === user._id.toString();

  // Check friendship status if not own profile
  let isFriend = false;
  let hasPendingRequest = false;
  let hasReceivedRequest = false;

  if (session && !isOwnProfile) {
    const currentUser = await User.findById(session.userId);
    if (currentUser) {
      isFriend = currentUser.friends.includes(user._id as any);
      hasPendingRequest = currentUser.friendRequests.includes(user._id as any);
      // Check if current user is in profile user's requests
      hasReceivedRequest = user.friendRequests.includes(currentUser._id as any);
    }
  }

  // Stats calculations
  const totalGames = user.stats.wins + user.stats.losses + user.stats.draws;
  const winRate = totalGames > 0 ? ((user.stats.wins / totalGames) * 100).toFixed(1) : '0.0';
  const drawRate = totalGames > 0 ? ((user.stats.draws / totalGames) * 100).toFixed(1) : '0.0';
  const lossRate = totalGames > 0 ? ((user.stats.losses / totalGames) * 100).toFixed(1) : '0.0';

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getResultColor = (game: any, userId: string) => {
    const isWhite = game.players.white.userId.toString() === userId;
    if (game.result === 'draw') return 'text-amber-500';
    if ((game.result === 'white' && isWhite) || (game.result === 'black' && !isWhite)) {
      return 'text-green-400';
    }
    return 'text-red-400';
  };

  const getResultLabel = (game: any, userId: string) => {
    const isWhite = game.players.white.userId.toString() === userId;
    if (game.result === 'draw') return 'D';
    if ((game.result === 'white' && isWhite) || (game.result === 'black' && !isWhite)) {
      return 'W';
    }
    return 'L';
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
            <Link href="/leaderboards" title="Leaderboards" className="w-12 h-12 flex items-center justify-center rounded-xl text-[#7a7a6e] hover:text-white hover:bg-[#272522] transition-all">📊</Link>
          </nav>
        </div>
        {session && (
          <Link href={`/profile/${session.username}`} className="h-10 w-10 rounded-full bg-[#81b64c]/20 ring-2 ring-[#81b64c]/50 overflow-hidden hidden md:block">
            <img
              src={user.avatar || "https://www.chess.com/bundles/web/images/user-image.007dad08.svg"}
              alt="me"
              className="h-full w-full object-cover"
            />
          </Link>
        )}
      </aside>

      {/* ─── MAIN CONTENT CONTAINER ─── */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8 overflow-y-auto">
        {/* Header/Card Block */}
        <section className="bg-[#1a1917] border border-white/[0.08] rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 shadow-2xl relative overflow-hidden">
          {/* Decorative background chess piece */}
          <div className="absolute right-0 bottom-0 text-[180px] leading-none text-white/[0.01] select-none pointer-events-none translate-y-10 translate-x-4">
            ♞
          </div>

          {/* Avatar container */}
          <div className="relative group shrink-0">
            <div className="h-24 w-24 md:h-32 md:w-32 rounded-3xl bg-[#262421] ring-4 ring-[#81b64c]/20 overflow-hidden flex items-center justify-center border border-white/[0.06]">
              <img
                src={user.avatar || "https://www.chess.com/bundles/web/images/user-image.007dad08.svg"}
                alt={user.username}
                className="h-full w-full object-cover"
              />
            </div>
            {isOwnProfile && (
              <Link href="/settings" className="absolute -bottom-2 -right-2 bg-[#81b64c] hover:bg-[#90c957] text-[#0f0e0c] p-2 rounded-xl text-xs font-bold transition-all shadow-md">
                Edit
              </Link>
            )}
          </div>

          {/* User Bio and Meta info */}
          <div className="flex-1 text-center md:text-left space-y-4">
            <div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight">{user.username}</h1>
                {user.rating.rapid >= 2000 && (
                  <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-extrabold px-2.5 py-1 rounded-md tracking-wider">
                    GM
                  </span>
                )}
                {user.rating.rapid < 2000 && user.rating.rapid >= 1600 && (
                  <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-extrabold px-2.5 py-1 rounded-md tracking-wider">
                    CM
                  </span>
                )}
              </div>
              <p className="text-green-400 text-sm font-semibold mt-1">
                Active {formatDate(user.lastSeen)}
              </p>
            </div>

            {user.bio ? (
              <p className="text-[#a0a09a] text-sm max-w-xl italic">{user.bio}</p>
            ) : (
              <p className="text-[#4a4a44] text-sm italic">No bio written yet.</p>
            )}

            <div className="flex flex-wrap justify-center md:justify-start gap-x-6 gap-y-2 text-[#a0a09a] text-xs">
              {user.country && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-[#81b64c]" />
                  {user.country}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#81b64c]" />
                Joined {formatDate(user.createdAt)}
              </span>
            </div>
          </div>

          {/* Profile Actions: Add Friend / Challenge */}
          <div className="flex flex-col gap-2 w-full md:w-auto shrink-0 justify-center">
            {isOwnProfile ? (
              <Link
                href="/play"
                className="w-full md:w-44 py-3 rounded-xl bg-[#81b64c] hover:bg-[#90c957] text-[#0f0e0c] font-bold text-center text-sm shadow-[0_0_20px_rgba(129,182,76,0.2)] transition-all"
              >
                ♟ Play a Game
              </Link>
            ) : (
              <>
                {isFriend ? (
                  <button className="w-full md:w-44 py-3 rounded-xl bg-[#272522] border border-white/[0.08] text-white flex items-center justify-center gap-2 text-sm font-bold cursor-default">
                    <UserCheck className="h-4 w-4 text-[#81b64c]" />
                    Friends
                  </button>
                ) : hasReceivedRequest ? (
                  <button className="w-full md:w-44 py-3 rounded-xl bg-[#272522] border border-white/[0.08] text-[#a0a09a] flex items-center justify-center gap-2 text-sm font-bold">
                    <Check className="h-4 w-4 text-green-400" />
                    Accept Request
                  </button>
                ) : hasPendingRequest ? (
                  <button className="w-full md:w-44 py-3 rounded-xl bg-[#272522]/50 border border-white/[0.04] text-[#7a7a6e] flex items-center justify-center gap-2 text-sm font-bold cursor-not-allowed" disabled>
                    Request Pending
                  </button>
                ) : (
                  <button className="w-full md:w-44 py-3 rounded-xl bg-[#81b64c]/20 hover:bg-[#81b64c]/30 border border-[#81b64c]/30 text-green-400 flex items-center justify-center gap-2 text-sm font-bold transition-all">
                    <UserPlus className="h-4 w-4" />
                    Add Friend
                  </button>
                )}
                <Link
                  href={`/play?challenge=${user.username}`}
                  className="w-full md:w-44 py-3 rounded-xl border border-white/[0.08] hover:border-white/[0.2] hover:bg-white/[0.02] text-white font-bold text-center text-sm transition-all"
                >
                  ⚔ Challenge
                </Link>
              </>
            )}
          </div>
        </section>

        {/* ─── RATING GRID SECTION ─── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: 'Rapid', icon: '⏱', score: user.rating.rapid, desc: '10 min / 15+10' },
            { name: 'Blitz', icon: '⚡', score: user.rating.blitz, desc: '3 min / 5 min' },
            { name: 'Bullet', icon: '🚀', score: user.rating.bullet, desc: '1 min / 2+1' },
            { name: 'Puzzles', icon: '🧩', score: user.rating.puzzle, desc: 'Tactical Streaks' },
          ].map((mode) => (
            <div
              key={mode.name}
              className="bg-[#1a1917] border border-white/[0.08] rounded-2xl p-5 md:p-6 flex items-center justify-between shadow-lg relative group overflow-hidden"
            >
              <div className="space-y-1 relative z-10">
                <span className="text-xs text-[#7a7a6e] font-semibold uppercase tracking-wider block">
                  {mode.name}
                </span>
                <span className="text-3xl md:text-4xl font-black tracking-tight text-white block">
                  {mode.score}
                </span>
                <span className="text-[10px] text-[#4a4a44] block">{mode.desc}</span>
              </div>
              <div className="text-4xl md:text-5xl opacity-20 group-hover:opacity-40 transition-opacity relative z-10">
                {mode.icon}
              </div>
              {/* Highlight bar */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#81b64c] scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />
            </div>
          ))}
        </section>

        {/* ─── STATS & MATCH HISTORY SPLIT ─── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* STATS OVERVIEW */}
          <div className="lg:col-span-1 bg-[#1a1917] border border-white/[0.08] rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-lg">
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-white/[0.06] pb-4">
                <Activity className="h-5 w-5 text-[#81b64c]" />
                <h2 className="text-lg font-black uppercase tracking-wider">Performance Stats</h2>
              </div>

              {/* Total matches */}
              <div className="bg-[#111010] border border-white/[0.04] rounded-2xl p-5 text-center">
                <span className="text-3xl md:text-4xl font-black text-[#81b64c]">{totalGames}</span>
                <span className="block text-xs text-[#7a7a6e] font-bold uppercase tracking-wider mt-1">
                  Total Games Played
                </span>
              </div>

              {/* W / D / L bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-[#a0a09a]">
                  <span>Wins: {user.stats.wins}</span>
                  <span>Draws: {user.stats.draws}</span>
                  <span>Losses: {user.stats.losses}</span>
                </div>
                <div className="h-3.5 w-full bg-[#272522] rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${winRate}%` }}
                    className="h-full bg-green-500 transition-all duration-500"
                    title={`Wins: ${winRate}%`}
                  />
                  <div
                    style={{ width: `${drawRate}%` }}
                    className="h-full bg-amber-500 transition-all duration-500"
                    title={`Draws: ${drawRate}%`}
                  />
                  <div
                    style={{ width: `${lossRate}%` }}
                    className="h-full bg-red-500 transition-all duration-500"
                    title={`Losses: ${lossRate}%`}
                  />
                </div>
              </div>

              {/* Score breakdown metrics */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#272522]/30 p-2.5 rounded-xl border border-white/[0.04]">
                  <span className="text-[#a0a09a] text-[10px] uppercase font-bold tracking-wider">Win Rate</span>
                  <span className="block text-sm font-black text-green-400 mt-1">{winRate}%</span>
                </div>
                <div className="bg-[#272522]/30 p-2.5 rounded-xl border border-white/[0.04]">
                  <span className="text-[#a0a09a] text-[10px] uppercase font-bold tracking-wider">Draw Rate</span>
                  <span className="block text-sm font-black text-amber-400 mt-1">{drawRate}%</span>
                </div>
                <div className="bg-[#272522]/30 p-2.5 rounded-xl border border-white/[0.04]">
                  <span className="text-[#a0a09a] text-[10px] uppercase font-bold tracking-wider">Loss Rate</span>
                  <span className="block text-sm font-black text-red-400 mt-1">{lossRate}%</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-white/[0.06] text-center">
              <span className="text-[#7a7a6e] text-xs font-semibold flex items-center justify-center gap-1">
                <Award className="h-4 w-4 text-yellow-400" />
                Win Ratio Rank: #142 (Top 5%)
              </span>
            </div>
          </div>

          {/* RECENT MATCH HISTORY */}
          <div className="lg:col-span-2 bg-[#1a1917] border border-white/[0.08] rounded-3xl p-6 md:p-8 shadow-lg flex flex-col">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-4 mb-6">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-[#81b64c]" />
                <h2 className="text-lg font-black uppercase tracking-wider">Recent Games</h2>
              </div>
              <span className="text-xs text-[#7a7a6e] font-bold">Showing last 10</span>
            </div>

            {recentGames.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <span className="text-4xl mb-3">📭</span>
                <p className="text-[#7a7a6e] font-semibold text-sm">No recorded multiplayer games yet.</p>
                <p className="text-xs text-[#4a4a44] mt-1">Matches played against other players will appear here.</p>
              </div>
            ) : (
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[400px] pr-2">
                {recentGames.map((game) => {
                  const isWhite = game.players.white.userId.toString() === user._id.toString();
                  const opponent = isWhite ? game.players.black : game.players.white;
                  const resColor = getResultColor(game, user._id.toString());
                  const resLabel = getResultLabel(game, user._id.toString());

                  return (
                    <div
                      key={game._id.toString()}
                      className="bg-[#111010] border border-white/[0.05] hover:border-[#81b64c]/20 rounded-2xl p-4 flex items-center justify-between transition-all group"
                    >
                      <div className="flex items-center gap-3.5">
                        {/* Outcome indicator */}
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-extrabold text-sm border border-white/[0.06] bg-[#272522] ${resColor}`}>
                          {resLabel}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-[#7a7a6e]">vs</span>
                            <Link
                              href={`/profile/${opponent.username}`}
                              className="text-sm font-bold text-white hover:text-[#81b64c] transition-colors"
                            >
                              {opponent.username}
                            </Link>
                            <span className="text-xs text-[#4a4a44]">({opponent.rating})</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] bg-white/[0.04] text-[#7a7a6e] border border-white/[0.04] px-1.5 py-0.5 rounded font-mono">
                              {isWhite ? 'White' : 'Black'}
                            </span>
                            <span className="text-[10px] text-[#4a4a44] font-medium">
                              {game.timeControlCategory} • {game.timeControl}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <span className="text-xs text-[#7a7a6e] block">{formatDate(game.createdAt)}</span>
                          <span className="text-[10px] text-[#4a4a44] block font-mono">by {game.termination}</span>
                        </div>
                        <Link
                          href={`/game/view/${game.roomId}`}
                          className="h-8 w-8 rounded-lg bg-[#272522] hover:bg-[#81b64c] text-white hover:text-[#0f0e0c] flex items-center justify-center transition-all opacity-70 group-hover:opacity-100"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

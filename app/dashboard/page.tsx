import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/session';
import { logout } from '@/app/actions/auth';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import Game from '@/models/Game';
import SocialPanel from '@/components/dashboard/SocialPanel';
import LeftNavbar from '@/components/chess/LeftNavbar';
import { 
  Trophy, 
  Zap, 
  Clock, 
  Rocket, 
  Cpu, 
  Activity, 
  Gamepad2,
  Sparkles
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'KnightX — Chess Dashboard',
  description: 'Your central hub for matchmaking, stats, analysis, puzzles, and social play on KnightX.',
};

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  await connectToDatabase();

  const user = await User.findById(session.userId)
    .populate({
      path: 'friends',
      select: 'username avatar rating lastSeen',
      options: { sort: { lastSeen: -1 } }
    })
    .populate({
      path: 'friendRequests',
      select: 'username avatar rating'
    });

  if (!user) {
    redirect('/login');
  }

  // Fetch recent completed games
  const recentGames = await Game.find({
    $or: [
      { 'players.white.userId': user._id },
      { 'players.black.userId': user._id }
    ],
    status: 'completed'
  })
  .sort({ createdAt: -1 })
  .limit(5);

  const friendsData = (user.friends || []).map((f: any) => ({
    _id: f._id.toString(),
    username: f.username,
    avatar: f.avatar,
    rating: {
      rapid: f.rating?.rapid ?? 800,
      blitz: f.rating?.blitz ?? 800,
    },
    lastSeen: f.lastSeen.toISOString(),
  }));

  const requestsData = (user.friendRequests || []).map((r: any) => ({
    _id: r._id.toString(),
    username: r.username,
    avatar: r.avatar,
    rating: {
      rapid: r.rating?.rapid ?? 800,
    },
  }));

  const recentGamesData = recentGames.map((g: any) => ({
    _id: g._id.toString(),
    players: {
      white: {
        userId: g.players.white.userId.toString(),
        username: g.players.white.username,
        rating: g.players.white.rating,
        ratingChange: g.players.white.ratingChange ?? 0,
      },
      black: {
        userId: g.players.black.userId.toString(),
        username: g.players.black.username,
        rating: g.players.black.rating,
        ratingChange: g.players.black.ratingChange ?? 0,
      },
    },
    pgn: g.pgn,
    fen: g.fen,
    result: g.result,
    termination: g.termination,
    timeControl: g.timeControl,
    timeControlCategory: g.timeControlCategory,
  }));

  const totalGames = user.stats.wins + user.stats.losses + user.stats.draws;
  const winRate = totalGames > 0 ? ((user.stats.wins / totalGames) * 100).toFixed(0) : '0';

  const serializedUser = {
    username: user.username,
    avatar: user.avatar,
    rating: {
      rapid: user.rating?.rapid ?? 800,
    },
  };

  return (
    <main className="min-h-screen bg-[#161412] text-white flex flex-col md:flex-row">
      
      {/* ─── SIDE NAVIGATION BAR (Chess.com style) ─── */}
      <LeftNavbar activeUser={serializedUser} />

      {/* ─── CENTER ARENA (Quick actions, ratings, stats) ─── */}
      <div className="flex-grow max-w-7xl mx-auto w-full p-4 md:p-8 flex flex-col xl:flex-row gap-6 overflow-y-auto">
        
        {/* Main Column */}
        <div className="flex-grow space-y-6 min-w-0">
          
          {/* Welcome Card */}
          <div className="bg-gradient-to-br from-[#1a1917] via-[#1d1c1a] to-[#141312] border border-white/[0.08] rounded-3xl p-6 md:p-8 shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col sm:flex-row justify-between items-center gap-6 group hover:border-[#81b64c]/20 transition-all duration-300">
            <div className="absolute right-0 bottom-0 text-[180px] leading-none text-white/[0.01] select-none pointer-events-none translate-y-12 transition-transform duration-500 group-hover:scale-105 group-hover:text-white/[0.02]">
              ♞
            </div>
            
            <div className="space-y-2.5 z-10 text-center sm:text-left">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                Welcome back,{' '}
                <span className="text-[#81b64c] hover:text-[#90c957] transition-colors">
                  <Link href={`/profile/${user.username}`}>@{user.username}</Link>
                </span>!
              </h1>
              <p className="text-xs text-[#a0a09a] max-w-md leading-relaxed">
                Ranked matchmaking, AI chess coaches, computer bots, and tactical reviews are live. Start your next session below.
              </p>
            </div>

            <div className="z-10 w-full sm:w-auto shrink-0">
              <Link
                href="/play"
                className="
                  block px-8 py-4 rounded-xl bg-[#81b64c] hover:bg-[#90c957]
                  text-[#0f0e0c] font-black text-sm tracking-wide text-center
                  shadow-[0_0_20px_rgba(129,182,76,0.25)] hover:shadow-[0_0_25px_rgba(129,182,76,0.45)]
                  transition-all duration-200 active:scale-[0.98]
                "
              >
                ♟ Play Online
              </Link>
            </div>
          </div>

          {/* Premium Subscription Banner (Pay Now) */}
          <div className="bg-gradient-to-br from-[#1a1917] via-[#21201d] to-[#141b10] border-2 border-[#81b64c]/20 rounded-3xl p-6 md:p-8 shadow-[0_15px_35px_rgba(0,0,0,0.6)] relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6 transition-all duration-300 hover:border-[#81b64c]/40">
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#81b64c]/5 rounded-full blur-[80px] pointer-events-none translate-x-20 -translate-y-20" />
            <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-amber-500/5 rounded-full blur-[60px] pointer-events-none -translate-x-10 translate-y-10" />

            <div className="space-y-4 z-10 w-full md:max-w-xl">
              <div className="flex items-center gap-2">
                <span className="bg-[#81b64c]/10 border border-[#81b64c]/30 text-[#81b64c] text-[10px] font-black tracking-wider uppercase px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-[0_0_12px_rgba(129,182,76,0.15)]">
                  <Sparkles className="h-3 w-3 fill-current" />
                  KnightX Premium
                </span>
                <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black tracking-wider uppercase px-2.5 py-1 rounded-full">
                  👑 Lifetime Access
                </span>
              </div>
              
              <div className="space-y-1.5">
                <h2 className="text-xl md:text-2xl font-black text-white leading-tight">
                  Unlock the Ultimate Chess Toolkit
                </h2>
                <p className="text-xs text-[#a0a09a] leading-relaxed">
                  Go premium today to experience unlimited features, custom audio training, and grandmaster-level analytics.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {[
                  { title: "🗣️ Voice Coaching", desc: "5 expert tutors explaining moves" },
                  { title: "⚡ Deep Review", desc: "Detailed move classification graphs" },
                  { title: "🤖 40+ Custom Bots", desc: "Novice to Grandmaster computers" }
                ].map((feat, idx) => (
                  <div key={idx} className="bg-black/30 border border-white/[0.04] p-3 rounded-xl">
                    <span className="text-[11px] font-black text-white block mb-0.5">{feat.title}</span>
                    <span className="text-[10px] text-[#7a7a6e] font-semibold block">{feat.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="z-10 w-full md:w-auto shrink-0 flex flex-col items-center gap-2">
              <Link
                href="/register"
                className="
                  w-full md:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 via-emerald-600 to-[#81b64c] hover:from-amber-600 hover:via-emerald-700 hover:to-[#90c957]
                  text-[#0f0e0c] font-black text-sm tracking-wide text-center
                  shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:shadow-[0_0_25px_rgba(129,182,76,0.5)]
                  transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap
                "
              >
                💎 Pay Now & Upgrade
              </Link>
              <span className="text-[10px] text-[#7a7a6e] font-bold tracking-wide">Secure Checkout via KnightX</span>
            </div>
          </div>

          {/* Quick Play options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link 
              href="/puzzles"
              className="bg-[#1a1917]/80 backdrop-blur-md border border-white/[0.08] hover:border-[#81b64c]/40 hover:bg-[#272522]/40 p-5 rounded-2xl flex items-center justify-between transition-all duration-300 group shadow-md hover:-translate-y-0.5"
            >
              <div className="space-y-1">
                <span className="text-[10px] text-[#7a7a6e] font-black uppercase tracking-wider block">Puzzles</span>
                <span className="text-base font-extrabold text-white block group-hover:text-[#81b64c] transition-colors">Tactics Trainer</span>
                <span className="text-[10px] text-[#4a4a44] block">Train Chess Streaks</span>
              </div>
              <span className="text-3xl p-2.5 bg-[#111010] rounded-xl border border-white/[0.05] group-hover:bg-[#81b64c]/10 transition-all">🧩</span>
            </Link>
 
            <Link 
              href="/bots"
              className="bg-[#1a1917]/80 backdrop-blur-md border border-white/[0.08] hover:border-[#81b64c]/40 hover:bg-[#272522]/40 p-5 rounded-2xl flex items-center justify-between transition-all duration-300 group shadow-md hover:-translate-y-0.5"
            >
              <div className="space-y-1">
                <span className="text-[10px] text-[#7a7a6e] font-black uppercase tracking-wider block">Computer Bots</span>
                <span className="text-base font-extrabold text-white block group-hover:text-[#81b64c] transition-colors">Play vs Bots</span>
                <span className="text-[10px] text-[#4a4a44] block">40 Custom AI Bots</span>
              </div>
              <span className="text-3xl p-2.5 bg-[#111010] rounded-xl border border-white/[0.05] group-hover:bg-[#81b64c]/10 transition-all">🤖</span>
            </Link>
 
            <Link 
              href="/coaches"
              className="bg-[#1a1917]/80 backdrop-blur-md border border-white/[0.08] hover:border-[#81b64c]/40 hover:bg-[#272522]/40 p-5 rounded-2xl flex items-center justify-between transition-all duration-300 group shadow-md hover:-translate-y-0.5"
            >
              <div className="space-y-1">
                <span className="text-[10px] text-[#7a7a6e] font-black uppercase tracking-wider block">AI Training</span>
                <span className="text-base font-extrabold text-white block group-hover:text-[#81b64c] transition-colors">Voice Coaches</span>
                <span className="text-[10px] text-[#4a4a44] block">5 Voice Instructors</span>
              </div>
              <span className="text-3xl p-2.5 bg-[#111010] rounded-xl border border-white/[0.05] group-hover:bg-[#81b64c]/10 transition-all">🎓</span>
            </Link>
 
            <Link 
              href="/analysis"
              className="bg-[#1a1917]/80 backdrop-blur-md border border-white/[0.08] hover:border-[#81b64c]/40 hover:bg-[#272522]/40 p-5 rounded-2xl flex items-center justify-between transition-all duration-300 group shadow-md hover:-translate-y-0.5"
            >
              <div className="space-y-1">
                <span className="text-[10px] text-[#7a7a6e] font-black uppercase tracking-wider block">Review Board</span>
                <span className="text-base font-extrabold text-white block group-hover:text-[#81b64c] transition-colors">Self-Analysis</span>
                <span className="text-[10px] text-[#4a4a44] block">Stockfish 10 WASM</span>
              </div>
              <span className="text-3xl p-2.5 bg-[#111010] rounded-xl border border-white/[0.05] group-hover:bg-[#81b64c]/10 transition-all">💻</span>
            </Link>
          </div>

          {/* Recent Games log */}
          <div className="bg-[#1a1917]/80 backdrop-blur-md border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-4 hover:border-white/[0.12] transition-colors duration-300">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Gamepad2 className="h-5 w-5 text-[#81b64c]" />
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Recent Games</h3>
              </div>
              <span className="text-xs text-[#7a7a6e] font-bold">{recentGamesData.length} Completed</span>
            </div>

            {recentGamesData.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#7a7a6e] font-semibold">
                No games played yet. Join a match to record game history!
              </div>
            ) : (
              <div className="space-y-3">
                {recentGamesData.map((gameItem: any) => {
                  const isWhite = gameItem.players.white.userId === user._id.toString();
                  const player = isWhite ? gameItem.players.white : gameItem.players.black;
                  const opponent = isWhite ? gameItem.players.black : gameItem.players.white;
                  
                  const isWin = gameItem.result === (isWhite ? 'white' : 'black');
                  const isDraw = gameItem.result === 'draw';
                  
                  const ratingChange = player.ratingChange ?? 0;
                  const changeSign = ratingChange >= 0 ? '+' : '';
                  const changeColor = ratingChange >= 0 ? 'text-green-400' : 'text-red-400';

                  return (
                    <div 
                      key={gameItem._id}
                      className="bg-[#111010] hover:bg-[#151413] border border-white/[0.03] hover:border-white/[0.08] p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span 
                          className={`
                            w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs uppercase shrink-0
                            ${isWin 
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                              : isDraw 
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'}
                          `}
                        >
                          {isWin ? 'W' : isDraw ? 'D' : 'L'}
                        </span>
                        
                        <div>
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-[#a0a09a] font-medium">vs</span>
                            {opponent.userId === '000000000000000000000000' ? (
                              <span className="font-extrabold text-white">{opponent.username}</span>
                            ) : (
                              <Link 
                                href={`/profile/${opponent.username}`}
                                className="font-extrabold text-[#81b64c] hover:underline"
                              >
                                {opponent.username}
                              </Link>
                            )}
                            <span className="text-[#4a4a44] font-mono">({opponent.rating})</span>
                          </div>
                          
                          <div className="text-[10px] text-[#7a7a6e] font-semibold flex items-center gap-2 mt-0.5">
                            <span>{gameItem.timeControl}</span>
                            <span>•</span>
                            <span>{gameItem.termination}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-right font-mono text-xs">
                          <span className="text-white font-bold">{player.rating}</span>
                          {ratingChange !== 0 && (
                            <span className={`text-[10px] font-bold ml-1.5 ${changeColor}`}>
                              {changeSign}{ratingChange}
                            </span>
                          )}
                        </div>

                        <Link
                          href={`/game/review/${gameItem._id}`}
                          className="
                            px-4 py-2 rounded-xl bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 border border-[#3b82f6]/20
                            text-[#60a5fa] hover:text-white font-extrabold text-xs transition-all flex items-center gap-1
                          "
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Review
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Side Panel for Stats & Social */}
        <div className="w-full xl:w-[320px] xl:min-w-[320px] space-y-6 shrink-0">
          
          {/* Ratings grid */}
          <div className="bg-[#1a1917]/80 backdrop-blur-md border border-white/[0.08] rounded-3xl p-5 shadow-xl space-y-3 hover:border-white/[0.12] transition-colors duration-300">
            <span className="text-[10px] text-[#7a7a6e] font-bold uppercase tracking-wider block border-b border-white/[0.04] pb-2">Ratings Overview</span>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Rapid', score: user.rating.rapid, icon: <Clock className="h-3.5 w-3.5 text-green-400" /> },
                { label: 'Blitz', score: user.rating.blitz, icon: <Zap className="h-3.5 w-3.5 text-yellow-400" /> },
                { label: 'Bullet', score: user.rating.bullet, icon: <Rocket className="h-3.5 w-3.5 text-blue-400" /> },
                { label: 'Puzzle', score: user.rating.puzzle, icon: <Trophy className="h-3.5 w-3.5 text-purple-400" /> },
              ].map((rating) => (
                <div key={rating.label} className="bg-[#111010] border border-white/[0.03] rounded-xl p-3 shadow-md flex flex-col justify-between">
                  <span className="text-[9px] text-[#7a7a6e] font-bold uppercase tracking-wider flex items-center gap-1">
                    {rating.icon}
                    {rating.label}
                  </span>
                  <span className="text-xl font-black text-white block font-mono mt-1">{rating.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Performance stats */}
          <div className="bg-[#1a1917]/80 backdrop-blur-md border border-white/[0.08] rounded-3xl p-5 shadow-xl space-y-4 hover:border-white/[0.12] transition-colors duration-300">
            <div className="flex items-center gap-2 border-b border-white/[0.04] pb-2">
              <Activity className="h-4 w-4 text-[#81b64c]" />
              <span className="text-[10px] text-[#7a7a6e] font-bold uppercase tracking-wider">Performance Overview</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-[#111010] border border-white/[0.03] p-2.5 rounded-xl">
                <span className="text-[9px] text-[#7a7a6e] font-bold uppercase">Wins</span>
                <span className="block font-black text-green-400 text-base font-mono mt-0.5">{user.stats.wins}</span>
              </div>
              <div className="bg-[#111010] border border-white/[0.03] p-2.5 rounded-xl">
                <span className="text-[9px] text-[#7a7a6e] font-bold uppercase">Draws</span>
                <span className="block font-black text-amber-400 text-base font-mono mt-0.5">{user.stats.draws}</span>
              </div>
              <div className="bg-[#111010] border border-white/[0.03] p-2.5 rounded-xl">
                <span className="text-[9px] text-[#7a7a6e] font-bold uppercase">Losses</span>
                <span className="block font-black text-red-400 text-base font-mono mt-0.5">{user.stats.losses}</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs text-[#a0a09a] font-semibold">
                <span>Overall Win Ratio</span>
                <span className="text-white font-mono">{winRate}%</span>
              </div>
              <div className="h-2 w-full bg-[#111010] rounded-full overflow-hidden border border-white/[0.03]">
                <div 
                  className="h-full bg-green-500 rounded-full transition-all duration-500" 
                  style={{ width: `${winRate}%` }} 
                />
              </div>
            </div>
          </div>

          {/* Social / Friends */}
          <div className="bg-[#1a1917]/80 backdrop-blur-md border border-white/[0.08] rounded-3xl p-5 shadow-xl h-[400px] overflow-hidden hover:border-white/[0.12] transition-colors duration-300">
            <SocialPanel friends={friendsData} friendRequests={requestsData} currentUserId={user._id.toString()} />
          </div>

        </div>

      </div>

    </main>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { Trophy, ArrowLeft, ShieldAlert, Star, Play, Sparkles } from "lucide-react";
import { CHESS_BOTS, ChessBot } from "@/lib/bots";
import LeftNavbar from "@/components/chess/LeftNavbar";

export default function BotsSelectionPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<"beginner" | "intermediate" | "advanced" | "expert">("beginner");
  const [userStars, setUserStars] = useState<Record<string, number>>({});
  const [selectedBot, setSelectedBot] = useState<ChessBot | null>(null);
  const [playColor, setPlayColor] = useState<"white" | "black" | "random">("white");
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    async function fetchUserProgress() {
      try {
        const res = await axios.get("/api/users/me");
        if (res.data?.user) {
          setCurrentUser(res.data.user);
          if (res.data.user.botProgress) {
            setUserStars(res.data.user.botProgress);
          }
        }
      } catch (err) {
        console.error("Failed to load user bot progress:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchUserProgress();
  }, []);

  const filteredBots = CHESS_BOTS.filter(b => b.category === activeCategory);

  const getStarsForBot = (botId: string) => {
    return userStars[botId] || 0;
  };

  const handleStartGame = () => {
    if (!selectedBot) return;
    router.push(`/game/bot?botId=${selectedBot.id}&color=${playColor}&hints=${hintsEnabled}`);
  };

  return (
    <main className="min-h-screen bg-[#161412] text-white flex flex-col md:flex-row relative">
      
      {/* ─── SIDE NAVIGATION BAR ─── */}
      <LeftNavbar activeUser={currentUser} />

      {/* ─── MAIN ARENA ─── */}
      <div className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8 overflow-y-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/[0.06] pb-4">
          <div className="space-y-1">
            <button onClick={() => router.push("/dashboard")} className="flex items-center gap-1.5 text-xs text-[#7a7a6e] hover:text-white transition-colors mb-2">
              <ArrowLeft className="h-4.5 w-4.5" /> Back to Dashboard
            </button>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-[#81b64c]" /> Play with Chess Bots
            </h1>
            <p className="text-xs text-[#a0a09a]">
              Challenge 40 unique virtual opponents ranging from novice to grandmaster level. Defeat them to earn up to 3 stars!
            </p>
          </div>
        </div>

        {/* Categories Tab Selector */}
        <div className="flex bg-[#1a1917] p-1.5 rounded-2xl border border-white/[0.06] max-w-md shrink-0">
          {(["beginner", "intermediate", "advanced", "expert"] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`
                flex-1 py-2.5 text-xs font-black capitalize rounded-xl transition-all duration-150
                ${activeCategory === cat 
                  ? "bg-[#81b64c] text-[#0f0e0c] shadow-lg" 
                  : "text-[#7a7a6e] hover:text-white hover:bg-[#272522]/50"}
              `}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid of Bots */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[180px] bg-[#1a1917] animate-pulse rounded-2xl border border-white/[0.04]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBots.map((bot) => {
              const stars = getStarsForBot(bot.id);
              return (
                <div 
                  key={bot.id}
                  className="
                    bg-[#1a1917] border border-white/[0.08] hover:border-[#81b64c]/30 hover:bg-[#272522]/20
                    p-5 rounded-2xl flex flex-col justify-between transition-all duration-200 group relative shadow-md
                  "
                >
                  <div className="space-y-4">
                    {/* Bot Meta */}
                    <div className="flex items-center gap-3.5">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${bot.avatarColor} flex items-center justify-center text-3xl shadow-inner shrink-0 border border-white/[0.06]`}>
                        {bot.avatar}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-base leading-none text-white">{bot.name}</span>
                          <span className="bg-[#111010] text-[#81b64c] border border-[#81b64c]/20 text-[10px] font-mono px-2 py-0.5 rounded font-black tracking-wider leading-none">
                            {bot.rating} ELO
                          </span>
                        </div>
                        <p className="text-[10px] text-[#7a7a6e] mt-1 line-clamp-1 capitalize font-semibold">
                          Category: {bot.category}
                        </p>
                        
                        {/* Stars Earned */}
                        <div className="flex items-center gap-0.5 mt-1">
                          {Array.from({ length: 3 }).map((_, idx) => (
                            <Star 
                              key={idx} 
                              className={`h-3.5 w-3.5 ${
                                idx < stars 
                                  ? "fill-yellow-400 text-yellow-400" 
                                  : "text-white/[0.08]"
                              }`} 
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-[#a0a09a] leading-snug line-clamp-2 min-h-[2.5rem]">
                      {bot.description}
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedBot(bot)}
                    className="
                      w-full mt-4 py-2.5 rounded-xl border border-[#81b64c]/20 bg-[#81b64c]/5 group-hover:bg-[#81b64c]
                      text-[#81b64c] group-hover:text-[#0f0e0c] font-black text-xs transition-all duration-200
                      flex items-center justify-center gap-1.5 active:scale-[0.98]
                    "
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Challenge Bot
                  </button>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ─── SETUP MODAL OVERLAY ─── */}
      {selectedBot && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1917] border border-white/[0.1] rounded-3xl p-6 max-w-md w-full space-y-6 shadow-2xl relative">
            
            {/* Header */}
            <div className="text-center space-y-2">
              <div className={`w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br ${selectedBot.avatarColor} flex items-center justify-center text-4xl shadow-inner border border-white/[0.06]`}>
                {selectedBot.avatar}
              </div>
              <h3 className="text-xl font-black text-white">Play vs {selectedBot.name}</h3>
              <p className="text-xs text-[#81b64c] font-bold font-mono">Rating: {selectedBot.rating} ELO</p>
            </div>

            {/* Config Choices */}
            <div className="space-y-4">
              
              {/* Choose Side */}
              <div className="space-y-2">
                <span className="text-[10px] text-[#7a7a6e] font-black uppercase tracking-wider block">Choose Side</span>
                <div className="grid grid-cols-3 gap-2">
                  {(["white", "random", "black"] as const).map((side) => (
                    <button
                      key={side}
                      onClick={() => setPlayColor(side)}
                      className={`
                        py-2.5 rounded-xl border text-xs font-bold capitalize transition-all
                        ${playColor === side 
                          ? "bg-white text-black border-white" 
                          : "bg-[#111010] text-[#a0a09a] border-white/[0.06] hover:text-white"}
                      `}
                    >
                      {side}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle Hints */}
              <div className="flex justify-between items-center bg-[#111010] p-4 rounded-2xl border border-white/[0.04]">
                <div className="space-y-0.5">
                  <span className="text-xs font-extrabold text-white block">Enable Hints</span>
                  <span className="text-[10px] text-[#7a7a6e] block">Win with hints yields max 2 stars</span>
                </div>
                <button
                  onClick={() => setHintsEnabled(!hintsEnabled)}
                  className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${
                    hintsEnabled ? "bg-[#81b64c]" : "bg-[#272522] border border-white/[0.08]"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                      hintsEnabled ? "left-6.5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setSelectedBot(null)}
                className="
                  py-3.5 rounded-xl bg-[#272522] border border-white/[0.06] text-white hover:bg-[#33312e] font-extrabold text-xs transition-all
                "
              >
                Cancel
              </button>
              <button
                onClick={handleStartGame}
                className="
                  py-3.5 rounded-xl bg-[#81b64c] hover:bg-[#90c957] text-[#0f0e0c] font-black text-xs transition-all shadow-[0_0_15px_rgba(129,182,76,0.2)]
                "
              >
                Play Match
              </button>
            </div>

          </div>
        </div>
      )}

    </main>
  );
}

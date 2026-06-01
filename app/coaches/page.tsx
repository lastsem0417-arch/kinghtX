"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { GraduationCap, ArrowLeft, Play, Sparkles } from "lucide-react";
import LeftNavbar from "@/components/chess/LeftNavbar";
import { CHESS_COACHES, ChessCoach } from "@/lib/coaches";

export default function CoachesSelectionPage() {
  const router = useRouter();
  const [selectedCoach, setSelectedCoach] = useState<ChessCoach | null>(null);
  const [playColor, setPlayColor] = useState<"white" | "black" | "random">("white");
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await axios.get("/api/users/me");
        if (res.data?.user) {
          setCurrentUser(res.data.user);
        }
      } catch (err) {
        console.error("Failed to load user info:", err);
      }
    }
    fetchUser();
  }, []);

  const handleStartTraining = () => {
    if (!selectedCoach) return;
    router.push(`/game/coach?coachId=${selectedCoach.id}&color=${playColor}`);
  };

  return (
    <main className="min-h-screen bg-[#161412] text-white flex flex-col md:flex-row relative">
      
      {/* ─── SIDE NAVIGATION BAR ─── */}
      <LeftNavbar activeUser={currentUser} />

      {/* ─── MAIN CONTENT ARENA ─── */}
      <div className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-8 overflow-y-auto space-y-8">
        
        {/* Header */}
        <div className="space-y-2 border-b border-white/[0.06] pb-4">
          <button onClick={() => router.push("/dashboard")} className="flex items-center gap-1.5 text-xs text-[#7a7a6e] hover:text-white transition-colors mb-2">
            <ArrowLeft className="h-4.5 w-4.5" /> Back to Dashboard
          </button>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2.5">
            <GraduationCap className="h-7 w-7 text-[#81b64c]" /> Interactive Voice Coaches
          </h1>
          <p className="text-xs text-[#a0a09a]">
            Play unlimited matches against custom-themed chess coaches. During the match, Stockfish evaluates your play in real-time. If you blunder, your coach will halt the game, explain what went wrong out loud, and let you undo your move!
          </p>
        </div>

        {/* Coaches Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CHESS_COACHES.map((coach) => (
            <div
              key={coach.id}
              className="
                bg-[#1a1917] border border-white/[0.08] hover:border-[#81b64c]/30 hover:bg-[#272522]/20
                p-6 rounded-3xl flex flex-col justify-between transition-all duration-200 group relative shadow-md
              "
            >
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${coach.avatarColor} flex items-center justify-center text-4xl shadow-inner shrink-0 border`}>
                    {coach.avatar}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">{coach.name}</h3>
                    <span className="text-xs text-[#81b64c] font-bold block">{coach.title}</span>
                    <span className="text-[10px] text-[#7a7a6e] font-semibold bg-[#111010] px-2 py-0.5 rounded-lg border border-white/[0.03] inline-block mt-1 font-mono">
                      Style: {coach.style}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#a0a09a] leading-relaxed">
                  {coach.description}
                </p>
              </div>

              <button
                onClick={() => setSelectedCoach(coach)}
                className="
                  w-full mt-6 py-3 rounded-xl border border-[#81b64c]/20 bg-[#81b64c]/5 group-hover:bg-[#81b64c]
                  text-[#81b64c] group-hover:text-[#0f0e0c] font-black text-xs transition-all duration-200
                  flex items-center justify-center gap-1.5 active:scale-[0.98]
                "
              >
                <GraduationCap className="h-4 w-4" />
                Train with {coach.name}
              </button>
            </div>
          ))}
        </div>

      </div>

      {/* ─── SETUP MODAL OVERLAY ─── */}
      {selectedCoach && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1917] border border-white/[0.1] rounded-3xl p-6 max-w-md w-full space-y-6 shadow-2xl relative">
            
            {/* Header */}
            <div className="text-center space-y-2">
              <div className={`w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br ${selectedCoach.avatarColor} flex items-center justify-center text-4xl shadow-inner border`}>
                {selectedCoach.avatar}
              </div>
              <h3 className="text-xl font-black text-white">Train with Coach {selectedCoach.name}</h3>
              <p className="text-xs text-[#81b64c] font-bold font-mono">{selectedCoach.title}</p>
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

            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setSelectedCoach(null)}
                className="
                  py-3.5 rounded-xl bg-[#272522] border border-white/[0.06] text-white hover:bg-[#33312e] font-extrabold text-xs transition-all
                "
              >
                Cancel
              </button>
              <button
                onClick={handleStartTraining}
                className="
                  py-3.5 rounded-xl bg-[#81b64c] hover:bg-[#90c957] text-[#0f0e0c] font-black text-xs transition-all shadow-[0_0_15px_rgba(129,182,76,0.2)]
                "
              >
                Start Training
              </button>
            </div>

          </div>
        </div>
      )}

    </main>
  );
}

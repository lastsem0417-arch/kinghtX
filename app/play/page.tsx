"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useUserStore } from "@/store/useUserStore";
import { useGameStore } from "@/store/useGameStore";
import { getCurrentUser } from "@/services/authService";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import LeftNavbar from "@/components/chess/LeftNavbar";

export default function PlayPage() {
  const router = useRouter();
  const { user, setUser, setLoading } = useUserStore();
  const {
    connectSocket,
    matchmakingStatus,
    timeControl,
    queueDuration,
    joinQueue,
    leaveQueue,
    roomId,
    opponent,
    color,
  } = useGameStore();

  const [selectedMode, setSelectedMode] = useState("10 min");
  const [rated, setRated] = useState(true);

  // Connect socket and fetch user if not present
  useEffect(() => {
    const init = async () => {
      // 1. Fetch user if store is empty
      if (!user) {
        setLoading(true);
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        } else {
          // Fallback redirect if session failed (proxy should handle this too)
          router.push("/login");
          return;
        }
      }
      // 2. Connect WebSockets
      connectSocket();
    };
    init();
  }, [user, setUser, setLoading, connectSocket, router]);

  // Handle redirect on match found
  useEffect(() => {
    if (matchmakingStatus === "matched" && roomId) {
      const timer = setTimeout(() => {
        router.push(`/game/${roomId}`);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [matchmakingStatus, roomId, router]);

  const sections = [
    {
      title: "Bullet",
      icon: "⚡",
      modes: ["1 min", "1 | 1", "2 | 1"],
    },
    {
      title: "Blitz",
      icon: "⚡⚡",
      modes: ["3 min", "3 | 2", "5 min"],
    },
    {
      title: "Rapid",
      icon: "⏱",
      modes: ["10 min", "15 | 10", "30 min"],
    },
  ];

  // Helper to get rating for category
  const getUserRatingForSelected = () => {
    if (!user) return 800;
    const tc = selectedMode.toLowerCase();
    if (tc.includes("1 min") || tc.includes("1 | 1") || tc.includes("2 | 1")) {
      return user.rating.bullet;
    }
    if (tc.includes("3 min") || tc.includes("3 | 2") || tc.includes("5 min")) {
      return user.rating.blitz;
    }
    return user.rating.rapid;
  };

  function handleStartMatchmaking() {
    joinQueue(selectedMode);
  }

  function formatQueueTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  return (
    <main className="min-h-screen bg-[#161412] text-white flex flex-col md:flex-row">
      <LeftNavbar activeUser={user} />
      <div className="flex-grow h-screen overflow-hidden p-4 flex flex-col md:flex-row gap-4">
        {/* LEFT PANEL - logo and preview board */}
        <div className="flex-1 flex flex-col justify-center min-w-0">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-[#81b64c] text-4xl">♞</span>
            <span className="text-white text-3xl font-black tracking-tight">
              KNIGHT<span className="text-[#81b64c]">X</span>
            </span>
          </div>

          {/* BOARD PREVIEW */}
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <div className="w-full h-full flex items-center justify-center">
              <img
                src="/images/board-preview.png"
                alt="chess board"
                className="
                  max-h-[80vh]
                  max-w-full
                  object-contain
                  rounded-3xl
                  border
                  border-white/[0.08]
                  shadow-[0_0_50px_rgba(0,0,0,0.6)]
                "
                draggable={false}
              />
            </div>
          </div>
        </div>

        {/* RIGHT DASHBOARD PANEL */}
        <div
          className="
            w-full md:w-[380px]
            md:min-w-[380px]
            h-full
            bg-[#1a1917]
            rounded-3xl
            border
            border-white/[0.08]
            flex
            flex-col
            shadow-2xl
            overflow-hidden
          "
        >
          {/* TOP NAV BAR */}
          <div className="grid grid-cols-4 border-b border-white/[0.08] bg-[#1a1917] shrink-0">
            {["Play", "New Game", "Games", "Players"].map((item, index) => (
              <button
                key={index}
                className={`py-5 text-sm font-semibold transition-all ${
                  index === 0
                    ? "bg-[#272522] text-[#81b64c] border-b-2 border-[#81b64c]"
                    : "text-[#7a7a6e] hover:text-white hover:bg-[#272522]/50"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {/* DYNAMIC SCREEN AREA */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col">
            {matchmakingStatus === "idle" && (
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                <div className="space-y-6">
                  {/* Selected Time Control Summary */}
                  <div className="bg-[#111010] border border-white/[0.05] rounded-2xl p-5 flex items-center justify-between">
                    <div>
                      <p className="text-[#7a7a6e] text-xs font-bold uppercase tracking-wider mb-1">
                        Time Control
                      </p>
                      <h2 className="text-3xl font-black text-white">
                        {selectedMode}
                      </h2>
                    </div>
                    <div className="text-4xl">⏱</div>
                  </div>

                  {/* Rating display */}
                  <div className="bg-[#111010] border border-white/[0.05] rounded-2xl p-4 flex items-center justify-between text-sm">
                    <span className="text-[#a0a09a] font-medium">Estimated Rating:</span>
                    <span className="font-extrabold text-[#81b64c] text-lg bg-[#81b64c]/10 px-3 py-1 rounded-lg">
                      {getUserRatingForSelected()} Elo
                    </span>
                  </div>

                  {/* Rated Toggle */}
                  <div className="flex items-center justify-between px-2 pt-2">
                    <div>
                      <h2 className="text-base font-black">Rated Match</h2>
                      <p className="text-xs text-[#7a7a6e]">
                        Results will affect your ranking
                      </p>
                    </div>
                    <button
                      onClick={() => setRated(!rated)}
                      className={`w-14 h-7 rounded-full transition-all relative shrink-0 ${
                        rated ? "bg-[#81b64c]" : "bg-[#272522] border border-white/[0.08]"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all shadow-md ${
                          rated ? "left-7.5" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Mode Categories */}
                  <div className="space-y-5 pt-2">
                    {sections.map((section) => (
                      <div key={section.title} className="space-y-2">
                        <div className="flex items-center gap-1.5 px-1">
                          <span className="text-xs">{section.icon}</span>
                          <span className="text-xs font-bold uppercase tracking-wider text-[#a0a09a]">
                            {section.title}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {section.modes.map((mode) => (
                            <button
                              key={mode}
                              onClick={() => setSelectedMode(mode)}
                              className={`py-3.5 rounded-xl font-black text-sm transition-all border ${
                                selectedMode === mode
                                  ? "bg-[#81b64c]/15 text-[#81b64c] border-[#81b64c] shadow-[0_0_15px_rgba(129,182,76,0.15)]"
                                  : "bg-[#111010] border-white/[0.04] text-[#a0a09a] hover:bg-[#272522] hover:text-white"
                              }`}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Start Button */}
                <button
                  onClick={handleStartMatchmaking}
                  className="
                    w-full py-5 rounded-2xl
                    bg-[#81b64c] hover:bg-[#90c957]
                    transition-all text-[#0f0e0c]
                    text-xl font-black tracking-wide
                    shadow-[0_0_30px_rgba(129,182,76,0.25)]
                    hover:shadow-[0_0_35px_rgba(129,182,76,0.35)]
                    active:scale-[0.99]
                    mt-8
                  "
                >
                  Play Online
                </button>
              </div>
            )}

            {/* MATCHMAKING SEARCH SCREEN */}
            {matchmakingStatus === "searching" && (
              <div className="flex-1 flex flex-col justify-between items-center py-8">
                <div className="text-center space-y-6 pt-10">
                  {/* Spinning/pulsing animation */}
                  <div className="relative flex items-center justify-center h-28 w-28 mx-auto">
                    <div className="absolute inset-0 rounded-full bg-[#81b64c]/10 animate-ping" />
                    <div className="absolute inset-2 rounded-full bg-[#81b64c]/20 animate-pulse" />
                    <div className="relative h-20 w-20 rounded-full bg-[#272522] border border-[#81b64c]/50 flex items-center justify-center text-5xl">
                      ♞
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-black">Searching for Opponent</h3>
                    <p className="text-sm text-[#7a7a6e] mt-1">
                      {timeControl} • Rated Match
                    </p>
                  </div>

                  <div className="bg-[#111010] border border-white/[0.05] rounded-xl px-4 py-2.5 inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 text-[#81b64c] animate-spin" />
                    <span className="text-sm font-mono tracking-widest text-[#a0a09a]">
                      {formatQueueTime(queueDuration)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={leaveQueue}
                  className="
                    w-full py-4 rounded-xl
                    bg-[#272522] hover:bg-red-500/10
                    border border-white/[0.08] hover:border-red-500/20
                    text-[#a0a09a] hover:text-red-400
                    font-bold text-sm transition-all
                  "
                >
                  Cancel Search
                </button>
              </div>
            )}

            {/* MATCH FOUND TRANSITION SCREEN */}
            {matchmakingStatus === "matched" && (
              <div className="flex-1 flex flex-col justify-center items-center text-center space-y-8 py-10">
                <div className="h-24 w-24 rounded-full bg-green-500/20 border border-green-500 text-green-400 flex items-center justify-center text-5xl animate-bounce">
                  ✔
                </div>

                <div>
                  <h3 className="text-2xl font-black text-green-400 tracking-tight">
                    Match Found!
                  </h3>
                  <p className="text-sm text-[#7a7a6e] mt-1">
                    Preparing the chessboard...
                  </p>
                </div>

                {opponent && (
                  <div className="bg-[#111010] border border-white/[0.06] rounded-2xl p-5 w-full space-y-4">
                    <div className="flex justify-between items-center text-sm border-b border-white/[0.04] pb-3">
                      <span className="text-[#7a7a6e]">Your Color:</span>
                      <span className="font-extrabold uppercase text-white tracking-widest text-xs">
                        {color === "white" ? "⬜ White" : "⬛ Black"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-xl shrink-0">
                        👤
                      </div>
                      <div className="text-left">
                        <span className="font-bold text-white block">
                          {opponent.username}
                        </span>
                        <span className="text-xs text-[#7a7a6e]">
                          Rating: {opponent.rating} Elo
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-xs text-[#4a4a44]">
                  Redirecting in a moment...
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
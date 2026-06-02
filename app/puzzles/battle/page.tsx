"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import BoardSection from "@/components/chess/BoardSection";
import LeftNavbar from "@/components/chess/LeftNavbar";
import { useGameStore } from "@/store/useGameStore";
import axios from "axios";
import { Trophy, Flame, Play, RefreshCw, XCircle, CheckCircle, Clock, Volume2, User as UserIcon } from "lucide-react";

interface ClientPuzzle {
  index: number;
  puzzleId: string;
  fen: string;
  rating: number;
  themes: string[];
  blunder: string; // moves[0]
  solutionLength: number;
  moves: string[];
}

interface PlayerStats {
  userId: string;
  score: number;
  strikes: number;
  finished: boolean;
  currentIndex: number;
}

export default function PuzzleBattlePage() {
  const router = useRouter();
  const { socket, connectSocket } = useGameStore();

  const [currentUser, setCurrentUser] = useState<any>(null);

  // States
  const [battleState, setBattleState] = useState<"lobby" | "queue" | "battle" | "over">("lobby");
  const [battleId, setBattleId] = useState<string | null>(null);
  const [puzzles, setPuzzles] = useState<ClientPuzzle[]>([]);
  
  // Players
  const [me, setMe] = useState<{ userId: string; username: string; rating: number; score: number; strikes: number; finished: boolean } | null>(null);
  const [opponent, setOpponent] = useState<{ userId: string; username: string; rating: number; score: number; strikes: number; finished: boolean } | null>(null);

  // Active puzzle gameplay
  const [currentPuzzleIdx, setCurrentPuzzleIdx] = useState(0);
  const [game, setGame] = useState(new Chess());
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [lastMoveSquares, setLastMoveSquares] = useState<any>({});
  
  // Timer
  const [timeLeft, setTimeLeft] = useState(180);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Puzzle validation indices
  const movesIndexRef = useRef(1);
  const movesRef = useRef<string[]>([]);

  // Sounds
  const moveSound = useRef<HTMLAudioElement | null>(null);
  const captureSound = useRef<HTMLAudioElement | null>(null);
  const checkSound = useRef<HTMLAudioElement | null>(null);
  const correctSound = useRef<HTMLAudioElement | null>(null);
  const wrongSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    moveSound.current = new Audio("/sounds/move.mp3");
    captureSound.current = new Audio("/sounds/capture.mp3");
    checkSound.current = new Audio("/sounds/move-check.mp3");
    correctSound.current = new Audio("/sounds/game-start.mp3");
    wrongSound.current = new Audio("/sounds/game-end.mp3");

    connectSocket();

    axios.get("/api/users/me").then((res) => {
      if (res.data?.user) {
        setCurrentUser(res.data.user);
      }
    }).catch((err) => console.error("Failed to load user in puzzle battle:", err));
  }, []);

  // Socket routing
  useEffect(() => {
    if (!socket) return;

    const handleQueueJoined = () => {
      setBattleState("queue");
    };

    const handleQueueLeft = () => {
      setBattleState("lobby");
    };

    const handleBattleStarted = (data: any) => {
      setBattleId(data.battleId);
      setPuzzles(data.puzzles);
      setCurrentPuzzleIdx(0);
      setTimeLeft(data.duration);
      setBattleState("battle");

      // Setup players
      const isP1Me = data.p1.userId === currentUser?._id;
      const myInfo = isP1Me ? data.p1 : data.p2;
      const oppInfo = isP1Me ? data.p2 : data.p1;

      setMe({ ...myInfo, score: 0, strikes: 0, finished: false });
      setOpponent({ ...oppInfo, score: 0, strikes: 0, finished: false });

      // Start timer
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Load first puzzle
      loadPuzzle(data.puzzles[0]);
    };

    const handleBattleSync = (data: { p1: PlayerStats; p2: PlayerStats }) => {
      const isP1Me = data.p1.userId === currentUser?._id;
      const myUpdate = isP1Me ? data.p1 : data.p2;
      const oppUpdate = isP1Me ? data.p2 : data.p1;

      setMe((prev: any) => prev ? { ...prev, score: myUpdate.score, strikes: myUpdate.strikes, finished: myUpdate.finished } : null);
      setOpponent((prev: any) => prev ? { ...prev, score: oppUpdate.score, strikes: oppUpdate.strikes, finished: oppUpdate.finished } : null);

      if (myUpdate.finished && me && !me.finished) {
        setMe((prev: any) => prev ? { ...prev, finished: true } : null);
      }
    };

    const handleBattleOver = (data: any) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setBattleState("over");
    };

    socket.on("puzzle_queue_joined", handleQueueJoined);
    socket.on("puzzle_queue_left", handleQueueLeft);
    socket.on("puzzle_battle_started", handleBattleStarted);
    socket.on("puzzle_battle_sync", handleBattleSync);
    socket.on("puzzle_battle_over", handleBattleOver);

    return () => {
      socket.off("puzzle_queue_joined", handleQueueJoined);
      socket.off("puzzle_queue_left", handleQueueLeft);
      socket.on("puzzle_battle_started", handleBattleStarted);
      socket.off("puzzle_battle_sync", handleBattleSync);
      socket.off("puzzle_battle_over", handleBattleOver);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [socket, currentUser]);

  const loadPuzzle = (puz: ClientPuzzle) => {
    if (!puz) return;

    movesRef.current = puz.moves;
    movesIndexRef.current = 1;

    const tempChess = new Chess(puz.fen);

    // Play initial blunder move
    const blunder = puz.blunder;
    const from = blunder.substring(0, 2);
    const to = blunder.substring(2, 4);
    const promo = blunder.length > 4 ? blunder.charAt(4) : undefined;

    const result = tempChess.move({ from, to, promotion: promo });
    if (result) {
      if (result.captured) captureSound.current?.play().catch(() => {});
      else moveSound.current?.play().catch(() => {});
    }

    setGame(tempChess);
    setBoardOrientation(tempChess.turn() === "w" ? "white" : "black");
    setLastMoveSquares({
      [from]: { backgroundColor: "rgba(255, 255, 0, 0.2)" },
      [to]: { backgroundColor: "rgba(255, 255, 0, 0.2)" },
    });
  };

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (battleState !== "battle" || me?.finished || opponent?.finished) return false;

    const expectedMove = movesRef.current[movesIndexRef.current];
    const playedMove = sourceSquare + targetSquare;

    // Check correctness
    if (playedMove !== expectedMove && playedMove !== expectedMove + "q") {
      // Wrong move! Play error sound, increment local strikes
      wrongSound.current?.play().catch(() => {});
      
      // Submit wrong attempt
      if (socket && battleId) {
        socket.emit("puzzle_battle_submit", { battleId, isCorrect: false });
      }

      advanceNextPuzzle();
      return false;
    }

    // Correct move
    try {
      const tempChess = new Chess(game.fen());
      const result = tempChess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q"
      });

      if (result) {
        if (tempChess.isCheck()) checkSound.current?.play().catch(() => {});
        else if (result.captured) captureSound.current?.play().catch(() => {});
        else moveSound.current?.play().catch(() => {});

        setLastMoveSquares({
          [sourceSquare]: { backgroundColor: "rgba(34, 197, 94, 0.25)" },
          [targetSquare]: { backgroundColor: "rgba(34, 197, 94, 0.25)" },
        });

        movesIndexRef.current += 1;
        setGame(tempChess);

        if (movesIndexRef.current >= movesRef.current.length) {
          // Solved fully!
          correctSound.current?.play().catch(() => {});
          if (socket && battleId) {
            socket.emit("puzzle_battle_submit", { battleId, isCorrect: true });
          }
          advanceNextPuzzle();
        } else {
          // Play opponent response
          setTimeout(() => {
            const nextOppMove = movesRef.current[movesIndexRef.current];
            const opFrom = nextOppMove.substring(0, 2);
            const opTo = nextOppMove.substring(2, 4);
            const opPromo = nextOppMove.length > 4 ? nextOppMove.charAt(4) : undefined;

            const opChess = new Chess(tempChess.fen());
            const opResult = opChess.move({ from: opFrom, to: opTo, promotion: opPromo });

            if (opResult) {
              if (opChess.isCheck()) checkSound.current?.play().catch(() => {});
              else if (opResult.captured) captureSound.current?.play().catch(() => {});
              else moveSound.current?.play().catch(() => {});
            }

            setLastMoveSquares({
              [opFrom]: { backgroundColor: "rgba(255, 255, 0, 0.2)" },
              [opTo]: { backgroundColor: "rgba(255, 255, 0, 0.2)" },
            });
            movesIndexRef.current += 1;
            setGame(opChess);
          }, 500);
        }
        return true;
      }
    } catch {
      return false;
    }
    return false;
  };

  const advanceNextPuzzle = () => {
    const nextIdx = currentPuzzleIdx + 1;
    if (nextIdx < puzzles.length) {
      setCurrentPuzzleIdx(nextIdx);
      loadPuzzle(puzzles[nextIdx]);
    } else {
      // Finished all puzzles
      setMe((prev: any) => prev ? { ...prev, finished: true } : null);
    }
  };

  // Lobby actions
  const handleJoinQueue = () => {
    if (socket) socket.emit("join_puzzle_battle_queue");
  };

  const handleLeaveQueue = () => {
    if (socket) socket.emit("leave_puzzle_battle_queue");
  };

  const handleBackToLobby = () => {
    setBattleState("lobby");
    setBattleId(null);
  };

  // Formatting helper
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#161412] text-white flex flex-col md:flex-row relative">
      <LeftNavbar activeUser={currentUser} />

      <div className="flex-grow flex flex-col items-center justify-center p-6 bg-[#161412] relative">
        
        {/* ─── LOBBY VIEW ─── */}
        {battleState === "lobby" && (
          <div className="max-w-md w-full text-center space-y-6 bg-[#1a1917] p-8 border border-white/[0.08] rounded-3xl shadow-2xl relative overflow-hidden">
            <div className="space-y-2.5">
              <div className="h-16 w-16 bg-[#81b64c]/10 text-[#81b64c] rounded-2xl flex items-center justify-center text-3xl mx-auto border border-[#81b64c]/15 shadow-[0_0_15px_rgba(129,182,76,0.1)]">
                ⚔️
              </div>
              <h2 className="text-2xl font-black text-white">Puzzle Battle</h2>
              <p className="text-xs text-[#7a7a6e] font-semibold leading-relaxed">
                Race against an opponent to solve tactical chess puzzles! Solve as many as you can in 3 minutes. 3 strikes and you are out.
              </p>
            </div>

            <button
              onClick={handleJoinQueue}
              className="
                w-full py-4 bg-[#81b64c] hover:bg-[#90c957]
                text-[#0f0e0c] font-black text-sm rounded-2xl
                transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(129,182,76,0.25)]
              "
            >
              Find a Match
            </button>
          </div>
        )}

        {/* ─── QUEUE / SEARCHING VIEW ─── */}
        {battleState === "queue" && (
          <div className="max-w-md w-full text-center space-y-6 bg-[#1a1917] p-8 border border-white/[0.08] rounded-3xl shadow-2xl">
            <div className="space-y-4">
              <RefreshCw className="h-12 w-12 text-[#81b64c] animate-spin mx-auto" />
              <div>
                <h3 className="text-xl font-black text-white">Searching for Opponent...</h3>
                <p className="text-xs text-[#7a7a6e] mt-1">Average pairing time is under 15 seconds.</p>
              </div>
            </div>

            <button
              onClick={handleLeaveQueue}
              className="
                w-full py-3.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25
                text-red-400 font-extrabold text-xs rounded-2xl
                transition-all active:scale-[0.98]
              "
            >
              Cancel Matchmaking
            </button>
          </div>
        )}

        {/* ─── ACTIVE BATTLE VIEW ─── */}
        {battleState === "battle" && me && opponent && (
          <div className="w-full h-full flex flex-col md:flex-row gap-6 min-h-0 justify-between">
            
            {/* Arena Board column */}
            <div className="flex-grow flex flex-col items-center justify-between min-h-0 py-2">
              
              {/* Opponent top header badge */}
              <div className="w-full max-w-md bg-[#1a1917]/50 border border-white/[0.04] p-3 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <UserIcon className="h-4 w-4 text-[#7a7a6e]" />
                  <span className="text-xs font-black text-[#a0a09a]">@{opponent.username}</span>
                  <span className="text-[9px] text-[#7a7a6e] font-mono">({opponent.rating} Elo)</span>
                </div>
                
                <div className="flex gap-1.5 text-xs font-bold items-center font-mono">
                  <span className="text-amber-500 font-black">Score: {opponent.score}</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <span key={idx} className={idx < opponent.strikes ? "text-red-500" : "text-[#3a3733]"}>❌</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Main Board Arena */}
              <div className="w-full max-w-[420px] aspect-square relative my-4">
                <BoardSection
                  position={game.fen()}
                  onDrop={onDrop}
                  onSquareClick={() => {}}
                  customSquareStyles={lastMoveSquares}
                  boardOrientation={boardOrientation}
                />
                
                {me.finished && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-center p-6 rounded-2xl border border-white/[0.04] select-none">
                    <div className="space-y-2">
                      <p className="text-sm font-black text-white">Out of Lives! (3 Strikes)</p>
                      <p className="text-[11px] text-[#7a7a6e]">Waiting for your opponent to complete their round...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* User bottom header badge */}
              <div className="w-full max-w-md bg-[#1a1917]/80 border border-white/[0.06] p-3.5 rounded-2xl flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2.5">
                  <UserIcon className="h-4.5 w-4.5 text-[#81b64c]" />
                  <span className="text-xs font-black text-white">@{me.username}</span>
                  <span className="text-[9px] text-[#7a7a6e] font-mono">({me.rating} Elo)</span>
                </div>

                <div className="flex gap-2 text-xs font-bold items-center font-mono">
                  <span className="text-green-400 font-black">Score: {me.score}</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <span key={idx} className={idx < me.strikes ? "text-red-500" : "text-[#3a3733]"}>❌</span>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* Battle Status Sidebar */}
            <aside className="w-full md:w-[280px] bg-[#1a1917] border border-white/[0.08] p-5 rounded-3xl shrink-0 flex flex-col justify-between h-full md:max-h-[500px]">
              <div className="space-y-6">
                
                {/* Timer block */}
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-3 bg-[#161412]/50 p-3 rounded-2xl">
                  <span className="text-[10px] text-[#7a7a6e] font-black uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-[#81b64c]" />
                    Timer Left
                  </span>
                  <span className="font-mono text-white text-base font-black">
                    {formatTime(timeLeft)}
                  </span>
                </div>

                {/* Comparative progress bar slider */}
                <div className="space-y-3.5">
                  <span className="text-[10px] text-[#7a7a6e] font-black uppercase tracking-wider block">Live Score Progress</span>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px]">
                      <span className="font-semibold text-white">@{me.username}</span>
                      <span className="font-mono font-bold text-green-400">{me.score} / 15</span>
                    </div>
                    <div className="h-2 w-full bg-[#111010] rounded-full overflow-hidden border border-white/[0.03]">
                      <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${(me.score / 15) * 100}%` }} />
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="font-semibold text-[#a0a09a]">@{opponent.username}</span>
                      <span className="font-mono font-bold text-amber-500">{opponent.score} / 15</span>
                    </div>
                    <div className="h-2 w-full bg-[#111010] rounded-full overflow-hidden border border-white/[0.03]">
                      <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${(opponent.score / 15) * 100}%` }} />
                    </div>
                  </div>
                </div>

              </div>

              <div className="pt-6 border-t border-white/[0.04] text-[10px] text-[#7a7a6e] font-semibold leading-relaxed">
                <span className="font-black text-white uppercase block text-[9px] tracking-wider mb-0.5">Themes in Play</span>
                <p className="capitalize">
                  {puzzles[currentPuzzleIdx]?.themes.slice(0, 3).join(", ") || "Tactics, Fork"}
                </p>
              </div>
            </aside>

          </div>
        )}

        {/* ─── GAME OVER VIEW ─── */}
        {battleState === "over" && me && opponent && (
          <div className="max-w-md w-full text-center space-y-6 bg-[#1a1917] p-8 border border-white/[0.08] rounded-3xl shadow-2xl relative overflow-hidden">
            
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white tracking-tight">
                {me.score > opponent.score ? "🏆 Victory!" : me.score < opponent.score ? "Defeat..." : "Draw!"}
              </h3>
              <p className="text-xs text-[#7a7a6e] font-semibold">The puzzle battle has concluded.</p>
            </div>

            <div className="bg-[#111010] border border-white/[0.04] p-4 rounded-2xl divide-y divide-white/[0.03] text-sm">
              <div className="flex justify-between items-center py-2">
                <span className="font-semibold text-white">@{me.username}</span>
                <span className="font-mono font-black text-green-400">{me.score} solved</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="font-semibold text-[#a0a09a]">@{opponent.username}</span>
                <span className="font-mono font-black text-amber-500">{opponent.score} solved</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleJoinQueue}
                className="
                  flex-grow py-3 bg-[#81b64c] hover:bg-[#90c957]
                  text-[#0f0e0c] font-black text-xs rounded-xl transition-all
                "
              >
                Battle Again
              </button>
              <button
                onClick={handleBackToLobby}
                className="
                  flex-grow py-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08]
                  text-white font-extrabold text-xs rounded-xl transition-all
                "
              >
                Back to Lobby
              </button>
            </div>

          </div>
        )}

      </div>
    </main>
  );
}

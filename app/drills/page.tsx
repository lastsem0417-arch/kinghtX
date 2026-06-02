"use client";

import { useState, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import BoardSection from "@/components/chess/BoardSection";
import LeftNavbar from "@/components/chess/LeftNavbar";
import axios from "axios";
import { Play, RotateCcw, Award, ShieldAlert, Cpu, Trophy, BookOpen } from "lucide-react";

interface Drill {
  id: string;
  name: string;
  description: string;
  fen: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  movesLimit: number;
}

const DRILLS: Drill[] = [
  {
    id: "kqk",
    name: "King & Queen vs King",
    description: "Learn how to deliver checkmate with the Queen. Force the opponent king to the edge and execute a support mate.",
    fen: "8/8/8/8/8/3k4/8/3KQ3 w - - 0 1",
    difficulty: "Beginner",
    movesLimit: 50
  },
  {
    id: "krk",
    name: "King & Rook vs King",
    description: "Master the fundamental rook mate. Use your king to cut off files and ranks to cage the enemy king.",
    fen: "8/8/8/8/8/3k4/8/3KR3 w - - 0 1",
    difficulty: "Beginner",
    movesLimit: 50
  },
  {
    id: "kbbk",
    name: "King & 2 Bishops vs King",
    description: "A classic coordination drill. Move your bishops in diagonals to drive the king into a corner square.",
    fen: "8/8/8/8/8/3k4/8/3KBB2 w - - 0 1",
    difficulty: "Intermediate",
    movesLimit: 50
  },
  {
    id: "kpk",
    name: "King & Pawn vs King",
    description: "The foundation of all pawn endings. Use opposition and key squares to promote your pawn.",
    fen: "8/8/8/8/8/3k4/4P3/3K4 w - - 0 1",
    difficulty: "Advanced",
    movesLimit: 50
  }
];

export default function DrillsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedDrill, setSelectedDrill] = useState<Drill>(DRILLS[0]);
  const [gameFen, setGameFen] = useState(DRILLS[0].fen);
  const gameRef = useRef(new Chess(DRILLS[0].fen));
  
  // Game states
  const [movesCount, setMovesCount] = useState(0);
  const [gameState, setGameState] = useState<"active" | "won" | "lost" | "draw">("active");
  const [engineThinking, setEngineThinking] = useState(false);
  const [feedback, setFeedback] = useState("Your turn! Find the checkmate pattern.");

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Fetch user details
    axios.get("/api/users/me").then((res) => {
      if (res.data?.user) {
        setCurrentUser(res.data.user);
      }
    }).catch((err) => {
      console.error("Failed to load user info in drills:", err);
    });
  }, []);

  // Initialize Stockfish worker
  useEffect(() => {
    try {
      const worker = new Worker("/stockfish-worker.js");
      workerRef.current = worker;

      worker.postMessage("uci");
      worker.postMessage("isready");

      worker.onmessage = (e: MessageEvent) => {
        const line = e.data;
        if (typeof line !== "string") return;

        if (line.startsWith("bestmove")) {
          const parts = line.split(" ");
          const bestMove = parts[1];

          if (bestMove && bestMove !== "(none)") {
            applyEngineMove(bestMove);
          } else {
            // Engine has no legal moves (Checkmate or Stalemate)
            setEngineThinking(false);
            checkGameStatus();
          }
        }
      };
    } catch (err) {
      console.error("Failed to initialize Stockfish worker in drills:", err);
    }

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Reset drill helper
  const handleSelectDrill = (drill: Drill) => {
    setSelectedDrill(drill);
    gameRef.current = new Chess(drill.fen);
    setGameFen(drill.fen);
    setMovesCount(0);
    setGameState("active");
    setEngineThinking(false);
    setFeedback("Your turn! Find the checkmate pattern.");
  };

  const handleRestart = () => {
    handleSelectDrill(selectedDrill);
  };

  // Check checkmate / stalemate / draw
  const checkGameStatus = () => {
    const currentGame = gameRef.current;
    if (currentGame.isCheckmate()) {
      if (currentGame.turn() === "b") {
        setGameState("won");
        setFeedback("Victory! You successfully checkmated the engine.");
      } else {
        setGameState("lost");
        setFeedback("Defeat. The engine checkmated your King.");
      }
      return true;
    }
    if (currentGame.isDraw()) {
      setGameState("draw");
      setFeedback("Draw! The position ended in stalemate or insufficient material.");
      return true;
    }
    return false;
  };

  const applyEngineMove = (uciMove: string) => {
    try {
      const from = uciMove.substring(0, 2);
      const to = uciMove.substring(2, 4);
      const promotion = uciMove.length > 4 ? uciMove.substring(4, 5) : undefined;

      const result = gameRef.current.move({ from, to, promotion });
      if (result) {
        setGameFen(gameRef.current.fen());
        setEngineThinking(false);

        // Check if game over after engine move
        const isOver = checkGameStatus();
        if (!isOver) {
          setFeedback("Your turn! Find the checkmate pattern.");
        }
      }
    } catch (err) {
      console.error("Failed to apply engine move:", uciMove, err);
      setEngineThinking(false);
    }
  };

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (gameState !== "active" || engineThinking) return false;

    try {
      const moveResult = gameRef.current.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q"
      });

      if (moveResult) {
        setGameFen(gameRef.current.fen());
        const newMovesCount = movesCount + 1;
        setMovesCount(newMovesCount);

        // Check game status first
        const isOver = checkGameStatus();
        if (isOver) return true;

        // Check if moves limit reached
        if (newMovesCount >= selectedDrill.movesLimit) {
          setGameState("draw");
          setFeedback(`Draw! You failed to checkmate the engine within the ${selectedDrill.movesLimit}-move limit.`);
          return true;
        }

        // Trigger engine move
        setEngineThinking(true);
        setFeedback("Stockfish is thinking...");
        
        if (workerRef.current) {
          workerRef.current.postMessage("stop");
          workerRef.current.postMessage(`position fen ${gameRef.current.fen()}`);
          workerRef.current.postMessage("go depth 12");
        } else {
          // Fallback if worker fails
          setTimeout(() => {
            setEngineThinking(false);
            setFeedback("Engine unavailable. Reset the drill to try again.");
          }, 1000);
        }
        return true;
      }
    } catch (err) {
      return false;
    }
    return false;
  };

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#161412] text-white flex flex-col md:flex-row relative">
      <LeftNavbar activeUser={currentUser} />

      <div className="flex-grow flex flex-col lg:flex-row min-h-0 overflow-hidden bg-[#161412]">
        
        {/* LEFT COLUMN: DRILLS SELECTION LIST */}
        <aside className="w-full lg:w-[360px] p-5 border-b lg:border-b-0 lg:border-r border-white/[0.06] bg-[#1a1917] flex flex-col justify-between shrink-0 h-full overflow-y-auto">
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-[#81b64c]" />
                Endgame Drills
              </h2>
              <p className="text-xs text-[#7a7a6e] font-semibold">
                Challenge Stockfish depth 12 in essential endgame matrices. Can you checkmate the engine in under 50 moves?
              </p>
            </div>

            <div className="space-y-3">
              {DRILLS.map((drill) => (
                <button
                  key={drill.id}
                  onClick={() => handleSelectDrill(drill)}
                  className={`
                    w-full text-left p-4 rounded-2xl border transition-all text-xs flex flex-col gap-2 relative overflow-hidden group
                    ${selectedDrill.id === drill.id
                      ? "bg-[#81b64c]/10 border-[#81b64c]/40 shadow-lg text-white"
                      : "bg-[#111010]/40 border-white/[0.04] text-[#a0a09a] hover:bg-[#111010]/90 hover:border-white/[0.08]"
                    }
                  `}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-sm text-white group-hover:text-[#81b64c] transition-colors">{drill.name}</span>
                    <span className={`
                      text-[9px] font-black uppercase px-2 py-0.5 rounded border leading-none
                      ${drill.difficulty === "Beginner" ? "text-green-400 border-green-400/20 bg-green-400/5" :
                        drill.difficulty === "Intermediate" ? "text-amber-400 border-amber-400/20 bg-amber-400/5" :
                        "text-red-400 border-red-400/20 bg-red-400/5"}
                    `}>
                      {drill.difficulty}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#7a7a6e] font-medium leading-relaxed">
                    {drill.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-white/[0.04] mt-6 bg-[#1a1917]/50 rounded-2xl p-4 text-[10px] text-[#7a7a6e] font-semibold space-y-1.5">
            <span className="font-black text-white uppercase block text-[9px] tracking-wider mb-0.5">Arena rules</span>
            <p>1. White moves first from the preset drill matrix.</p>
            <p>2. Stockfish plays defender with depth 12 logic.</p>
            <p>3. Solve by delivering a checkmate within 50 moves.</p>
          </div>
        </aside>

        {/* RIGHT COLUMN: ARENA BOARD & FEEDBACK */}
        <div className="flex-grow flex flex-col min-h-0 py-4 px-6 justify-between items-center">
          
          {/* Header Feedback alert card */}
          <div className="w-full max-w-lg bg-[#1a1917] border border-white/[0.06] rounded-2xl p-3.5 flex items-center justify-between shadow-xl shrink-0 gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-[#81b64c]/10 flex items-center justify-center text-lg">
                🏆
              </div>
              <div className="text-left">
                <span className="text-[9px] text-[#7a7a6e] font-black uppercase tracking-wider block">Game Status feedback</span>
                <p className="text-xs font-bold text-white mt-0.5 leading-snug">
                  {feedback}
                </p>
              </div>
            </div>

            <div className="flex gap-2 font-mono text-[10px] items-center">
              <span className="text-[#7a7a6e] font-black uppercase">Moves:</span>
              <span className={`font-black text-xs ${movesCount >= 40 ? "text-red-400" : "text-white"}`}>
                {movesCount}/{selectedDrill.movesLimit}
              </span>
            </div>
          </div>

          {/* Chessboard block wrapper */}
          <div className="w-full max-w-[480px] aspect-square py-4 shrink-0 flex items-center justify-center relative">
            <BoardSection
              position={gameFen}
              onDrop={onDrop}
              onSquareClick={() => {}}
              customSquareStyles={{}}
              boardOrientation="white"
            />
            {engineThinking && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center rounded-2xl">
                <div className="bg-[#1a1917] border border-white/[0.08] px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs text-white font-extrabold animate-pulse">
                  <Cpu className="h-4 w-4 text-[#81b64c] animate-spin" />
                  Stockfish defending...
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons panel */}
          <div className="flex gap-3 w-full max-w-sm shrink-0">
            <button
              onClick={handleRestart}
              className="
                flex-1 py-3 bg-[#111010] border border-white/[0.08] hover:border-white/[0.12]
                text-white hover:text-[#81b64c] font-black text-xs rounded-2xl
                transition-all active:scale-[0.97] flex items-center justify-center gap-2
              "
            >
              <RotateCcw className="h-4 w-4" />
              Restart Drill
            </button>
          </div>

        </div>

      </div>
    </main>
  );
}

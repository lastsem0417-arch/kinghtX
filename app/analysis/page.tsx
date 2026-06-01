"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import axios from "axios";
import BoardSection from "@/components/chess/BoardSection";
import LeftNavbar from "@/components/chess/LeftNavbar";
import Sidebar from "@/components/chess/Sidebar";
import GameControls from "@/components/chess/GameControls";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  ArrowLeft, 
  TrendingUp, 
  Cpu, 
  Gauge 
} from "lucide-react";

export default function AnalysisPage() {
  const router = useRouter();

  const [game, setGame] = useState(new Chess());
  const [history, setHistory] = useState<string[]>([]);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  
  // Engine State
  const [engineActive, setEngineActive] = useState(true);
  const [evalScore, setEvalScore] = useState<string>("0.0");
  const [evalPercentage, setEvalPercentage] = useState<number>(50); // White advantage percentage
  const [bestLine, setBestLine] = useState<string>("Engine loading...");
  const [suggestedArrow, setSuggestedArrow] = useState<[string, string][]>([]);
  const [depth, setDepth] = useState<number>(0);
  const [pgnInput, setPgnInput] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  const workerRef = useRef<Worker | null>(null);

  // preloaded sounds
  const moveSound = useRef<HTMLAudioElement | null>(null);
  const captureSound = useRef<HTMLAudioElement | null>(null);
  const castleSound = useRef<HTMLAudioElement | null>(null);
  const checkSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    moveSound.current = new Audio("/sounds/move.mp3");
    captureSound.current = new Audio("/sounds/capture.mp3");
    castleSound.current = new Audio("/sounds/castle.mp3");
    checkSound.current = new Audio("/sounds/move-check.mp3");

    // Fetch user details
    axios.get("/api/users/me").then((res) => {
      if (res.data?.user) {
        setCurrentUser(res.data.user);
      }
    }).catch((err) => {
      console.error("Failed to load user info in analysis:", err);
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
        
        // Parse depth and evaluation
        if (line.startsWith("info") && line.includes("depth")) {
          // Extract depth
          const depthMatch = line.match(/depth (\d+)/);
          if (depthMatch) {
            setDepth(parseInt(depthMatch[1]));
          }

          // Extract score (centipawns or mate)
          if (line.includes("score cp")) {
            const cpMatch = line.match(/score cp (-?\d+)/);
            if (cpMatch) {
              const cp = parseInt(cpMatch[1]);
              const scoreVal = (game.turn() === "b" ? -cp : cp) / 100;
              
              // Format display text
              const sign = scoreVal > 0 ? "+" : "";
              setEvalScore(`${sign}${scoreVal.toFixed(2)}`);

              // Map evaluation to visual percentage (Sigmoid Arctan map)
              const mappedPercent = 50 + (Math.atan(scoreVal / 2) * (100 / Math.PI));
              setEvalPercentage(mappedPercent);
            }
          } else if (line.includes("score mate")) {
            const mateMatch = line.match(/score mate (-?\d+)/);
            if (mateMatch) {
              const mate = parseInt(mateMatch[1]);
              const sign = (game.turn() === "b" ? -mate : mate) > 0 ? "+" : "-";
              setEvalScore(`M${sign}${Math.abs(mate)}`);
              setEvalPercentage(mate > 0 ? 100 : 0);
            }
          }

          // Extract suggested line (pv)
          const pvIndex = line.indexOf(" pv ");
          if (pvIndex !== -1) {
            const pvString = line.substring(pvIndex + 4);
            const moves = pvString.split(" ");
            const uciBestMove = moves[0];
            
            // Draw suggested arrow on the board
            if (uciBestMove && uciBestMove.length >= 4) {
              const from = uciBestMove.substring(0, 2);
              const to = uciBestMove.substring(2, 4);
              setSuggestedArrow([[from, to]]);
            }

            // Convert raw UCI moves to readable format
            setBestLine(moves.slice(0, 4).join(" "));
          }
        }
      };

      // Trigger initial analysis
      runEngineAnalysis(game.fen());

    } catch (e) {
      console.error("Failed to start Stockfish worker:", e);
      setBestLine("Engine unavailable");
    }

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Run analysis when FEN or engine state changes
  const runEngineAnalysis = (fenString: string) => {
    if (!workerRef.current || !engineActive) return;
    workerRef.current.postMessage("stop");
    workerRef.current.postMessage(`position fen ${fenString}`);
    workerRef.current.postMessage("go depth 12");
  };

  useEffect(() => {
    if (engineActive) {
      runEngineAnalysis(game.fen());
    } else {
      setEvalScore("Off");
      setSuggestedArrow([]);
      setDepth(0);
    }
  }, [game, engineActive]);

  // Chess move handlers
  const makeMove = (move: any) => {
    const gameCopy = new Chess(game.fen());
    try {
      const result = gameCopy.move(move);
      if (result) {
        // Play sounds
        if (gameCopy.isCheck()) {
          checkSound.current?.play().catch(() => {});
        } else if (result.captured) {
          captureSound.current?.play().catch(() => {});
        } else if (result.flags.includes("k") || result.flags.includes("q")) {
          castleSound.current?.play().catch(() => {});
        } else {
          moveSound.current?.play().catch(() => {});
        }

        setGame(gameCopy);
        setHistory((prev) => [...prev, result.san]);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  };

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    return makeMove({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q",
    });
  };

  const handleUndo = () => {
    const newGame = new Chess();
    const newHistory = history.slice(0, -1);
    
    newHistory.forEach((move) => {
      newGame.move(move);
    });

    setGame(newGame);
    setHistory(newHistory);
  };

  const handleReset = () => {
    setGame(new Chess());
    setHistory([]);
    setSuggestedArrow([]);
  };

  const handleFlip = () => {
    setBoardOrientation((prev) => (prev === "white" ? "black" : "white"));
  };

  const handleCopyPGN = () => {
    navigator.clipboard.writeText(game.pgn());
    alert("PGN copied to clipboard!");
  };

  const handleLoadPgn = () => {
    if (!pgnInput.trim()) return;

    try {
      const parsedChess = new Chess();
      parsedChess.loadPgn(pgnInput);
      const parsedHistory = parsedChess.history({ verbose: true });
      if (parsedHistory.length === 0 && pgnInput.trim().length > 0) {
        throw new Error("No moves found in PGN.");
      }
      const sanHistory = parsedHistory.map((m) => m.san);

      setGame(parsedChess);
      setHistory(sanHistory);
      setPgnInput("");
      setSuggestedArrow([]);
      
      moveSound.current?.play().catch(() => {});
    } catch (err: any) {
      console.error("Invalid PGN imported:", err);
      alert("Oops! Invalid PGN format. Make sure you copy a standard PGN game log (e.g., 1. e4 e5 ...).");
    }
  };

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#161412] text-white flex flex-col md:flex-row relative">
      
      {/* ─── LEFT SIDEBAR NAVIGATION ─── */}
      <LeftNavbar activeUser={currentUser} />

      {/* ─── CENTER ARENA (Evaluation + Board) ─── */}
      <div className="flex-grow min-w-0 flex flex-row min-h-0 overflow-hidden bg-[#161412]">
        
        {/* EVALUATION BAR */}
        <div className="w-6 md:w-8 h-full bg-[#272522] shrink-0 flex flex-col relative overflow-hidden border-r border-white/[0.05]">
          <div className="w-full bg-[#1b1917] transition-all duration-300" style={{ height: `${100 - evalPercentage}%` }} />
          <div className="w-full bg-white transition-all duration-300" style={{ height: `${evalPercentage}%` }} />
          
          <div 
            className={`
              absolute left-0 right-0 py-1 text-center text-[9px] font-black pointer-events-none select-none z-10 font-mono rounded shadow-lg
              ${evalPercentage > 50 ? "bottom-2 bg-black text-white" : "top-2 bg-white text-black"}
            `}
          >
            {evalScore}
          </div>
        </div>

        {/* Board and controls column */}
        <div className="flex-grow flex flex-col min-h-0 py-2">
          {/* Header */}
          <div className="px-4 py-1.5 flex items-center justify-between shrink-0">
            <span className="text-xs text-[#7a7a6e] font-bold uppercase tracking-wider">
              Self-Analysis Board
            </span>
            <div className="flex items-center gap-1.5 bg-[#1a1917] border border-white/[0.08] px-3 py-1 rounded-xl">
              <Cpu className="h-3.5 w-3.5 text-[#81b64c]" />
              <span className="text-xs font-bold font-mono text-white">Stockfish 10</span>
            </div>
          </div>

          <div className="shrink-0 px-4 py-1 text-xs text-[#7a7a6e] font-semibold">
            {boardOrientation === "white" ? "Black" : "White"}
          </div>

          {/* Interactive Chessboard */}
          <div className="flex-1 min-h-0 min-w-0 overflow-hidden px-4 py-1.5">
            <BoardSection
              position={game.fen()}
              onDrop={onDrop}
              onSquareClick={() => {}}
              customSquareStyles={{}}
              boardOrientation={boardOrientation}
              customArrows={suggestedArrow}
            />
          </div>

          <div className="shrink-0 px-4 py-1 text-xs text-[#7a7a6e] font-semibold">
            {boardOrientation === "white" ? "White" : "Black"}
          </div>

          {/* Chess controller actions */}
          <div className="shrink-0">
            <GameControls
              onUndo={handleUndo}
              onReset={handleReset}
              onFlip={handleFlip}
              onCopyPGN={handleCopyPGN}
            />
          </div>
        </div>

      </div>

      {/* ─── RIGHT PANEL: Engine statistics & Moves history ─── */}
      <aside className="h-full flex flex-col overflow-hidden bg-[#1e1c1a] border-l border-white/[0.07]" style={{ width: "290px", minWidth: "290px", maxWidth: "290px" }}>
        
        {/* Engine Switch & Status Dashboard */}
        <div className="shrink-0 p-4 border-b border-white/[0.06] bg-[#161412] space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-[#81b64c]" />
              <span className="text-xs font-black uppercase tracking-wider text-white">Engine Analysis</span>
            </div>
            
            <button
              onClick={() => setEngineActive(!engineActive)}
              className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${
                engineActive ? "bg-[#81b64c]" : "bg-[#272522] border border-white/[0.08]"
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                  engineActive ? "left-6.5" : "left-0.5"
                }`}
              />
            </button>
          </div>

          {engineActive && (
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="bg-[#111010] p-2.5 rounded-xl border border-white/[0.03]">
                <span className="text-[10px] text-[#7a7a6e] font-bold block mb-1">EVALUATION</span>
                <span className="font-mono text-white text-sm font-black">{evalScore}</span>
              </div>
              <div className="bg-[#111010] p-2.5 rounded-xl border border-white/[0.03]">
                <span className="text-[10px] text-[#7a7a6e] font-bold block mb-1">DEPTH / SPEED</span>
                <span className="font-mono text-white text-sm font-black">{depth} ply</span>
              </div>
            </div>
          )}

          {engineActive && (
            <div className="bg-[#111010]/60 p-3 rounded-xl border border-white/[0.04]">
              <div className="flex items-center gap-1 text-[10px] text-[#7a7a6e] font-bold mb-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-[#81b64c]" />
                BEST MOVE LINE
              </div>
              <p className="font-mono text-xs text-white uppercase tracking-wider truncate">
                {bestLine}
              </p>
            </div>
          )}
        </div>

        {/* Move History log */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Sidebar history={history} />
        </div>

        {/* Paste PGN Import */}
        <div className="shrink-0 p-4 border-t border-white/[0.06] bg-[#161412] space-y-3">
          <span className="text-[10px] text-[#7a7a6e] font-black uppercase tracking-wider block">Import PGN</span>
          <textarea
            placeholder="Paste raw PGN moves here... e.g. 1. e4 e5 2. Nf3 Nc6..."
            value={pgnInput}
            onChange={(e) => setPgnInput(e.target.value)}
            className="w-full h-16 bg-[#111010] border border-white/[0.06] hover:border-white/[0.1] focus:border-[#81b64c]/50 rounded-xl p-2.5 text-xs text-[#a0a09a] focus:text-white placeholder-[#4a4a44] transition-all resize-none outline-none focus:ring-1 focus:ring-[#81b64c]/20"
          />
          <button
            onClick={handleLoadPgn}
            className="w-full py-2 bg-[#81b64c] hover:bg-[#90c957] text-[#0f0e0c] font-black text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
          >
            Load Game
          </button>
        </div>

      </aside>

    </main>
  );
}

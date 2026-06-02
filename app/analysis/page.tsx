"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import axios from "axios";
import BoardSection from "@/components/chess/BoardSection";
import LeftNavbar from "@/components/chess/LeftNavbar";
import MoveHistory from "@/components/chess/MoveHistory";
import GameControls from "@/components/chess/GameControls";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  ArrowLeft, 
  TrendingUp, 
  Cpu, 
  Gauge,
  Sparkles,
  BarChart2,
  RefreshCw,
  GraduationCap,
  Volume2,
  VolumeX
} from "lucide-react";
import { AreaChart, Area, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from "recharts";
import { scanTactics } from "@/lib/chessTactics";

type MoveClassification = "brilliant" | "great" | "best" | "excellent" | "good" | "book" | "inaccuracy" | "mistake" | "blunder";

interface AnalyzedMove {
  san: string;
  color: "w" | "b";
  fenBefore: string;
  fenAfter: string;
  scoreBefore: number;
  scoreAfter: number;
  bestMove?: string;
  classification: MoveClassification;
}

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

  // Opening Explorer State
  const [openingData, setOpeningData] = useState<{
    name: string;
    white: number;
    draws: number;
    black: number;
    moves: { san: string; play: number; white: number; draws: number; black: number }[];
  } | null>(null);
  const [loadingOpening, setLoadingOpening] = useState(false);

  // Coach Voice Speak function
  const speak = (text: string) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Chess.com Parity States
  const [activeTab, setActiveTab] = useState<"analysis" | "review" | "pgn">("analysis");
  const [evalHistory, setEvalHistory] = useState<number[]>([0.35]);
  const [analyzedMoves, setAnalyzedMoves] = useState<AnalyzedMove[]>([]);
  const [whiteAccuracy, setWhiteAccuracy] = useState<number | null>(null);
  const [blackAccuracy, setBlackAccuracy] = useState<number | null>(null);
  const [isReviewRunning, setIsReviewRunning] = useState(false);
  const [reviewProgress, setReviewProgress] = useState(0);
  const [counts, setCounts] = useState<{
    white: Record<MoveClassification, number>;
    black: Record<MoveClassification, number>;
  }>({
    white: { brilliant: 0, great: 0, best: 0, excellent: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
    black: { brilliant: 0, great: 0, best: 0, excellent: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, blunder: 0 }
  });

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

              // Update evaluation history
              setEvalHistory((prev) => {
                const next = [...prev];
                next[history.length] = scoreVal;
                return next;
              });
            }
          } else if (line.includes("score mate")) {
            const mateMatch = line.match(/score mate (-?\d+)/);
            if (mateMatch) {
              const mate = parseInt(mateMatch[1]);
              const sign = (game.turn() === "b" ? -mate : mate) > 0 ? "+" : "-";
              setEvalScore(`M${sign}${Math.abs(mate)}`);
              setEvalPercentage(mate > 0 ? 100 : 0);

              const scoreVal = mate > 0 ? 10.0 : -10.0;
              setEvalHistory((prev) => {
                const next = [...prev];
                next[history.length] = scoreVal;
                return next;
              });
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

  // Fetch opening explorer data from Lichess on FEN change
  useEffect(() => {
    const fetchOpening = async () => {
      const fen = game.fen();
      setLoadingOpening(true);
      try {
        const encodedFen = encodeURIComponent(fen);
        const res = await axios.get(`https://explorer.lichess.ovh/masters?fen=${encodedFen}`);
        const data = res.data;
        if (data && data.opening) {
          setOpeningData({
            name: data.opening.name || "Unknown Opening",
            white: data.white || 0,
            draws: data.draws || 0,
            black: data.black || 0,
            moves: data.moves ? data.moves.slice(0, 3).map((m: any) => ({
              san: m.san,
              play: m.white + m.draws + m.black,
              white: m.white,
              draws: m.draws,
              black: m.black
            })) : []
          });
        } else {
          setOpeningData(null);
        }
      } catch (err) {
        console.warn("Failed to fetch Lichess opening explorer data:", err);
      } finally {
        setLoadingOpening(false);
      }
    };
    fetchOpening();
  }, [game]);

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
      try {
        newGame.move(move);
      } catch (e) {
        console.error("Error replaying move in analysis handleUndo:", move, e);
      }
    });

    setGame(newGame);
    setHistory(newHistory);
    setEvalHistory((prev) => prev.slice(0, newHistory.length + 1));
  };

  const handleReset = () => {
    setGame(new Chess());
    setHistory([]);
    setSuggestedArrow([]);
    setEvalHistory([0.35]);
    setAnalyzedMoves([]);
    setWhiteAccuracy(null);
    setBlackAccuracy(null);
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
      setEvalHistory(new Array(sanHistory.length + 1).fill(0.35));
      setAnalyzedMoves([]);
      setWhiteAccuracy(null);
      setBlackAccuracy(null);
      
      moveSound.current?.play().catch(() => {});
    } catch (err: any) {
      console.error("Invalid PGN imported:", err);
      alert("Oops! Invalid PGN format. Make sure you copy a standard PGN game log (e.g., 1. e4 e5 ...).");
    }
  };

  const classifyMove = (
    san: string,
    color: "w" | "b",
    scoreBefore: number,
    scoreAfter: number,
    bestMoveUci: string,
    moveIndex: number,
    isCustomFen = false
  ): MoveClassification => {
    if (san.includes("#")) {
      return "best";
    }

    if (!isCustomFen && moveIndex < 12) {
      return "book";
    }

    const scoreDiff = color === "w" 
      ? (scoreAfter - scoreBefore) 
      : (scoreBefore - scoreAfter);

    const isBrilliantAttempt = scoreDiff >= 0 && (san.includes("x") && (san.includes("Q") || san.includes("R") || san.includes("B") || san.includes("N")));
    if (isBrilliantAttempt) {
      return "brilliant";
    }

    if (scoreDiff >= -0.05) {
      return "best";
    }
    if (scoreDiff >= -0.20) {
      return "excellent";
    }
    if (scoreDiff >= -0.50) {
      return "good";
    }
    if (scoreDiff >= -1.0) {
      return "inaccuracy";
    }
    if (scoreDiff >= -2.0) {
      return "mistake";
    }
    return "blunder";
  };

  const computeMetrics = (movesList: AnalyzedMove[]) => {
    const whiteMoves = movesList.filter((m) => m.color === "w");
    const blackMoves = movesList.filter((m) => m.color === "b");

    const categoryScores: Record<MoveClassification, number> = {
      brilliant: 100,
      great: 100,
      best: 100,
      excellent: 90,
      good: 85,
      book: 100,
      inaccuracy: 60,
      mistake: 30,
      blunder: 0
    };

    const runTally = (list: AnalyzedMove[]) => {
      const tally: Record<MoveClassification, number> = {
        brilliant: 0, great: 0, best: 0, excellent: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, blunder: 0
      };
      let sum = 0;
      
      list.forEach((m) => {
        tally[m.classification] += 1;
        sum += categoryScores[m.classification];
      });

      const accuracy = list.length > 0 ? Math.round(sum / list.length) : 100;
      return { tally, accuracy };
    };

    const whiteStats = runTally(whiteMoves);
    const blackStats = runTally(blackMoves);

    setWhiteAccuracy(whiteStats.accuracy);
    setBlackAccuracy(blackStats.accuracy);
    
    setCounts({
      white: whiteStats.tally,
      black: blackStats.tally
    });

    setAnalyzedMoves(movesList);
  };

  const triggerFullReview = async () => {
    if (history.length === 0 || !workerRef.current) return;
    setIsReviewRunning(true);
    setReviewProgress(0);

    const positions: { fenBefore: string; fenAfter: string; san: string; color: "w" | "b" }[] = [];
    const initialChess = new Chess();
    let startingFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    try {
      initialChess.loadPgn(game.pgn());
      startingFen = initialChess.header().FEN || startingFen;
    } catch {}
    const isCustomFen = startingFen !== "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const tempChess = new Chess(startingFen);
    
    for (let i = 0; i < history.length; i++) {
      const fenBefore = tempChess.fen();
      const move = history[i];
      try {
        tempChess.move(move);
      } catch {
        // Fallback
      }
      const fenAfter = tempChess.fen();
      positions.push({
        fenBefore,
        fenAfter,
        san: move,
        color: i % 2 === 0 ? "w" : "b"
      });
    }

    const worker = workerRef.current;
    const analyzed: AnalyzedMove[] = [];

    const evaluateFen = (fen: string): Promise<{ score: number; bestMove: string }> => {
      return new Promise((resolve) => {
        let currentScore = 0.35;
        let bestMove = "";
        let resolved = false;

        const timeout = setTimeout(() => {
          if (!resolved) {
            console.warn("[Review Engine] Timeout waiting for FEN:", fen, "Sending stop...");
            worker.postMessage("stop");
          }
        }, 5000); // 5 seconds safety timeout

        const handleMsg = (e: MessageEvent) => {
          const line = e.data;
          if (typeof line !== "string") return;

          if (line.startsWith("info") && line.includes("score")) {
            if (line.includes("score cp")) {
              const cpMatch = line.match(/score cp (-?\d+)/);
              if (cpMatch) {
                currentScore = parseInt(cpMatch[1]) / 100;
              }
            } else if (line.includes("score mate")) {
              const mateMatch = line.match(/score mate (-?\d+)/);
              if (mateMatch) {
                currentScore = parseInt(mateMatch[1]) > 0 ? 10.0 : -10.0;
              }
            }
            const activeTurn = fen.split(" ")[1];
            if (activeTurn === "b") {
              currentScore = -currentScore;
            }
          }

          if (line.startsWith("bestmove")) {
            const parts = line.split(" ");
            bestMove = parts[1];
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              worker.removeEventListener("message", handleMsg);
              console.log(`[Review Engine] Resolved FEN: ${fen} -> Score: ${currentScore}, BestMove: ${bestMove}`);
              resolve({ score: currentScore, bestMove });
            }
          }
        };

        worker.addEventListener("message", handleMsg);
        worker.postMessage("stop");
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage("go depth 8");
      });
    };

    const localHistoryEval: number[] = [0.35];

    for (let i = 0; i < history.length; i++) {
      const pos = positions[i];
      const beforeResult = await evaluateFen(pos.fenBefore);
      const afterResult = await evaluateFen(pos.fenAfter);

      const classification = classifyMove(
        pos.san,
        pos.color,
        beforeResult.score,
        afterResult.score,
        beforeResult.bestMove,
        i,
        isCustomFen
      );

      analyzed.push({
        san: pos.san,
        color: pos.color,
        fenBefore: pos.fenBefore,
        fenAfter: pos.fenAfter,
        scoreBefore: beforeResult.score,
        scoreAfter: afterResult.score,
        bestMove: beforeResult.bestMove,
        classification
      });

      localHistoryEval.push(afterResult.score);
      setReviewProgress(Math.round(((i + 1) / history.length) * 100));
    }

    setEvalHistory(localHistoryEval);
    computeMetrics(analyzed);
    setIsReviewRunning(false);
    setActiveTab("review");
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

      {/* ─── RIGHT PANEL: Engine statistics, Move Review & PGN paste ─── */}
      <aside className="h-full flex flex-col overflow-hidden bg-[#1a1917] border-l border-white/[0.07]" style={{ width: "320px", minWidth: "320px", maxWidth: "320px" }}>
        
        {/* TAB BUTTONS HEADER */}
        <div className="shrink-0 flex items-stretch border-b border-white/[0.07] bg-[#161412] h-[45px]">
          {[
            { id: "analysis", label: "Analysis", icon: <Cpu className="h-3.5 w-3.5" /> },
            { id: "review", label: "Review", icon: <Sparkles className="h-3.5 w-3.5" /> },
            { id: "pgn", label: "PGN", icon: <BarChart2 className="h-3.5 w-3.5" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                flex-1 flex items-center justify-center gap-1.5
                text-[11px] font-black tracking-wider uppercase
                transition-all duration-200
                ${activeTab === tab.id 
                  ? "text-[#81b64c] bg-[#1a1917] border-b-2 border-[#81b64c]" 
                  : "text-[#7a7a6e] hover:text-white hover:bg-[#1e1c1a]"}
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENT VIEWPORT */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          
          {/* TAB 1: LIVE ENGINE ANALYSIS */}
          {activeTab === "analysis" && (
            <div className="space-y-4 h-full flex flex-col">
              <div className="shrink-0 space-y-4">
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
                      <span className="text-[9px] text-[#7a7a6e] font-bold block mb-1">EVALUATION</span>
                      <span className="font-mono text-white text-sm font-black">{evalScore}</span>
                    </div>
                    <div className="bg-[#111010] p-2.5 rounded-xl border border-white/[0.03]">
                      <span className="text-[9px] text-[#7a7a6e] font-bold block mb-1">DEPTH</span>
                      <span className="font-mono text-white text-sm font-black">{depth} ply</span>
                    </div>
                  </div>
                )}

                {engineActive && (
                  <div className="bg-[#111010]/60 p-3 rounded-xl border border-white/[0.04]">
                    <div className="flex items-center gap-1 text-[10px] text-[#7a7a6e] font-bold mb-1">
                      <TrendingUp className="h-3.5 w-3.5 text-[#81b64c]" />
                      BEST MOVE LINE
                    </div>
                    <p className="font-mono text-xs text-white uppercase tracking-wider truncate">
                      {bestLine}
                    </p>
                  </div>
                )}
              </div>

              {/* COACH COMMENTARY / TACTICS SCANNER */}
              {(() => {
                const activeTactics = scanTactics(game.fen());
                if (activeTactics.length === 0) return null;
                return (
                  <div className="shrink-0 bg-[#81b64c]/10 border border-[#81b64c]/20 p-3 rounded-xl space-y-1 text-left">
                    <div className="flex items-center justify-between text-[10px] text-[#81b64c] font-black uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">🎓 Coach Tactical Scan</span>
                      <button 
                        onClick={() => speak(activeTactics.join(" "))}
                        title="Read coach comments"
                        className="p-1 rounded bg-[#81b64c]/15 hover:bg-[#81b64c]/30 text-white transition-all active:scale-[0.95] cursor-pointer"
                      >
                        🔊 Speak
                      </button>
                    </div>
                    <p className="text-xs text-[#a0a09a] leading-relaxed">
                      {activeTactics.join(" ")}
                    </p>
                  </div>
                );
              })()}

              {/* LICHESS OPENING EXPLORER */}
              <div className="shrink-0 bg-[#111010]/60 p-3 rounded-xl border border-white/[0.04] space-y-2.5">
                <div className="flex items-center gap-1.5 text-[10px] text-[#7a7a6e] font-black uppercase tracking-wider">
                  <GraduationCap className="h-3.5 w-3.5 text-[#81b64c]" />
                  Opening Explorer
                </div>
                
                {loadingOpening ? (
                  <div className="flex items-center gap-2 text-xs text-[#7a7a6e] py-1.5">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#81b64c]" />
                    <span>Querying Lichess database...</span>
                  </div>
                ) : openingData ? (
                  <div className="space-y-2">
                    <div className="text-xs font-black text-white leading-tight">
                      {openingData.name}
                    </div>
                    
                    {/* HSL percentage bar */}
                    {openingData.white + openingData.draws + openingData.black > 0 && (
                      <div className="space-y-1">
                        <div className="h-4.5 w-full rounded-lg overflow-hidden flex text-[9px] font-black font-mono">
                          {(() => {
                            const total = openingData.white + openingData.draws + openingData.black;
                            const wPct = Math.round((openingData.white / total) * 100);
                            const dPct = Math.round((openingData.draws / total) * 100);
                            const bPct = 100 - wPct - dPct;
                            return (
                              <>
                                {wPct > 0 && (
                                  <div 
                                    className="bg-[#e2e2e0] text-black flex items-center justify-center transition-all duration-300"
                                    style={{ width: `${wPct}%` }}
                                    title={`White wins: ${wPct}%`}
                                  >
                                    {wPct}%
                                  </div>
                                )}
                                {dPct > 0 && (
                                  <div 
                                    className="bg-[#787870] text-white flex items-center justify-center transition-all duration-300"
                                    style={{ width: `${dPct}%` }}
                                    title={`Draws: ${dPct}%`}
                                  >
                                    {dPct}%
                                  </div>
                                )}
                                {bPct > 0 && (
                                  <div 
                                    className="bg-[#262421] text-[#a0a09a] flex items-center justify-center transition-all duration-300 border-l border-white/[0.05]"
                                    style={{ width: `${bPct}%` }}
                                    title={`Black wins: ${bPct}%`}
                                  >
                                    {bPct}%
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <div className="flex justify-between text-[8px] text-[#7a7a6e] font-bold">
                          <span>White Wins</span>
                          <span>Draws</span>
                          <span>Black Wins</span>
                        </div>
                      </div>
                    )}

                    {/* Book Moves continuation */}
                    {openingData.moves && openingData.moves.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-white/[0.03]">
                        <span className="text-[8px] text-[#7a7a6e] font-black uppercase tracking-wider block mb-1">Book Moves</span>
                        <div className="space-y-1">
                          {openingData.moves.map((mv, index) => {
                            const totalMove = mv.white + mv.draws + mv.black;
                            const wPct = totalMove > 0 ? Math.round((mv.white / totalMove) * 100) : 0;
                            const dPct = totalMove > 0 ? Math.round((mv.draws / totalMove) * 100) : 0;
                            const bPct = totalMove > 0 ? 100 - wPct - dPct : 0;
                            return (
                              <div key={mv.san} className="flex justify-between items-center bg-white/[0.02] border border-white/[0.03] p-1.5 rounded-lg text-[10px]">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-4 h-4 rounded bg-[#81b64c]/10 text-[#81b64c] font-black flex items-center justify-center text-[9px]">{index + 1}</span>
                                  <span className="font-extrabold text-white font-mono">{mv.san}</span>
                                </div>
                                <div className="flex items-center gap-1.5 font-mono text-[9px] text-[#7a7a6e]">
                                  <span className="text-white font-bold">{mv.play.toLocaleString()} games</span>
                                  <span>({wPct}/{dPct}/{bPct})</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-[#7a7a6e] italic">Position is out of book / custom layout</p>
                )}
              </div>

              {/* Moves History section */}
              <div className="flex-grow min-h-0 overflow-y-auto border border-white/[0.04] bg-[#111010] rounded-2xl p-2 mt-2">
                <MoveHistory history={history} />
              </div>
            </div>
          )}

          {/* TAB 2: MOVE REVIEW & ACCURACY GRAPH */}
          {activeTab === "review" && (
            <div className="space-y-4">
              
              {/* Spinner progress for active reviews */}
              {isReviewRunning && (
                <div className="bg-[#111010] p-6 rounded-2xl border border-white/[0.04] text-center space-y-4">
                  <RefreshCw className="h-8 w-8 text-[#81b64c] animate-spin mx-auto" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-white">Analyzing Game Moves...</h4>
                    <p className="text-[10px] text-[#7a7a6e]">Depth 8 analysis on positions</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] font-mono text-[#7a7a6e]">
                      <span>Completed</span>
                      <span>{reviewProgress}%</span>
                    </div>
                    <div className="h-2 w-full bg-[#161412] rounded-full overflow-hidden border border-white/[0.02]">
                      <div className="h-full bg-[#81b64c] rounded-full transition-all duration-200" style={{ width: `${reviewProgress}%` }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Inactive review prompt */}
              {!isReviewRunning && whiteAccuracy === null && (
                <div className="bg-[#111010] p-6 rounded-2xl border border-white/[0.04] text-center space-y-3">
                  <Sparkles className="h-8 w-8 text-yellow-400 mx-auto animate-pulse" />
                  <div>
                    <h4 className="text-sm font-black text-white">Game Review Pending</h4>
                    <p className="text-[10px] text-[#7a7a6e] mt-1">
                      Let Stockfish categorize your move blunders, inaccuracies, and calculate an accuracy score.
                    </p>
                  </div>
                  <button
                    onClick={triggerFullReview}
                    disabled={history.length === 0}
                    className="w-full py-2.5 bg-[#81b64c] hover:bg-[#90c957] disabled:opacity-20 text-[#0f0e0c] font-black text-xs rounded-xl transition-all shadow-md"
                  >
                    Run Full Review
                  </button>
                </div>
              )}

              {/* Reviewed scorecard results */}
              {!isReviewRunning && whiteAccuracy !== null && (
                <div className="space-y-4">
                  {/* Accuracy boxes */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-[#111010] p-3 rounded-2xl border border-white/[0.04] text-center space-y-1">
                      <span className="text-[9px] text-[#7a7a6e] font-bold block uppercase">White Accuracy</span>
                      <span className="text-xl font-black text-white font-mono">{whiteAccuracy}%</span>
                    </div>
                    <div className="bg-[#111010] p-3 rounded-2xl border border-white/[0.04] text-center space-y-1">
                      <span className="text-[9px] text-[#7a7a6e] font-bold block uppercase">Black Accuracy</span>
                      <span className="text-xl font-black text-white font-mono">{blackAccuracy}%</span>
                    </div>
                  </div>

                  {/* Evaluation Area Chart */}
                  <div className="bg-[#111010] p-3 rounded-2xl border border-white/[0.04] space-y-1.5">
                    <span className="text-[10px] text-[#7a7a6e] font-black uppercase tracking-wider block">Evaluation Flow</span>
                    <div className="h-[90px] w-full mt-1 select-none">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={evalHistory.map((val, idx) => ({ name: idx, eval: val }))}
                          margin={{ top: 2, right: 2, left: -25, bottom: 2 }}
                        >
                          <defs>
                            <linearGradient id="colorEval" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#81b64c" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#81b64c" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <YAxis domain={[-5, 5]} stroke="#4a4a44" fontSize={8} tickCount={5} />
                          <Tooltip contentStyle={{ backgroundColor: "#111010", borderColor: "rgba(255,255,255,0.08)", fontSize: 10 }} />
                          <ReferenceLine y={0} stroke="#4a4a44" strokeDasharray="3 3" />
                          <Area type="monotone" dataKey="eval" stroke="#81b64c" strokeWidth={1.5} fillOpacity={1} fill="url(#colorEval)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Move tallies table */}
                  <div className="bg-[#111010] p-3.5 rounded-2xl border border-white/[0.04] text-[10px] space-y-1 max-h-[140px] overflow-y-auto">
                    <div className="flex justify-between border-b border-white/[0.03] pb-1 text-[#7a7a6e] font-black">
                      <span>MOVE RATING</span>
                      <span>W</span>
                      <span>B</span>
                    </div>
                    {[
                      { label: "Brilliant !! 🌟", key: "brilliant" as MoveClassification },
                      { label: "Best Move ⭐", key: "best" as MoveClassification },
                      { label: "Book Move 📖", key: "book" as MoveClassification },
                      { label: "Excellent ✓", key: "excellent" as MoveClassification },
                      { label: "Good 👍", key: "good" as MoveClassification },
                      { label: "Inaccuracy ❓", key: "inaccuracy" as MoveClassification },
                      { label: "Mistake ❌", key: "mistake" as MoveClassification },
                      { label: "Blunder 🛑", key: "blunder" as MoveClassification }
                    ].map((row) => (
                      <div key={row.key} className="flex justify-between py-0.5 border-b border-white/[0.01]">
                        <span className="font-semibold text-white">{row.label}</span>
                        <span className="font-mono text-emerald-400 font-bold">{counts.white[row.key]}</span>
                        <span className="font-mono text-emerald-400 font-bold">{counts.black[row.key]}</span>
                      </div>
                    ))}
                  </div>

                  {/* Reviewed moves scroll selector */}
                  <div className="space-y-1.5 mt-2">
                    <span className="text-[10px] text-[#7a7a6e] font-black uppercase tracking-wider block">Reviewed Moves list</span>
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {analyzedMoves.map((m, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            const tempChess = new Chess(m.fenAfter);
                            setGame(tempChess);
                            setHistory(history.slice(0, idx + 1));
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-xl bg-[#111010] border border-white/[0.03] hover:border-white/[0.08] text-left transition-all"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[9px] text-[#7a7a6e]">
                              {Math.floor(idx / 2) + 1}.{m.color === "w" ? "" : ".."}
                            </span>
                            <span className="font-bold text-xs text-white">{m.san}</span>
                          </div>
                          <span className={`text-[8px] font-black uppercase border rounded px-1.5 py-0.5 ${
                            m.classification === "brilliant" ? "text-[#3b82f6] border-[#3b82f6]/20 bg-[#3b82f6]/5" :
                            m.classification === "best" ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/5" :
                            m.classification === "book" ? "text-amber-500 border-amber-500/20 bg-amber-500/5" :
                            m.classification === "blunder" ? "text-red-400 border-red-400/20 bg-red-400/5" :
                            "text-gray-400 border-white/[0.05]"
                          }`}>
                            {m.classification}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: IMPORT PGN FORM */}
          {activeTab === "pgn" && (
            <div className="space-y-4">
              <div className="bg-[#111010] p-4 rounded-2xl border border-white/[0.04] space-y-3">
                <span className="text-[10px] text-[#7a7a6e] font-black uppercase tracking-wider block">Import PGN</span>
                <textarea
                  placeholder="Paste raw PGN moves here... e.g. 1. e4 e5 2. Nf3 Nc6..."
                  value={pgnInput}
                  onChange={(e) => setPgnInput(e.target.value)}
                  className="w-full h-28 bg-[#161412] border border-white/[0.06] hover:border-white/[0.1] focus:border-[#81b64c]/50 rounded-xl p-2.5 text-xs text-[#a0a09a] focus:text-white placeholder-[#4a4a44] transition-all resize-none outline-none focus:ring-1 focus:ring-[#81b64c]/20"
                />
                <button
                  onClick={handleLoadPgn}
                  className="w-full py-2.5 bg-[#81b64c] hover:bg-[#90c957] text-[#0f0e0c] font-black text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  Load Game
                </button>
              </div>

              {history.length > 0 && (
                <button
                  onClick={triggerFullReview}
                  className="w-full py-3 bg-[#3b82f6]/20 border border-[#3b82f6]/30 hover:bg-[#3b82f6]/30 text-blue-400 font-black text-xs rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="h-4 w-4" /> Run Full Review on Loaded PGN
                </button>
              )}
            </div>
          )}

        </div>

      </aside>

    </main>
  );
}

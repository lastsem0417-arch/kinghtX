"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Chess } from "chess.js";
import axios from "axios";
import { ArrowLeft, Award, Sparkles, RefreshCw, BarChart2, CheckCircle2, AlertTriangle, XCircle, BookOpen, Star, HelpCircle, GraduationCap } from "lucide-react";
import BoardSection from "@/components/chess/BoardSection";
import PlayerCard from "@/components/chess/PlayerCard";
import LeftNavbar from "@/components/chess/LeftNavbar";

interface ReviewPlayer {
  username: string;
  rating: number;
}

interface ReviewGame {
  _id: string;
  players: {
    white: ReviewPlayer;
    black: ReviewPlayer;
  };
  pgn: string;
  fen: string;
  result?: "white" | "black" | "draw";
  termination?: string;
  timeControl: string;
}

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

// Helper to calculate captured pieces and material delta
function getCapturedStats(game: Chess) {
  const currentCounts = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };

  const board = game.board();
  for (const row of board) {
    for (const piece of row) {
      if (piece) {
        const color = piece.color as "w" | "b";
        const type = piece.type as keyof typeof currentCounts.w;
        currentCounts[color][type]++;
      }
    }
  }

  const starting = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  
  const capturedBlack: string[] = [];
  for (const key in starting) {
    const type = key as keyof typeof starting;
    const diff = starting[type] - currentCounts.b[type];
    for (let i = 0; i < diff; i++) {
      capturedBlack.push(type);
    }
  }

  const capturedWhite: string[] = [];
  for (const key in starting) {
    const type = key as keyof typeof starting;
    const diff = starting[type] - currentCounts.w[type];
    for (let i = 0; i < diff; i++) {
      capturedWhite.push(type);
    }
  }

  const values = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const whiteScore = Object.entries(currentCounts.w).reduce((acc, [type, count]) => acc + count * (values[type as keyof typeof values] || 0), 0);
  const blackScore = Object.entries(currentCounts.b).reduce((acc, [type, count]) => acc + count * (values[type as keyof typeof values] || 0), 0);

  const whiteAdvantage = whiteScore > blackScore ? whiteScore - blackScore : 0;
  const blackAdvantage = blackScore > whiteScore ? blackScore - whiteScore : 0;

  return {
    capturedWhite,
    capturedBlack,
    whiteAdvantage,
    blackAdvantage,
  };
}

// Procedural coach feedback generator based on move ratings
function getCoachCommentary(move: AnalyzedMove) {
  const pieceName = move.san.includes("Q") ? "Queen" : move.san.includes("R") ? "Rook" : move.san.includes("B") ? "Bishop" : move.san.includes("N") ? "Knight" : "Pawn";
  
  switch (move.classification) {
    case "brilliant":
      return `Wow! A brilliant sacrifice of your ${pieceName}. This tactic opens up a strong attack against your opponent's position!`;
    case "great":
      return `This is a great move! You developed your ${pieceName} and found a critical threat that puts pressure on your opponent.`;
    case "best":
      return `Excellent choice! This was the best move in this position, improving your piece coordination and control of the board.`;
    case "excellent":
      return `A very strong move that maintains your position's balance and keeps up active pressure.`;
    case "good":
      return `A solid move. It defends key squares and helps consolidate your structure.`;
    case "book":
      return `This is standard opening theory. You are following well-known path lines to establish your presence.`;
    case "inaccuracy":
      return `A slight inaccuracy. Developing a different piece or contesting the center might have been more active. Stockfish preferred ${move.bestMove || "another line"}.`;
    case "mistake":
      return `A mistake that hands over some initiative to the opponent. Better was ${move.bestMove || "a different approach"} to keep the balance.`;
    case "blunder":
      return `Oh no! This is a blunder. You dropped material or missed a critical threat. The engine suggests ${move.bestMove || "another continuation"} instead.`;
    default:
      return `Let's keep examining the board.`;
  }
}

export default function GameReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [gameData, setGameData] = useState<ReviewGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Analysis results
  const [analyzedMoves, setAnalyzedMoves] = useState<AnalyzedMove[]>([]);
  const [whiteAccuracy, setWhiteAccuracy] = useState(0);
  const [blackAccuracy, setBlackAccuracy] = useState(0);
  const [counts, setCounts] = useState<{
    white: Record<MoveClassification, number>;
    black: Record<MoveClassification, number>;
  }>({
    white: { brilliant: 0, great: 0, best: 0, excellent: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
    black: { brilliant: 0, great: 0, best: 0, excellent: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, blunder: 0 }
  });

  // Replay state
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");

  // Stockfish worker reference
  const workerRef = useRef<Worker | null>(null);

  // Load game record from DB
  useEffect(() => {
    async function loadGame() {
      try {
        setLoading(true);
        const res = await axios.get(`/api/users/me`);
        if (res.data?.user) {
          setCurrentUser(res.data.user);
        }

        const gameDetails = await fetchGameDetails(id);
        if (gameDetails) {
          setGameData(gameDetails);
          startAnalysis(gameDetails);
        } else {
          router.push("/dashboard");
        }
      } catch (err) {
        console.error("Failed to load game details:", err);
        router.push("/dashboard");
      }
    }
    loadGame();

    return () => {
      workerRef.current?.terminate();
    };
  }, [id]);

  const fetchGameDetails = async (gameId: string) => {
    try {
      const res = await axios.get(`/api/users/me`);
      if (res.data?.user) {
        const gameRes = await axios.get(`/api/games/${gameId}`);
        return gameRes.data?.game as ReviewGame;
      }
    } catch {
      return null;
    }
    return null;
  };

  // Start sequential engine analysis
  const startAnalysis = async (game: ReviewGame) => {
    setAnalyzing(true);
    setProgress(0);

    const chess = new Chess();
    try {
      chess.loadPgn(game.pgn);
    } catch (e) {
      console.error("Error loading PGN in review page startAnalysis:", game.pgn, e);
    }
    const historyList = chess.history({ verbose: true });
    const totalMovesCount = historyList.length;

    if (totalMovesCount === 0) {
      setAnalyzing(false);
      setLoading(false);
      return;
    }

    const positions: { fenBefore: string; fenAfter: string; san: string; color: "w" | "b" }[] = [];
    const startingFen = chess.header().FEN || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const isCustomFen = startingFen !== "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const tempChess = new Chess(startingFen);
    
    for (let i = 0; i < totalMovesCount; i++) {
      const fenBefore = tempChess.fen();
      const move = historyList[i];
      try {
        tempChess.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion || undefined
        });
      } catch (e) {
        console.error("Error applying move in review page:", move, e);
      }
      const fenAfter = tempChess.fen();
      positions.push({
        fenBefore,
        fenAfter,
        san: move.san,
        color: move.color
      });
    }

    const worker = new Worker("/stockfish-worker.js");
    workerRef.current = worker;
    
    worker.onerror = (err) => {
      console.error("Stockfish worker error in review page:", err);
    };

    // Wait for Stockfish to be ready
    await new Promise<void>((resolveReady) => {
      const handleInit = (e: MessageEvent) => {
        if (e.data === "readyok") {
          worker.removeEventListener("message", handleInit);
          resolveReady();
        }
      };
      worker.addEventListener("message", handleInit);
      worker.postMessage("uci");
      worker.postMessage("isready");
    });

    const analyzed: AnalyzedMove[] = [];
    
    const evaluateFen = (fen: string): Promise<{ score: number; bestMove: string }> => {
      try {
        const temp = new Chess(fen);
        if (temp.isGameOver()) {
          let score = 0.0;
          if (temp.isCheckmate()) {
            const activeTurn = temp.turn();
            score = activeTurn === "w" ? -10.0 : 10.0;
          }
          return Promise.resolve({ score, bestMove: "(none)" });
        }
      } catch (e) {
        console.error("Error checking game over FEN:", e);
      }

      return new Promise((resolve) => {
        let currentScore = 0.35;
        let bestMove = "";
        let resolved = false;

        const timeout = setTimeout(() => {
          if (!resolved) {
            console.warn("[Review Engine] Timeout waiting for FEN:", fen, "Sending stop...");
            worker.postMessage("stop");
            resolved = true;
            worker.removeEventListener("message", handleMsg);
            resolve({ score: currentScore, bestMove: bestMove || "(none)" });
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

    for (let i = 0; i < totalMovesCount; i++) {
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

      setProgress(Math.round(((i + 1) / totalMovesCount) * 100));
    }

    computeMetrics(analyzed);
    setAnalyzing(false);
    setLoading(false);
    setCurrentMoveIndex(totalMovesCount - 1);
  };

  // Move classifier logic
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

  const getCurrentFen = () => {
    if (currentMoveIndex === -1) {
      return analyzedMoves[0]?.fenBefore || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    }
    return analyzedMoves[currentMoveIndex]?.fenAfter || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  };

  const getBadgeEmoji = (cls: MoveClassification) => {
    switch (cls) {
      case "brilliant": return "!! 🌟";
      case "great": return "! ✨";
      case "best": return "⭐";
      case "book": return "📖";
      case "excellent": return "✓";
      case "good": return "👍";
      case "inaccuracy": return "❓";
      case "mistake": return "❌";
      case "blunder": return "⁉️ 🛑";
    }
  };

  const getBadgeColor = (cls: MoveClassification) => {
    switch (cls) {
      case "brilliant": return "text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20";
      case "great": return "text-cyan-400 bg-cyan-400/10 border-cyan-400/20";
      case "best": return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
      case "book": return "text-amber-500 bg-amber-500/10 border-amber-500/20";
      case "excellent": return "text-green-400 bg-green-400/10 border-green-400/20";
      case "good": return "text-teal-400 bg-teal-400/10 border-teal-400/20";
      case "inaccuracy": return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
      case "mistake": return "text-orange-400 bg-orange-400/10 border-orange-400/20";
      case "blunder": return "text-red-400 bg-red-400/10 border-red-400/20";
    }
  };

  const handlePrev = () => setCurrentMoveIndex((p) => Math.max(-1, p - 1));
  const handleNext = () => setCurrentMoveIndex((p) => Math.min(analyzedMoves.length - 1, p + 1));
  const handleFirst = () => setCurrentMoveIndex(-1);
  const handleLast = () => setCurrentMoveIndex(analyzedMoves.length - 1);
  const handleFlip = () => setBoardOrientation((p) => (p === "white" ? "black" : "white"));

  // Calculate captured pieces stats on the active board step
  const activeChess = new Chess(getCurrentFen());
  const stats = getCapturedStats(activeChess);

  const selectedMove = currentMoveIndex !== -1 ? analyzedMoves[currentMoveIndex] : null;
  const coachCommentary = selectedMove 
    ? getCoachCommentary(selectedMove) 
    : "Select any move from the list below. I will analyze the move quality and offer coach tactical remarks here.";

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#161412] text-white flex flex-col md:flex-row relative">
      
      {/* ─── SIDE NAVIGATION BAR ─── */}
      <LeftNavbar activeUser={currentUser} />

      {/* ─── LOADING & ANALYSIS PROGRESS MODAL ─── */}
      {(loading || analyzing) && (
        <div className="absolute inset-0 bg-[#161412] z-50 flex flex-col items-center justify-center gap-6">
          <div className="bg-[#1a1917] p-8 rounded-3xl border border-white/[0.08] shadow-2xl max-w-md w-full text-center space-y-6">
            <RefreshCw className="h-10 w-10 text-[#81b64c] animate-spin mx-auto" />
            <div className="space-y-2">
              <h3 className="text-lg font-black tracking-tight text-white flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5 text-[#81b64c]" /> Running Game Review...
              </h3>
              <p className="text-xs text-[#a0a09a] leading-relaxed">
                Stockfish is analyzing each position of this game at depth 8. Computing move categorizations, accuracy scoring, and blunder reviews.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-[#7a7a6e] font-mono">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-3 w-full bg-[#111010] rounded-full overflow-hidden border border-white/[0.03]">
                <div className="h-full bg-[#81b64c] transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MAIN ARENA (Board Column) ─── */}
      {gameData && (
        <div className="flex-grow min-w-0 flex flex-col min-h-0 py-2">
          {/* Header toolbar */}
          <div className="px-4 py-1.5 flex items-center justify-between shrink-0 mb-1 border-b border-white/[0.04] pb-2">
            <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs text-[#7a7a6e] hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to Replay
            </button>
            <div className="flex items-center gap-1.5 bg-[#1a1917] border border-[#81b64c]/20 px-3 py-1 rounded-xl">
              <Sparkles className="h-4 w-4 text-[#81b64c] animate-pulse" />
              <span className="text-xs font-black text-white">Full Move Analyzer Active</span>
            </div>
          </div>

          {/* Top Player Card (Black) */}
          <div className="shrink-0 px-4 mb-1">
            <PlayerCard
              name={boardOrientation === "white" ? gameData.players.black.username : gameData.players.white.username}
              rating={boardOrientation === "white" ? gameData.players.black.rating : gameData.players.white.rating}
              time="Engine Checked"
              active={false}
              side="top"
              username={boardOrientation === "white" ? gameData.players.black.username : gameData.players.white.username}
              capturedPieces={boardOrientation === "white" ? stats.capturedWhite : stats.capturedBlack}
              capturedColor={boardOrientation === "white" ? "w" : "b"}
              materialAdvantage={boardOrientation === "white" ? stats.blackAdvantage : stats.whiteAdvantage}
            />
          </div>

          {/* Chessboard Section */}
          <div className="flex-grow min-h-0 min-w-0 overflow-hidden px-4 py-1">
            <BoardSection
              position={getCurrentFen()}
              onDrop={() => false} // Read-only
              onSquareClick={() => {}}
              customSquareStyles={{}}
              boardOrientation={boardOrientation}
            />
          </div>

          {/* Bottom Player Card (White) */}
          <div className="shrink-0 px-4 mt-1">
            <PlayerCard
              name={boardOrientation === "white" ? gameData.players.white.username : gameData.players.black.username}
              rating={boardOrientation === "white" ? gameData.players.white.rating : gameData.players.black.rating}
              time="Engine Checked"
              active={false}
              side="bottom"
              username={boardOrientation === "white" ? gameData.players.white.username : gameData.players.black.username}
              capturedPieces={boardOrientation === "white" ? stats.capturedBlack : stats.capturedWhite}
              capturedColor={boardOrientation === "white" ? "b" : "w"}
              materialAdvantage={boardOrientation === "white" ? stats.whiteAdvantage : stats.blackAdvantage}
            />
          </div>

          {/* Navigation Controls */}
          <div className="flex justify-center items-center gap-2 mt-2 shrink-0 bg-[#1a1917]/50 border border-white/[0.04] py-2 px-4 rounded-2xl max-w-sm mx-auto w-full">
            <button onClick={handleFirst} disabled={currentMoveIndex === -1} className="p-2 bg-[#272522] rounded-lg text-[#7a7a6e] hover:text-white disabled:opacity-20 transition-all">
              ⏪
            </button>
            <button onClick={handlePrev} disabled={currentMoveIndex === -1} className="p-2 bg-[#272522] rounded-lg text-[#7a7a6e] hover:text-white disabled:opacity-20 transition-all">
              ⬅️
            </button>
            <button onClick={handleFlip} className="text-xs font-bold text-[#7a7a6e] hover:text-white px-3 py-2 bg-[#272522] rounded-lg transition-all">
              Flip
            </button>
            <button onClick={handleNext} disabled={currentMoveIndex === analyzedMoves.length - 1} className="p-2 bg-[#272522] rounded-lg text-[#7a7a6e] hover:text-white disabled:opacity-20 transition-all">
              ➡️
            </button>
            <button onClick={handleLast} disabled={currentMoveIndex === analyzedMoves.length - 1} className="p-2 bg-[#272522] rounded-lg text-[#7a7a6e] hover:text-white disabled:opacity-20 transition-all">
              ⏩
            </button>
          </div>
        </div>
      )}

      {/* ─── SIDEBAR: SCORECARD & MOVES CATEGORIZATION ─── */}
      {gameData && !analyzing && (
        <aside className="h-full flex flex-col overflow-hidden bg-[#1a1917] border-l border-white/[0.07]" style={{ width: "320px", minWidth: "320px", maxWidth: "320px" }}>
          
          {/* Dynamic Coach explanation container */}
          <div className="shrink-0 p-4 border-b border-white/[0.06] bg-[#161412] space-y-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-[#81b64c]" />
              <span className="text-[10px] text-[#7a7a6e] font-black uppercase tracking-wider block">Game Review Coach</span>
            </div>

            <div className="bg-[#111010] p-4 rounded-2xl border border-white/[0.04] flex gap-3">
              <div className="h-10 w-10 rounded-full bg-[#81b64c]/20 border border-[#81b64c]/30 flex items-center justify-center shrink-0 text-lg">
                🎓
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-[#81b64c] font-black uppercase tracking-wider block">Coach Sofia</span>
                <p className="text-xs text-[#a0a09a] leading-relaxed">
                  {coachCommentary}
                </p>
              </div>
            </div>
          </div>

          {/* Accuracy Scorecard Dashboard */}
          <div className="shrink-0 p-4 border-b border-white/[0.06] bg-[#161412] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#7a7a6e] font-black uppercase tracking-wider block">Accuracy Report</span>
              <BarChart2 className="h-4.5 w-4.5 text-[#81b64c]" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#111010] p-3 rounded-2xl border border-white/[0.04] text-center space-y-1">
                <span className="text-[9px] text-[#7a7a6e] font-bold block uppercase">White accuracy</span>
                <span className="text-2xl font-black text-white font-mono">{whiteAccuracy}%</span>
                <span className="text-[9px] text-[#81b64c] block font-bold leading-none">{gameData.players.white.username}</span>
              </div>
              <div className="bg-[#111010] p-3 rounded-2xl border border-white/[0.04] text-center space-y-1">
                <span className="text-[9px] text-[#7a7a6e] font-bold block uppercase">Black accuracy</span>
                <span className="text-2xl font-black text-white font-mono">{blackAccuracy}%</span>
                <span className="text-[9px] text-[#81b64c] block font-bold leading-none">{gameData.players.black.username}</span>
              </div>
            </div>

            {/* Categories comparison list */}
            <div className="bg-[#111010] p-3 rounded-2xl border border-white/[0.04] text-[10px] space-y-1 max-h-[120px] overflow-y-auto">
              <div className="flex justify-between border-b border-white/[0.02] pb-1 text-[#7a7a6e] font-bold">
                <span>Move Rating</span>
                <span>W</span>
                <span>B</span>
              </div>
              {[
                { label: "Book Move 📖", key: "book" as MoveClassification },
                { label: "Brilliant !! 🌟", key: "brilliant" as MoveClassification },
                { label: "Best Move ⭐", key: "best" as MoveClassification },
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
          </div>

          {/* Moves classification scroll viewport */}
          <div className="flex-grow overflow-y-auto bg-[#1e1c1a] p-4">
            <span className="text-[10px] text-[#7a7a6e] font-black uppercase tracking-wider block mb-3.5">Review Analysis List</span>
            
            <div className="space-y-3">
              {analyzedMoves.map((move, idx) => {
                const badgeText = getBadgeEmoji(move.classification);
                const badgeColor = getBadgeColor(move.classification);

                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentMoveIndex(idx)}
                    className={`
                      w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left
                      ${currentMoveIndex === idx 
                        ? "bg-[#81b64c]/10 border-[#81b64c]/30 text-white" 
                        : "bg-[#161412] border-white/[0.04] text-[#a0a09a] hover:border-white/[0.08]"}
                    `}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-[#7a7a6e]">
                          {Math.floor(idx / 2) + 1}.{move.color === "w" ? "" : ".."}
                        </span>
                        <span className="font-bold text-sm text-white">{move.san}</span>
                      </div>
                      <span className="text-[9px] text-[#7a7a6e] font-medium font-mono leading-none block">
                        Eval: {move.scoreAfter.toFixed(2)}
                      </span>
                    </div>

                    <span className={`text-[10px] font-black uppercase tracking-wider border rounded-lg px-2.5 py-1 ${badgeColor}`}>
                      {badgeText}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </aside>
      )}

    </main>
  );
}

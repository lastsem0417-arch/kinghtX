"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import BoardSection from "./BoardSection";
import PlayerCard from "./PlayerCard";
import MoveHistory from "./MoveHistory";
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  RotateCcw, 
  ArrowLeft, 
  Copy, 
  List, 
  Award 
} from "lucide-react";

interface ReplayPlayer {
  username: string;
  rating: number;
  ratingChange: number;
}

interface ReplayGame {
  _id: string;
  players: {
    white: ReplayPlayer;
    black: ReplayPlayer;
  };
  pgn: string;
  fen: string;
  result?: "white" | "black" | "draw";
  termination?: string;
  timeControl: string;
  timeControlCategory: string;
  roomId: string;
  createdAt: string;
}

interface GameReplayProps {
  game: ReplayGame;
}

export default function GameReplay({ game }: GameReplayProps) {
  const router = useRouter();

  // Load chess moves from PGN
  const chessRef = useRef(new Chess());
  const [moves, setMoves] = useState<any[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const chess = new Chess();
      chess.loadPgn(game.pgn);
      setMoves(chess.history({ verbose: true }));
      // Set to final position by default
      setCurrentMoveIndex(chess.history().length - 1);
    } catch (e) {
      console.error("Error parsing PGN:", e);
    }
  }, [game.pgn]);

  // Compute current FEN based on move index
  const getCurrentFen = () => {
    const initialChess = new Chess();
    let startingFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    try {
      initialChess.loadPgn(game.pgn);
      startingFen = initialChess.header().FEN || startingFen;
    } catch {}

    if (currentMoveIndex === -1) {
      return startingFen;
    }
    const tempChess = new Chess(startingFen);
    for (let i = 0; i <= currentMoveIndex; i++) {
      if (moves[i]) {
        try {
          tempChess.move({
            from: moves[i].from,
            to: moves[i].to,
            promotion: moves[i].promotion || undefined
          });
        } catch (e) {
          console.error("Error applying move in getCurrentFen:", moves[i], e);
        }
      }
    }
    return tempChess.fen();
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moves, currentMoveIndex]);

  const handleFirst = () => setCurrentMoveIndex(-1);
  const handlePrev = () => setCurrentMoveIndex(prev => Math.max(-1, prev - 1));
  const handleNext = () => setCurrentMoveIndex(prev => Math.min(moves.length - 1, prev + 1));
  const handleLast = () => setCurrentMoveIndex(moves.length - 1);
  
  const handleFlip = () => {
    setBoardOrientation(prev => prev === "white" ? "black" : "white");
  };

  const handleCopyPGN = () => {
    navigator.clipboard.writeText(game.pgn);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract pure move notation strings (e.g. ["e4", "e5", "Nf3"])
  const getSanHistory = () => {
    return moves.map(m => m.san);
  };

  const currentFen = getCurrentFen();
  const formatRatingChange = (val: number) => {
    if (val === 0) return "";
    return val > 0 ? `+${val}` : `${val}`;
  };

  // Render variables
  const isWhiteOrientation = boardOrientation === "white";
  const bottomPlayer = isWhiteOrientation ? game.players.white : game.players.black;
  const topPlayer = isWhiteOrientation ? game.players.black : game.players.white;
  
  const bottomChange = isWhiteOrientation ? game.players.white.ratingChange : game.players.black.ratingChange;
  const topChange = isWhiteOrientation ? game.players.black.ratingChange : game.players.white.ratingChange;

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#161412] text-white flex flex-col md:flex-row">
      
      {/* ─── LEFT SIDEBAR NAVIGATION (Chess.com style) ─── */}
      <aside
        className="flex-shrink-0 flex flex-col overflow-hidden bg-[#161412] border-r border-white/[0.06] hidden md:flex"
        style={{ width: "60px" }}
      >
        <div className="flex items-center justify-center h-[52px] border-b border-white/[0.06] shrink-0">
          <span className="text-[#81b64c] text-[22px]">♞</span>
        </div>
        <nav className="flex-1 flex flex-col items-center gap-0.5 py-2 overflow-hidden">
          {[
            { label: "Back", icon: "⬅", action: () => router.back() },
            { label: "Play", icon: "♟", action: () => router.push("/play") },
            { label: "Puzzles", icon: "🧩", action: () => router.push("/puzzles") },
          ].map((item) => (
            <button
              key={item.label}
              title={item.label}
              onClick={item.action}
              className="
                w-11 h-11 flex flex-col items-center justify-center gap-0.5
                rounded-lg text-[#7a7a6e] hover:text-white hover:bg-[#272522]
                transition-all duration-150 group
              "
            >
              <span className="text-[18px] leading-none">{item.icon}</span>
              <span className="text-[8px] font-bold tracking-wide opacity-0 group-hover:opacity-100 transition-opacity leading-none">
                {item.label}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      {/* ─── CENTER ARENA (Replay board) ─── */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden bg-[#161412] py-2">
        {/* Back Link on Mobile */}
        <div className="md:hidden px-4 py-2 flex items-center">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-[#7a7a6e] hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>

        {/* Top Player Card */}
        <div className="shrink-0 px-4">
          <PlayerCard
            name={`${topPlayer.username} (${topPlayer.rating})`}
            rating={topRatingChangeColor(topChange)}
            time={formatRatingChange(topChange)}
            active={false}
            side="top"
          />
        </div>

        {/* Board Section */}
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden px-4 py-1.5">
          <BoardSection
            position={currentFen}
            onDrop={() => false} // Read-only board
            onSquareClick={() => {}}
            customSquareStyles={{}}
            boardOrientation={boardOrientation}
          />
        </div>

        {/* Bottom Player Card */}
        <div className="shrink-0 px-4">
          <PlayerCard
            name={`${bottomPlayer.username} (${bottomPlayer.rating})`}
            rating={topRatingChangeColor(bottomChange)}
            time={formatRatingChange(bottomChange)}
            active={false}
            side="bottom"
          />
        </div>

      </div>

      {/* ─── RIGHT PANEL: Move Log & Navigation Controls ─── */}
      <aside className="h-full flex flex-col overflow-hidden bg-[#1a1917] border-l border-white/[0.07]" style={{ width: "300px", minWidth: "300px", maxWidth: "300px" }}>
        
        {/* Match Header Info */}
        <div className="shrink-0 px-4 py-4 border-b border-white/[0.06] bg-[#161412]">
          <div className="text-[10px] text-[#81b64c] font-black uppercase tracking-wider mb-1 flex items-center gap-1">
            <Award className="h-3.5 w-3.5" />
            Game Over Summary
          </div>
          <div className="text-sm font-bold text-white leading-snug">
            {game.result === "draw" 
              ? "Match Drawn"
              : game.result === "white" 
              ? `${game.players.white.username} won`
              : `${game.players.black.username} won`}
          </div>
          <div className="text-[10px] text-[#7a7a6e] mt-1 font-mono">
            {game.termination} • {game.timeControl}
          </div>
        </div>

        {/* Move log tab */}
        <div className="shrink-0 flex items-center gap-1.5 px-4 py-2 border-b border-white/[0.05] bg-[#211f1d] text-[11px] text-[#a0a09a] font-semibold">
          <List className="h-3.5 w-3.5 text-[#81b64c]" />
          <span>Move History</span>
          <span className="ml-auto text-[10px] text-[#5e5b57] font-mono">
            {currentMoveIndex + 1} / {moves.length}
          </span>
        </div>

        {/* Move History scroll viewport */}
        <div 
          className="flex-grow overflow-y-auto"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#3a3733 transparent" }}
        >
          {/* Custom Move History table to support click navigability */}
          {moves.length === 0 ? (
            <div className="text-[#6e6a66] text-[12px] px-3 py-6 text-center">
              No moves recorded.
            </div>
          ) : (
            <table className="w-full border-collapse">
              <tbody>
                {Array.from({
                  length: Math.ceil(moves.length / 2),
                }).map((_, index) => {
                  const whiteMoveIdx = index * 2;
                  const blackMoveIdx = index * 2 + 1;
                  
                  const whiteMove = moves[whiteMoveIdx];
                  const blackMove = moves[blackMoveIdx];
                  
                  const isWhiteActive = currentMoveIndex === whiteMoveIdx;
                  const isBlackActive = currentMoveIndex === blackMoveIdx;

                  return (
                    <tr
                      key={index}
                      className="border-b border-white/[0.03] hover:bg-white/[0.01]"
                    >
                      <td className="w-[36px] text-right pr-2 py-[6px] pl-3 text-[12px] font-semibold text-[#5e5b57] select-none">
                        {index + 1}
                      </td>

                      {/* White move column */}
                      <td className="py-[6px] px-2 w-1/2">
                        {whiteMove && (
                          <button
                            onClick={() => setCurrentMoveIndex(whiteMoveIdx)}
                            className={`text-left text-[13px] font-semibold px-2 py-0.5 rounded transition-all w-full ${
                              isWhiteActive 
                                ? "bg-[#81b64c] text-[#0f0e0c]" 
                                : "text-[#e8e6d9] hover:bg-[#272522] hover:text-white"
                            }`}
                          >
                            {whiteMove.san}
                          </button>
                        )}
                      </td>

                      {/* Black move column */}
                      <td className="py-[6px] px-2 w-1/2">
                        {blackMove && (
                          <button
                            onClick={() => setCurrentMoveIndex(blackMoveIdx)}
                            className={`text-left text-[13px] font-semibold px-2 py-0.5 rounded transition-all w-full ${
                              isBlackActive 
                                ? "bg-[#81b64c] text-[#0f0e0c]" 
                                : "text-[#b0aea8] hover:bg-[#272522] hover:text-white"
                            }`}
                          >
                            {blackMove.san}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ─── NAVIGATION BUTTON PANEL AT BOTTOM ─── */}
        <div className="shrink-0 border-t border-white/[0.07] bg-[#161412] p-3 space-y-2.5">
          {/* Replay Controls Row */}
          <div className="flex justify-between gap-1">
            <button
              onClick={handleFirst}
              disabled={currentMoveIndex === -1}
              className="flex-1 py-2.5 rounded-lg bg-[#272522] hover:bg-[#302e2b] text-[#7a7a6e] hover:text-white flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="First move"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handlePrev}
              disabled={currentMoveIndex === -1}
              className="flex-1 py-2.5 rounded-lg bg-[#272522] hover:bg-[#302e2b] text-[#7a7a6e] hover:text-white flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Previous move"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleNext}
              disabled={currentMoveIndex === moves.length - 1}
              className="flex-1 py-2.5 rounded-lg bg-[#272522] hover:bg-[#302e2b] text-[#7a7a6e] hover:text-white flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Next move"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={handleLast}
              disabled={currentMoveIndex === moves.length - 1}
              className="flex-1 py-2.5 rounded-lg bg-[#272522] hover:bg-[#302e2b] text-[#7a7a6e] hover:text-white flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Final position"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>

          {/* Action Row: Flip / Copy PGN */}
          <div className="flex gap-2">
            <button
              onClick={handleFlip}
              className="flex-1 py-2 rounded-lg bg-[#272522] hover:bg-[#302e2b] border border-white/[0.05] text-[#a0a09a] hover:text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Flip Board
            </button>
            <button
              onClick={handleCopyPGN}
              className="flex-1 py-2 rounded-lg bg-[#272522] hover:bg-[#302e2b] border border-white/[0.05] text-[#a0a09a] hover:text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied!" : "Copy PGN"}
            </button>
          </div>

          {/* Game Review button */}
          <button
            onClick={() => router.push(`/game/review/${game.roomId}`)}
            className="w-full py-3 rounded-lg bg-[#81b64c] hover:bg-[#90c957] text-[#0f0e0c] text-xs font-black transition-colors flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(129,182,76,0.25)]"
          >
            ✨ Run Game Review
          </button>

          {/* Back button */}
          <button
            onClick={() => router.push("/play")}
            className="w-full py-2.5 rounded-lg bg-[#81b64c]/20 hover:bg-[#81b64c]/30 text-green-400 text-xs font-black transition-colors"
          >
            Play Another Game
          </button>
        </div>

      </aside>

    </main>
  );
}

// Internal styling color selector
function topRatingChangeColor(change: number): any {
  if (change > 0) return "text-green-400";
  if (change < 0) return "text-red-400";
  return "text-[#7a7a6e]";
}
